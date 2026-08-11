"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowLeftRight, TrendingDown, TrendingUp } from "lucide-react";
import {
  Button,
  ErrorBanner,
  Field,
  Input,
  MoneyInput,
  Select,
  Textarea,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { createTransactionAction, type TxFormState } from "../actions";

type Option = { id: string; name: string };

const TABS = [
  { value: "EXPENSE", label: "Despesa", Icon: TrendingDown },
  { value: "INCOME", label: "Receita", Icon: TrendingUp },
  { value: "TRANSFER", label: "Transferência", Icon: ArrowLeftRight },
] as const;

type TxType = (typeof TABS)[number]["value"];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "A guardar…" : "Guardar"}
    </Button>
  );
}

/**
 * O formulário mais usado da aplicação.
 *
 * O que a pessoa vê são três separadores — Despesa, Receita, Transferência.
 * As palavras "débito" e "crédito" nunca aparecem: a tradução para as linhas
 * do livro acontece no servidor.
 */
export function TransactionForm({
  accounts,
  expenseCategories,
  incomeCategories,
  incomeSources,
  vehicles,
  today,
  initialType = "EXPENSE",
}: {
  accounts: Option[];
  expenseCategories: Option[];
  incomeCategories: Option[];
  incomeSources: Option[];
  vehicles: Option[];
  today: string;
  initialType?: TxType;
}) {
  const [state, action] = useActionState<TxFormState, FormData>(
    createTransactionAction,
    {},
  );
  const [type, setType] = useState<TxType>(initialType);
  const values = state.values ?? {};
  const fieldError = (name: string) => state.fieldErrors?.[name];

  const categories = type === "INCOME" ? incomeCategories : expenseCategories;
  const noAccounts = accounts.length === 0;

  if (noAccounts) {
    return (
      <ErrorBanner>
        Antes de registar movimentos precisa de pelo menos uma conta.{" "}
        <a href="/contas" className="font-medium underline">
          Criar conta
        </a>
      </ErrorBanner>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="type" value={type} />

      <div
        className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-surface-2 p-1"
        role="tablist"
      >
        {TABS.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={type === value}
            onClick={() => setType(value)}
            className={cn(
              "flex h-10 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors",
              type === value
                ? "bg-surface text-ink shadow-[var(--shadow)]"
                : "text-muted hover:text-ink",
            )}
          >
            <Icon size={15} aria-hidden />
            <span className="hidden xs:inline sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {state.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}

      <Field label="Valor" error={fieldError("amount") ?? fieldError("amountCents")}>
        <MoneyInput
          name="amount"
          required
          autoFocus
          defaultValue={values.amount ?? ""}
        />
      </Field>

      <Field label="Descrição" error={fieldError("description")}>
        <Input
          name="description"
          required
          maxLength={200}
          placeholder={
            type === "INCOME"
              ? "Ordenado, trabalho, venda…"
              : type === "TRANSFER"
                ? "Passagem para a poupança"
                : "Supermercado, combustível…"
          }
          defaultValue={values.description ?? ""}
        />
      </Field>

      {type === "TRANSFER" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="De" error={fieldError("fromAccountId")}>
            <Select name="fromAccountId" required defaultValue={values.fromAccountId ?? ""}>
              <option value="">Escolher…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Para" error={fieldError("toAccountId")}>
            <Select name="toAccountId" required defaultValue={values.toAccountId ?? ""}>
              <option value="">Escolher…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      ) : (
        <>
          <Field
            label={type === "INCOME" ? "Entrou na conta" : "Saiu da conta"}
            error={fieldError("accountId")}
          >
            <Select name="accountId" required defaultValue={values.accountId ?? ""}>
              <option value="">Escolher…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Categoria" error={fieldError("categoryId")}>
            <Select name="categoryId" required defaultValue={values.categoryId ?? ""}>
              <option value="">Escolher…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Data" error={fieldError("date")}>
          <Input
            type="date"
            name="date"
            required
            defaultValue={values.date ?? today}
          />
        </Field>

        <Field label="Âmbito" hint="Separa a vida pessoal do trabalho">
          <Select name="scope" defaultValue={values.scope ?? "PERSONAL"}>
            <option value="PERSONAL">Pessoal</option>
            <option value="BUSINESS">Profissional</option>
          </Select>
        </Field>
      </div>

      {type === "INCOME" && incomeSources.length > 0 ? (
        <Field label="Fonte de rendimento" hint="Opcional">
          <Select name="incomeSourceId" defaultValue={values.incomeSourceId ?? ""}>
            <option value="">Sem fonte definida</option>
            {incomeSources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      {type !== "TRANSFER" && vehicles.length > 0 ? (
        <Field
          label="Veículo"
          hint="Associe para este valor contar no custo por quilómetro"
        >
          <Select name="vehicleId" defaultValue={values.vehicleId ?? ""}>
            <option value="">Nenhum</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <Field label="Notas" hint="Opcional">
        <Textarea name="notes" maxLength={2000} defaultValue={values.notes ?? ""} />
      </Field>

      <SubmitButton />
    </form>
  );
}
