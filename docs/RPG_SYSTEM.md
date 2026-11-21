# Sistema RPG

## Curva de niveles (implementada en `src/features/progression/leveling.ts`)

`xpToNext(L) = redondeo a decenas de 100 · L^1.5`

| Nivel | XP para subir | XP acumulada para alcanzarlo |
|---|---|---|
| 1 | 100 | 0 |
| 2 | 280 | 100 |
| 5 | 1.120 | 1.700 |
| 10 | 3.160 | 11.100 |
| 20 | 8.940 | 67.140 |

## Rangos

| Rango | Nivel mínimo |
|---|---|
| E | 1 |
| D | 10 |
| C | 20 |
| B | 35 |
| A | 50 |
| S | 70 |

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
paréntesis. Además del nivel, cada rango exige un examen de fuerza sobre 11 músculos, una letra por debajo:
D 4 en D · C 6 en D · B 6 en C · A 8 en C · S 8 en B · SS 10 en B · SSS 8 en A · SSS+ 11 en A y 3 en S.
El examen se aprueba solo al cumplirse (+200 XP, una vez) y el rango aprobado se guarda (`rank.passed`): no baja
aunque los músculos pierdan rank. Código: `features/progression/exams.ts`, `services/progression.ts`.

## Misión secundaria semanal
Cada semana ISO se fija el músculo con menor rank de fuerza (sin datos = más débil). Meta: 10 series de ese
músculo antes del domingo; +50 XP una vez por semana, entregados al terminar la sesión que la cumple.
