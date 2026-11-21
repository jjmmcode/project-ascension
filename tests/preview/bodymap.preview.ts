/**
 * @jest-environment node
 */
/// <reference types="node" />
import { writeFileSync, mkdirSync } from 'node:fs';
import { bodyMapSvg } from '@/features/exercises/bodyMap/regions';

it('mapa muscular', () => {
  const out = process.env.PREVIEW_OUT ?? '/tmp/ascension-preview';
  mkdirSync(out, { recursive: true });
  writeFileSync(`${out}/bm-all.svg`, bodyMapSvg(['chest', 'lats', 'quads', 'biceps', 'traps', 'calves', 'abs', 'glutes'], ['shoulders', 'triceps', 'forearms', 'obliques', 'hamstrings', 'lowerBack', 'neck']));
  writeFileSync(`${out}/bm-curl.svg`, bodyMapSvg(['biceps'], ['forearms']));
  writeFileSync(`${out}/bm-row.svg`, bodyMapSvg(['lats'], ['biceps', 'traps', 'shoulders']));
});
