import type { Metadata } from "next";
import { Check, Clock, Trash2, Users } from "lucide-react";
import { requireSession } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import {
  listMembers,
  listMyWorkspaces,
  ROLE_EXPLICACAO,
} from "@/server/workspaces";
import { ROLE_LABELS } from "@/server/auth/permissions";
import { cn } from "@/lib/cn";
import {
  Badge,
  Card,
  CardHeader,
  InfoNote,
  PageHeader,
} from "@/components/ui";
import { InviteForm, NewWorkspaceForm } from "./invite-form";
import {
  cancelInviteAction,
  changeRoleAction,
  removeMemberAction,
  switchWorkspaceAction,
} from "./actions";

export const metadata: Metadata = { title: "Pessoas e espaços" };

export default async function MembrosPage() {
  const session = await requireSession("/definicoes/membros");
  const [{ membros, convites }, espacos] = await Promise.all([
    listMembers(session.workspaceId),
    listMyWorkspaces(session.userId),
  ]);

  const podeGerir = can(session.role, "admin:users");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pessoas e espaços"
        description="Partilhar as contas com quem as partilha consigo."
      />

      {/* ── Espaços ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Os seus espaços"
          hint="Um espaço é uma carteira comum. Pode ter vários."
        />
        <ul className="mb-3 divide-y divide-line">
          {espacos.map((e) => {
            const atual = e.id === session.workspaceId;
            return (
              <li
                key={e.id}
                className="flex items-center gap-3 py-2.5 first:pt-0"
              >
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-sm",
                      atual ? "font-medium text-ink" : "text-muted",
                    )}
                  >
                    {e.name}
                  </p>
                  <p className="text-[11px] text-muted">
                    {ROLE_LABELS[e.role]} · {e.membros} pessoa
                    {e.membros === 1 ? "" : "s"}
                  </p>
                </div>
                {atual ? (
                  <Badge tone="primary">
                    <Check size={11} className="mr-1 inline" aria-hidden />A ver
                  </Badge>
                ) : (
                  <form action={switchWorkspaceAction}>
                    <input type="hidden" name="workspaceId" value={e.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-line-strong px-2.5 py-1 text-[11px] font-medium text-ink hover:bg-surface-hover"
                    >
                      Trocar
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
        <NewWorkspaceForm />
      </Card>

      {/* ── Quem está neste espaço ──────────────────────────────────────── */}
      <Card>
        <CardHeader
          title={`Quem está em ${session.workspaceName}`}
          hint={`${membros.length} pessoa${membros.length === 1 ? "" : "s"}`}
        />
        <ul className="divide-y divide-line">
          {membros.map((m) => {
            const sou = m.userId === session.userId;
            return (
              <li key={m.id} className="flex items-center gap-3 py-3 first:pt-0">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-muted"
                  aria-hidden
                >
                  {m.user.name.slice(0, 2).toUpperCase()}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">
                    {m.user.name}
                    {sou ? <span className="text-muted"> (você)</span> : null}
                  </p>
                  <p className="truncate text-[11px] text-muted">
                    {m.user.email}
                  </p>
                </div>

                {podeGerir && !sou ? (
                  <form action={changeRoleAction} className="shrink-0">
                    <input type="hidden" name="membershipId" value={m.id} />
                    <select
                      name="role"
                      defaultValue={m.role}
                      // Sem JavaScript de cliente: submeter ao mudar seria
                      // preciso, por isso fica um botão explícito ao lado.
                      className="h-8 rounded-lg border border-line bg-surface-2 px-2 text-[11px] text-ink"
                    >
                      {(["ADMIN", "MEMBER", "VIEWER"] as const).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="ml-1 h-8 rounded-lg border border-line-strong px-2 text-[11px] text-ink hover:bg-surface-hover"
                    >
                      Guardar
                    </button>
                  </form>
                ) : (
                  <Badge>{ROLE_LABELS[m.role]}</Badge>
                )}

                {podeGerir && !sou ? (
                  <form action={removeMemberAction} className="shrink-0">
                    <input type="hidden" name="membershipId" value={m.id} />
                    <button
                      type="submit"
                      title="Tirar do espaço"
                      aria-label={`Tirar ${m.user.name} do espaço`}
                      className="grid h-8 w-8 place-items-center rounded-lg text-faint transition-colors hover:bg-negative-soft hover:text-negative"
                    >
                      <Trash2 size={15} aria-hidden />
                    </button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Card>

      {/* ── Convites por aceitar ────────────────────────────────────────── */}
      {convites.length > 0 ? (
        <Card>
          <CardHeader title="Convites à espera" />
          <ul className="divide-y divide-line">
            {convites.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2.5">
                <Clock size={15} className="shrink-0 text-faint" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{c.email}</p>
                  <p className="text-[11px] text-muted">
                    {ROLE_LABELS[c.role]} · expira a{" "}
                    {c.expiresAt.toLocaleDateString("pt-PT")}
                  </p>
                </div>
                {podeGerir ? (
                  <form action={cancelInviteAction} className="shrink-0">
                    <input type="hidden" name="inviteId" value={c.id} />
                    <button
                      type="submit"
                      className="rounded-lg px-2 py-1 text-[11px] text-muted hover:bg-surface-hover hover:text-ink"
                    >
                      Cancelar
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {podeGerir ? (
        <InviteForm />
      ) : (
        <InfoNote>
          Só quem administra este espaço pode convidar ou remover pessoas.
        </InfoNote>
      )}

      <Card>
        <CardHeader title="O que cada papel pode fazer" />
        <dl className="divide-y divide-line text-xs">
          {(["OWNER", "ADMIN", "MEMBER", "VIEWER"] as const).map((r) => (
            <div key={r} className="flex gap-3 py-2 first:pt-0 last:pb-0">
              <dt className="w-28 shrink-0 font-medium text-ink">
                {ROLE_LABELS[r]}
              </dt>
              <dd className="text-muted">{ROLE_EXPLICACAO[r]}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <div className="flex items-start gap-2 px-1 pb-2 text-[11px] leading-relaxed text-faint">
        <Users size={13} className="mt-0.5 shrink-0" aria-hidden />
        <p>
          Tudo o que está num espaço é visto por todos os que lá estão. Para um
          casal, é isso que se quer: os dois veem os mesmos gráficos e o mesmo
          saldo. Para separar, crie espaços diferentes.
        </p>
      </div>
    </div>
  );
}
