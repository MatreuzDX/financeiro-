"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, X } from "lucide-react";
import {
  Button,
  ErrorBanner,
  Field,
  Input,
  MoneyInput,
  Select,
  SuccessBanner,
  Textarea,
} from "@/components/ui";
import {
  divRound,
  formatCents,
  formatCostPerKm,
  kmPayToCents,
  parseAmountToCents,
  parseKmToMetres,
} from "@/lib/money";
import { createWorkJobAction, type WorkState } from "./actions";

type Option = { id: string; name: string };
type PayModel = "PER_KM" | "PER_DELIVERY" | "HOURLY" | "FIXED";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? "A guardar…" : "Registar trabalho"}
    </Button>
  );
}

/**
 * O fluxo que justifica o produto.
 *
 * O cálculo aparece EM BAIXO, ao vivo, na ordem que interessa:
 *   receita → custo estimado → lucro.
 * Nunca só a receita. €60 recebidos não são €60 ganhos.
 *
 * O custo estimado é uma imputação analítica — o combustível já é lançado
 * quando se abastece, e lançá-lo outra vez aqui contaria o mesmo custo duas
 * vezes. Por isso é mostrado, mas não é contabilizado. A interface diz isso.
 */
export function WorkForm({
  incomeSources,
  vehicles,
  accounts,
  incomeCategories,
  today,
  costPerKmCents,
}: {
  incomeSources: Option[];
  vehicles: Option[];
  accounts: Option[];
  incomeCategories: Option[];
  today: string;
  costPerKmCents: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<WorkState, FormData>(
    createWorkJobAction,
    {},
  );

  const [payModel, setPayModel] = useState<PayModel>("PER_KM");
  const [startKm, setStartKm] = useState("");
  const [endKm, setEndKm] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [rate, setRate] = useState("0,40");
  const [deliveries, setDeliveries] = useState("");
  const [ratePerDelivery, setRatePerDelivery] = useState("");
  const [hours, setHours] = useState("");
  const [ratePerHour, setRatePerHour] = useState("");
  const [fixed, setFixed] = useState("");
  const [tips, setTips] = useState("");

  const preview = useMemo(() => {
    const start = parseKmToMetres(startKm);
    const end = parseKmToMetres(endKm);
    const metres =
      start !== null && end !== null && end >= start
        ? end - start
        : (parseKmToMetres(distanceKm) ?? 0);

    const tipsCents = parseAmountToCents(tips) ?? 0;
    let gross = 0;

    if (payModel === "PER_KM") {
      gross = kmPayToCents(metres, parseAmountToCents(rate) ?? 0);
    } else if (payModel === "PER_DELIVERY") {
      gross =
        (Number(deliveries) || 0) * (parseAmountToCents(ratePerDelivery) ?? 0);
    } else if (payModel === "HOURLY") {
      const tenths = Math.round((Number(hours.replace(",", ".")) || 0) * 10);
      gross = divRound(tenths * (parseAmountToCents(ratePerHour) ?? 0), 10);
    } else {
      gross = parseAmountToCents(fixed) ?? 0;
    }

    gross += tipsCents;

    const cost =
      costPerKmCents !== null && metres > 0
        ? divRound(metres * costPerKmCents, 1000)
        : null;

    return { metres, gross, cost, profit: cost === null ? null : gross - cost };
  }, [
    payModel,
    startKm,
    endKm,
    distanceKm,
    rate,
    deliveries,
    ratePerDelivery,
    hours,
    ratePerHour,
    fixed,
    tips,
    costPerKmCents,
  ]);

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)} className="w-full">
        <Plus size={16} aria-hidden />
        Registar trabalho
      </Button>
    );
  }

  if (accounts.length === 0 || incomeSources.length === 0) {
    return (
      <ErrorBanner>
        Para registar trabalhos precisa de pelo menos{" "}
        {accounts.length === 0 ? (
          <a href="/contas" className="font-medium underline">
            uma conta
          </a>
        ) : (
          <a href="/fontes" className="font-medium underline">
            uma fonte de rendimento
          </a>
        )}
        .
      </ErrorBanner>
    );
  }

  return (
    <form
      action={action}
      className="animate-rise space-y-4 rounded-2xl border border-line bg-surface p-4"
      noValidate
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Novo trabalho</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Fechar"
          className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-hover"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      {state.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}
      {state.success ? <SuccessBanner>{state.success}</SuccessBanner> : null}

      <Field label="Para quem trabalhou">
        <Input
          name="clientName"
          required
          maxLength={80}
          placeholder="Pizzaria do Bairro"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fonte de rendimento">
          <Select name="incomeSourceId" required defaultValue={incomeSources[0]?.id}>
            {incomeSources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Data">
          <Input type="date" name="date" required defaultValue={today} />
        </Field>
      </div>

      <Field label="Como lhe pagam">
        <Select
          name="payModel"
          value={payModel}
          onChange={(e) => setPayModel(e.target.value as PayModel)}
        >
          <option value="PER_KM">Por quilómetro</option>
          <option value="PER_DELIVERY">Por entrega</option>
          <option value="HOURLY">Por hora</option>
          <option value="FIXED">Valor fixo</option>
        </Select>
      </Field>

      {payModel === "PER_KM" ? (
        <Field label="Valor por quilómetro">
          <MoneyInput
            name="ratePerKm"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            required
          />
        </Field>
      ) : null}

      {payModel === "PER_DELIVERY" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Entregas">
            <Input
              name="deliveries"
              type="number"
              inputMode="numeric"
              min={0}
              value={deliveries}
              onChange={(e) => setDeliveries(e.target.value)}
              required
            />
          </Field>
          <Field label="Valor por entrega">
            <MoneyInput
              name="ratePerDelivery"
              value={ratePerDelivery}
              onChange={(e) => setRatePerDelivery(e.target.value)}
              required
            />
          </Field>
        </div>
      ) : null}

      {payModel === "HOURLY" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Horas">
            <Input
              name="hours"
              inputMode="decimal"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="4,5"
              required
            />
          </Field>
          <Field label="Valor por hora">
            <MoneyInput
              name="ratePerHour"
              value={ratePerHour}
              onChange={(e) => setRatePerHour(e.target.value)}
              required
            />
          </Field>
        </div>
      ) : null}

      {payModel === "FIXED" ? (
        <Field label="Valor acordado">
          <MoneyInput
            name="fixed"
            value={fixed}
            onChange={(e) => setFixed(e.target.value)}
            required
          />
        </Field>
      ) : null}

      {vehicles.length > 0 ? (
        <>
          <Field label="Veículo" hint="Opcional, mas é o que permite saber o lucro real">
            <Select name="vehicleId" defaultValue={vehicles[0]?.id}>
              <option value="">Nenhum</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Km ao início" hint="Opcional">
              <Input
                name="startKm"
                inputMode="decimal"
                value={startKm}
                onChange={(e) => setStartKm(e.target.value)}
                placeholder="24150"
              />
            </Field>
            <Field label="Km ao fim" hint="Opcional">
              <Input
                name="endKm"
                inputMode="decimal"
                value={endKm}
                onChange={(e) => setEndKm(e.target.value)}
                placeholder="24300"
              />
            </Field>
          </div>
        </>
      ) : null}

      {payModel === "PER_KM" && !(startKm && endKm) ? (
        <Field
          label="Distância percorrida"
          hint="Se não usou o conta-quilómetros, escreva os km diretamente"
        >
          <Input
            name="distanceKm"
            inputMode="decimal"
            value={distanceKm}
            onChange={(e) => setDistanceKm(e.target.value)}
            placeholder="150"
          />
        </Field>
      ) : (
        <input type="hidden" name="distanceKm" value={distanceKm} />
      )}

      <Field label="Gorjetas" hint="Opcional">
        <MoneyInput
          name="tips"
          value={tips}
          onChange={(e) => setTips(e.target.value)}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Entrou na conta">
          <Select name="accountId" required defaultValue={accounts[0]?.id}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Categoria de receita">
          <Select name="categoryId" required defaultValue={incomeCategories[0]?.id}>
            {incomeCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Notas" hint="Opcional">
        <Textarea name="notes" maxLength={1000} />
      </Field>

      {/* ── O cálculo, ao vivo ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-line bg-surface-2 p-3.5">
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-muted">
              Recebe
              {preview.metres > 0 ? (
                <span className="text-faint">
                  {" "}
                  ({(preview.metres / 1000).toLocaleString("pt-PT")} km)
                </span>
              ) : null}
            </dt>
            <dd className="tabular font-medium text-ink">
              {formatCents(preview.gross)}
            </dd>
          </div>

          {preview.cost !== null ? (
            <>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">
                  Custo estimado do veículo
                  <span className="block text-[10px] text-faint">
                    {costPerKmCents !== null
                      ? formatCostPerKm(costPerKmCents)
                      : ""}{" "}
                    — estimativa, não é lançada como despesa
                  </span>
                </dt>
                <dd className="tabular text-negative">
                  − {formatCents(preview.cost)}
                </dd>
              </div>
              <div className="flex justify-between gap-2 border-t border-line pt-1.5">
                <dt className="font-medium text-ink">Lucro estimado</dt>
                <dd
                  className={`tabular text-base font-semibold ${
                    (preview.profit ?? 0) >= 0 ? "text-positive" : "text-negative"
                  }`}
                >
                  {formatCents(preview.profit ?? 0)}
                </dd>
              </div>
            </>
          ) : (
            <p className="pt-1 text-[11px] leading-relaxed text-faint">
              O lucro estimado aparece quando houver custo por quilómetro
              calculado — para isso é preciso ter registado abastecimentos ou
              despesas do veículo e quilómetros percorridos.
            </p>
          )}
        </dl>
      </div>

      <SubmitButton />
    </form>
  );
}
