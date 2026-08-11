/**
 * Guardas de acesso.
 *
 * Isto é a SEGUNDA barreira. A primeira é o `proxy.ts`, que corre no edge e
 * só consegue ver se o cookie existe — não fala com a base de dados, por isso
 * não sabe se a sessão é válida. Esconder o menu não é barreira nenhuma:
 * escrever o endereço à mão contorna tudo o que só existe no browser.
 *
 * Toda a página privada e toda a Server Action começam por aqui.
 */

import "server-only";
import { redirect } from "next/navigation";
import { getSession, type SessionUser } from "./session";
import { can, type Action } from "./permissions";

/** Página privada: sem sessão, vai para o login (guardando o destino). */
export async function requireSession(
  returnTo?: string,
): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    const target = returnTo
      ? `/entrar?seguinte=${encodeURIComponent(returnTo)}`
      : "/entrar";
    redirect(target);
  }
  if (session.mustChangePassword) {
    redirect("/definicoes/palavra-passe?obrigatorio=1");
  }
  return session;
}

/**
 * Igual, mas sem o desvio da troca de palavra-passe — senão a própria página
 * de trocar a palavra-passe entrava num ciclo infinito de redirecionamentos.
 */
export async function requireSessionRaw(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/entrar");
  return session;
}

export async function requirePermission(action: Action): Promise<SessionUser> {
  const session = await requireSession();
  if (!can(session.role, action)) {
    redirect("/?erro=sem-permissao");
  }
  return session;
}

/**
 * Para Server Actions: em vez de redirecionar (que numa ação devolve um 303
 * mudo e faz a pessoa perder o que escreveu), devolve um erro tratável.
 */
export type ActionGuard =
  | { ok: true; session: SessionUser }
  | { ok: false; error: string };

export async function guardAction(action: Action): Promise<ActionGuard> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "A sua sessão expirou. Entre novamente." };
  }
  if (!can(session.role, action)) {
    return { ok: false, error: "Não tem permissão para fazer isto." };
  }
  return { ok: true, session };
}
