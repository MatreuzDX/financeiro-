"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Plus } from "lucide-react";
import { Button, ErrorBanner, Field, Input, Select, SuccessBanner } from "@/components/ui";
import { createRuleAction, type RegrasState } from "./actions";

type Categoria = { id: string; name: string; type: "INCOME" | "EXPENSE" };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      <Plus size={16} aria-hidden />
      {pending ? "A guardar…" : "Criar regra"}
    </Button>
  );
}

export function RuleForm({ categorias }: { categorias: Categoria[] }) {
  const [state, action] = useActionState<RegrasState, FormData>(
    createRuleAction,
    {},
  );

  return (
    <form
      action={action}
      key={state.criada}
      className="space-y-4 rounded-2xl border border-line bg-surface p-4"
      noValidate
    >
      {state.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}
      {state.criada ? (
        <SuccessBanner>Regra guardada para «{state.criada}».</SuccessBanner>
      ) : null}

      <Field
        label="Quando a descrição contiver"
        hint="Escreva só o nome do sítio: PINGO DOCE, GALP, EDP. Não distingue maiúsculas nem acentos."
      >
        <Input
          name="label"
          required
          maxLength={80}
          placeholder="PINGO DOCE"
          autoComplete="off"
        />
      </Field>

      <Field label="A categoria é">
        <Select name="categoryId" required defaultValue="">
          <option value="" disabled>
            Escolher…
          </option>
          <optgroup label="Despesas">
            {categorias
              .filter((c) => c.type === "EXPENSE")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </optgroup>
          <optgroup label="Receitas">
            {categorias
              .filter((c) => c.type === "INCOME")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </optgroup>
        </Select>
      </Field>

      <Field label="E conta como">
        <Select name="scope" defaultValue="PERSONAL">
          <option value="PERSONAL">Pessoal</option>
          <option value="BUSINESS">Profissional</option>
        </Select>
      </Field>

      <Submit />
    </form>
  );
}
