"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Plus, X } from "lucide-react";
import { registoRapidoAction, type RapidoState } from "@/app/(app)/rapido-actions";

type Categoria = { id: string; name: string; color: string | null };

function Gravar({ desativado }: { desativado: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || desativado}
      className="h-12 w-full rounded-xl bg-primary text-sm font-medium text-primary-fg disabled:opacity-40"
    >
      {pending ? "A guardar…" : "Guardar"}
    </button>
  );
}

/**
 * Registar uma despesa sem mudar de página.
 *
 * Três toques: abrir, marcar o valor, escolher a categoria. A data é hoje, a
 * conta é a primeira, e não se pergunta mais nada — o formulário completo
 * continua a existir para os casos que precisam dele.
 *
 * É a ação mais repetida da app inteira. Se cansar, deixa-se de registar, e
 * uma app de finanças com dados a meio é pior do que nenhuma: os números
 * passam a mentir com ar de verdade.
 *
 * O teclado é desenhado à mão em vez de um `<input type=number>` porque no
 * telemóvel o teclado do sistema tapa metade do ecrã e esconde as categorias,
 * que é exatamente o toque seguinte.
 */
export function RegistoRapido({ categorias }: { categorias: Categoria[] }) {
  const [aberto, setAberto] = useState(false);
  const [state, action] = useActionState<RapidoState, FormData>(
    registoRapidoAction,
    {},
  );

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label="Registo rápido"
        className="fixed bottom-24 right-4 z-30 grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-fg shadow-lg transition-transform active:scale-95 sm:bottom-6"
      >
        <Plus size={24} aria-hidden />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/40">
      <button
        type="button"
        aria-label="Fechar"
        onClick={() => setAberto(false)}
        className="flex-1"
      />

      <div className="animate-rise max-h-[88vh] overflow-y-auto rounded-t-3xl border-t border-line bg-surface p-4 pb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Registo rápido</h2>
          <button
            type="button"
            onClick={() => setAberto(false)}
            aria-label="Fechar"
            className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-hover"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        {state.guardado ? (
          <div className="animate-fade mb-3 flex items-center gap-2 rounded-xl border border-positive/30 bg-positive-soft px-3 py-2.5 text-sm text-positive">
            <Check size={15} className="shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate">
              Guardado: {state.guardado}
            </span>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="shrink-0 text-xs font-medium underline"
            >
              Fechar
            </button>
          </div>
        ) : null}

        {state.error ? (
          <p className="mb-3 rounded-xl border border-negative/30 bg-negative-soft px-3 py-2.5 text-sm text-negative">
            {state.error}
          </p>
        ) : null}

        {/*
          A chave muda a cada gravação e o formulário remonta limpo. É por
          isso que não há nenhum efeito a chamar setState — limpar campos
          dentro de um `useEffect` é a receita para atualizações em cascata.
          E o painel fica ABERTO de propósito: quem regista uma despesa
          costuma ter duas ou três para registar.
        */}
        <Formulario key={state.n ?? 0} action={action} categorias={categorias} />
      </div>
    </div>
  );
}

function Formulario({
  action,
  categorias,
}: {
  action: (formData: FormData) => void;
  categorias: Categoria[];
}) {
  const [valor, setValor] = useState("");
  const [categoria, setCategoria] = useState("");

  function tecla(t: string) {
    setValor((v) => {
      if (t === "apagar") return v.slice(0, -1);
      if (t === ",") return v.includes(",") ? v : v === "" ? "0," : `${v},`;
      // Duas casas decimais chegam para dinheiro.
      if (v.includes(",") && v.split(",")[1].length >= 2) return v;
      if (v.length >= 9) return v;
      return v + t;
    });
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="amount" value={valor} />
      <input type="hidden" name="categoryId" value={categoria} />

      <p
        className="tabular py-2 text-center text-4xl font-semibold text-ink"
        aria-live="polite"
      >
        {valor === "" ? <span className="text-faint">0,00</span> : valor}
        <span className="ml-1 text-2xl text-muted">€</span>
      </p>

      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "apagar"].map(
          (t) => (
            <button
              key={t}
              type="button"
              onClick={() => tecla(t)}
              aria-label={t === "apagar" ? "Apagar o último algarismo" : t}
              className="h-12 rounded-xl border border-line bg-surface-2 text-lg font-medium text-ink transition-colors active:bg-surface-hover"
            >
              {t === "apagar" ? "⌫" : t}
            </button>
          ),
        )}
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted">Em quê</p>
        <ul className="flex flex-wrap gap-1.5">
          {categorias.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setCategoria(c.id)}
                aria-pressed={categoria === c.id}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  categoria === c.id
                    ? "border-primary bg-primary text-primary-fg"
                    : "border-line bg-surface-2 text-ink hover:bg-surface-hover"
                }`}
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <input
        name="description"
        placeholder="Onde? (opcional)"
        maxLength={80}
        autoComplete="off"
        className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-ink placeholder:text-faint"
      />

      <Gravar desativado={valor === "" || categoria === ""} />

      <p className="text-center text-[11px] text-faint">
        Fica com a data de hoje e na sua primeira conta. Para mudar isso, use o
        formulário completo.
      </p>
    </form>
  );
}
