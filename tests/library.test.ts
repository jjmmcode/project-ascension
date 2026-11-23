/**
 * @jest-environment node
 */
import { EVERKINETIC } from '@/features/exercises/library/everkinetic.data';
import { EK_IMAGES } from '@/features/exercises/library/everkinetic.images';
import { ES } from '@/features/exercises/library/es';
import { LIBRARY, getLibraryExercise, searchLibrary } from '@/features/exercises/library';
import { getTechnique } from '@/features/exercises/catalog';
import { FEATURED_IDS } from '@/features/training/exerciseOptions';

describe('biblioteca Everkinetic', () => {
  it('cada ejercicio tiene dos imágenes, nombre y al menos un músculo principal', () => {
    // + jalón agarre abierto, dominadas asistidas 6 de core/antebrazo, press en máquina, elevación frontal con disco y extensión de tríceps en polea (ilustración de referencia o sin dibujo)
    expect(LIBRARY.length).toBe(EVERKINETIC.length + 11);
    for (const e of LIBRARY) {
      if (e.images) expect(e.images).toHaveLength(2);
      else expect(e.imageNote).toBeTruthy();
      expect(e.name.length).toBeGreaterThan(2);
      expect(e.primary.length).toBeGreaterThan(0);
    }
  });

  it('ids únicos y con prefijo estable', () => {
    const ids = LIBRARY.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^ek-\d{4}$/.test(id))).toBe(true);
  });

  it('todas las entradas tienen nombre en español y no hay traducciones huérfanas', () => {
    const known = new Set(LIBRARY.map((e) => e.sourceId));
    for (const e of LIBRARY) expect(ES[e.sourceId]?.name).toBeTruthy();
    for (const k of Object.keys(ES)) expect(known.has(k)).toBe(true);
    expect(Object.keys(EK_IMAGES).sort()).toEqual(EVERKINETIC.map((r) => r.id).sort());
  });

  it('las traducciones completas tienen pasos y no quedan textos HTML', () => {
    for (const e of LIBRARY) {
      for (const s of [...e.steps, ...e.tips]) expect(s).not.toMatch(/<[^>]+>/);
    }
    expect(LIBRARY.filter((e) => e.translated).length).toBeGreaterThanOrEqual(25);
  });

  it('los enlaces a técnica animada apuntan a animaciones existentes', () => {
    const linked = LIBRARY.filter((e) => e.techniqueId);
    expect(linked.length).toBeGreaterThanOrEqual(13);
    for (const e of linked) expect(getTechnique(e.techniqueId!)).not.toBeNull();
  });

  it('cada ejercicio tiene al menos una zona principal en el mapa muscular', () => {
    for (const e of LIBRARY) {
      expect(e.primaryRegions.length).toBeGreaterThan(0);
      for (const r of e.secondaryRegions) expect(e.primaryRegions).not.toContain(r);
    }
    expect(getLibraryExercise('ek-0211')?.primaryRegions).toEqual(['biceps']);
    expect(getLibraryExercise('ek-0024')?.primaryRegions).toEqual(['lats']);
    expect(getLibraryExercise('ek-0097')?.imageNote).toBeTruthy();
  });

  it('la rutina destacada existe, está traducida y encaja con el equipamiento', () => {
    for (const id of FEATURED_IDS) {
      const e = getLibraryExercise(id);
      expect(e?.translated).toBe(true);
      expect(e?.fitsMyEquipment).toBe(true);
    }
  });

  it('tipos de carga: asistidas, peso corporal y externas', () => {
    expect(getLibraryExercise('ek-9087')?.loadMode).toBe('assisted');
    expect(getLibraryExercise('ek-0087')?.loadMode).toBe('bodyweight');
    expect(getLibraryExercise('ek-0054')?.loadMode).toBe('bodyweight');
    expect(getLibraryExercise('ek-0211')?.loadMode).toBe('external');
    expect(getLibraryExercise('ek-0077')?.loadMode).toBe('external'); // flexiones: no mueven el 100 % del peso
    expect(getLibraryExercise('ek-0253')?.name).toBe('Curl de bíceps en máquina (supino)');
  });

  it('búsqueda sin tildes, en español e inglés, con filtros', () => {
    expect(searchLibrary('triceps').some((e) => e.id === 'ek-0172')).toBe(true);
    expect(searchLibrary('chest dips').some((e) => e.id === 'ek-0054')).toBe(true);
    expect(searchLibrary('', { muscle: 'biceps' }).every((e) => e.primary.includes('biceps'))).toBe(true);
    const mine = searchLibrary('', { onlyMine: true });
    expect(mine.every((e) => e.fitsMyEquipment)).toBe(true);
    expect(mine.some((e) => e.equipment.includes('smith machine'))).toBe(false);
    expect(getLibraryExercise('ek-0087')?.fitsMyEquipment).toBe(true);
  });
});
