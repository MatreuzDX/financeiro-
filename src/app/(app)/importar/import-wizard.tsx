"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, CopyCheck, FileUp, Sparkles } from "lucide-react";
import {
  Button,
  Card,
  ErrorBanner,
  Field,
  InfoNote,
  Select,
} from "@/components/ui";
import { formatCents } from "@/lib/money";
import { formatShort } from "@/lib/date";
import type { PreviewRow } from "@/server/import";
import { analisarAction, importarAction, type ImportState } from "./actions";

type Conta = { id: string; name: string };
type Categoria = { id: string; name: string; type: "INCOME" | "EXPENSE" };

/**
 * Importar um extrato, em dois passos separados de propósito:
 * escolher o ficheiro, e só depois confirmar o que vai entrar.
 *
 * Nada é gravado no primeiro passo. É a diferença entre um importador em que
 * se confia e um que obriga a limpar duzentos movimentos à mão quando corre
 * mal.
 */
export function ImportWizard({
  contas,
  categorias,
}: {
  contas: Conta[];
  categorias: Categoria[];
}) {
  const [analise, analisar] = useActionState<ImportState, FormData>(
    analisarAction,
    {},
  );

  if (analise.preview) {
    return (
      <Confirmar
        preview={analise.preview}
        categorias={categorias}
        aoRecomecar={() => window.location.reload()}
      />
    );
  }

  if (contas.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted">
          Primeiro crie a conta onde o extrato deve entrar.
        </p>
        <Link
          href="/contas"
          className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
        >
          Criar conta →
        </Link>
      </Card>
    );
  }

  return (
    <form action={analisar} className="space-y-4">
      {analise.error ? <ErrorBanner>{analise.error}</ErrorBanner> : null}

      <Card className="space-y-4 p-4">
        <Field
          label="Para que conta"
          hint="Os movimentos entram nesta conta e mexem no saldo dela"
        >
          <Select name="accountId" required defaultValue={contas[0]?.id}>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Ficheiro do extrato"
          hint="CSV descarregado do homebanking. Não serve PDF nem foto."
        >
          <input
            type="file"
            name="ficheiro"
            accept=".csv,.txt,text/csv,text/plain"
            required
            className="w-full rounded-xl border border-dashed border-line-strong bg-surface-2 p-3 text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-fg"
          />
        </Field>

        <Analisar />
      </Card>

      <InfoNote>
        <strong>Nada é gravado agora.</strong> Vai ver a lista toda antes de
        confirmar, com as categorias já preenchidas onde houver uma regra, e os
        movimentos repetidos assinalados.
      </InfoNote>

      <details className="rounded-2xl border border-line bg-surface p-4">
        <summary className="cursor-pointer text-sm font-medium text-ink">
          Onde encontro este ficheiro no meu banco?
        </summary>
        <div className="mt-3 space-y-2 text-xs leading-relaxed text-muted">
          <p>
            No homebanking, procure <strong>Movimentos</strong> ou{" "}
            <strong>Consulta de conta</strong> e um botão de{" "}
            <strong>Exportar</strong>, <strong>Descarregar</strong> ou{" "}
            <strong>Extrato</strong>. Escolha o formato <strong>CSV</strong> ou{" "}
            <strong>Excel/CSV</strong> — nunca PDF.
          </p>
          <p>
            Não faz mal se o ficheiro tiver meses que já importou: os
            movimentos repetidos são reconhecidos e não entram duas vezes.
          </p>
          <p>
            Os formatos dos bancos portugueses são todos diferentes uns dos
            outros. Se as colunas saírem trocadas, diga — melhor corrigir do
            que ficar com números errados.
          </p>
        </div>
      </details>
    </form>
  );
}

function Analisar() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      <FileUp size={16} aria-hidden />
      {pending ? "A ler o ficheiro…" : "Ler o extrato"}
    </Button>
  );
}

// ─── Passo 2: confirmar ────────────────────────────────────────────────────

type Escolha = { categoryId: string; incluir: boolean; aprender: boolean };

function Confirmar({
  preview,
  categorias,
  aoRecomecar,
}: {
  preview: NonNullable<ImportState["preview"]>;
  categorias: Categoria[];
  aoRecomecar: () => void;
}) {
  const [state, importar] = useActionState<ImportState, FormData>(
    importarAction,
    {},
  );

  const importaveis = useMemo(
    () => preview.rows.filter((r) => !r.problem && !r.duplicate),
    [preview.rows],
  );

  const [escolhas, setEscolhas] = useState<Record<string, Escolha>>(() =>
    Object.fromEntries(
      importaveis.map((r) => [
        r.hash,
        {
          categoryId: r.suggestedCategoryId ?? "",
          incluir: true,
          aprender: false,
        },
      ]),
    ),
  );

  if (state.resultado) {
    return (
      <Card className="space-y-3 p-5 text-center">
        <CheckCircle2 size={28} className="mx-auto text-positive" aria-hidden />
        <p className="text-base font-semibold text-ink">
          {state.resultado.importados} movimento
          {state.resultado.importados === 1 ? "" : "s"} importado
          {state.resultado.importados === 1 ? "" : "s"}
        </p>
        <p className="text-xs text-muted">
          Se alguma coisa correu mal, pode desfazer esta importação inteira na
          lista abaixo — apaga tudo o que entrou agora e mais nada.
        </p>
        <div className="flex justify-center gap-2 pt-1">
          <Link
            href="/movimentos"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-fg"
          >
            Ver os movimentos
          </Link>
          <Button variant="secondary" size="sm" onClick={aoRecomecar}>
            Importar outro
          </Button>
        </div>
      </Card>
    );
  }

  const selecionadas = importaveis.filter((r) => escolhas[r.hash]?.incluir);
  const semCategoria = selecionadas.filter((r) => !escolhas[r.hash]?.categoryId);

  function definir(hash: string, patch: Partial<Escolha>) {
    setEscolhas((prev) => ({ ...prev, [hash]: { ...prev[hash], ...patch } }));
  }

  /** Aplica a mesma categoria a tudo o que ainda não tem. Poupa muito clique. */
  function preencherTudo(categoryId: string, tipo: "INCOME" | "EXPENSE") {
    if (!categoryId) return;
    setEscolhas((prev) => {
      const next = { ...prev };
      for (const row of importaveis) {
        if (row.type === tipo && next[row.hash] && !next[row.hash].categoryId) {
          next[row.hash] = { ...next[row.hash], categoryId };
        }
      }
      return next;
    });
  }

  const linhas = selecionadas
    .filter((r) => escolhas[r.hash]?.categoryId)
    .map((r) => ({
      date: r.date,
      description: r.description,
      amountCents: r.amountCents,
      categoryId: escolhas[r.hash].categoryId,
      scope: r.scope,
      hash: r.hash,
      matchedRuleId: r.matchedRuleId,
      learn: escolhas[r.hash].aprender,
    }));

  return (
    <div className="space-y-4">
      {state.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}

      <Card className="space-y-3 p-4">
        <div>
          <p className="text-sm font-semibold text-ink">{preview.filename}</p>
          <p className="text-xs text-muted">
            {preview.accountName}
            {preview.resumo.de
              ? ` · ${formatShort(preview.resumo.de)} a ${formatShort(preview.resumo.ate!)}`
              : ""}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Resumo label="Para importar" valor={String(preview.resumo.prontos)} />
          <Resumo
            label="Já cá estavam"
            valor={String(preview.resumo.duplicados)}
            tom={preview.resumo.duplicados > 0 ? "aviso" : undefined}
          />
          <Resumo label="Entra" valor={formatCents(preview.resumo.entradasCents)} />
          <Resumo label="Sai" valor={formatCents(preview.resumo.saidasCents)} />
        </div>
      </Card>

      {preview.resumo.duplicados > 0 ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-xs text-muted">
          <CopyCheck size={15} className="mt-0.5 shrink-0 text-positive" aria-hidden />
          <p>
            <strong className="text-ink">
              {preview.resumo.duplicados} movimento
              {preview.resumo.duplicados === 1 ? "" : "s"}
            </strong>{" "}
            já tinha entrado numa importação anterior. Fica de fora — é normal,
            os extratos sobrepõem-se.
          </p>
        </div>
      ) : null}

      {preview.resumo.problemas > 0 ? (
        <details className="rounded-xl border border-warning/40 bg-warning-soft px-3 py-2.5">
          <summary className="cursor-pointer text-xs font-medium text-ink">
            <AlertTriangle size={13} className="mr-1.5 inline" aria-hidden />
            {preview.resumo.problemas} linha
            {preview.resumo.problemas === 1 ? "" : "s"} que não consegui ler
          </summary>
          <ul className="mt-2 space-y-1">
            {preview.rows
              .filter((r) => r.problem)
              .slice(0, 20)
              .map((r) => (
                <li key={r.lineNumber} className="text-[11px] text-muted">
                  Linha {r.lineNumber}: {r.problem}
                </li>
              ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted">
            Costumam ser cabeçalhos repetidos ou totais no fim do ficheiro. Se
            for um movimento a sério, registe-o à mão.
          </p>
        </details>
      ) : null}

      {semCategoria.length > 0 ? (
        <PreencherEmMassa
          categorias={categorias}
          emFalta={semCategoria.length}
          aoAplicar={preencherTudo}
        />
      ) : null}

      <ul className="space-y-2">
        {importaveis.map((row) => (
          <Linha
            key={row.hash}
            row={row}
            categorias={categorias}
            escolha={escolhas[row.hash]}
            aoMudar={(patch) => definir(row.hash, patch)}
          />
        ))}
      </ul>

      <form
        action={importar}
        className="sticky bottom-20 z-10 space-y-2 rounded-2xl border border-line-strong bg-surface p-3 shadow-lg sm:bottom-4"
      >
        <input type="hidden" name="linhas" value={JSON.stringify(linhas)} />
        <input type="hidden" name="accountId" value={preview.accountId} />
        <input type="hidden" name="filename" value={preview.filename} />
        <input type="hidden" name="totalRows" value={preview.resumo.total} />

        {semCategoria.length > 0 ? (
          <p className="text-center text-xs text-muted">
            Faltam {semCategoria.length} categoria
            {semCategoria.length === 1 ? "" : "s"} — essas linhas ficam de fora.
          </p>
        ) : null}

        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={aoRecomecar}>
            Cancelar
          </Button>
          <div className="flex-1">
            <Gravar quantas={linhas.length} />
          </div>
        </div>
      </form>
    </div>
  );
}

function Gravar({ quantas }: { quantas: number }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending || quantas === 0}
      className="w-full"
    >
      {pending
        ? "A importar…"
        : quantas === 0
          ? "Nada para importar"
          : `Importar ${quantas} movimento${quantas === 1 ? "" : "s"}`}
    </Button>
  );
}

function Resumo({
  label,
  valor,
  tom,
}: {
  label: string;
  valor: string;
  tom?: "aviso";
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-faint">{label}</p>
      <p
        className={`tabular mt-0.5 text-sm font-semibold ${
          tom === "aviso" ? "text-warning" : "text-ink"
        }`}
      >
        {valor}
      </p>
    </div>
  );
}

function PreencherEmMassa({
  categorias,
  emFalta,
  aoAplicar,
}: {
  categorias: Categoria[];
  emFalta: number;
  aoAplicar: (categoryId: string, tipo: "INCOME" | "EXPENSE") => void;
}) {
  const [despesa, setDespesa] = useState("");
  const [receita, setReceita] = useState("");

  return (
    <Card className="space-y-3 p-4">
      <p className="text-xs text-muted">
        Faltam <strong className="text-ink">{emFalta}</strong> por categorizar.
        Preencha as que sobrarem de uma vez e corrija depois só as que
        interessam.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex gap-2">
          <Select
            value={despesa}
            onChange={(e) => setDespesa(e.target.value)}
            aria-label="Categoria para as despesas em falta"
          >
            <option value="">Despesas em falta…</option>
            {categorias
              .filter((c) => c.type === "EXPENSE")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!despesa}
            onClick={() => aoAplicar(despesa, "EXPENSE")}
          >
            Aplicar
          </Button>
        </div>
        <div className="flex gap-2">
          <Select
            value={receita}
            onChange={(e) => setReceita(e.target.value)}
            aria-label="Categoria para as receitas em falta"
          >
            <option value="">Receitas em falta…</option>
            {categorias
              .filter((c) => c.type === "INCOME")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!receita}
            onClick={() => aoAplicar(receita, "INCOME")}
          >
            Aplicar
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Linha({
  row,
  categorias,
  escolha,
  aoMudar,
}: {
  row: PreviewRow;
  categorias: Categoria[];
  escolha: Escolha | undefined;
  aoMudar: (patch: Partial<Escolha>) => void;
}) {
  if (!escolha) return null;
  const negativo = (row.amountCents ?? 0) < 0;

  return (
    <li
      className={`rounded-xl border bg-surface p-3 transition-opacity ${
        escolha.incluir ? "border-line" : "border-line opacity-50"
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={escolha.incluir}
          onChange={(e) => aoMudar({ incluir: e.target.checked })}
          aria-label={`Importar ${row.description}`}
          className="mt-1 h-4 w-4 shrink-0 accent-[var(--primary)]"
        />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-ink">{row.description}</p>
          <p className="text-[11px] text-muted">
            {row.date ? formatShort(row.date) : ""}
          </p>
        </div>

        <span
          className={`tabular shrink-0 text-sm font-medium ${
            negativo ? "text-negative" : "text-positive"
          }`}
        >
          {formatCents(row.amountCents ?? 0)}
        </span>
      </div>

      {escolha.incluir ? (
        <div className="mt-2.5 space-y-2 pl-7">
          <Select
            value={escolha.categoryId}
            onChange={(e) => aoMudar({ categoryId: e.target.value })}
            aria-label={`Categoria de ${row.description}`}
            className="h-9 text-xs"
          >
            <option value="">Escolher categoria…</option>
            {categorias
              .filter((c) => c.type === row.type)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>

          {row.suggestedCategoryName ? (
            <p className="flex items-center gap-1.5 text-[11px] text-primary">
              <Sparkles size={11} aria-hidden />
              Preenchido por uma regra sua
            </p>
          ) : escolha.categoryId ? (
            <label className="flex items-center gap-2 text-[11px] text-muted">
              <input
                type="checkbox"
                checked={escolha.aprender}
                onChange={(e) => aoMudar({ aprender: e.target.checked })}
                className="h-3.5 w-3.5 accent-[var(--primary)]"
              />
              Lembrar para a próxima
            </label>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
