"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, X } from "lucide-react";
import {
  Button,
  ErrorBanner,
  Field,
  Input,
  MoneyInput,
  Select,
  SuccessBanner,
} from "@/components/ui";
import { createRecurringAction, type RecurringState } from "./actions";

type Opcao = { id: string; name: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "A criar…" : "Criar recorrência"}
    </Button>
  );
}

export function RecurringForm({
  accounts,
  expenseCategories,
  incomeCategories,
  today,
}: {
  accounts: Opcao[];
  expenseCategories: Opcao[];
  incomeCategories: Opcao[];
  today: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [state, action] = useActionState<RecurringState, FormData>(
    createRecurringAction,
    {},
  );
  const [tipo, setTipo] = useState("EXPENSE");
  const [frequencia, setFrequencia] = useState("MONTHLY");

  const categorias = tipo === "INCOME" ? incomeCategories : expenseCategories;

  if (!aberto) {
    return (
      <>
        {state.success ? <SuccessBanner>{state.success}</SuccessBanner> : null}
        <Button
          variant="secondary"
          onClick={() => setAberto(true)}
          className="w-full"
        >
          <Plus size={16} aria-hidden />
          Nova recorrência
        </Button>
      </>
    );
  }

  return (
    <form
      action={action}
      className="animate-rise space-y-4 rounded-2xl border border-line bg-surface p-4"
      noValidate
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Nova recorrência</h3>
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
      {state.success ? <SuccessBanner>{state.success}</SuccessBanner> : null}

      <Field label="O que é" hint="Renda, Internet, Ordenado…">
        <Input name="name" required maxLength={80} placeholder="Renda" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo">
          <Select
            name="type"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
          >
            <option value="EXPENSE">Despesa</option>
            <option value="INCOME">Receita</option>
          </Select>
        </Field>

        <Field label="Valor">
          <MoneyInput name="amount" required />
        </Field>
      </div>

      <Field label="Conta">
        <Select name="accountId" required defaultValue="">
          <option value="">Escolher…</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Categoria">
        <Select name="categoryId" required defaultValue="">
          <option value="">Escolher…</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Com que frequência">
        <Select
          name="frequency"
          value={frequencia}
          onChange={(e) => setFrequencia(e.target.value)}
        >
          <option value="MONTHLY">Todos os meses</option>
          <option value="WEEKLY">Todas as semanas</option>
          <option value="QUARTERLY">De três em três meses</option>
          <option value="YEARLY">Uma vez por ano</option>
        </Select>
      </Field>

      {frequencia === "WEEKLY" ? (
        <Field label="Dia da semana">
          <Select name="weekday" defaultValue="1">
            <option value="1">Segunda-feira</option>
            <option value="2">Terça-feira</option>
            <option value="3">Quarta-feira</option>
            <option value="4">Quinta-feira</option>
            <option value="5">Sexta-feira</option>
            <option value="6">Sábado</option>
            <option value="7">Domingo</option>
          </Select>
        </Field>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Dia do mês"
            hint="Em meses curtos, usa-se o último dia disponível."
          >
            <Input
              name="dayOfMonth"
              type="number"
              min={1}
              max={31}
              defaultValue={1}
              required
            />
          </Field>

          {frequencia === "YEARLY" ? (
            <Field label="Mês">
              <Select name="monthOfYear" defaultValue="1">
                {[
                  "Janeiro",
                  "Fevereiro",
                  "Março",
                  "Abril",
                  "Maio",
                  "Junho",
                  "Julho",
                  "Agosto",
                  "Setembro",
                  "Outubro",
                  "Novembro",
                  "Dezembro",
                ].map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="A partir de">
          <Input type="date" name="startDate" required defaultValue={today} />
        </Field>
        <Field label="Até" hint="Opcional — deixe vazio para não ter fim">
          <Input type="date" name="endDate" />
        </Field>
      </div>

      <Field label="Âmbito">
        <Select name="scope" defaultValue="PERSONAL">
          <option value="PERSONAL">Pessoal</option>
          <option value="BUSINESS">Profissional</option>
        </Select>
      </Field>

      <SubmitButton />
    </form>
  );
}
