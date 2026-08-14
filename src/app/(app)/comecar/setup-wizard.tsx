"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Bike,
  Check,
  Home,
  Wallet,
} from "lucide-react";
import {
  Button,
  Card,
  ErrorBanner,
  Field,
  Input,
  InfoNote,
  MoneyInput,
  Select,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatCents, parseAmountToCents, parseKmToMetres } from "@/lib/money";
import { completeSetupAction } from "./actions";

type Pergunta = { categoria: string; pergunta: string; exemplo?: string };

const PASSOS = ["Dinheiro", "Rendimento", "Veículo", "Contas fixas", "Resumo"] as const;

/** Converte o que a pessoa escreveu; vazio ou inválido → null. */
function euros(valor: string): number | null {
  const t = valor.trim();
  if (t === "") return null;
  return parseAmountToCents(t);
}

export function SetupWizard({
  perguntasFixas,
  nome,
}: {
  perguntasFixas: Pergunta[];
  nome: string;
}) {
  const router = useRouter();
  const [passo, setPasso] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  // ── Passo 1: dinheiro ──────────────────────────────────────────────────
  const [contaNome, setContaNome] = useState("Conta à ordem");
  const [contaTipo, setContaTipo] = useState("BANK");
  const [contaSaldo, setContaSaldo] = useState("");
  const [dinheiroVivo, setDinheiroVivo] = useState("");

  // ── Passo 2: rendimento ────────────────────────────────────────────────
  const [temRendimento, setTemRendimento] = useState(true);
  const [fonteNome, setFonteNome] = useState("Trabalho principal");
  const [fonteTipo, setFonteTipo] = useState("SALARY");
  const [fonteMensal, setFonteMensal] = useState("");

  // ── Passo 3: veículo ───────────────────────────────────────────────────
  const [temVeiculo, setTemVeiculo] = useState<boolean | null>(null);
  const [vNome, setVNome] = useState("");
  const [vMarca, setVMarca] = useState("");
  const [vModelo, setVModelo] = useState("");
  const [vAno, setVAno] = useState("");
  const [vTipo, setVTipo] = useState("SCOOTER");
  const [vCombustivel, setVCombustivel] = useState("PETROL");
  const [vKm, setVKm] = useState("");
  const [vCombMensal, setVCombMensal] = useState("");
  const [vManutMensal, setVManutMensal] = useState("");
  const [vTrabalho, setVTrabalho] = useState(false);

  // ── Passo 4: contas fixas ──────────────────────────────────────────────
  const [fixas, setFixas] = useState<Record<string, string>>({});

  const totalFixas = useMemo(() => {
    let soma = 0;
    for (const v of Object.values(fixas)) soma += euros(v) ?? 0;
    soma += euros(vCombMensal) ?? 0;
    soma += euros(vManutMensal) ?? 0;
    return soma;
  }, [fixas, vCombMensal, vManutMensal]);

  const rendimentoCents = euros(fonteMensal) ?? 0;
  const sobra = rendimentoCents - totalFixas;

  function seguinte() {
    setErro(null);

    if (passo === 0) {
      if (contaNome.trim() === "") {
        setErro("Dê um nome à conta.");
        return;
      }
      if (contaSaldo.trim() !== "" && euros(contaSaldo) === null) {
        setErro("O saldo não é um valor válido. Exemplo: 450,00");
        return;
      }
      if (dinheiroVivo.trim() !== "" && euros(dinheiroVivo) === null) {
        setErro("O dinheiro em carteira não é um valor válido.");
        return;
      }
    }

    if (passo === 2 && temVeiculo) {
      if (vNome.trim() === "") {
        setErro("Dê um nome ao veículo. Por exemplo: Honda PCX.");
        return;
      }
      if (vKm.trim() !== "" && parseKmToMetres(vKm) === null) {
        setErro("Os quilómetros não são um valor válido. Exemplo: 24150");
        return;
      }
    }

    setPasso((p) => Math.min(p + 1, PASSOS.length - 1));
  }

  function anterior() {
    setErro(null);
    setPasso((p) => Math.max(p - 1, 0));
  }

  function concluir() {
    setErro(null);

    const fixasCents: Record<string, number> = {};
    for (const [categoria, valor] of Object.entries(fixas)) {
      const c = euros(valor);
      if (c && c > 0) fixasCents[categoria] = c;
    }

    const payload = {
      conta: {
        name: contaNome.trim(),
        type: contaTipo,
        openingCents: euros(contaSaldo) ?? 0,
      },
      dinheiroVivoCents: euros(dinheiroVivo),
      rendimento: temRendimento
        ? {
            name: fonteNome.trim() || "Trabalho principal",
            type: fonteTipo,
            mensalCents: euros(fonteMensal),
          }
        : null,
      veiculo:
        temVeiculo && vNome.trim() !== ""
          ? {
              name: vNome.trim(),
              brand: vMarca.trim() || null,
              model: vModelo.trim() || null,
              year: vAno.trim() ? Number(vAno) : null,
              type: vTipo,
              fuelType: vCombustivel,
              currentMetres: parseKmToMetres(vKm) ?? 0,
              combustivelMensalCents: euros(vCombMensal),
              manutencaoMensalCents: euros(vManutMensal),
              usaParaTrabalho: vTrabalho,
            }
          : null,
      fixas: fixasCents,
    };

    iniciar(async () => {
      const resultado = await completeSetupAction(payload);
      if (resultado?.error) setErro(resultado.error);
    });
  }

  return (
    <div className="space-y-4">
      {/* Progresso — saber onde se está e quanto falta */}
      <ol className="flex items-center gap-1.5" aria-label="Progresso">
        {PASSOS.map((nomePasso, i) => (
          <li key={nomePasso} className="flex-1">
            <div
              className={cn(
                "h-1 rounded-full transition-colors",
                i <= passo ? "bg-primary" : "bg-surface-2",
              )}
              aria-current={i === passo ? "step" : undefined}
            />
            <span
              className={cn(
                "mt-1 block truncate text-[10px]",
                i === passo ? "font-medium text-ink" : "text-faint",
              )}
            >
              {nomePasso}
            </span>
          </li>
        ))}
      </ol>

      {erro ? <ErrorBanner>{erro}</ErrorBanner> : null}

      {/* ── Passo 1 ─────────────────────────────────────────────────────── */}
      {passo === 0 ? (
        <Card className="animate-rise space-y-4">
          <header>
            <div className="mb-2 flex items-center gap-2 text-primary">
              <Wallet size={18} aria-hidden />
              <h2 className="text-sm font-semibold">Quanto tem agora?</h2>
            </div>
            <p className="text-xs leading-relaxed text-muted">
              É o ponto de partida. A partir daqui, cada movimento que
              registar mexe neste saldo — e o número no início da app passa a
              ser verdade.
            </p>
          </header>

          <Field label="Nome da conta">
            <Input
              value={contaNome}
              onChange={(e) => setContaNome(e.target.value)}
              maxLength={60}
              placeholder="Conta à ordem"
            />
          </Field>

          <Field label="Tipo">
            <Select value={contaTipo} onChange={(e) => setContaTipo(e.target.value)}>
              <option value="BANK">Conta bancária</option>
              <option value="CASH">Dinheiro</option>
              <option value="CARD">Cartão de crédito</option>
              <option value="SAVINGS">Poupança</option>
              <option value="OTHER">Outra</option>
            </Select>
          </Field>

          <Field
            label="Saldo atual"
            hint="Se não souber ao certo, ponha um valor aproximado — dá para corrigir depois."
          >
            <MoneyInput
              value={contaSaldo}
              onChange={(e) => setContaSaldo(e.target.value)}
            />
          </Field>

          <Field label="E em dinheiro, na carteira?" hint="Opcional">
            <MoneyInput
              value={dinheiroVivo}
              onChange={(e) => setDinheiroVivo(e.target.value)}
            />
          </Field>
        </Card>
      ) : null}

      {/* ── Passo 2 ─────────────────────────────────────────────────────── */}
      {passo === 1 ? (
        <Card className="animate-rise space-y-4">
          <header>
            <h2 className="text-sm font-semibold text-ink">
              De onde vem o seu dinheiro?
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Pode acrescentar mais fontes depois — entregas, freelas, um
              negócio. Cada uma passa a ter o seu próprio histórico e lucro.
            </p>
          </header>

          <div className="flex gap-2">
            <EscolhaBotao
              ativo={temRendimento}
              onClick={() => setTemRendimento(true)}
            >
              Tenho rendimento fixo
            </EscolhaBotao>
            <EscolhaBotao
              ativo={!temRendimento}
              onClick={() => setTemRendimento(false)}
            >
              Agora não
            </EscolhaBotao>
          </div>

          {temRendimento ? (
            <>
              <Field label="Como se chama">
                <Input
                  value={fonteNome}
                  onChange={(e) => setFonteNome(e.target.value)}
                  maxLength={60}
                  placeholder="Trabalho principal"
                />
              </Field>

              <Field label="Que tipo é">
                <Select
                  value={fonteTipo}
                  onChange={(e) => setFonteTipo(e.target.value)}
                >
                  <option value="SALARY">Ordenado</option>
                  <option value="DELIVERY">Entregas</option>
                  <option value="FREELANCE">Freelancer</option>
                  <option value="BUSINESS">Negócio</option>
                  <option value="OTHER">Outro</option>
                </Select>
              </Field>

              <Field
                label="Quanto recebe por mês, líquido"
                hint="Serve de referência para o orçamento. Não é lançado como receita — o dinheiro só entra quando entrar mesmo."
              >
                <MoneyInput
                  value={fonteMensal}
                  onChange={(e) => setFonteMensal(e.target.value)}
                />
              </Field>
            </>
          ) : null}
        </Card>
      ) : null}

      {/* ── Passo 3 ─────────────────────────────────────────────────────── */}
      {passo === 2 ? (
        <Card className="animate-rise space-y-4">
          <header>
            <div className="mb-2 flex items-center gap-2 text-primary">
              <Bike size={18} aria-hidden />
              <h2 className="text-sm font-semibold">Tem algum veículo?</h2>
            </div>
            <p className="text-xs leading-relaxed text-muted">
              Carro, mota ou scooter. Se usa para trabalhar, é isto que
              permite saber quanto custa cada quilómetro — e quanto lucra de
              verdade, em vez de só quanto recebe.
            </p>
          </header>

          <div className="flex gap-2">
            <EscolhaBotao ativo={temVeiculo === true} onClick={() => setTemVeiculo(true)}>
              Tenho
            </EscolhaBotao>
            <EscolhaBotao
              ativo={temVeiculo === false}
              onClick={() => setTemVeiculo(false)}
            >
              Não tenho
            </EscolhaBotao>
          </div>

          {temVeiculo ? (
            <>
              <Field label="Como lhe chama" hint="O nome que usa no dia a dia">
                <Input
                  value={vNome}
                  onChange={(e) => setVNome(e.target.value)}
                  maxLength={60}
                  placeholder="Honda PCX"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Marca">
                  <Input
                    value={vMarca}
                    onChange={(e) => setVMarca(e.target.value)}
                    maxLength={40}
                    placeholder="Honda"
                  />
                </Field>
                <Field label="Modelo">
                  <Input
                    value={vModelo}
                    onChange={(e) => setVModelo(e.target.value)}
                    maxLength={40}
                    placeholder="PCX 125"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Ano">
                  <Input
                    value={vAno}
                    onChange={(e) => setVAno(e.target.value.replace(/\D/g, ""))}
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="2016"
                  />
                </Field>
                <Field label="Tipo">
                  <Select value={vTipo} onChange={(e) => setVTipo(e.target.value)}>
                    <option value="SCOOTER">Scooter</option>
                    <option value="MOTORCYCLE">Mota</option>
                    <option value="CAR">Carro</option>
                    <option value="VAN">Carrinha</option>
                    <option value="BICYCLE">Bicicleta</option>
                    <option value="OTHER">Outro</option>
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Combustível">
                  <Select
                    value={vCombustivel}
                    onChange={(e) => setVCombustivel(e.target.value)}
                  >
                    <option value="PETROL">Gasolina</option>
                    <option value="DIESEL">Gasóleo</option>
                    <option value="ELECTRIC">Elétrico</option>
                    <option value="HYBRID">Híbrido</option>
                    <option value="LPG">GPL</option>
                    <option value="NONE">Não aplicável</option>
                  </Select>
                </Field>
                <Field label="Quilómetros" hint="No conta-quilómetros">
                  <Input
                    value={vKm}
                    onChange={(e) => setVKm(e.target.value)}
                    inputMode="decimal"
                    placeholder="24150"
                  />
                </Field>
              </div>

              <Field label="Gasta quanto em combustível por mês?" hint="Aproximado">
                <MoneyInput
                  value={vCombMensal}
                  onChange={(e) => setVCombMensal(e.target.value)}
                />
              </Field>

              <Field label="E em manutenção, por mês?" hint="Opcional">
                <MoneyInput
                  value={vManutMensal}
                  onChange={(e) => setVManutMensal(e.target.value)}
                />
              </Field>

              <label className="flex items-start gap-2.5 rounded-xl bg-surface-2 p-3">
                <input
                  type="checkbox"
                  checked={vTrabalho}
                  onChange={(e) => setVTrabalho(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
                />
                <span className="text-xs leading-relaxed text-muted">
                  Uso este veículo para trabalhar (entregas, serviços)
                </span>
              </label>

              <InfoNote>
                O consumo real não é adivinhado: assim que registar dois
                abastecimentos, a app calcula os litros aos 100 km e o custo
                por quilómetro a partir dos seus números, não de tabelas.
              </InfoNote>
            </>
          ) : null}
        </Card>
      ) : null}

      {/* ── Passo 4 ─────────────────────────────────────────────────────── */}
      {passo === 3 ? (
        <Card className="animate-rise space-y-4">
          <header>
            <div className="mb-2 flex items-center gap-2 text-primary">
              <Home size={18} aria-hidden />
              <h2 className="text-sm font-semibold">O que paga todos os meses?</h2>
            </div>
            <p className="text-xs leading-relaxed text-muted">
              Preencha só o que souber — o resto fica em branco e acrescenta
              quando quiser. Isto vira o orçamento deste mês.
            </p>
          </header>

          <div className="space-y-3">
            {perguntasFixas.map((p) => (
              <Field
                key={p.categoria}
                label={p.pergunta}
                hint={p.exemplo}
                className="grid grid-cols-[1fr_auto] items-center gap-3"
              >
                <MoneyInput
                  value={fixas[p.categoria] ?? ""}
                  onChange={(e) =>
                    setFixas((f) => ({ ...f, [p.categoria]: e.target.value }))
                  }
                  className="w-36"
                />
              </Field>
            ))}
          </div>
        </Card>
      ) : null}

      {/* ── Passo 5: resumo ─────────────────────────────────────────────── */}
      {passo === 4 ? (
        <Card className="animate-rise space-y-4">
          <header>
            <h2 className="text-sm font-semibold text-ink">
              {nome}, é isto que vou criar
            </h2>
            <p className="mt-1 text-xs text-muted">
              Nada disto fica fixo. Tudo se muda depois nas páginas normais.
            </p>
          </header>

          <ul className="divide-y divide-line text-sm">
            <LinhaResumo
              rotulo={contaNome || "Conta"}
              valor={formatCents(euros(contaSaldo) ?? 0)}
            />
            {euros(dinheiroVivo) ? (
              <LinhaResumo
                rotulo="Dinheiro"
                valor={formatCents(euros(dinheiroVivo)!)}
              />
            ) : null}
            {temRendimento ? (
              <LinhaResumo
                rotulo={fonteNome || "Rendimento"}
                valor={
                  rendimentoCents > 0
                    ? `${formatCents(rendimentoCents)} / mês`
                    : "sem valor indicado"
                }
              />
            ) : null}
            {temVeiculo && vNome.trim() ? (
              <LinhaResumo
                rotulo={vNome}
                valor={[vMarca, vModelo, vAno].filter(Boolean).join(" ") || "veículo"}
              />
            ) : null}
            <LinhaResumo
              rotulo="Orçamento do mês"
              valor={
                totalFixas > 0
                  ? formatCents(totalFixas)
                  : "sem contas fixas indicadas"
              }
            />
          </ul>

          {rendimentoCents > 0 && totalFixas > 0 ? (
            <div
              className={cn(
                "rounded-xl p-3 text-sm",
                sobra >= 0
                  ? "bg-positive-soft text-positive"
                  : "bg-negative-soft text-negative",
              )}
            >
              {sobra >= 0 ? (
                <>
                  Depois das contas fixas, sobram{" "}
                  <strong className="tabular">{formatCents(sobra)}</strong> por
                  mês.
                </>
              ) : (
                <>
                  As contas fixas somam{" "}
                  <strong className="tabular">{formatCents(-sobra)}</strong> a
                  mais do que o rendimento indicado. Vale a pena confirmar os
                  valores.
                </>
              )}
            </div>
          ) : null}
        </Card>
      ) : null}

      {/* ── Navegação ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {passo > 0 ? (
          <Button variant="secondary" onClick={anterior} disabled={pendente}>
            <ArrowLeft size={16} aria-hidden />
            Voltar
          </Button>
        ) : null}

        <div className="flex-1" />

        {passo < PASSOS.length - 1 ? (
          <>
            <Button
              variant="ghost"
              onClick={() => setPasso(PASSOS.length - 1)}
              disabled={pendente}
            >
              Saltar
            </Button>
            <Button onClick={seguinte} disabled={pendente}>
              Continuar
              <ArrowRight size={16} aria-hidden />
            </Button>
          </>
        ) : (
          <Button onClick={concluir} disabled={pendente} size="lg">
            {pendente ? "A criar…" : "Criar e começar"}
            {pendente ? null : <Check size={16} aria-hidden />}
          </Button>
        )}
      </div>

      <button
        type="button"
        onClick={() => router.push("/")}
        className="w-full py-2 text-center text-xs text-faint hover:text-muted"
      >
        Prefiro configurar mais tarde
      </button>
    </div>
  );
}

function EscolhaBotao({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        "flex-1 rounded-xl border px-3 py-2.5 text-xs font-medium transition-colors",
        ativo
          ? "border-primary bg-primary-soft text-primary"
          : "border-line bg-surface text-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function LinhaResumo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <li className="flex items-baseline justify-between gap-3 py-2">
      <span className="truncate text-muted">{rotulo}</span>
      <span className="tabular shrink-0 font-medium text-ink">{valor}</span>
    </li>
  );
}
