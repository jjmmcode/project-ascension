# Arquitectura técnica — Project Ascension

## 1. Decisiones principales

| Decisión | Elección | Motivo |
|---|---|---|
| Framework | Expo SDK 58 + React Native 0.88 + TypeScript estricto | Versión estable actual; APK sin Android Studio vía EAS |
| Navegación | Expo Router (rutas en `src/app/`) | Convención oficial desde SDK 56; rutas tipadas |
| Persistencia | `expo-sqlite` (API async) | Local-first, offline, transaccional, migrable a Postgres |
| Estado UI | Zustand | Solo estado efímero/caché de UI. **La fuente de verdad es SQLite** |
| Validación | Zod | Valida toda entrada antes de escribir en BD e importaciones JSON |
| IDs | UUID v4 (`expo-crypto.randomUUID`) | Sin colisiones al sincronizar con Supabase en el futuro |
| Gráficos | `react-native-svg` + componentes propios (Etapa 6) | Sin dependencias pesadas; control total del estilo HUD |
| Pruebas | Jest (`jest-expo`) | Lógica pura y repositorios probados contra SQLite real en Node (Etapa 2) |
| Build | EAS Build, perfil `preview` → APK | Compilación real en la nube, sin SDK Android local |

## 2. Capas

```
┌──────────────────────────────────────────────────────────┐
│  src/app/            Rutas (Expo Router) — solo composición │
├──────────────────────────────────────────────────────────┤
│  src/components/     UI reutilizable (sin lógica de negocio)│
│  src/features/*/     Pantallas parciales, hooks y lógica    │
│                      de dominio por módulo                  │
├──────────────────────────────────────────────────────────┤
│  src/services/       Casos de uso que cruzan módulos        │
│                      (XP, misiones, import/export)          │
├──────────────────────────────────────────────────────────┤
│  src/database/       Conexión, migraciones, repositorios    │
│                      (único lugar con SQL)                  │
└──────────────────────────────────────────────────────────┘
```

Reglas:

1. Las pantallas nunca ejecutan SQL. Llaman a hooks de `features/` que usan repositorios.
2. La lógica de cálculo (macros, XP, niveles, rachas) es **pura** y vive en `features/*/` → se prueba sin React ni BD.
3. Toda escritura pasa por un esquema Zod. Si no valida, no se escribe.
4. La XP nunca se guarda como "nivel": se guarda como eventos (`xp_events`) y el nivel se deriva.
5. Integraciones futuras se definen como interfaces en `src/services/` (p. ej. `SyncProvider`) con una única implementación local. No se implementan antes del MVP.

## 3. Estructura del repositorio

```
project-ascension/
├── src/
│   ├── app/                  # Rutas
│   │   ├── _layout.tsx       # Raíz: splash, migraciones, providers
│   │   └── (tabs)/           # Status · Training · Nutrición · Quests · Evolution
│   ├── components/ui/        # Screen, Card, Button, XPBar, ProgressRing, StatTile…
│   ├── database/             # client.ts, migrations/, repositories/
│   ├── features/
│   │   ├── training/  nutrition/  hydration/  progression/  measurements/
│   ├── services/             # xp, quests, import-export
│   ├── stores/               # Zustand (UI)
│   ├── types/
│   └── theme/                # tokens de diseño
├── tests/
├── docs/
├── assets/
├── app.json · eas.json · tsconfig.json · package.json
```

Desviación del prompt: las rutas están en `src/app/` y no en `app/`. Es la convención actual de Expo Router y mantiene todo el código bajo `src/`.

## 4. Fechas y zona horaria

- Instantes: ISO-8601 UTC (`2026-11-17T17:30:00.000Z`).
- "Día" para metas y misiones: clave local `YYYY-MM-DD` calculada en `America/Santiago`. Así el agua que registres a las 23:50 cuenta para ese día y no para el siguiente.
- Semanas: ISO (lunes a domingo), clave `2026-W47`.

## 5. Seguridad y datos

- Sin claves ni secretos en el cliente. `.env*` ignorado por git.
- Fotos de progreso en `FileSystem.documentDirectory/photos/` (privado de la app, no en galería).
- Borrado lógico (`deleted_at`) en tablas de registros, con confirmación explícita en la UI.
- Exportación JSON completa + importación con vista previa (Etapa 6).
- Datos personales (`profiles`, `body_metrics`, fotos) separados de configuración (`settings`).

## 6. Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| Expo Go para SDK 58 puede tardar en estar en Play Store | Usar APK `preview` vía EAS (ver README) |
| Pérdida de datos al desinstalar | Exportación JSON manual desde Ajustes (Etapa 6) |
| Corrupción por migraciones fallidas | Cada migración en transacción + `PRAGMA user_version`; pruebas de migración |
| XP duplicada por doble toque o reintentos | `idempotency_key UNIQUE` + `INSERT OR IGNORE` |
| Gamificación dañina (sobreentrenamiento, restricción) | Topes diarios de XP, sin XP por bajar peso, descanso recompensado |
| Datos históricos tratados como actuales | Columna `data_status` (`confirmed` / `historical` / `estimated`) |
