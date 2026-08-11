/**
 * Cria a conta de administrador inicial.
 *
 *   npm run setup:admin
 *
 * A palavra-passe é gerada aleatoriamente (22 caracteres, ~135 bits), é
 * mostrada UMA vez no terminal e nunca é guardada em lado nenhum a não ser
 * como hash argon2id. É obrigatório alterá-la no primeiro acesso.
 *
 * Nunca escrever a palavra-passe num ficheiro, num registo, ou no .env.
 */

import "dotenv/config";
import { prisma } from "../src/server/db";
import { generateStrongPassword } from "../src/server/auth/password";
import { createUserWithWorkspace } from "../src/server/onboarding";
import { recordAudit } from "../src/server/audit";

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const name = (process.env.ADMIN_NAME ?? "Administrador").trim();

  if (!email) {
    console.error(
      "ADMIN_EMAIL não está definida. Preencha-a no .env antes de correr isto.",
    );
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.error(
      `Já existe uma conta com o email ${email}.\n` +
        "Para definir uma palavra-passe nova, use:\n" +
        `  npm run reset-password -- ${email}`,
    );
    process.exit(1);
  }

  const anyOwner = await prisma.user.count({ where: { role: "OWNER" } });
  if (anyOwner > 0 && process.env.NODE_ENV === "production") {
    console.error(
      "Já existe um administrador. Em produção este script só corre uma vez.",
    );
    process.exit(1);
  }

  const password = generateStrongPassword();

  const user = await createUserWithWorkspace({
    name,
    email,
    password,
    role: "OWNER",
    mustChangePassword: true,
  });

  await recordAudit({
    action: "admin.created",
    userId: user.id,
    userEmail: user.email,
    workspaceId: user.workspaceId,
    metadata: { criadoPor: "scripts/setup-admin.ts" },
  });

  const line = "─".repeat(56);
  console.log(`\n${line}`);
  console.log("  Conta de administrador criada");
  console.log(line);
  console.log(`  Email:          ${email}`);
  console.log(`  Palavra-passe:  ${password}`);
  console.log(line);
  console.log("  Esta palavra-passe é mostrada UMA única vez.");
  console.log("  Não fica guardada em texto simples em lado nenhum.");
  console.log("  Terá de a alterar no primeiro acesso.");
  console.log(`${line}\n`);
}

main()
  .catch((error) => {
    console.error("Falhou:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
