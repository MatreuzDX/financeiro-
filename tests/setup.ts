import "dotenv/config";

// Os testes de integração correm contra o Postgres local (npm run db:start).
// Mocks provariam que o mock funciona; as garantias que interessam — a soma
// zero, a auditoria imutável, o isolamento entre workspaces — vivem na base
// de dados.
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL em falta. Copie .env.example para .env e corra `npm run db:start`.",
  );
}
