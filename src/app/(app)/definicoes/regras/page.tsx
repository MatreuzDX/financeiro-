import type { Metadata } from "next";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { requireSession } from "@/server/auth/guard";
import { listCategories } from "@/server/categories";
import { listRules } from "@/server/rules";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { RuleForm } from "./rule-form";
import { deleteRuleAction } from "./actions";

export const metadata: Metadata = { title: "Regras de categorização" };

export default async function RegrasPage() {
  const session = await requireSession("/definicoes/regras");
  const [regras, categorias] = await Promise.all([
    listRules(session.workspaceId),
    listCategories(session.workspaceId),
  ]);

  const acertos = regras.reduce((s, r) => s + r.hits, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Regras de categorização"
        description="Para a app categorizar sozinha o que vem do banco"
      />

      <Card className="p-4">
        <p className="text-xs leading-relaxed text-muted">
          Uma regra é uma frase simples: <strong>«se a descrição contiver
          PINGO DOCE, é Supermercado»</strong>. Quando importa um extrato, as
          linhas que baterem já vêm preenchidas.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Quando duas regras batem na mesma linha, ganha a mais específica —
          uma regra para «continente bom dia» passa à frente de uma para
          «continente».
        </p>
        {acertos > 0 ? (
          <p className="mt-2 text-xs font-medium text-positive">
            Já pouparam {acertos} categorização{acertos === 1 ? "" : "ões"} à mão.
          </p>
        ) : null}
      </Card>

      <RuleForm
        categorias={categorias.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
        }))}
      />

      {regras.length === 0 ? (
        <EmptyState
          title="Ainda não há regras"
          description="Crie a primeira acima, ou marque «lembrar para a próxima» ao importar um extrato — dá no mesmo e é menos trabalho."
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {regras.map((regra) => (
            <li key={regra.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">
                  <span className="text-muted">contém</span> {regra.label}
                </p>
                <p className="truncate text-[11px] text-muted">
                  → {regra.categoryName}
                  {regra.scope === "BUSINESS" ? " · Profissional" : ""}
                  {regra.hits > 0
                    ? ` · acertou ${regra.hits} vez${regra.hits === 1 ? "" : "es"}`
                    : ""}
                </p>
              </div>

              {regra.hits === 0 ? (
                <Badge tone="neutral">por estrear</Badge>
              ) : null}

              <form action={deleteRuleAction}>
                <input type="hidden" name="id" value={regra.id} />
                <button
                  type="submit"
                  title="Apagar regra"
                  aria-label={`Apagar a regra ${regra.label}`}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-faint transition-colors hover:bg-surface-hover hover:text-negative"
                >
                  <Trash2 size={15} aria-hidden />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted">
        Apagar uma regra não mexe nos movimentos já categorizados — só deixa de
        se aplicar a partir de agora.{" "}
        <Link href="/importar" className="font-medium text-primary hover:underline">
          Importar um extrato →
        </Link>
      </p>
    </div>
  );
}
