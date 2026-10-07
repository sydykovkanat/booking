import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/server/**', 'src/lib/**', 'src/features/**'],
      // Vendored UI-kit helpers are covered in their own project.
      exclude: ['**/*.test.*', 'src/lib/utils.ts', 'src/lib/scrollbar.ts', 'src/lib/locale.ts'],
    },
  },
});
