"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { guardAction } from "@/server/auth/guard";
import { applySetup } from "@/server/setup";

export type SetupState = { error?: string };

/**
 * Recebe as respostas do assistente já em cêntimos — a conversão do que a
 * pessoa escreveu ("12,40") acontece no cliente, com o mesmo
 * `parseAmountToCents` que o resto da app usa, e aqui só se aceitam
 * inteiros. Assim não há duas interpretações diferentes do mesmo texto.
 */
export async function completeSetupAction(
  payload: unknown,
): Promise<SetupState> {
  const guard = await guardAction("data:write");
  if (!guard.ok) return { error: guard.error };

  try {
    await applySetup(guard.session, payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        error:
          error.issues[0]?.message ??
          "Há um campo preenchido de forma inválida.",
      };
    }
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível guardar a configuração.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/?configurado=1");
}
