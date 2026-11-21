# Plan semanal (aprobado el 19-11-2026)

| Día | Rutina |
|---|---|
| Lunes | Pecho y tríceps |
| Martes | Bíceps y espalda |
| Miércoles | Core y zona lumbar (o descanso) |
| Jueves | Hombro y antebrazo |
| Viernes | Pierna |
| Sábado y domingo | Cardio: caminadora |

Las rutinas se crean una sola vez (`src/features/training/defaultPlan.ts`) y luego son editables en la app
(series, objetivo, orden, añadir/quitar ejercicios, cambiar el día). Si el usuario borra una rutina no se vuelve a crear.

## Criterios
- Esquemas del usuario: 4×10 compuestos, 4×12 secundarios, 4×15 aislamiento, 4×20 gemelos/antebrazo.
- Hipertrofia similar con cargas bajas o altas si las series van cerca del fallo (Schoenfeld et al. 2017).
- No hace falta llegar al fallo en todas las series: 1–3 repeticiones en reserva.
- ≥10 series semanales por músculo se asocian a más hipertrofia (Schoenfeld, Ogborn y Krieger 2017):
  la pantalla Training muestra las series hechas por músculo en la semana.
- Core: «Big 3» de McGill (curl-up, plancha lateral, bird-dog) + dead bug, plancha frontal y puente de glúteos.
- Pierna: prensa en vez de sentadilla con barra para bajar la carga sobre la columna; peso muerto rumano sustituible por curl femoral.

## Precarga de sesiones
Al empezar una rutina se crean todas sus series: repeticiones (o segundos) = primer número del objetivo,
peso = el de la misma serie la última vez que se completó el ejercicio. Las planchas se registran en segundos.

## Cambios del 19-11-2026
- Jueves: elevación frontal con disco 4×12 tras las laterales (se añade a planes ya creados una sola vez).
- Nuevo ejercicio «Press de hombro en máquina (discos)»: se anota el total de discos de ambos lados (sin el peso
  propio de la máquina) y la app muestra los kg por lado. Va como ejercicio aparte porque la fuerza es específica
  del aparato (Haugen et al. 2023), aunque la hipertrofia es similar con máquina y peso libre.
- Botón «Cambiar ejercicio» en la sesión: cambia un ejercicio solo en esa sesión, conserva series y objetivo.
- La rutina del jueves mantiene el press militar con barra; el cambio a la máquina se hace con el botón.
- Las series anotadas como press militar con barra el 19-11-2026 pasan al press en máquina (corrección pedida).
