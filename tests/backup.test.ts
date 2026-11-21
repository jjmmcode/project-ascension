/**
 * @jest-environment node
 */
import { createTestDb } from './helpers/nodeDb';
import { migrate, profilesRepo } from '@/database';
import { workoutsRepo } from '@/database/repositories/workouts';
import { templatesRepo } from '@/database/repositories/templates';
import { ensureDefaultPlan, startFromTemplate } from '@/services/plan';
import { finishWorkout } from '@/services/workoutSession';
import { BackupError, exportBackup, parseBackup, restoreBackup } from '@/services/backup';
import { totalXp } from '@/services/xp';

async function seeded() {
  const db = createTestDb();
  await migrate(db);
  const profileId = (await profilesRepo.create(db, { displayName: 'Prueba', heightCm: 175 })).id;
  await ensureDefaultPlan(db, profileId);
  const t = (await templatesRepo.list(db, profileId))[0]!;
  const w = await startFromTemplate(db, profileId, t.id);
  for (const s of (await workoutsRepo.listSets(db, w.id)).slice(0, 4)) {
    await workoutsRepo.updateSet(db, s.id, { repetitions: 10, weightKg: 40, completed: true });
  }
  await finishWorkout(db, w.id);
  return { db, profileId };
}

describe('copia de seguridad', () => {
  it('exporta y restaura todo en otra base (ida y vuelta)', async () => {
    const a = await seeded();
    const backup = await exportBackup(a.db);
    const text = JSON.stringify(backup);
    const { summary } = parseBackup(text);
    expect(summary).toMatchObject({ workouts: 1, sets: 20, xpEvents: 1 });

    const b = createTestDb();
    await migrate(b);
    await profilesRepo.create(b, { displayName: 'Otro', heightCm: 160 }); // se reemplaza
    await restoreBackup(b, parseBackup(text).backup);
    expect((await profilesRepo.getById(b, a.profileId))?.displayName).toBe('Prueba');
    expect(await totalXp(b, a.profileId)).toBe(100);
    expect(await exportBackup(b, new Date(backup.exportedAt))).toEqual(backup);
    a.db.close();
    b.close();
  });

  it('rechaza archivos que no son copias o de versiones más nuevas, sin tocar la base', async () => {
    expect(() => parseBackup('hola')).toThrow(BackupError);
    expect(() => parseBackup(JSON.stringify({ app: 'otra' }))).toThrow(/no es una copia/);
    const a = await seeded();
    const backup = await exportBackup(a.db);
    expect(() => parseBackup(JSON.stringify({ ...backup, schemaVersion: 999 }))).toThrow(/más nueva/);
    a.db.close();
  });

  it('si una fila es inválida, la restauración no cambia nada', async () => {
    const a = await seeded();
    const backup = await exportBackup(a.db);
    const broken = { ...backup, tables: { ...backup.tables, workout_sets: [{ id: 'x', workout_id: 'no-existe', exercise_id: 'nada', set_number: 1 }] } };
    await expect(restoreBackup(a.db, broken)).rejects.toThrow();
    expect(await totalXp(a.db, a.profileId)).toBe(100);
    a.db.close();
  });
});
