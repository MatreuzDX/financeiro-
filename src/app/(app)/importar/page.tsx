import type { Metadata } from "next";
import Link from "next/link";
import { Undo2 } from "lucide-react";
import { requireSession } from "@/server/auth/guard";
import { listAccounts } from "@/server/accounts";
import { listCategories } from "@/server/categories";
import { listarImportacoes } from "@/server/import";
import { listRules } from "@/server/rules";
import { Card, PageHeader } from "@/components/ui";
import { formatShort } from "@/lib/date";
import { toIso } from "@/lib/date";
import { ImportWizard } from "./import-wizard";
import { desfazerAction } from "./actions";

export const metadata: Metadata = { title: "Importar extrato" };

export default async function ImportarPage() {
  const session = await requireSession("/importar");

  const [contas, categorias, importacoes, regras] = await Promise.all([
    listAccounts(session.workspaceId),
    listCategories(session.workspaceId),
    listarImportacoes(session.workspaceId),
    listRules(session.workspaceId),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Importar extrato"
        description="Traga os movimentos do banco em vez de os escrever um a um"
      />

      <ImportWizard
        contas={contas.map((c) => ({ id: c.id, name: c.name }))}
        categorias={categorias.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
        }))}
      />

      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">
            Regras de categorização
          </h2>
          <Link
            href="/definicoes/regras"
            className="text-xs font-medium text-primary hover:underline"
          >
            {regras.length > 0 ? `Ver as ${regras.length}` : "Criar"}
          </Link>
        </div>
        <p className="text-xs leading-relaxed text-muted">
          {regras.length > 0
            ? `${regras.length} regra${regras.length === 1 ? "" : "s"} a preencher categorias sozinha${regras.length === 1 ? "" : "s"}. Quanto mais tiver, menos trabalho dá a próxima importação.`
            : "Ainda não tem nenhuma. Ao categorizar uma linha, marque «lembrar para a próxima» e da próxima vez já vem preenchida."}
        </p>
      </section>

      {importacoes.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-ink">
            Importações anteriores
          </h2>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {importacoes.map((imp) => (
              <li key={imp.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{imp.filename}</p>
                  <p className="text-[11px] text-muted">
                    {formatShort(toIso(imp.createdAt))} · {imp.accountName} ·{" "}
                    {imp.undoneAt
                      ? "desfeita"
                      : `${imp.importedRows} movimento${imp.importedRows === 1 ? "" : "s"}`}
                  </p>
                </div>

                {!imp.undoneAt && imp.aindaLa > 0 ? (
                  <form action={desfazerAction}>
                    <input type="hidden" name="batchId" value={imp.id} />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-2.5 py-1.5 text-[11px] font-medium text-ink hover:bg-surface-hover"
                    >
                      <Undo2 size={12} aria-hidden />
                      Desfazer
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted">
            Desfazer apaga apenas os movimentos que entraram nessa importação.
            O que registou à mão nunca é tocado.
          </p>
        </section>
      ) : null}

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-ink">
          Porque é que isto importa
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          Registar tudo à mão funciona umas três semanas. Depois falha-se um
          dia, depois uma semana, e a app fica com dados a meio — que é pior do
          que não ter app nenhuma, porque aí os números <em>parecem</em>{" "}
          verdadeiros e não são. Importar o extrato uma vez por mês resolve
          isso em dois minutos. O que continua a valer a pena registar à mão é
          o dinheiro vivo, que no extrato aparece só como um levantamento.
        </p>
      </Card>
    </div>
  );
}
