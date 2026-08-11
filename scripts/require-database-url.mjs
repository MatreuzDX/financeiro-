/**
 * Verificação antes das migrações, para o build falhar com uma mensagem que
 * se percebe em vez de um erro do Prisma no meio de mil linhas de log.
 *
 * Corre no `vercel-build`, antes de `prisma migrate deploy`.
 */

if (!process.env.DATABASE_URL) {
  const line = "─".repeat(64);
  console.error(`\n${line}`);
  console.error("  Falta a variável DATABASE_URL.");
  console.error(line);
  console.error("  A aplicação precisa de uma base de dados PostgreSQL.");
  console.error("");
  console.error("  Na Vercel:");
  console.error("    Storage → Create Database → Neon → plano gratuito");
  console.error("    (a DATABASE_URL é adicionada automaticamente)");
  console.error("");
  console.error("  Se a integração criar só POSTGRES_URL, criar em");
  console.error("  Settings → Environment Variables uma DATABASE_URL com o");
  console.error("  mesmo valor da ligação pooled.");
  console.error(`${line}\n`);
  process.exit(1);
}

const value = process.env.DATABASE_URL;
if (!/^postgres(ql)?:\/\//.test(value)) {
  console.error(
    "\nDATABASE_URL não parece uma ligação PostgreSQL " +
      `(começa por "${value.slice(0, 12)}…").\n`,
  );
  process.exit(1);
}

console.log("DATABASE_URL presente. A aplicar migrações…");
