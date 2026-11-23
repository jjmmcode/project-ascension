# Sistema RPG

## Curva de niveles (implementada en `src/features/progression/leveling.ts`)

`xpToNext(L) = redondeo a decenas de 45 · L^1.1` (curva aprobada el 23-11-2026; antes era `100 · L^1.5`,
que dejaba el nivel 60 a ~32 años y el 100 a ~117 años de entrenamiento constante).

Tiempo aproximado con una semana realista (5 sesiones + 2 de caminadora + misión ≈ 650 XP):

| Nivel | XP para subir | XP acumulada | Tiempo aprox. | Rango que habilita |
|---|---|---|---|---|
| 1 | 50 | 0 | — | E |
| 10 | 570 | 2.410 | ~1 mes | D |
| 20 | 1.210 | 10.960 | ~4 meses | C |
| 30 | 1.900 | 26.150 | ~10 meses | B |
| 45 | 2.960 | 62.030 | ~1,8 años | A |
| 60 | 4.070 | 114.150 | ~3,4 años | S |
| 75 | 5.200 | 183.050 | ~5,4 años | SS |
| 90 | 6.350 | 269.060 | ~8 años | SSS |
| 100 | — | 336.080 | ~10 años | SSS+ |

El nivel mide constancia; la fuerza real la miden los exámenes de rango (más abajo).

## Recompensas base (configurables en `settings`, Etapa 5)

| Acción | XP | Tope diario |
|---|---|---|
| Entrenamiento completado (≥ 3 series marcadas como hechas) | 100 | 1 por día (el 2.º del día se guarda, sin XP) |
| Registrar comida | 10 | 4 por día |
| Objetivo de hidratación alcanzado | 20 | 1 por día |
| Registro de progreso semanal (peso o cintura) | 50 | 1 por semana |
| Descanso planificado respetado | 30 | Solo en días marcados como descanso |

## Reglas de bienestar

- No hay XP por bajar de peso ni por la magnitud del cambio.
- No hay XP extra por entrenar por encima del plan semanal. Un séptimo entreno no da más que el cuarto.
- No registrar comidas no penaliza. Las rachas toleran días de descanso planificados y un "día de gracia" semanal.
- Los días marcados como enfermedad o pausa congelan rachas sin restar nada.

## Estadísticas del personaje (índices ficticios 0–100, Etapa 5)

| Stat | Fórmula (transparente) | Representa |
|---|---|---|
| STR | Progreso relativo de tu mejor e1RM o reps por ejercicio frente a tu propia línea base | Tendencia de fuerza, **no** fuerza absoluta |
| END | Minutos de cardio y series totales de las últimas 4 semanas, frente a tu objetivo | Volumen de trabajo |
| CON | % de sesiones planificadas completadas en 4 semanas | Constancia |
| MOB | Sesiones de movilidad registradas en 4 semanas | Hábito de movilidad |
| REC | Descansos planificados respetados y RPE medio de sesión | Gestión de la recuperación |

Cada stat se muestra con la etiqueta **"índice del juego"** y un botón *¿Cómo se calcula?*. Ninguna se deriva de la XP.

## Rangos y examen de rango (20-11-2026)
Nueve rangos: E (1), D (10), C (20), B (30), A (45), S (60), SS (75), SSS (90), SSS+ (100) — nivel mínimo entre
paréntesis. Además del nivel, cada rango exige un examen de fuerza sobre 11 músculos, **de su misma letra o superior**
(tabla aprobada el 23-11-2026): D 6 en D · C 6 en C · B 6 en B · A 6 en A · S 6 en S · SS 8 en S · SSS 10 en S ·
SSS+ los 11 en S. Los ranks musculares siguen los niveles de fuerza estándar: D principiante, C novato,
B intermedio (más fuerte que el 50 %), A avanzado (80 %), S élite (95 %).
El examen se aprueba solo al cumplirse (+200 XP, una vez) y el rango aprobado se guarda (`rank.passed`): no baja
aunque los músculos pierdan rank; solo se pierde por inactividad (ver PENANCE.md). Código: `features/progression/exams.ts`, `services/progression.ts`.

## Misión secundaria semanal
Cada semana ISO se fija el músculo con menor rank de fuerza (sin datos = más débil). Meta: 10 series de ese
músculo antes del domingo; +50 XP una vez por semana, entregados al terminar la sesión que la cumple.
