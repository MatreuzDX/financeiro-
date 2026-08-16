import type { Metadata } from "next";
import { requireSession } from "@/server/auth/guard";
import { prisma } from "@/server/db";
import { AUDIT_LABELS } from "@/server/audit";
import { Card, EmptyState, InfoNote, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Atividade" };

const dataHora = new Intl.DateTimeFormat("pt-PT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Lisbon",
});

/**
 * A auditoria, à vista.
 *
 * Guardávamos tudo e não mostrávamos nada — o que é o pior dos dois mundos:
 * o custo de escrever sem o benefício de poder consultar. Aqui vê-se quem
 * fez o quê e quando, incluindo tentativas de entrada falhadas.
 */
export default async function AtividadePage() {
  const session = await requireSession("/definicoes/atividade");

  const registos = await prisma.auditLog.findMany({
    where: {
      OR: [{ workspaceId: session.workspaceId }, { userId: session.userId }],
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const falhas = registos.filter((r) => r.action === "auth.login_failed").length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Atividade"
        description="Tudo o que aconteceu nesta conta, do mais recente para trás."
      />

      {falhas > 0 ? (
        <Card className="border-warning/40 bg-warning-soft">
          <p className="text-sm font-medium text-warning">
            {falhas} tentativa{falhas === 1 ? "" : "s"} de entrada falhada
            {falhas === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-warning/80">
            Se não foi você, mude a palavra-passe — isso fecha também todas as
            sessões abertas noutros sítios.
          </p>
        </Card>
      ) : null}

      <Card>
        {registos.length === 0 ? (
          <EmptyState
            title="Ainda sem atividade"
            description="As entradas, alterações e eliminações passam a aparecer aqui."
          />
        ) : (
          <ul className="divide-y divide-line">
            {registos.map((r) => (
              <li key={r.id} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 truncate text-sm text-ink">
                    {AUDIT_LABELS[r.action] ?? r.action}
                  </p>
                  <p className="tabular shrink-0 text-[11px] text-faint">
                    {dataHora.format(r.createdAt)}
                  </p>
                </div>
                {r.entity ? (
                  <p className="truncate text-[11px] text-muted">
                    {r.entity}
                    {r.userEmail ? ` · ${r.userEmail}` : ""}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <InfoNote>
        Este registo é <strong>append-only</strong>: nem a aplicação o
        consegue alterar ou apagar, por causa de um travão na própria base de
        dados. Nunca guarda palavras-passe nem códigos.
      </InfoNote>
    </div>
  );
}
