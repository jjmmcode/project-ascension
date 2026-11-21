import type { Db } from './types';

const depth = new WeakMap<Db, number>();
let savepointSeq = 0;

/**
 * Transacción anidable. El nivel externo usa BEGIN/COMMIT (withTransactionAsync)
 * y los niveles internos usan SAVEPOINT, porque SQLite no permite BEGIN dentro de BEGIN.
 * Así un repositorio puede ser atómico por sí solo y también formar parte de un
 * caso de uso mayor (p. ej. el onboarding) sin cambiar su código.
 */
export async function transaction<T>(db: Db, task: () => Promise<T>): Promise<T> {
  const level = depth.get(db) ?? 0;
  depth.set(db, level + 1);
  try {
    if (level === 0) {
      let result!: T;
      await db.withTransactionAsync(async () => {
        result = await task();
      });
      return result;
    }
    const name = `sp_${++savepointSeq}`;
    await db.execAsync(`SAVEPOINT ${name}`);
    try {
      const result = await task();
      await db.execAsync(`RELEASE ${name}`);
      return result;
    } catch (e) {
      await db.execAsync(`ROLLBACK TO ${name}; RELEASE ${name}`);
      throw e;
    }
  } finally {
    depth.set(db, level);
  }
}
