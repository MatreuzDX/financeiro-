"use server";

import { guardAction } from "@/server/auth/guard";
import { perguntar } from "@/server/ai/agent";
import type { Grafico } from "@/server/ai/tools";

export type Mensagem = {
  papel: "pessoa" | "assistente";
  texto: string;
  grafico?: Grafico;
};

export type ChatState = {
  mensagens: Mensagem[];
  error?: string;
  usadas?: number;
  limite?: number;
  local?: boolean;
};

/** 500 caracteres chegam para qualquer pergunta sobre dinheiro. */
const MAX_PERGUNTA = 500;

export async function perguntarAction(
  prev: ChatState,
  formData: FormData,
): Promise<ChatState> {
  const guard = await guardAction("data:read");
  if (!guard.ok) return { ...prev, error: guard.error };

  const pergunta = String(formData.get("pergunta") ?? "").trim();
  if (pergunta === "") return prev;
  if (pergunta.length > MAX_PERGUNTA) {
    return { ...prev, error: `A pergunta é longa demais (máximo ${MAX_PERGUNTA} letras).` };
  }

  const comPergunta: Mensagem[] = [
    ...prev.mensagens,
    { papel: "pessoa", texto: pergunta },
  ];

  try {
    const resposta = await perguntar(
      guard.session,
      pergunta,
      prev.mensagens.map((m) => ({ papel: m.papel, texto: m.texto })),
    );

    return {
      mensagens: [
        ...comPergunta,
        { papel: "assistente", texto: resposta.texto, grafico: resposta.grafico },
      ],
      usadas: resposta.usadas,
      limite: resposta.limite,
      local: resposta.local,
    };
  } catch (error) {
    return {
      mensagens: comPergunta,
      error:
        error instanceof Error ? error.message : "Não consegui responder agora.",
    };
  }
}
