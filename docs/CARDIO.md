# Caminadora (Fase 2, 21-11-2026)

Código: `src/features/cardio/acsm.ts` (fórmulas), `src/services/cardio.ts`, pantalla `src/app/cardio.tsx`. Migración v7
(`cardio_sessions`).

## Registro

Velocidad (km/h), inclinación (%), minutos y tipo (caminar o trotar/correr; se sugiere por la velocidad: correr desde
8 km/h). Se abre desde Status en los días de cardio, desde Training o desde los accesos rápidos.

## Kcal

Ecuaciones metabólicas del ACSM (S en m/min, G = inclinación en fracción, VO2 en mL/kg/min):

- Caminar: `VO2 = 0,1·S + 1,8·S·G + 3,5` (más precisa entre 50 y 100 m/min ≈ 3–6 km/h)
- Correr: `VO2 = 0,2·S + 0,9·S·G + 3,5` (más precisa sobre 134 m/min ≈ 8 km/h)
- Kcal netas = `(VO2 − 3,5) · kg · min / 1000 · 5`. Se descuenta el reposo, igual que en las pesas, para no duplicar el
  gasto que ya cuenta Fitia.

Ejemplo: 80 kg, 6 km/h, 8 %, 30 min → VO2 27,9 → ≈293 kcal netas. Se usa el último peso confirmado de ≤30 días; sin peso
no se inventan kcal. Supone que no te agarras de las barras. Cada sesión ofrece una línea lista para copiar en Fitia.

## Progresión

- XP: 50 por sesión de ≥10 min, una vez al día.
- RES: una sesión de ≥20 min y llegar a 150 min en la semana son hechos que pueden dar puntos. Tras 6 semanas sin cardio
  los puntos de RES se pierden; vuelven al retomar la caminadora.
- Eje Cardio del radar: minutos de los últimos 7 días frente a 150 (recomendación de la OMS).
- La penitencia sigue contando solo sesiones de pesas.
