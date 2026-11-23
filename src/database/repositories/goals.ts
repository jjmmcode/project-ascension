import type { Db, DataStatus } from '../types';
import { newId } from '../ids';
import { transaction } from '../transaction';
import { nowIso } from '@/lib/time';
import { GOAL_TYPES, goalInputSchema, type GoalInput, type GoalType } from '@/features/progression/goalSchema';

export interface Goal {
  id: string;
  goalType: GoalType;
  targetValue: number;
  unit: string;
  startDate: string;
  targetDate: string | null;
  status: 'active' | 'archived' | 'achieved';
  dataStatus: DataStatus;
  notes: string | null;
}

interface Row {
  id: string;
  goal_type: GoalType;
  target_value: number;
  unit: string;
  start_date: string;
  target_date: string | null;
  status: Goal['status'];
  data_status: DataStatus;
  notes: string | null;
}

const map = (r: Row): Goal => ({
  id: r.id,
  goalType: r.goal_type,
  targetValue: r.target_value,
  unit: r.unit,
  startDate: r.start_date,
  targetDate: r.target_date,
  status: r.status,
  dataStatus: r.data_status,
  notes: r.notes,
});

export const goalsRepo = {
  /** Archiva el objetivo activo del mismo tipo y crea el nuevo, en una sola transacción. */
  async setActive(db: Db, profileId: string, input: GoalInput): Promise<Goal> {
    const g = goalInputSchema.parse(input);
    const id = newId();
    const now = nowIso();
    await transaction(db, async (db) => {
      await db.runAsync(
        `UPDATE goals SET status = 'archived', updated_at = ? WHERE profile_id = ? AND goal_type = ? AND status = 'active'`,
        [now, profileId, g.goalType],
      );
      await db.runAsync(
        `INSERT INTO goals (id, profile_id, goal_type, target_value, unit, start_date, target_date, status,
           data_status, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
        [id, profileId, g.goalType, g.targetValue, GOAL_TYPES[g.goalType].unit, g.startDate, g.targetDate,
          g.dataStatus, g.notes, now, now],
      );
    });
    const row = await db.getFirstAsync<Row>('SELECT * FROM goals WHERE id = ?', [id]);
    return map(row!);
  },

  async listActive(db: Db, profileId: string): Promise<Partial<Record<GoalType, Goal>>> {
    const rows = await db.getAllAsync<Row>(`SELECT * FROM goals WHERE profile_id = ? AND status = 'active'`, [profileId]);
    return Object.fromEntries(rows.map((r) => [r.goal_type, map(r)]));
  },

  async history(db: Db, profileId: string, goalType: GoalType): Promise<Goal[]> {
    const rows = await db.getAllAsync<Row>(
      'SELECT * FROM goals WHERE profile_id = ? AND goal_type = ? ORDER BY created_at ASC',
      [profileId, goalType],
    );
    return rows.map(map);
  },
};
