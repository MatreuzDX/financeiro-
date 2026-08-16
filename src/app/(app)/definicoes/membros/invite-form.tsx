"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Copy, Plus, UserPlus, X } from "lucide-react";
import {
  Button,
  ErrorBanner,
  Field,
  Input,
  InfoNote,
  Select,
} from "@/components/ui";
import {
  createWorkspaceAction,
  inviteMemberAction,
  type MembrosState,
} from "./actions";

function Submit({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "A criar…" : children}
    </Button>
  );
}

export function InviteForm() {
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [state, action] = useActionState<MembrosState, FormData>(
    inviteMemberAction,
    {},
  );

  async function copiar(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sem permissão para a área de transferência: o link está à vista e
      // dá para selecionar à mão. Não vale a pena assustar ninguém.
    }
  }

  if (state.convite) {
    return (
      <div className="animate-rise space-y-3 rounded-2xl border border-primary/30 bg-primary-soft p-4">
        <p className="text-sm font-medium text-primary">
          Convite criado para {state.convite.email}
        </p>
        <p className="text-xs leading-relaxed text-primary/80">
          Não enviei nenhum email — esta app ainda não tem serviço de envio, e
          prefiro dizê-lo do que fingir que enviou. <strong>Copie o link e
          mande-o</strong> por WhatsApp ou mensagem. Vale 14 dias.
        </p>

        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface p-2">
          <code className="min-w-0 flex-1 truncate text-[11px] text-muted">
            {state.convite.link}
          </code>
          <button
            type="button"
            onClick={() => copiar(state.convite!.link)}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-[11px] font-medium text-primary-fg"
          >
            {copiado ? <Check size={13} /> : <Copy size={13} />}
            {copiado ? "Copiado" : "Copiar"}
          </button>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => window.location.reload()}
        >
          Convidar outra pessoa
        </Button>
      </div>
    );
  }

  if (!aberto) {
    return (
      <Button
        variant="secondary"
        onClick={() => setAberto(true)}
        className="w-full"
      >
        <UserPlus size={16} aria-hidden />
        Convidar alguém
      </Button>
    );
  }

  return (
    <form
      action={action}
      className="animate-rise space-y-4 rounded-2xl border border-line bg-surface p-4"
      noValidate
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Convidar alguém</h3>
        <button
          type="button"
          onClick={() => setAberto(false)}
          aria-label="Fechar"
          className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-hover"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      {state.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}

      <Field label="Email da pessoa">
        <Input
          name="email"
          type="email"
          required
          autoFocus
          placeholder="pessoa@exemplo.com"
        />
      </Field>

      <Field label="O que pode fazer">
        <Select name="role" defaultValue="MEMBER">
          <option value="MEMBER">Membro — regista e edita movimentos</option>
          <option value="VIEWER">Só ver — não altera nada</option>
          <option value="ADMIN">Administrador — faz tudo menos apagar o espaço</option>
        </Select>
      </Field>

      <InfoNote>
        Quem entra num espaço vê <strong>tudo</strong> o que lá está: saldos,
        movimentos, gráficos. Não há despesas privadas dentro de um espaço
        partilhado — para isso, use um espaço à parte.
      </InfoNote>

      <Submit>Criar convite</Submit>
    </form>
  );
}

export function NewWorkspaceForm() {
  const [aberto, setAberto] = useState(false);
  const [state, action] = useActionState<MembrosState, FormData>(
    createWorkspaceAction,
    {},
  );

  if (!aberto) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setAberto(true)}
        className="w-full"
      >
        <Plus size={15} aria-hidden />
        Criar outro espaço
      </Button>
    );
  }

  return (
    <form action={action} className="animate-rise space-y-3" noValidate>
      {state.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}
      <Field
        label="Nome do espaço"
        hint="Nós os dois, Casa, A loja — o que fizer sentido"
      >
        <Input name="name" required autoFocus maxLength={60} placeholder="Casa" />
      </Field>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setAberto(false)}
        >
          Cancelar
        </Button>
        <div className="flex-1">
          <Submit>Criar espaço</Submit>
        </div>
      </div>
    </form>
  );
}
