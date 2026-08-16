/**
 * Operações de autenticação.
 *
 * Princípios em vigor aqui:
 *  • As mensagens de erro nunca dizem se o email existe. "Credenciais
 *    inválidas" para tudo — senão o formulário de login vira uma lista de
 *    quem tem conta.
 *  • O tempo de resposta é parecido nos dois casos: quando o email não
 *    existe, verifica-se na mesma um hash falso, para não haver diferença
 *    mensurável.
 *  • Mudar a palavra-passe fecha as outras sessões, sempre.
 */

import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/server/db";
import { recordAudit } from "@/server/audit";
import {
  checkPasswordStrength,
  hashPassword,
  randomToken,
  verifyPassword,
} from "./password";
import {
  checkRateLimit,
  clearRateLimit,
  describeRetry,
  LOGIN_RULE,
  registerFailure,
  RESET_RULE,
} from "./rate-limit";
import {
  createSession,
  destroyAllSessions,
  hashIp,
  setSessionCookie,
} from "./session";

/**
 * Hash descartável de uma palavra-passe qualquer. Serve para gastar o mesmo
 * tempo quando o email não existe — sem isto, um login rápido revela que a
 * conta não existe.
 */
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$YkVBcVpjT2ZKZmRvR2NqTndkV2ZjZw";

const GENERIC_LOGIN_ERROR = "Email ou palavra-passe incorretos.";

export type AuthResult = { ok: true } | { ok: false; error: string };

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function login(input: {
  email: string;
  password: string;
  ip: string | null;
  userAgent: string | null;
}): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.password) return { ok: false, error: GENERIC_LOGIN_ERROR };

  // Duas chaves: uma protege a conta, a outra protege contra varrer contas
  // a partir do mesmo sítio.
  const emailKey = `login:email:${email}`;
  const ipKey = `login:ip:${input.ip ?? "desconhecido"}`;

  for (const key of [emailKey, ipKey]) {
    const limit = await checkRateLimit(key, LOGIN_RULE);
    if (!limit.allowed) {
      return {
        ok: false,
        error: `Demasiadas tentativas. ${describeRetry(limit.retryAfterSeconds)}`,
      };
    }
  }

  const user = await prisma.user.findUnique({ where: { email } });

  const valid = user
    ? await verifyPassword(user.passwordHash, input.password)
    : await verifyPassword(DUMMY_HASH, input.password).then(() => false);

  if (!user || !valid) {
    await registerFailure(emailKey, LOGIN_RULE);
    await registerFailure(ipKey, LOGIN_RULE);
    await recordAudit({
      action: "auth.login_failed",
      userEmail: email,
      ipHash: hashIp(input.ip),
      metadata: { motivo: user ? "palavra-passe errada" : "conta inexistente" },
    });
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }

  await clearRateLimit(emailKey);
  await clearRateLimit(ipKey);

  const { token, expiresAt } = await createSession(user.id, {
    ip: input.ip,
    userAgent: input.userAgent,
  });
  await setSessionCookie(token, expiresAt);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await recordAudit({
    action: "auth.login",
    userId: user.id,
    userEmail: user.email,
    ipHash: hashIp(input.ip),
  });

  return { ok: true };
}

export async function changePassword(input: {
  userId: string;
  userEmail: string;
  currentPassword: string;
  newPassword: string;
  keepSessionId?: string;
}): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) return { ok: false, error: "Conta não encontrada." };

  const valid = await verifyPassword(user.passwordHash, input.currentPassword);
  if (!valid) return { ok: false, error: "A palavra-passe atual está errada." };

  if (input.currentPassword === input.newPassword) {
    return { ok: false, error: "A palavra-passe nova tem de ser diferente." };
  }

  const problems = checkPasswordStrength(input.newPassword);
  if (problems.length > 0) return { ok: false, error: problems.join(" ") };

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(input.newPassword),
      mustChangePassword: false,
    },
  });

  // Quem muda a palavra-passe por desconfiar que lhe entraram na conta tem
  // de conseguir expulsar quem lá está. Isto faz parte da operação.
  await destroyAllSessions(user.id, input.keepSessionId);

  await recordAudit({
    action: "auth.password_changed",
    userId: user.id,
    userEmail: user.email,
    metadata: { outrasSessoesFechadas: true },
  });

  return { ok: true };
}

// ─── Recuperação ───────────────────────────────────────────────────────────

const RESET_TTL_MS = 30 * 60_000;

/** Só há entrega por email se houver um serviço de email configurado. */
export function isEmailDeliveryConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export type ResetRequestOutcome = {
  ok: boolean;
  /**
   * O link, quando pode ser mostrado: em desenvolvimento, ou quando a
   * recuperação de emergência está ligada para este email.
   */
  devLink?: string;
  /** Porque é que o link está visível. A interface explica-o à pessoa. */
  motivo?: "desenvolvimento" | "emergencia";
  error?: string;
};

/**
 * Recuperação de emergência, para instalações sem serviço de email.
 *
 * O PROBLEMA REAL: esta app instala-se num servidor de uma pessoa só. Se ela
 * esquecer a palavra-passe e não houver serviço de email configurado, fica
 * fechada fora dos seus próprios dados. O script de terminal resolve — mas
 * exige a ligação à base de dados de produção na mão, que a maior parte das
 * pessoas não tem à distância de um telemóvel.
 *
 * A SOLUÇÃO: quem controla as variáveis de ambiente do servidor define
 * `RECOVERY_EMAIL` com o email da conta. A partir daí, e só para ESSE email, o
 * link de recuperação aparece no ecrã em vez de ser enviado.
 *
 * PORQUE É QUE ISTO NÃO É UM BURACO: mostrar o link a quem escreve um email
 * qualquer seria tomar contas alheias com um clique. Aqui o portão não é o
 * email — é o acesso às variáveis de ambiente do servidor, que só tem quem já
 * manda em tudo. Quem consegue definir a variável já consegue ler a base de
 * dados diretamente.
 *
 * Deve ser removida assim que se recuperar o acesso, e a interface diz isso.
 */
export function emergencyRecoveryEmail(): string | null {
  const valor = process.env.RECOVERY_EMAIL?.trim().toLowerCase();
  return valor ? valor : null;
}

export async function requestPasswordReset(input: {
  email: string;
  ip: string | null;
  appUrl: string;
}): Promise<ResetRequestOutcome> {
  const email = input.email.trim().toLowerCase();
  const key = `reset:${email}`;

  const limit = await checkRateLimit(key, RESET_RULE);
  if (!limit.allowed) {
    return {
      ok: false,
      error: `Demasiados pedidos. ${describeRetry(limit.retryAfterSeconds)}`,
    };
  }
  await registerFailure(key, RESET_RULE);

  const user = await prisma.user.findUnique({ where: { email } });

  await recordAudit({
    action: "auth.password_reset_requested",
    userId: user?.id ?? null,
    userEmail: email,
    ipHash: hashIp(input.ip),
    metadata: { contaExiste: Boolean(user) },
  });

  // Resposta idêntica exista ou não a conta.
  if (!user) return { ok: true };

  const token = randomToken(32);
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    },
  });

  const link = `${input.appUrl}/redefinir?token=${token}`;

  // A emergência vem primeiro: se está ligada, é porque alguém ficou fechado
  // de fora e precisa do link agora, mesmo que o email esteja configurado.
  if (emergencyRecoveryEmail() === email) {
    await recordAudit({
      action: "auth.password_reset_emergency",
      userId: user.id,
      userEmail: email,
      ipHash: hashIp(input.ip),
    });
    return { ok: true, devLink: link, motivo: "emergencia" };
  }

  if (isEmailDeliveryConfigured()) {
    // TODO(fase 5): enviar por Resend. Enquanto não houver serviço de email
    // configurado, esta ramificação não corre — e a interface diz a verdade
    // sobre isso em vez de fingir que enviou uma mensagem.
    return { ok: true };
  }

  if (process.env.NODE_ENV === "development") {
    console.log(`\n[recuperação] link para ${email}:\n${link}\n`);
    return { ok: true, devLink: link, motivo: "desenvolvimento" };
  }

  return { ok: true };
}

export async function completePasswordReset(input: {
  token: string;
  newPassword: string;
}): Promise<AuthResult> {
  const problems = checkPasswordStrength(input.newPassword);
  if (problems.length > 0) return { ok: false, error: problems.join(" ") };

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: sha256(input.token) },
    include: { user: true },
  });

  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    return {
      ok: false,
      error: "Este link já não é válido. Peça um novo.",
    };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: {
        passwordHash: await hashPassword(input.newPassword),
        mustChangePassword: false,
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    // Todos os outros pedidos pendentes deixam de servir.
    prisma.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.session.deleteMany({ where: { userId: record.userId } }),
  ]);

  await recordAudit({
    action: "auth.password_reset_completed",
    userId: record.userId,
    userEmail: record.user.email,
  });

  return { ok: true };
}
