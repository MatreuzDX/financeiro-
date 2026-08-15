"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Bike,
  Bus,
  Check,
  CreditCard,
  House,
  Plus,
  Trash2,
  UserRound,
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

type Pergunta = {
  categoria: string;
  pergunta: string;
  exemplo?: string;
  soSe?: { agregado?: string[]; perfis?: string[] };
};
type Opcao = { id: string; label: string; hint?: string };

const PASSOS = [
  "Perfil",
  "Dinheiro",
  "Rendimentos",
  "Casa",
  "Transporte",
  "Contas fixas",
  "Resumo",
] as const;

/** Converte o que a pessoa escreveu; vazio ou inválido → null. */
function euros(valor: string): number | null {
  const t = valor.trim();
  if (t === "") return null;
  return parseAmountToCents(t);
}

type Rendimento = { id: number; nome: string; tipo: string; mensal: string };
type Credito = { id: number; nome: string; mensal: string };

/** Sugestões de fonte de rendimento a partir do perfil escolhido. */
const SUGESTAO_POR_PERFIL: Record<string, { nome: string; tipo: string }> = {
  EMPREGADO: { nome: "Trabalho principal", tipo: "SALARY" },
  INDEPENDENTE: { nome: "Trabalho independente", tipo: "FREELANCE" },
  ENTREGAS: { nome: "Entregas", tipo: "DELIVERY" },
  NEGOCIO: { nome: "Negócio", tipo: "BUSINESS" },
  ESTUDANTE: { nome: "Bolsa ou apoio", tipo: "OTHER" },
  REFORMADO: { nome: "Pensão", tipo: "OTHER" },
};

let proximoId = 1;

export function SetupWizard({
  perguntasFixas,
  perfis,
  habitacoes,
  agregados,
  nome,
}: {
  perguntasFixas: Pergunta[];
  perfis: readonly Opcao[];
  habitacoes: readonly Opcao[];
  agregados: readonly Opcao[];
  nome: string;
}) {
  const router = useRouter();
  const [passo, setPasso] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  // ── 1. Perfil ──────────────────────────────────────────────────────────
  const [perfisEscolhidos, setPerfisEscolhidos] = useState<string[]>([]);

  // ── 2. Dinheiro ────────────────────────────────────────────────────────
  const [contaNome, setContaNome] = useState("Conta à ordem");
  const [contaTipo, setContaTipo] = useState("BANK");
  const [contaSaldo, setContaSaldo] = useState("");
  const [dinheiroVivo, setDinheiroVivo] = useState("");
  const [poupanca, setPoupanca] = useState("");

  // ── 3. Rendimentos ─────────────────────────────────────────────────────
  const [rendimentos, setRendimentos] = useState<Rendimento[]>([]);

  // ── 4. Casa ────────────────────────────────────────────────────────────
  const [habitacao, setHabitacao] = useState<string | null>(null);
  const [habitacaoValor, setHabitacaoValor] = useState("");
  const [agregado, setAgregado] = useState<string | null>(null);

  // ── 5. Transporte ──────────────────────────────────────────────────────
  const [temVeiculo, setTemVeiculo] = useState<boolean | null>(null);
  const [transportes, setTransportes] = useState("");
  const [vNome, setVNome] = useState("");
  const [vMarca, setVMarca] = useState("");
  const [vModelo, setVModelo] = useState("");
  const [vAno, setVAno] = useState("");
  const [vTipo, setVTipo] = useState("CAR");
  const [vCombustivel, setVCombustivel] = useState("PETROL");
  const [vKm, setVKm] = useState("");
  const [vCombMensal, setVCombMensal] = useState("");
  const [vManutMensal, setVManutMensal] = useState("");
  const [vTrabalho, setVTrabalho] = useState(false);

  // ── 6. Contas fixas e créditos ─────────────────────────────────────────
  const [fixas, setFixas] = useState<Record<string, string>>({});
  const [creditos, setCreditos] = useState<Credito[]>([]);

  const fazEntregas = perfisEscolhidos.includes("ENTREGAS");

  /** Só as perguntas que fazem sentido para quem está a responder. */
  const perguntasVisiveis = useMemo(
    () =>
      perguntasFixas.filter((p) => {
        if (!p.soSe) return true;
        if (p.soSe.agregado && !p.soSe.agregado.includes(agregado ?? "")) {
          return false;
        }
        if (
          p.soSe.perfis &&
          !p.soSe.perfis.some((x) => perfisEscolhidos.includes(x))
        ) {
          return false;
        }
        return true;
      }),
    [perguntasFixas, agregado, perfisEscolhidos],
  );

  const rendimentoTotal = useMemo(
    () => rendimentos.reduce((s, r) => s + (euros(r.mensal) ?? 0), 0),
    [rendimentos],
  );

  const totalFixas = useMemo(() => {
    let soma = 0;
    for (const v of Object.values(fixas)) soma += euros(v) ?? 0;
    soma += euros(habitacaoValor) ?? 0;
    soma += euros(transportes) ?? 0;
    soma += euros(vCombMensal) ?? 0;
    soma += euros(vManutMensal) ?? 0;
    for (const c of creditos) soma += euros(c.mensal) ?? 0;
    return soma;
  }, [fixas, habitacaoValor, transportes, vCombMensal, vManutMensal, creditos]);

  const sobra = rendimentoTotal - totalFixas;

  function alternarPerfil(id: string) {
    setPerfisEscolhidos((atual) => {
      const novo = atual.includes(id)
        ? atual.filter((p) => p !== id)
        : [...atual, id];

      // Ao escolher um perfil, propõe já a fonte de rendimento
      // correspondente — sem obrigar, dá para apagar.
      const sugestao = SUGESTAO_POR_PERFIL[id];
      if (sugestao && !atual.includes(id)) {
        setRendimentos((rs) =>
          rs.some((r) => r.nome === sugestao.nome)
            ? rs
            : [
                ...rs,
                {
                  id: proximoId++,
                  nome: sugestao.nome,
                  tipo: sugestao.tipo,
                  mensal: "",
                },
              ],
        );
      }
      if (id === "ENTREGAS" && !atual.includes(id)) {
        setTemVeiculo(true);
        setVTipo("SCOOTER");
        setVTrabalho(true);
      }
      return novo;
    });
  }

  function seguinte() {
    setErro(null);

    if (passo === 1) {
      if (contaNome.trim() === "") {
        setErro("Dê um nome à conta.");
        return;
      }
      for (const [rotulo, valor] of [
        ["saldo", contaSaldo],
        ["dinheiro em carteira", dinheiroVivo],
        ["poupança", poupanca],
      ] as const) {
        if (valor.trim() !== "" && euros(valor) === null) {
          setErro(`O valor do ${rotulo} não é válido. Exemplo: 450,00`);
          return;
        }
      }
    }

    if (passo === 4 && temVeiculo) {
      if (vNome.trim() === "") {
        setErro("Dê um nome ao veículo. Por exemplo: o meu carro.");
        return;
      }
      if (vKm.trim() !== "" && parseKmToMetres(vKm) === null) {
        setErro("Os quilómetros não são um valor válido. Exemplo: 84500");
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

    iniciar(async () => {
      const resultado = await completeSetupAction({
        perfis: perfisEscolhidos,
        conta: {
          name: contaNome.trim(),
          type: contaTipo,
          openingCents: euros(contaSaldo) ?? 0,
        },
        dinheiroVivoCents: euros(dinheiroVivo),
        poupancaCents: euros(poupanca),
        rendimentos: rendimentos
          .filter((r) => r.nome.trim() !== "")
          .map((r) => ({
            name: r.nome.trim(),
            type: r.tipo,
            mensalCents: euros(r.mensal),
          })),
        habitacao,
        habitacaoCents: euros(habitacaoValor),
        agregado,
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
        transportesMensalCents: euros(transportes),
        creditos: creditos
          .filter((c) => c.nome.trim() !== "" && (euros(c.mensal) ?? 0) > 0)
          .map((c) => ({ nome: c.nome.trim(), mensalCents: euros(c.mensal)! })),
        fixas: fixasCents,
      });
      if (resultado?.error) setErro(resultado.error);
    });
  }

  return (
    <div className="space-y-4">
      <ol className="flex items-center gap-1" aria-label="Progresso">
        {PASSOS.map((nomePasso, i) => (
          <li key={nomePasso} className="flex-1">
            <div
              className={cn(
                "h-1 rounded-full transition-colors",
                i <= passo ? "bg-primary" : "bg-surface-2",
              )}
              aria-current={i === passo ? "step" : undefined}
            />
          </li>
        ))}
      </ol>
      <p className="text-[11px] text-muted">
        Passo {passo + 1} de {PASSOS.length} · {PASSOS[passo]}
      </p>

      {erro ? <ErrorBanner>{erro}</ErrorBanner> : null}

      {/* ── 1. Perfil ───────────────────────────────────────────────────── */}
      {passo === 0 ? (
        <Card className="animate-rise space-y-4">
          <header>
            <div className="mb-2 flex items-center gap-2 text-primary">
              <UserRound size={18} aria-hidden />
              <h2 className="text-sm font-semibold">Como é a sua vida agora?</h2>
            </div>
            <p className="text-xs leading-relaxed text-muted">
              Escolha tudo o que se aplicar. Serve para não lhe fazer
              perguntas que não têm nada a ver consigo — e para propor as
              coisas certas a seguir.
            </p>
          </header>

          <div className="space-y-2">
            {perfis.map((p) => {
              const ativo = perfisEscolhidos.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => alternarPerfil(p.id)}
                  aria-pressed={ativo}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                    ativo
                      ? "border-primary bg-primary-soft"
                      : "border-line bg-surface hover:bg-surface-hover",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border",
                      ativo
                        ? "border-primary bg-primary text-primary-fg"
                        : "border-line-strong",
                    )}
                    aria-hidden
                  >
                    {ativo ? <Check size={11} /> : null}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cn(
                        "block text-sm",
                        ativo ? "font-medium text-primary" : "text-ink",
                      )}
                    >
                      {p.label}
                    </span>
                    {p.hint ? (
                      <span className="block text-[11px] text-muted">
                        {p.hint}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>

          <InfoNote>
            Nada disto fica fixo. Se a sua vida mudar — muda-se aqui, em
            Definições → Rever a configuração.
          </InfoNote>
        </Card>
      ) : null}

      {/* ── 2. Dinheiro ─────────────────────────────────────────────────── */}
      {passo === 1 ? (
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
            hint="Se não souber ao certo, ponha um valor aproximado — corrige-se depois."
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

          <Field
            label="Tem algum dinheiro de lado?"
            hint="Cria uma conta Poupança à parte, para não se misturar com o do dia a dia."
          >
            <MoneyInput
              value={poupanca}
              onChange={(e) => setPoupanca(e.target.value)}
            />
          </Field>
        </Card>
      ) : null}

      {/* ── 3. Rendimentos ──────────────────────────────────────────────── */}
      {passo === 2 ? (
        <Card className="animate-rise space-y-4">
          <header>
            <h2 className="text-sm font-semibold text-ink">
              De onde vem o seu dinheiro?
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Pode ter várias fontes — ordenado, uns trabalhos por fora, uma
              casa arrendada. Cada uma passa a ter o seu próprio histórico e
              o seu próprio lucro.
            </p>
          </header>

          {rendimentos.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-muted">
              Ainda sem fontes. Acrescente uma, ou salte este passo.
            </p>
          ) : null}

          <div className="space-y-3">
            {rendimentos.map((r) => (
              <div
                key={r.id}
                className="space-y-3 rounded-xl border border-line bg-surface-2 p-3"
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <Field label="Nome">
                      <Input
                        value={r.nome}
                        maxLength={60}
                        onChange={(e) =>
                          setRendimentos((rs) =>
                            rs.map((x) =>
                              x.id === r.id ? { ...x, nome: e.target.value } : x,
                            ),
                          )
                        }
                        placeholder="Trabalho principal"
                      />
                    </Field>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setRendimentos((rs) => rs.filter((x) => x.id !== r.id))
                    }
                    aria-label={`Remover ${r.nome || "fonte"}`}
                    className="mt-6 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-faint transition-colors hover:bg-negative-soft hover:text-negative"
                  >
                    <Trash2 size={15} aria-hidden />
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Tipo">
                    <Select
                      value={r.tipo}
                      onChange={(e) =>
                        setRendimentos((rs) =>
                          rs.map((x) =>
                            x.id === r.id ? { ...x, tipo: e.target.value } : x,
                          ),
                        )
                      }
                    >
                      <option value="SALARY">Ordenado</option>
                      <option value="DELIVERY">Entregas</option>
                      <option value="FREELANCE">Freelancer</option>
                      <option value="BUSINESS">Negócio</option>
                      <option value="RENTAL">Arrendamento</option>
                      <option value="OTHER">Outro</option>
                    </Select>
                  </Field>

                  <Field label="Por mês, líquido" hint="Aproximado">
                    <MoneyInput
                      value={r.mensal}
                      onChange={(e) =>
                        setRendimentos((rs) =>
                          rs.map((x) =>
                            x.id === r.id ? { ...x, mensal: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>

          <Button
            variant="secondary"
            className="w-full"
            onClick={() =>
              setRendimentos((rs) => [
                ...rs,
                { id: proximoId++, nome: "", tipo: "OTHER", mensal: "" },
              ])
            }
          >
            <Plus size={16} aria-hidden />
            Acrescentar fonte
          </Button>

          {rendimentoTotal > 0 ? (
            <p className="text-xs text-muted">
              Total por mês:{" "}
              <strong className="tabular text-ink">
                {formatCents(rendimentoTotal)}
              </strong>
            </p>
          ) : null}

          <InfoNote>
            Estes valores são referência para o orçamento. Não são lançados
            como receita — o dinheiro só entra na app quando entrar mesmo.
          </InfoNote>
        </Card>
      ) : null}

      {/* ── 4. Casa ─────────────────────────────────────────────────────── */}
      {passo === 3 ? (
        <Card className="animate-rise space-y-4">
          <header>
            <div className="mb-2 flex items-center gap-2 text-primary">
              <House size={18} aria-hidden />
              <h2 className="text-sm font-semibold">Onde e com quem vive?</h2>
            </div>
            <p className="text-xs leading-relaxed text-muted">
              A casa costuma ser a maior despesa. E quem vive consigo muda o
              que faz sentido perguntar a seguir.
            </p>
          </header>

          <fieldset>
            <legend className="mb-2 text-xs font-medium text-muted">
              A casa onde vive
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {habitacoes.map((h) => (
                <EscolhaBotao
                  key={h.id}
                  ativo={habitacao === h.id}
                  onClick={() => setHabitacao(h.id)}
                >
                  {h.label}
                </EscolhaBotao>
              ))}
            </div>
          </fieldset>

          {habitacao === "ARRENDO" || habitacao === "CREDITO" ? (
            <Field
              label={
                habitacao === "ARRENDO"
                  ? "Quanto paga de renda por mês"
                  : "Quanto paga de prestação por mês"
              }
            >
              <MoneyInput
                value={habitacaoValor}
                onChange={(e) => setHabitacaoValor(e.target.value)}
              />
            </Field>
          ) : null}

          {habitacao === "PAGA" || habitacao === "FAMILIA" ? (
            <InfoNote>
              Sem custo mensal de habitação, então. Não vou criar nenhuma
              linha de orçamento para isso.
            </InfoNote>
          ) : null}

          <fieldset>
            <legend className="mb-2 text-xs font-medium text-muted">
              Quem vive consigo
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {agregados.map((a) => (
                <EscolhaBotao
                  key={a.id}
                  ativo={agregado === a.id}
                  onClick={() => setAgregado(a.id)}
                >
                  {a.label}
                </EscolhaBotao>
              ))}
            </div>
          </fieldset>
        </Card>
      ) : null}

      {/* ── 5. Transporte ───────────────────────────────────────────────── */}
      {passo === 4 ? (
        <Card className="animate-rise space-y-4">
          <header>
            <div className="mb-2 flex items-center gap-2 text-primary">
              <Bike size={18} aria-hidden />
              <h2 className="text-sm font-semibold">Como se desloca?</h2>
            </div>
            <p className="text-xs leading-relaxed text-muted">
              {fazEntregas
                ? "Como faz entregas, o veículo é a peça central: é o que permite saber quanto custa cada quilómetro e quanto lucra de verdade."
                : "Carro, mota, transportes públicos, a pé. Só para não ficar de fora uma despesa que costuma ser das maiores."}
            </p>
          </header>

          <div className="flex gap-2">
            <EscolhaBotao ativo={temVeiculo === true} onClick={() => setTemVeiculo(true)}>
              Tenho veículo
            </EscolhaBotao>
            <EscolhaBotao
              ativo={temVeiculo === false}
              onClick={() => setTemVeiculo(false)}
            >
              Não tenho
            </EscolhaBotao>
          </div>

          {temVeiculo === false ? (
            <Field
              label="Gasta quanto em transportes por mês?"
              hint="Passe, bilhetes, boleias. Deixe em branco se não gastar."
            >
              <div className="flex items-center gap-2">
                <Bus size={16} className="shrink-0 text-muted" aria-hidden />
                <MoneyInput
                  value={transportes}
                  onChange={(e) => setTransportes(e.target.value)}
                />
              </div>
            </Field>
          ) : null}

          {temVeiculo ? (
            <>
              <Field label="Como lhe chama" hint="O nome que usa no dia a dia">
                <Input
                  value={vNome}
                  onChange={(e) => setVNome(e.target.value)}
                  maxLength={60}
                  placeholder={fazEntregas ? "Honda PCX" : "O meu carro"}
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
                    <option value="CAR">Carro</option>
                    <option value="SCOOTER">Scooter</option>
                    <option value="MOTORCYCLE">Mota</option>
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
                    placeholder="84500"
                  />
                </Field>
              </div>

              <Field label="Combustível por mês" hint="Aproximado">
                <MoneyInput
                  value={vCombMensal}
                  onChange={(e) => setVCombMensal(e.target.value)}
                />
              </Field>

              <Field label="Manutenção por mês" hint="Opcional">
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

      {/* ── 6. Contas fixas e créditos ──────────────────────────────────── */}
      {passo === 5 ? (
        <>
          <Card className="animate-rise space-y-4">
            <header>
              <h2 className="text-sm font-semibold text-ink">
                O que paga todos os meses?
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Preencha só o que souber — o resto fica em branco e
                acrescenta-se quando quiser. Isto vira o orçamento deste mês.
              </p>
            </header>

            <div className="space-y-3">
              {perguntasVisiveis.map((p) => (
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

          <Card className="animate-rise space-y-4">
            <header>
              <div className="mb-2 flex items-center gap-2 text-primary">
                <CreditCard size={18} aria-hidden />
                <h2 className="text-sm font-semibold">
                  Tem créditos a pagar?
                </h2>
              </div>
              <p className="text-xs leading-relaxed text-muted">
                Cartão, crédito pessoal, automóvel, estudante. Só a prestação
                mensal — o que interessa aqui é o que sai por mês.
              </p>
            </header>

            {creditos.map((c) => (
              <div key={c.id} className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <Field label="Qual">
                    <Input
                      value={c.nome}
                      maxLength={60}
                      placeholder="Crédito do carro"
                      onChange={(e) =>
                        setCreditos((cs) =>
                          cs.map((x) =>
                            x.id === c.id ? { ...x, nome: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </Field>
                </div>
                <div className="w-32 shrink-0">
                  <Field label="Por mês">
                    <MoneyInput
                      value={c.mensal}
                      onChange={(e) =>
                        setCreditos((cs) =>
                          cs.map((x) =>
                            x.id === c.id ? { ...x, mensal: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </Field>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setCreditos((cs) => cs.filter((x) => x.id !== c.id))
                  }
                  aria-label={`Remover ${c.nome || "crédito"}`}
                  className="grid h-11 w-10 shrink-0 place-items-center rounded-lg text-faint transition-colors hover:bg-negative-soft hover:text-negative"
                >
                  <Trash2 size={15} aria-hidden />
                </button>
              </div>
            ))}

            <Button
              variant="secondary"
              className="w-full"
              onClick={() =>
                setCreditos((cs) => [
                  ...cs,
                  { id: proximoId++, nome: "", mensal: "" },
                ])
              }
            >
              <Plus size={16} aria-hidden />
              {creditos.length === 0 ? "Tenho um crédito" : "Acrescentar outro"}
            </Button>
          </Card>
        </>
      ) : null}

      {/* ── 7. Resumo ───────────────────────────────────────────────────── */}
      {passo === 6 ? (
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
            {euros(poupanca) ? (
              <LinhaResumo
                rotulo="Poupança"
                valor={formatCents(euros(poupanca)!)}
              />
            ) : null}
            {rendimentos
              .filter((r) => r.nome.trim())
              .map((r) => (
                <LinhaResumo
                  key={r.id}
                  rotulo={r.nome}
                  valor={
                    euros(r.mensal)
                      ? `${formatCents(euros(r.mensal)!)} / mês`
                      : "sem valor indicado"
                  }
                />
              ))}
            {temVeiculo && vNome.trim() ? (
              <LinhaResumo
                rotulo={vNome}
                valor={
                  [vMarca, vModelo, vAno].filter(Boolean).join(" ") || "veículo"
                }
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

          {rendimentoTotal > 0 && totalFixas > 0 ? (
            <div
              className={cn(
                "rounded-xl p-3 text-sm leading-relaxed",
                sobra >= 0
                  ? "bg-positive-soft text-positive"
                  : "bg-negative-soft text-negative",
              )}
            >
              {sobra >= 0 ? (
                <>
                  Depois das contas fixas, sobram{" "}
                  <strong className="tabular">{formatCents(sobra)}</strong> por
                  mês para o resto — comida fora, imprevistos, poupança.
                </>
              ) : (
                <>
                  As contas fixas somam{" "}
                  <strong className="tabular">{formatCents(-sobra)}</strong> a
                  mais do que o rendimento indicado. Pode ser um valor mal
                  metido, ou pode ser real — de qualquer forma, vale a pena
                  olhar com atenção.
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
        "min-h-11 flex-1 rounded-xl border px-3 text-xs font-medium transition-colors",
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
