import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    // Resolves the "@/..." imports from tsconfig.json.
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    // The stock tests talk to the development database, so they must not run
    // against each other's rows at the same time.
    fileParallelism: false,
    setupFiles: ['./src/test/setup.ts'],
  },
})
