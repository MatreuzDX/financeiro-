/**
 * Peças visuais que faltavam.
 *
 * O que a pesquisa de 2026 diz sobre painéis financeiros, e que aqui não
 * estava:
 *
 * - **Todo o indicador precisa de direção.** Um número sozinho não diz nada:
 *   €340 é bom ou mau? Uma minigráfica ou uma seta ao lado respondem sem
 *   ocupar espaço.
 * - **O esqueleto de carregamento tem de ter a FORMA do conteúdo.** Um
 *   retângulo cinzento genérico desorienta; um que já mostra onde vai estar o
 *   título e onde vai estar o valor mantém a pessoa orientada.
 * - **O vazio tem de ensinar.** Um ecrã sem dados é a primeira coisa que toda
 *   a gente vê, e é onde a maior parte desiste.
 *
 * Nada aqui é decorativo. Cada peça responde a uma pergunta.
 */

import type { ReactNode } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatCents } from "@/lib/money";

// ─── Minigráfica ───────────────────────────────────────────────────────────

/**
 * Uma linha de tendência do tamanho de uma palavra.
 *
 * Sem eixos, sem grelha, sem legenda — de propósito. Não serve para ler
 * valores, serve para responder a "está a subir ou a descer?" num relance.
 * Quem quiser o valor exato toca e vai ao gráfico grande.
 *
 * SVG à mão em vez de Recharts: são doze pontos e uma polilinha. Montar um
 * gráfico completo para isto custaria mais em JavaScript do que o cartão
 * inteiro onde ele vive.
 */
export function Sparkline({
  valores,
  tom = "auto",
  largura = 72,
  altura = 24,
  className,
}: {
  valores: number[];
  /** `auto` decide pela direção: sobe é positivo, desce é negativo. */
  tom?: "auto" | "positivo" | "negativo" | "neutro";
  largura?: number;
  altura?: number;
  className?: string;
}) {
  // Menos de dois pontos não é uma tendência, é um ponto.
  if (valores.length < 2) return null;

  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const amplitude = max - min;

  const pontos = valores.map((v, i) => {
    const x = (i / (valores.length - 1)) * largura;
    // Amplitude zero → linha a meio, em vez de uma divisão por zero.
    const y = amplitude === 0 ? altura / 2 : altura - ((v - min) / amplitude) * altura;
    // Uma margem de 2px em cima e em baixo evita o traço colar às bordas.
    return [x, 2 + (y * (altura - 4)) / altura] as const;
  });

  const subiu = valores[valores.length - 1] >= valores[0];
  const cor =
    tom === "neutro"
      ? "var(--muted)"
      : tom === "positivo" || (tom === "auto" && subiu)
        ? "var(--positive)"
        : "var(--negative)";

  const d = pontos.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join(" ");
  const area = `${d} L${largura} ${altura} L0 ${altura} Z`;
  const id = `spark-${valores.length}-${Math.round(min)}-${Math.round(max)}`;

  return (
    <svg
      width={largura}
      height={altura}
      viewBox={`0 0 ${largura} ${altura}`}
      className={cn("shrink-0 overflow-visible", className)}
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={cor} stopOpacity="0.18" />
          <stop offset="100%" stopColor={cor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path
        d={d}
        fill="none"
        stroke={cor}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* O último ponto marcado: é o de agora, e é o que interessa. */}
      <circle
        cx={pontos[pontos.length - 1][0]}
        cy={pontos[pontos.length - 1][1]}
        r="2.25"
        fill={cor}
      />
    </svg>
  );
}

// ─── Variação ──────────────────────────────────────────────────────────────

/**
 * "+12% face ao mês passado" numa etiqueta.
 *
 * O detalhe que muda tudo: em despesas, SUBIR É MAU. Uma seta verde para cima
 * ao lado de "gastou mais 30%" é uma mentira visual. Por isso `inverter`.
 */
export function Variacao({
  percent,
  inverter = false,
  sufixo,
  className,
}: {
  percent: number | null;
  /** Verdadeiro em despesas: subir é mau. */
  inverter?: boolean;
  sufixo?: string;
  className?: string;
}) {
  if (percent === null || !Number.isFinite(percent)) return null;

  const subiu = percent > 0;
  const bom = subiu !== inverter;
  const igual = Math.abs(percent) < 1;

  const Icone = igual ? ArrowRight : subiu ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
        igual
          ? "bg-surface-2 text-muted"
          : bom
            ? "bg-positive-soft text-positive"
            : "bg-negative-soft text-negative",
        className,
      )}
    >
      <Icone size={11} aria-hidden />
      <span className="tabular">
        {igual ? "igual" : `${subiu ? "+" : "−"}${Math.abs(Math.round(percent))}%`}
      </span>
      {sufixo ? <span className="font-normal opacity-80"> {sufixo}</span> : null}
    </span>
  );
}

// ─── Cartão de indicador ───────────────────────────────────────────────────

/**
 * Um número, o que ele é, para onde vai e a tendência. Tudo num cartão.
 *
 * É a peça mais repetida da app, e por isso a que mais vale a pena ter
 * desenhada num sítio só: seis versões ligeiramente diferentes do mesmo
 * cartão é como um painel deixa de parecer desenhado.
 */
export function Indicador({
  rotulo,
  valorCents,
  valorTexto,
  tom = "neutro",
  variacao,
  variacaoInvertida,
  serie,
  nota,
  className,
}: {
  rotulo: string;
  valorCents?: number;
  valorTexto?: string;
  tom?: "neutro" | "positivo" | "negativo";
  variacao?: number | null;
  variacaoInvertida?: boolean;
  serie?: number[];
  nota?: string;
  className?: string;
}) {
  const valor = valorTexto ?? (valorCents !== undefined ? formatCents(valorCents) : "—");

  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-surface p-3.5",
        "shadow-[var(--elev-1)] transition-shadow hover:shadow-[var(--elev-2)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-faint">
          {rotulo}
        </p>
        {serie && serie.length > 1 ? (
          <Sparkline
            valores={serie}
            tom={tom === "neutro" ? "auto" : tom}
            largura={54}
            altura={20}
          />
        ) : null}
      </div>

      <p
        className={cn(
          "figura mt-1.5 text-xl",
          tom === "positivo"
            ? "text-positive"
            : tom === "negativo"
              ? "text-negative"
              : "text-ink",
        )}
      >
        {valor}
      </p>

      {variacao !== undefined || nota ? (
        <div className="mt-1.5 flex items-center gap-2">
          <Variacao percent={variacao ?? null} inverter={variacaoInvertida} />
          {nota ? (
            <span className="truncate text-[11px] text-muted">{nota}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ─── Esqueletos com forma ──────────────────────────────────────────────────

/**
 * Esqueletos que imitam o conteúdo que vem a seguir.
 *
 * Um retângulo cinzento genérico desorienta: a pessoa não sabe o que está a
 * chegar e o salto quando chega é grande. Um esqueleto com a forma certa faz
 * a chegada parecer instantânea, porque nada se move de sítio.
 */
export function EsqueletoIndicador() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3.5">
      <div className="skeleton h-2.5 w-16" />
      <div className="skeleton mt-2.5 h-6 w-24" />
      <div className="skeleton mt-2 h-3 w-12" />
    </div>
  );
}

export function EsqueletoLinha() {
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <div className="skeleton h-9 w-1 rounded-full" />
      <div className="min-w-0 flex-1">
        <div className="skeleton h-3.5 w-2/5" />
        <div className="skeleton mt-1.5 h-2.5 w-3/5" />
      </div>
      <div className="skeleton h-4 w-16" />
    </div>
  );
}

export function EsqueletoLista({ linhas = 5 }: { linhas?: number }) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {Array.from({ length: linhas }, (_, i) => (
        <EsqueletoLinha key={i} />
      ))}
    </div>
  );
}

export function EsqueletoGrafico({ altura = 208 }: { altura?: number }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="skeleton h-3 w-28" />
      <div className="mt-4 flex items-end gap-1.5" style={{ height: altura }}>
        {/* Alturas fixas e não aleatórias: o servidor e o cliente têm de
            desenhar o mesmo, senão o React queixa-se de hidratação. */}
        {[45, 70, 35, 85, 55, 95, 60, 40, 75, 50, 80, 65].map((h, i) => (
          <div key={i} className="skeleton flex-1" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

// ─── Barra de repartição ───────────────────────────────────────────────────

/**
 * Uma barra dividida em fatias, com legenda por baixo.
 *
 * Substitui um gráfico de círculo quando há três ou quatro fatias: ocupa uma
 * fração da altura e lê-se mais depressa. Círculos só valem a pena com muitas
 * fatias e mesmo aí é discutível.
 */
export function BarraRepartida({
  fatias,
  className,
}: {
  fatias: { rotulo: string; cents: number; cor?: string }[];
  className?: string;
}) {
  const total = fatias.reduce((s, f) => s + Math.max(0, f.cents), 0);
  if (total <= 0) return null;

  const CORES = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
    "var(--chart-6)",
  ];

  return (
    <div className={className}>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {fatias.map((f, i) => {
          const p = (Math.max(0, f.cents) / total) * 100;
          if (p <= 0) return null;
          return (
            <span
              key={f.rotulo}
              className="animate-crescer h-full first:rounded-l-full last:rounded-r-full"
              style={{
                width: `${p}%`,
                background: f.cor ?? CORES[i % CORES.length],
                animationDelay: `${i * 60}ms`,
              }}
              title={`${f.rotulo}: ${formatCents(f.cents)}`}
            />
          );
        })}
      </div>

      <ul className="mt-2.5 space-y-1">
        {fatias.map((f, i) => (
          <li key={f.rotulo} className="flex items-center gap-2 text-xs">
            <span
              className="h-2 w-2 shrink-0 rounded-sm"
              style={{ background: f.cor ?? CORES[i % CORES.length] }}
            />
            <span className="min-w-0 flex-1 truncate text-muted">{f.rotulo}</span>
            <span className="tabular shrink-0 text-ink">{formatCents(f.cents)}</span>
            <span className="tabular w-9 shrink-0 text-right text-faint">
              {Math.round((Math.max(0, f.cents) / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Aviso com tom ─────────────────────────────────────────────────────────

/**
 * Uma caixa de aviso com o tom certo.
 *
 * Existia `InfoNote`, `ErrorBanner` e `SuccessBanner`, cada um com o seu
 * desenho ligeiramente diferente. Isto é o mesmo objeto com quatro tons — e
 * ter um só desenho é metade do que faz uma app parecer coerente.
 */
export function Nota({
  tom = "info",
  titulo,
  Icone,
  children,
  className,
}: {
  tom?: "info" | "bom" | "aviso" | "mau";
  titulo?: string;
  Icone?: typeof ArrowRight;
  children: ReactNode;
  className?: string;
}) {
  const tons = {
    info: "border-line bg-surface-2 text-muted",
    bom: "border-positive/30 bg-positive-soft text-ink",
    aviso: "border-warning/40 bg-warning-soft text-ink",
    mau: "border-negative/30 bg-negative-soft text-ink",
  } as const;

  const cores = {
    info: "text-muted",
    bom: "text-positive",
    aviso: "text-warning",
    mau: "text-negative",
  } as const;

  return (
    <div
      className={cn(
        "animate-fade flex items-start gap-2.5 rounded-xl border px-3 py-2.5",
        tons[tom],
        className,
      )}
    >
      {Icone ? (
        <Icone size={15} className={cn("mt-0.5 shrink-0", cores[tom])} aria-hidden />
      ) : null}
      <div className="min-w-0 flex-1 text-xs leading-relaxed">
        {titulo ? (
          <p className={cn("mb-0.5 font-medium", tom === "info" ? "text-ink" : cores[tom])}>
            {titulo}
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}

// ─── Anel de progresso ─────────────────────────────────────────────────────

/**
 * Progresso em anel, para metas.
 *
 * Uma barra diz "quanto falta"; um anel diz "quanto já é". Para uma meta de
 * poupança, a segunda leitura motiva mais — e é a diferença entre uma pessoa
 * continuar ou desistir.
 */
export function Anel({
  percent,
  tamanho = 56,
  espessura = 5,
  children,
}: {
  percent: number;
  tamanho?: number;
  espessura?: number;
  children?: ReactNode;
}) {
  const p = Math.max(0, Math.min(100, percent));
  const raio = (tamanho - espessura) / 2;
  const volta = 2 * Math.PI * raio;

  return (
    <div
      className="relative shrink-0"
      style={{ width: tamanho, height: tamanho }}
      role="progressbar"
      aria-valuenow={Math.round(p)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg width={tamanho} height={tamanho} className="-rotate-90" aria-hidden>
        <circle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={raio}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={espessura}
        />
        <circle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={raio}
          fill="none"
          stroke={p >= 100 ? "var(--positive)" : "var(--primary)"}
          strokeWidth={espessura}
          strokeLinecap="round"
          strokeDasharray={volta}
          strokeDashoffset={volta - (volta * p) / 100}
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      {children ? (
        <div className="absolute inset-0 grid place-items-center">{children}</div>
      ) : null}
    </div>
  );
}
