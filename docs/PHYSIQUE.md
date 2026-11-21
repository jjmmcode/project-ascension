# Físico: ranks por músculo, ficha de personaje y animación de subida (20-11-2026)

Inspirado en Ascend (stats que suben con resultados reales, ranks E→S, ficha con radar) y en apps de ranking por
músculo con estándares de fuerza. Ni Ascend ni Arise publican su fórmula: esta es propia y transparente.

## Rank por músculo (`src/features/physique/`)
- Mejor serie de 90 días por ejercicio: 1RM estimado de Epley (solo series de 3–15 reps) ÷ peso corporal confirmado.
  Isométricos (planchas): segundos.
- Cinco umbrales (principiante, novato, intermedio, avanzado, élite; hombres) → D, C, B, A, S; por debajo, E.
- Estándares publicados para los básicos; el resto «aprox.» (máquinas de placas, poleas, prensa, accesorios).
- Máquinas de palanca cargadas con discos (press de hombro en máquina): sin rank, solo progreso.
- Músculo = su mejor ejercicio principal. Sin entrenarlo 6 semanas: baja un rank.
- Pista para el siguiente rank: kg necesarios a las mismas repeticiones de tu mejor serie.

## Ficha (radar de 5 ejes, 0–100)
Fuerza (media de ranks de 11 músculos), Progresión (récords de 1RM estimado en 4 semanas), Constancia (días de gimnasio
del plan cumplidos en 4 semanas, desde la primera sesión; el miércoles opcional no cuenta), Volumen (series de 7 días
frente a 10 por músculo) y Cardio (minutos de caminadora en 7 días frente a 150).

## Animación
Al terminar una sesión con subida de nivel, de rango o de rank de algún músculo: destello, rayos del color del rango,
partículas, contador de nivel con hápticos, revelación del emblema con anillo de energía y tarjetas por músculo.
Con «reducir movimiento» se muestra el estado final.

## Atributos (entrega 1 del sistema de progresión, 20-11-2026)
Código: `src/features/attributes/engine.ts` (puro) y `src/services/attributes.ts`.
- FUE, VOL, DIS, NÚC, RES, VIT. Cada nivel desde el 2 da 3 puntos, repartidos automáticamente con los hechos del
  tramo entre niveles: subida de rank (peso 3) y récord de 1RM estimado (2) → FUE; músculo que llega a 10 series en la
  semana (2) → VOL; semana del plan completa (3) y sesión del plan (1) → DIS; sesión con ≥3 series de core (2) → NÚC.
  Máximo 2 puntos del mismo atributo por nivel si hay alternativas; las subidas de rank no usadas pasan al siguiente.
  Sin hechos: refuerzo del atributo más trabajado o Disciplina. Todo se recalcula desde el historial (retroactivo).
- Pérdida: puntos con músculo (FUE, VOL, NÚC) quedan perdidos si ese músculo pasa >6 semanas sin entrenarse;
  aviso a las 4 semanas (Status y mapa). DIS no se pierde. Volver a entrenarlo los recupera y da +25 XP por punto
  (memoria muscular; tope 75 XP/día).
- Base: la fuerza se mantiene ~3 semanas sin entrenar y luego cae (revisión de 27 estudios, 2013); el reentrenamiento
  recupera lo perdido más rápido que la primera vez.
- Evolution: hexágono (hoy y hace 30 días), lista con motivo de cada punto, mapa con vistas Rank / Volumen / Puntos y
  radar «Estado actual (4 semanas)».
