import { defineConfig } from 'vitest/config';

// The old calculation uses local dates, so tests run in the coach's time zone.
process.env.TZ = 'Africa/Cairo';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
});
