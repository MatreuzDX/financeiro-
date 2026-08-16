"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Trash2 } from "lucide-react";
import { deleteTransactionAction } from "@/app/(app)/movimentos/actions";

function Confirmar({ descricao }: { descricao: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={`Confirmar apagar ${descricao}`}
      className="h-8 rounded-lg bg-negative px-2.5 text-[11px] font-medium text-white disabled:opacity-60"
    >
      {pending ? "A apagar…" : "Apagar"}
    </button>
  );
}

/**
 * Apagar em dois passos.
 *
 * Estava a um clique só. Num sítio onde as linhas estão encostadas umas às
 * outras e se navega com o polegar, isso é apagar por engano à espera de
 * acontecer — e "confirmação explícita em ações consequentes" é das poucas
 * regras em que toda a gente que desenha apps financeiras concorda.
 *
 * Não é um diálogo do sistema: `confirm()` é bloqueante, feio no telemóvel,
 * e alguns browsers suprimem-no. É o próprio botão que se transforma.
 */
export function DeleteTransactionButton({
  id,
  descricao,
}: {
  id: string;
  descricao: string;
}) {
  const [aPerguntar, setAPerguntar] = useState(false);

  if (!aPerguntar) {
    return (
      <button
        type="button"
        onClick={() => setAPerguntar(true)}
        title="Apagar movimento"
        aria-label={`Apagar ${descricao}`}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-faint transition-colors hover:bg-negative-soft hover:text-negative"
      >
        <Trash2 size={15} aria-hidden />
      </button>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={() => setAPerguntar(false)}
        className="h-8 rounded-lg px-2 text-[11px] font-medium text-muted hover:bg-surface-hover"
      >
        Manter
      </button>
      <form action={deleteTransactionAction}>
        <input type="hidden" name="id" value={id} />
        <Confirmar descricao={descricao} />
      </form>
    </div>
  );
}
