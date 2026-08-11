"use server";

import { revalidatePath } from "next/cache";
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
  return {
    success:
      "Palavra-passe alterada. As restantes sessões abertas foram fechadas.",
  };
}
