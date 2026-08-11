import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    // `server-only` só sabe resolver-se dentro do bundler do Next. Nos testes
    // (Node puro) resolveria para o ficheiro que lança de propósito, e todo o
    // módulo de servidor deixaria de poder ser testado.
    alias: { "server-only": new URL("./tests/stubs/server-only.ts", import.meta.url).pathname },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    // Os testes de integração partilham uma base de dados; correr em série
    // evita que uma fixture apanhe as linhas de outra.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
