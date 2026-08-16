import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import {
  ChevronRight,
  Download,
  KeyRound,
  PackageOpen,
  ScrollText,
  Users,
  Wand,
} from "lucide-react";
import { requireSession } from "@/server/auth/guard";
import { ROLE_LABELS } from "@/server/auth/permissions";
import { prisma } from "@/server/db";
import { AUDIT_LABELS } from "@/server/audit";
import { ThemeSwitcher } from "@/components/theme";
import { isThemeChoice, THEME_COOKIE } from "@/lib/theme";
import { Card, CardHeader, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Definições" };

export default async function DefinicoesPage() {
  const session = await requireSession("/definicoes");
  const store = await cookies();
  const raw = store.get(THEME_COOKIE)?.value;
  const theme = isThemeChoice(raw) ? raw : "system";

  const [sessions, audit] = await Promise.all([
    prisma.session.count({ where: { userId: session.userId } }),
    prisma.auditLog.findMany({
      where: { workspaceId: session.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  const dateTime = new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: session.timezone,
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Definições" description={session.workspaceName} />

      <Card>
        <CardHeader title="Conta" />
        <dl className="space-y-2 text-sm">
          <Row label="Nome" value={session.name} />
          <Row label="Email" value={session.email} />
          <Row label="Perfil" value={ROLE_LABELS[session.role]} />
          <Row label="Moeda" value={session.currency} />
          <Row label="Fuso horário" value={session.timezone} />
          <Row
            label="Sessões abertas"
            value={String(sessions)}
          />
        </dl>
      </Card>

      <Card>
        <CardHeader
          title="Aspeto"
          hint="A preferência fica guardada e acompanha-o noutro dispositivo."
        />
        <ThemeSwitcher current={theme} />
      </Card>

      <Card className="p-0">
        <ul className="divide-y divide-line">
          <li>
            <Link
              href="/definicoes/palavra-passe"
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover"
            >
              <KeyRound size={17} className="shrink-0 text-muted" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-ink">Palavra-passe</span>
                <span className="block text-[11px] text-muted">
                  Alterar e fechar as outras sessões
                </span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-faint" aria-hidden />
            </Link>
          </li>
          <li>
            <Link
              href="/comecar?rever=1"
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover"
            >
              <Wand size={17} className="shrink-0 text-muted" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-ink">
                  Rever a configuração
                </span>
                <span className="block text-[11px] text-muted">
                  Voltar às perguntas iniciais e reajustar os valores
                </span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-faint" aria-hidden />
            </Link>
          </li>
          <li>
            <Link
              href="/definicoes/membros"
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover"
            >
              <Users size={17} className="shrink-0 text-muted" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-ink">
                  Pessoas e espaços
                </span>
                <span className="block text-[11px] text-muted">
                  Partilhar as contas com o casal, a família ou a equipa
                </span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-faint" aria-hidden />
            </Link>
          </li>
          <li>
            <Link
              href="/definicoes/atividade"
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover"
            >
              <ScrollText size={17} className="shrink-0 text-muted" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-ink">Atividade</span>
                <span className="block text-[11px] text-muted">
                  Tudo o que aconteceu na conta, incluindo entradas falhadas
                </span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-faint" aria-hidden />
            </Link>
          </li>
          <li>
            <a
              href="/api/export/tudo"
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover"
            >
              <PackageOpen size={17} className="shrink-0 text-muted" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-ink">
                  Levar todos os dados
                </span>
                <span className="block text-[11px] text-muted">
                  Ficheiro JSON com tudo o que criou. Sem segredos lá dentro
                </span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-faint" aria-hidden />
            </a>
          </li>
          <li>
            <a
              href="/api/export/movimentos?periodo=ano"
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover"
            >
              <Download size={17} className="shrink-0 text-muted" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-ink">Exportar movimentos</span>
                <span className="block text-[11px] text-muted">
                  CSV deste ano — abre no Excel
                </span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-faint" aria-hidden />
            </a>
          </li>
        </ul>
      </Card>

      {/* ── Auditoria ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Atividade recente"
          hint="Registo permanente: não é possível apagá-lo nem alterá-lo."
        />
        {audit.length === 0 ? (
          <p className="text-xs text-muted">Ainda sem atividade registada.</p>
        ) : (
          <ul className="divide-y divide-line text-xs">
            {audit.map((entry) => (
              <li key={entry.id} className="flex items-center gap-2 py-2">
                <span className="min-w-0 flex-1 truncate text-ink">
                  {AUDIT_LABELS[entry.action] ?? entry.action}
                  {entry.entity ? (
                    <span className="text-faint"> · {entry.entity}</span>
                  ) : null}
                </span>
                <span className="shrink-0 text-faint">
                  {dateTime.format(entry.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-[11px] leading-relaxed text-faint">
        Ainda por fazer nesta secção: exportação completa dos dados, apagar a
        conta, autenticação em dois passos. Estão previstas para as fases
        seguintes e não estão escondidas atrás de botões que não funcionam.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="truncate text-ink">{value}</dd>
    </div>
  );
}
