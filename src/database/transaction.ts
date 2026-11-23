import type { Db } from './types';

/** Conexiones «dentro de una transacción»: copias ligeras de la base que la tarea recibe. */
const inside = new WeakSet<Db>();
/** Cola por base: las transacciones externas se ejecutan de a una. */
const queue = new WeakMap<Db, Promise<void>>();
let savepointSeq = 0;

/**
 * Transacción anidable y segura ante concurrencia.
 *
 * - La tarea recibe `tx`, una copia de la base marcada como «dentro de la transacción».
 *   Dentro de la tarea hay que usar ese parámetro (por eso se llama igual: `async (db) => …`).
 * - Si se llama con `tx` → es anidada y usa SAVEPOINT.
 * - Si se llama con la base normal → es externa: espera su turno en la cola y usa BEGIN/COMMIT.
 *
 * Antes, la profundidad se contaba por base y no por llamada: dos transacciones independientes
 * que corrían a la vez (p. ej. dos `refresh` al abrir una pestaña) se tomaban como anidadas;
 * la segunda abría un SAVEPOINT dentro del BEGIN de la primera y, si ésta terminaba antes,
 * el SAVEPOINT desaparecía → «no such savepoint: sp_N».
 */
export async function transaction<T>(db: Db, task: (tx: Db) => Promise<T>): Promise<T> {
  if (inside.has(db)) {
    const name = `sp_${++savepointSeq}`;
    await db.execAsync(`SAVEPOINT ${name}`);
    try {
      const result = await task(db);
      await db.execAsync(`RELEASE ${name}`);
      return result;
    } catch (e) {
      await db.execAsync(`ROLLBACK TO ${name}; RELEASE ${name}`);
      throw e;
    }
  }

  const previous = queue.get(db) ?? Promise.resolve();
  let release!: () => void;
  const mine = new Promise<void>((r) => (release = r));
  queue.set(
    db,
    previous.then(() => mine),
  );
  await previous;
  try {
    // Mismos métodos y estado que la base (prototipo), pero marcada como «dentro».
    const tx = Object.create(db) as Db;
    inside.add(tx);
    let result!: T;
    await db.withTransactionAsync(async () => {
      result = await task(tx);
    });
    return result;
  } finally {
    release();
  }
}
