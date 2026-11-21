/**
 * @jest-environment node
 */
/// <reference types="node" />
import { writeFileSync, mkdirSync } from 'node:fs';
import { bodyMapSvg } from '@/features/exercises/bodyMap/regions';
import { getLibraryExercise } from '@/features/exercises/library';

it('mapas de la rutina de hoy', () => {
  const out = process.env.PREVIEW_OUT ?? '/tmp/ascension-preview';
  mkdirSync(out, { recursive: true });
  for (const id of ['ek-0211', 'ek-0024', 'ek-0097']) {
    const e = getLibraryExercise(id)!;
    writeFileSync(`${out}/map-${id}.svg`, bodyMapSvg(e.primaryRegions, e.secondaryRegions));
    writeFileSync(`${out}/map-${id}.txt`, `${e.name}|${e.primaryRegions}|${e.secondaryRegions}`);
  }
});
