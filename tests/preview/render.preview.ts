/**
 * @jest-environment node
 *
 * Genera SVG de cada keyframe y fotogramas intermedios para revisión visual.
 * Uso: npx jest --testMatch '**\/tests/preview/*.preview.ts'   (salida en /tmp/ascension-preview)
 */
/// <reference types="node" />
import { mkdirSync, writeFileSync } from 'node:fs';
import { cycleDuration, sampleTimeline } from '@/features/exercises/figure/kinematics';
import { buildScene, sceneToSvg } from '@/features/exercises/figure/scene';
import { EXERCISE_TECHNIQUES } from '@/features/exercises/catalog';

const OUT = process.env.PREVIEW_OUT ?? '/tmp/ascension-preview';

it('renderiza vistas previas', () => {
  mkdirSync(OUT, { recursive: true });
  for (const ex of EXERCISE_TECHNIQUES) {
    const total = cycleDuration(ex.keyframes);
    const frames = Number(process.env.PREVIEW_FRAMES ?? 6);
    for (let i = 0; i < frames; i++) {
      const { pose } = sampleTimeline(ex.keyframes, (total * i) / frames);
      const { prims } = buildScene(pose, { props: ex.props, muscles: ex.primary });
      writeFileSync(`${OUT}/${ex.id}-${i}.svg`, sceneToSvg(prims, ex.viewBox, 2));
    }
  }
});
