"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Send, Sparkles } from "lucide-react";
import { AiChart } from "@/components/ai-chart";
import { ErrorBanner } from "@/components/ui";
import { perguntarAction, type ChatState } from "./actions";

function Enviar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="Perguntar"
      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-fg disabled:opacity-50"
    >
      <Send size={16} aria-hidden />
    </button>
  );
}

function AEscrever() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <div className="animate-fade flex items-center gap-2 rounded-2xl rounded-bl-sm border border-line bg-surface px-3.5 py-3">
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </span>
      <span className="text-xs text-muted">a ver os seus números…</span>
    </div>
  );
}

/**
 * Texto do assistente com **negrito** e parágrafos.
 *
 * Escrito à mão em vez de trazer uma biblioteca de Markdown: só se aceita
 * negrito e quebras de linha, e nada de HTML. Uma biblioteca completa aqui
 * seria peso e superfície de ataque a troco de nada.
 */
function Texto({ children }: { children: string }) {
  return (
    <>
      {children.split("\n").map((linha, i) => (
        <p key={i} className={linha.trim() === "" ? "h-2" : "text-sm leading-relaxed"}>
          {linha.split(/(\*\*[^*]+\*\*)/g).map((parte, j) =>
            parte.startsWith("**") && parte.endsWith("**") ? (
              <strong key={j} className="font-semibold">
                {parte.slice(2, -2)}
              </strong>
            ) : (
              parte
            ),
          )}
        </p>
      ))}
    </>
  );
}

export function Chat({
  sugestoes,
  ligado,
}: {
  sugestoes: string[];
  ligado: boolean;
}) {
  const [state, action] = useActionState<ChatState, FormData>(perguntarAction, {
    mensagens: [],
  });
  const fim = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    if (campo.current) campo.current.value = "";
  }, [state.mensagens.length]);

  return (
    <div className="space-y-4">
      {state.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}

      {state.mensagens.length === 0 ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-line bg-surface p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-ink">
              <Sparkles size={15} className="text-primary" aria-hidden />
              Pergunte sobre o seu dinheiro
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              Responde só com os seus números — vai buscá-los à base de dados
              antes de dizer seja o que for. Quando não houver dados, diz que
              não há, em vez de inventar.
            </p>
          </div>

          <ul className="space-y-2">
            {sugestoes.map((s) => (
              <li key={s}>
                <form action={action}>
                  <input type="hidden" name="pergunta" value={s} />
                  <button
                    type="submit"
                    className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-left text-sm text-ink transition-colors hover:bg-surface-hover"
                  >
                    {s}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ul className="space-y-3">
          {state.mensagens.map((m, i) => (
            <li
              key={i}
              className={m.papel === "pessoa" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={
                  m.papel === "pessoa"
                    ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2.5 text-sm text-primary-fg"
                    : "max-w-[92%] rounded-2xl rounded-bl-sm border border-line bg-surface px-3.5 py-3 text-ink"
                }
              >
                {m.papel === "pessoa" ? m.texto : <Texto>{m.texto}</Texto>}
                {m.grafico ? <AiChart grafico={m.grafico} /> : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="sticky bottom-20 z-10 sm:bottom-4">
        <AEscrever />
        <div className="mt-2 flex gap-2 rounded-2xl border border-line-strong bg-surface p-2 shadow-lg">
          <input
            ref={campo}
            name="pergunta"
            maxLength={500}
            autoComplete="off"
            placeholder={
              ligado ? "Quanto gastei este mês?" : "O assistente está desligado"
            }
            className="h-11 w-full min-w-0 rounded-xl bg-transparent px-2 text-sm text-ink placeholder:text-faint focus:outline-none"
          />
          <Enviar />
        </div>
      </form>

      {state.usadas !== undefined && state.limite ? (
        <p className="text-center text-[11px] text-faint">
          {state.usadas} de {state.limite} perguntas usadas este mês
        </p>
      ) : null}
      <div ref={fim} />
    </div>
  );
}
