# Penitencia, emblema roto y sonidos (entrega 3, 21-11-2026)

Código: `src/features/penance/engine.ts` (lógica pura), `src/services/penance.ts`, `src/components/game/ShatterBadge.tsx`,
`src/features/sound/`. Migración v6 (`xp_penalties`).

## Penitencia por inactividad

- Cuenta desde la primera sesión de pesas terminada. Los días se miden en fecha local.
- 5–6 días sin sesión: aviso en Status. Día 7: misión de penitencia, 2 sesiones en los 7 días siguientes.
- Fallarla: la 1.ª vez pierdes la XP acumulada dentro del nivel actual; las siguientes, bajas 1 nivel (máx. 1 por semana)
  y pierdes sus 3 puntos de atributo hasta recuperarlo.
- Las pérdidas se guardan en `xp_penalties` (una por ventana, con clave de idempotencia) y se restan del total de XP;
  `xp_events` solo admite cantidades positivas.
- Cumplir la misión la cierra y reinicia la cuenta.
- Modo descanso (Ajustes): hasta 14 días que no cuentan y alargan una ventana en curso.
- Memoria muscular: mientras tu nivel esté por debajo del máximo alcanzado, cada sesión da +100 XP extra (`comeback`).

## Emblema roto

El rango general nunca se pierde. Si tu nivel cae por debajo del mínimo del rango, el emblema muestra el daño
(niveles por debajo, máximo 3): grieta → fractura (4 pedazos, color apagado, parpadeo) → destrozado. Al cambiar el daño
se ve una animación de rotura o de reparación con su sonido. Se dibuja con SVG recortado en 4 pedazos.

## Simulador

En Ajustes, toca «versión» 5 veces: aparece «Simular +N días», que muestra qué pasaría sin entrenar. Es de solo lectura.

## Sonidos

- expo-audio, activados por defecto. `playsInSilentMode: false` (en silencio o vibración no suenan) e
  `interruptionMode: 'mixWithOthers'`: tu música sigue. Los momentos grandes usan `duckOthers` un instante.
- Ajustes: activar/desactivar, volumen y «solo momentos importantes».

| Momento | Sonido |
|---|---|
| Serie completada | tick |
| Fin del descanso | jingle corto |
| Sesión terminada | confirmación |
| Subida de nivel | fanfarria 8-bit |
| Rango / examen | fanfarria + impacto |
| Rank muscular / punto de atributo | ding |
| Misión cumplida | jingle |
| Punto recuperado | sonido de recuperación |
| Penitencia fallida | tono grave |
| Emblema se rompe / se repara | cristal / cristal al revés + brillo |

Fuente: Kenney, CC0. Se convirtieron a MP3 mono y se normalizó el volumen con `loudnorm`.
