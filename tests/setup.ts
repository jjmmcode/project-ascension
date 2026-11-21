// expo-crypto es un módulo nativo: en Node se sustituye por el UUID estándar.
jest.mock('expo-crypto', () => ({
  randomUUID: () => require('node:crypto').randomUUID(),
}));
