import { loadStep, repRange, suggestProgression } from '@/features/training/progression';
import { restSecondsFor } from '@/features/training/rest';

const sets = (reps: number[], kg: number, assist: number | null = null) =>
  reps.map((r) => ({ repetitions: r, weightKg: assist == null ? kg : null, assistanceKg: assist }));

describe('doble progresión', () => {
  it('rangos de repeticiones', () => {
    expect(repRange('10–12')).toEqual([10, 12]);
    expect(repRange('12')).toEqual([12, 12]);
    expect(repRange('12 por pierna')).toEqual([12, 12]);
    expect(repRange('30–45 s')).toBeNull();
  });

  it('todas las series en el tope con el mismo peso → subir (5 % o el salto mínimo)', () => {
    expect(suggestProgression({ target: '12', loadMode: 'external', lastSets: sets([12, 12, 12, 12], 20), step: 2.5 })).toEqual({
      kind: 'increase', fromKg: 20, toKg: 22.5, reps: 12, field: 'weight',
    });
    expect(suggestProgression({ target: '10–12', loadMode: 'external', lastSets: sets([12, 12, 12], 100), step: 2.5 })).toMatchObject({
      kind: 'increase', toKg: 105, reps: 10,
    });
    expect(suggestProgression({ target: '15', loadMode: 'external', lastSets: sets([15, 15], 8), step: 2 })).toMatchObject({ toKg: 10 });
  });

  it('si no llegó al tope en todas → mismo peso y buscar el tope', () => {
    expect(suggestProgression({ target: '12', loadMode: 'external', lastSets: sets([12, 11, 10, 10], 20), step: 2.5 })).toEqual({
      kind: 'reps', kg: 20, goalReps: 12, field: 'weight',
    });
  });

  it('asistidas: progresar es quitar asistencia', () => {
    expect(suggestProgression({ target: '10', loadMode: 'assisted', lastSets: sets([10, 10, 10, 10], 0, 30), step: 2.5 })).toEqual({
      kind: 'increase', fromKg: 30, toKg: 25, reps: 10, field: 'assistance',
    });
  });

  it('saltos y descansos por equipamiento', () => {
    expect(loadStep(['dumbbell'], false)).toBe(2);
    expect(loadStep(['machine'], true)).toBe(5);
    expect(restSecondsFor('ek-0042')).toBe(120);
    expect(restSecondsFor('ek-0018')).toBe(90);
    expect(restSecondsFor('ek-9304')).toBe(60);
  });
});
