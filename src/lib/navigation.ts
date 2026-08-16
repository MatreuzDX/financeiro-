/**
 * A lista de secções da aplicação, num módulo NEUTRO.
 *
 * Mesma armadilha do `lib/theme.ts`: isto estava exportado de
 * `components/nav.tsx`, que é `"use client"`. A página `/mais` é um Server
 * Component e importava-a de lá — recebia uma referência de cliente em vez de
 * um array, e rebentava com "MAIN_NAV.filter is not a function".
 *
 * Dados partilhados entre servidor e cliente vivem em módulos sem
 * `"use client"` e sem `server-only`.
 */

import {
  ArrowLeftRight,
  Bike,
  Car,
  ChartColumn,
  CreditCard,
  House,
  Landmark,
  Lightbulb,
  Repeat,
  Settings,
  Tags,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Upload,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  Icon: LucideIcon;
};

export const MAIN_NAV: NavItem[] = [
  { href: "/", label: "Início", Icon: House },
  { href: "/analise", label: "Análise", Icon: Lightbulb },
  { href: "/movimentos", label: "Movimentos", Icon: ArrowLeftRight },
  { href: "/receitas", label: "Receitas", Icon: TrendingUp },
  { href: "/despesas", label: "Despesas", Icon: TrendingDown },
  { href: "/orcamento", label: "Orçamento", Icon: Target },
  { href: "/recorrentes", label: "Contas a pagar", Icon: Repeat },
  { href: "/metas", label: "Metas", Icon: Trophy },
  { href: "/contas", label: "Contas", Icon: Wallet },
  { href: "/patrimonio", label: "Património", Icon: Landmark },
  { href: "/categorias", label: "Categorias", Icon: Tags },
  { href: "/fontes", label: "Fontes de renda", Icon: CreditCard },
  { href: "/trabalhos", label: "Trabalhos", Icon: Bike },
  { href: "/veiculos", label: "Veículos", Icon: Car },
  { href: "/relatorios", label: "Relatórios", Icon: ChartColumn },
  { href: "/importar", label: "Importar extrato", Icon: Upload },
  { href: "/definicoes", label: "Definições", Icon: Settings },
];

/** Secções que já têm lugar próprio na barra inferior do telemóvel. */
export const BOTTOM_NAV_HREFS = ["/", "/movimentos", "/orcamento"];

/**
 * Comparação por SEGMENTO, não por prefixo de texto: `/contas` não pode
 * dar-se por ativa quando se está em `/contabilidade`.
 */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
