# Gasto energético estimado de las sesiones de pesas

Aprobado el 19-11-2026. Código: `src/features/training/energy.ts`.

- Fórmula del Compendio de Actividad Física 2024: `kcal = MET × 3,5 × kg / 200 × min`.
- Se guardan y muestran kcal **netas** (MET − 1) para no duplicar el gasto en reposo que ya cuentan Fitia o el TDEE.
- MET: 3,5 (02054, varios ejercicios 8–15 reps) por defecto; 5,0 (02052) si ≥50 % de las series son compuestos de
  pierna; 6,0 (02050, vigoroso) si la densidad es ≥0,6 series/min.
- Duración = inicio → fin, con tope de 4 min por serie hecha + 10 min (sesiones olvidadas abiertas).
- Peso: último peso confirmado de ≤30 días; si no hay, se pide y se recalcula. Nunca se inventa.
- Rango mostrado ±20 % (sin pulsómetro). Validación: 80 kg · 45 min → 158 kcal, frente a 167,7 ± 51,6 kcal netas
  medidas por calorimetría en hombres con un protocolo de 7 ejercicios, 2–3 series de 8–12 reps, una serie cada 2 min.
- La caminadora se calcula aparte con las ecuaciones del ACSM (ver `docs/CARDIO.md`).
- Sesiones anteriores: al abrir la app se calculan las sesiones terminadas sin kcal con el peso **confirmado** más
  cercano a su fecha (±30 días). Si no hay, quedan pendientes y se calculan en cuanto se registra el peso
  (Training → Sesiones recientes).
