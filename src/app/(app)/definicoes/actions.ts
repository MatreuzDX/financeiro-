"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/session";
import { changePassword } from "@/server/auth/service";

export type PasswordState = { error?: string; success?: string };

export async function changePasswordAction(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const session = await getSession();
  if (!session) return { error: "A sua sessão expirou. Entre novamente." };

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next !== confirm) {
    return { error: "As duas palavras-passe novas não são iguais." };
  }

  const result = await changePassword({
    userId: session.userId,
    userEmail: session.email,
    currentPassword: current,
    newPassword: next,
    keepSessionId: session.sessionId,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/", "layout");

  // BUG apanhado a testar: quem foi OBRIGADO a trocar a palavra-passe ficava
  // preso nesta página. A troca corria bem, mas o aviso "defina uma que só
  // você conheça" continuava lá — e não havia botão nenhum para seguir em
  // frente. Agora, cumprida a obrigação, vai direto para o início.
  //
  // Redirecionar só faz sentido no caminho de SUCESSO: num erro, devolve-se
  // estado para o formulário manter o que a pessoa escreveu.
  if (session.mustChangePassword) redirect("/");

  return {
    success:
      "Palavra-passe alterada. As restantes sessões abertas foram fechadas.",
  };
}
