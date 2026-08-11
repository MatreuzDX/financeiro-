"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  House,
  MoreHorizontal,
  Plus,
  Target,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  isActivePath as isActive,
  MAIN_NAV,
  type NavItem,
} from "@/lib/navigation";

export function Sidebar({ workspaceName }: { workspaceName: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 border-r border-line bg-surface lg:flex lg:flex-col">
      <div className="flex h-16 items-center gap-2 border-b border-line px-5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-fg">
          €
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">Financeiro</p>
          <p className="truncate text-[11px] text-muted">{workspaceName}</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-0.5">
          {MAIN_NAV.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary-soft font-medium text-primary"
                      : "text-muted hover:bg-surface-hover hover:text-ink",
                  )}
                >
                  <Icon size={17} aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-line p-3">
        <Link
          href="/movimentos/novo"
          className="flex h-10 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-medium text-primary-fg transition-colors hover:bg-primary-hover"
        >
          <Plus size={16} aria-hidden />
          Novo movimento
        </Link>
      </div>
    </aside>
  );
}

const BOTTOM_NAV: NavItem[] = [
  { href: "/", label: "Início", Icon: House },
  { href: "/movimentos", label: "Movimentos", Icon: ArrowLeftRight },
  { href: "/orcamento", label: "Orçamento", Icon: Target },
  { href: "/mais", label: "Mais", Icon: MoreHorizontal },
];

/**
 * Navegação de telemóvel.
 *
 * O botão do meio é o mais importante da aplicação: registar uma despesa tem
 * de dar em três toques, ou a pessoa deixa de registar e a app morre.
 */
export function BottomNav() {
  const pathname = usePathname();
  const left = BOTTOM_NAV.slice(0, 2);
  const right = BOTTOM_NAV.slice(2);

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur lg:hidden">
      <ul className="mx-auto flex max-w-lg items-end justify-around px-2 pt-1.5">
        {left.map((item) => (
          <BottomItem key={item.href} item={item} pathname={pathname} />
        ))}

        <li className="-mt-5">
          <Link
            href="/movimentos/novo"
            aria-label="Novo movimento"
            className="grid h-13 w-13 place-items-center rounded-2xl bg-primary text-primary-fg shadow-[var(--shadow-lg)] transition-transform active:scale-95 motion-reduce:active:scale-100"
            style={{ height: "3.25rem", width: "3.25rem" }}
          >
            <Plus size={24} aria-hidden />
          </Link>
        </li>

        {right.map((item) => (
          <BottomItem key={item.href} item={item} pathname={pathname} />
        ))}
      </ul>
    </nav>
  );
}

function BottomItem({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  const { Icon } = item;
  return (
    <li className="flex-1">
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10px] transition-colors",
          active ? "text-primary" : "text-muted",
        )}
      >
        <Icon size={20} aria-hidden />
        <span className="truncate">{item.label}</span>
      </Link>
    </li>
  );
}
