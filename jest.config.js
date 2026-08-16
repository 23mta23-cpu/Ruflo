// Tests laufen in der Zeitzone, in der das Produkt benutzt wird.
//
// Ohne das laufen sie in UTC — und in UTC verschwinden genau die Datumsfehler,
// die deutsche Nutzer treffen. Nachgewiesen am 16.08.2026: eine Mutationsprobe
// ersetzte die ortszeit-basierte Tagesberechnung des Kalenders durch
// `toISOString()`, und ALLE zehn Tests blieben gruen. In UTC gibt es keinen
// Versatz, in Europe/Berlin sind es je nach Jahreszeit ein bis zwei Stunden:
// ein Termin um 00:30 landete damit auf dem Vortag.
//
// Muss gesetzt sein, BEVOR Node die Zeitzone das erste Mal aufloest — deshalb
// hier ganz oben in der Konfiguration und nicht in einer einzelnen Testdatei.
process.env.TZ = 'Europe/Berlin';

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  // Ignore node_modules and stale git worktrees left under .claude/ — otherwise
  // Jest scans duplicate test copies and reports phantom suite failures.
  testPathIgnorePatterns: ['/node_modules/', '/.claude/'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          // Use a self-contained config for tests so we are not bound by
          // Expo's "bundler" moduleResolution which is incompatible with ts-jest.
          module: 'CommonJS',
          moduleResolution: 'Node',
          esModuleInterop: true,
          strict: true,
          target: 'ES2020',
          skipLibCheck: true,
          types: ['jest', 'node'],
        },
      },
    ],
  },
};
