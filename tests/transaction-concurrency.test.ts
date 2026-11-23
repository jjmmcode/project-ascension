/**
 * @jest-environment node
 */
import { createTestDb } from './helpers/nodeDb';
import { transaction } from '@/database/transaction';

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('transacciones concurrentes', () => {
  it('dos transacciones independientes a la vez no se mezclan (bug «no such savepoint»)', async () => {
    const db = createTestDb();
    await db.execAsync('CREATE TABLE t (v INTEGER)');
    const run = (v: number) =>
      transaction(db, async (db) => {
        await tick();
        await transaction(db, async (db) => {
          await db.runAsync('INSERT INTO t (v) VALUES (?)', [v]);
          await tick();
        });
        await tick();
      });
    await Promise.all([run(1), run(2), run(3)]);
    const rows = await db.getAllAsync<{ v: number }>('SELECT v FROM t ORDER BY v', []);
    expect(rows.map((r) => r.v)).toEqual([1, 2, 3]);
    db.close();
  });

  it('un error dentro de una transacción no deshace la otra que corre a la vez', async () => {
    const db = createTestDb();
    await db.execAsync('CREATE TABLE t (v INTEGER)');
    const ok = transaction(db, async (db) => {
      await tick();
      await db.runAsync('INSERT INTO t (v) VALUES (1)', []);
    });
    const bad = transaction(db, async (db) => {
      await db.runAsync('INSERT INTO t (v) VALUES (2)', []);
      await tick();
      throw new Error('falla');
    }).catch(() => 'fallo');
    await Promise.all([ok, bad]);
    const rows = await db.getAllAsync<{ v: number }>('SELECT v FROM t', []);
    expect(rows.map((r) => r.v)).toEqual([1]);
    db.close();
  });

  it('la transacción anidada que falla se deshace sin tumbar la externa', async () => {
    const db = createTestDb();
    await db.execAsync('CREATE TABLE t (v INTEGER)');
    await transaction(db, async (db) => {
      await db.runAsync('INSERT INTO t (v) VALUES (1)', []);
      await transaction(db, async (db) => {
        await db.runAsync('INSERT INTO t (v) VALUES (2)', []);
        throw new Error('x');
      }).catch(() => undefined);
    });
    const rows = await db.getAllAsync<{ v: number }>('SELECT v FROM t', []);
    expect(rows.map((r) => r.v)).toEqual([1]);
    db.close();
  });
});
