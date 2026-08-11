/**
 * Define uma palavra-passe nova para uma conta, a partir do terminal.
 *
 *   npm run reset-password -- pessoa@exemplo.com
 *
 * Existe porque a recuperação por email ainda não tem serviço de envio
 * configurado. Em vez de a interface fingir que enviou uma mensagem, há um
 * caminho real: quem tem acesso ao servidor consegue repor o acesso.
 *
 * Fecha todas as sessões abertas dessa conta, como qualquer mudança de
 * palavra-passe deve fazer.
 */

import "dotenv/config";
import { prisma } from "../src/server/db";
import { generateStrongPassword, hashPassword } from "../src/server/auth/password";
import { recordAudit } from "../src/server/audit";

async function main() {
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  if (!email) {
    console.error("Uso: npm run reset-password -- pessoa@exemplo.com");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`Não existe nenhuma conta com o email ${email}.`);
    process.exit(1);
  }

  const password = generateStrongPassword();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(password),
        mustChangePassword: true,
      },
    }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);

  await recordAudit({
    action: "auth.password_reset_completed",
    userId: user.id,
    userEmail: user.email,
    metadata: { via: "scripts/reset-password.ts" },
  });

  const line = "─".repeat(56);
  console.log(`\n${line}`);
  console.log(`  Palavra-passe nova para ${email}`);
  console.log(line);
  console.log(`  ${password}`);
  console.log(line);
  console.log("  Mostrada uma única vez. Todas as sessões foram fechadas.");
  console.log("  Terá de a alterar no próximo acesso.");
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
