import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireSession } from "@/server/auth/guard";
import { BOTTOM_NAV_HREFS, MAIN_NAV } from "@/lib/navigation";
import { Card, PageHeader } from "@/components/ui";
import { logoutAction } from "../actions";

export const metadata: Metadata = { title: "Mais" };

/**
 * Página só para telemóvel: a barra inferior tem quatro lugares e a app tem
 * doze secções. O resto vive aqui, em lista, em vez de num menu escondido
 * atrás de um ícone que ninguém carrega.
 */
export default async function MaisPage() {
  const session = await requireSession("/mais");

  const items = MAIN_NAV.filter(
    (item) => !BOTTOM_NAV_HREFS.includes(item.href),
  );

  return (
    <div className="space-y-4">
      <PageHeader title="Mais" description={session.workspaceName} />

      <Card className="p-0">
        <ul className="divide-y divide-line">
          {items.map(({ href, label, Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover"
              >
                <Icon size={17} className="shrink-0 text-muted" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                  {label}
                </span>
                <ChevronRight size={16} className="shrink-0 text-faint" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-0">
        <div className="px-4 py-3">
          <p className="text-sm text-ink">{session.name}</p>
          <p className="text-[11px] text-muted">{session.email}</p>
        </div>
        <form action={logoutAction} className="border-t border-line">
          <button
            type="submit"
            className="w-full px-4 py-3 text-left text-sm text-negative transition-colors hover:bg-surface-hover"
          >
            Terminar sessão
          </button>
        </form>
      </Card>
    </div>
  );
}
