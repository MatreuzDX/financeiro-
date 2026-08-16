"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button, ErrorBanner, Field, Input, Select, SuccessBanner } from "@/components/ui";
import type { PerfilFiscal } from "@/lib/fiscal";
import { guardarPerfilAction, type FiscalState } from "./actions";

function Guardar() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "A guardar…" : "Guardar perfil"}
    </Button>
  );
}

/**
 * O perfil fiscal.
 *
 * As taxas estão todas à vista e todas editáveis. Não é preguiça — é que
 * mudam de ano para ano e há exceções (atividades com retenção a 16,5% ou
 * 11,5%, coeficientes diferentes) que nenhuma app consegue adivinhar. Mais
 * vale mostrar a conta e deixar corrigir do que esconder e errar.
 */
export function FiscalForm({ perfil }: { perfil: PerfilFiscal }) {
  const [state, action] = useActionState<FiscalState, FormData>(
    guardarPerfilAction,
    {},
  );
  const [independente, setIndependente] = useState(perfil.independente);
  const [regimeIva, setRegimeIva] = useState(perfil.regimeIva);
  const [retencao, setRetencao] = useState(perfil.retencaoNaFonte);

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-line bg-surface p-4">
      {state.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}
      {state.guardado ? <SuccessBanner>Perfil guardado.</SuccessBanner> : null}

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="independente"
          checked={independente}
          onChange={(e) => setIndependente(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
        />
        <span>
          <span className="block text-sm text-ink">
            Trabalho a recibos verdes
          </span>
          <span className="block text-[11px] text-muted">
            Passa faturas ou faturas-recibo como trabalhador independente
          </span>
        </span>
      </label>

      {!independente ? (
        <p className="text-xs text-muted">
          Se um dia abrir atividade, ligue isto e a app passa a separar o
          dinheiro dos impostos do dinheiro que é seu.
        </p>
      ) : (
        <>
          <Field
            label="Regime de IVA"
            hint="Isento pelo art. 53.º enquanto faturar menos de 13 500 € por ano"
          >
            <Select
              name="regimeIva"
              value={regimeIva}
              onChange={(e) => setRegimeIva(e.target.value as typeof regimeIva)}
            >
              <option value="ISENTO_ART53">Isento — art. 53.º</option>
              <option value="NORMAL">Regime normal — cobro IVA</option>
            </Select>
          </Field>

          <Field
            label="Mês em que abriu atividade"
            hint="Para saber se ainda está nos 12 meses de isenção da Segurança Social"
          >
            <Input
              name="inicioAtividade"
              type="month"
              defaultValue={perfil.inicioAtividade ?? ""}
            />
          </Field>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="retencaoNaFonte"
              checked={retencao}
              onChange={(e) => setRetencao(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
            />
            <span>
              <span className="block text-sm text-ink">
                Os meus clientes retêm IRS no recibo
              </span>
              <span className="block text-[11px] text-muted">
                Se retêm, esse dinheiro nunca chega à sua conta e não precisa de
                o guardar
              </span>
            </span>
          </label>

          <details className="rounded-xl border border-line bg-surface-2 p-3">
            <summary className="cursor-pointer text-xs font-medium text-ink">
              Ajustar as taxas
            </summary>
            <div className="mt-3 space-y-3">
              <p className="text-[11px] leading-relaxed text-muted">
                Os valores por omissão são os de 2026. Mudam quase todos os anos
                e há atividades com taxas diferentes — se o seu contabilista lhe
                disser outros números, são esses que valem.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <Percent
                  name="taxaSsPercent"
                  label="Segurança Social"
                  value={perfil.taxaSsPercent}
                />
                <Percent
                  name="coeficienteSsPercent"
                  label="Coeficiente"
                  value={perfil.coeficienteSsPercent}
                />
                {regimeIva === "NORMAL" ? (
                  <Percent name="taxaIvaPercent" label="IVA" value={perfil.taxaIvaPercent} />
                ) : (
                  <input type="hidden" name="taxaIvaPercent" value={perfil.taxaIvaPercent} />
                )}
                {retencao ? (
                  <Percent
                    name="taxaRetencaoPercent"
                    label="Retenção"
                    value={perfil.taxaRetencaoPercent}
                  />
                ) : (
                  <>
                    <input
                      type="hidden"
                      name="taxaRetencaoPercent"
                      value={perfil.taxaRetencaoPercent}
                    />
                    <Percent
                      name="reservaIrsPercent"
                      label="Guardar p/ IRS"
                      value={perfil.reservaIrsPercent}
                    />
                  </>
                )}
                {retencao ? (
                  <input
                    type="hidden"
                    name="reservaIrsPercent"
                    value={perfil.reservaIrsPercent}
                  />
                ) : null}
              </div>
            </div>
          </details>
        </>
      )}

      {!independente ? (
        <>
          <input type="hidden" name="regimeIva" value={regimeIva} />
          <input type="hidden" name="taxaSsPercent" value={perfil.taxaSsPercent} />
          <input
            type="hidden"
            name="coeficienteSsPercent"
            value={perfil.coeficienteSsPercent}
          />
          <input type="hidden" name="taxaIvaPercent" value={perfil.taxaIvaPercent} />
          <input
            type="hidden"
            name="taxaRetencaoPercent"
            value={perfil.taxaRetencaoPercent}
          />
          <input
            type="hidden"
            name="reservaIrsPercent"
            value={perfil.reservaIrsPercent}
          />
        </>
      ) : null}

      <Guardar />
    </form>
  );
}

function Percent({
  name,
  label,
  value,
}: {
  name: string;
  label: string;
  value: number;
}) {
  return (
    <Field label={label}>
      <div className="relative">
        <Input
          name={name}
          defaultValue={String(value).replace(".", ",")}
          inputMode="decimal"
          className="pr-7"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-faint">
          %
        </span>
      </div>
    </Field>
  );
}
