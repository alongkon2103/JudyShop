import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vitest configuration.
 *
 * Tests live under `src/**\/__tests__` next to the code they exercise.
 * `node` environment is enough for our pure-logic suites — none of these
 * tests touch the DOM or a real Prisma instance (the Prisma client is
 * mocked via `vi.mock("@/lib/db")` inside the tests that need it).
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    globals: false,
    clearMocks: true,
    restoreMocks: true,
    // bcrypt cost-12 hashes can take ~2s each on modest hardware;
    // 5s vitest default sometimes trips on cold CI runs. Give all
    // tests a generous ceiling — fast ones still finish in <100ms.
    testTimeout: 15_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/lib/**/*.ts",
        "src/app/admin/products/_actions.ts",
      ],
      exclude: [
        "src/lib/db.ts",
        "src/lib/stripe.ts",
        "src/lib/env.ts",
        "src/**/__tests__/**",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
