import { randomUUID } from 'expo-crypto';

/** UUID v4: compatible con una futura sincronización (Supabase/PostgreSQL `uuid`). */
export const newId = (): string => randomUUID();
