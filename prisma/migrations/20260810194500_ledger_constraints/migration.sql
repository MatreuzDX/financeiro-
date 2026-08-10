-- Garantias que vivem na BASE DE DADOS, não no código.
--
-- Porquê: um bug numa Server Action, um script mal escrito, um `psql` à
-- pressa — qualquer um deles pode escrever lixo. Uma verificação em
-- TypeScript só protege o caminho que se lembrou de a chamar. Isto protege
-- todos os caminhos, para sempre.

-- ---------------------------------------------------------------------------
-- 1. Cada linha do livro aponta para UMA conta OU UMA categoria
-- ---------------------------------------------------------------------------
ALTER TABLE "Entry"
  ADD CONSTRAINT "entry_account_xor_category"
  CHECK (
    ("accountId" IS NOT NULL AND "categoryId" IS NULL)
    OR
    ("accountId" IS NULL AND "categoryId" IS NOT NULL)
  );

-- ---------------------------------------------------------------------------
-- 2. A soma das linhas de cada transação é ZERO
--
-- É esta constraint que torna impossível uma transferência inflacionar o
-- lucro, ou uma despesa "desaparecer" de uma conta sem aparecer noutro lado.
--
-- DEFERRABLE INITIALLY DEFERRED: a verificação corre no COMMIT, não a cada
-- linha inserida — senão a primeira linha de qualquer transação falharia
-- sempre, já que sozinha nunca soma zero.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION assert_transaction_balanced() RETURNS TRIGGER AS $$
DECLARE
  tx_id TEXT;
  total BIGINT;
  line_count INT;
BEGIN
  tx_id := COALESCE(NEW."transactionId", OLD."transactionId");

  -- Se a transação foi apagada (as linhas vão atrás em cascata), não há nada
  -- a validar.
  IF NOT EXISTS (SELECT 1 FROM "Transaction" WHERE "id" = tx_id) THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM("amountCents"), 0), COUNT(*)
    INTO total, line_count
    FROM "Entry"
   WHERE "transactionId" = tx_id;

  IF line_count < 2 THEN
    RAISE EXCEPTION
      'Transacao % tem % linha(s) no livro; sao precisas pelo menos 2',
      tx_id, line_count;
  END IF;

  IF total <> 0 THEN
    RAISE EXCEPTION
      'Transacao % nao esta equilibrada: as linhas somam % centimos, deviam somar 0',
      tx_id, total;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "entry_keeps_transaction_balanced"
  AFTER INSERT OR UPDATE OR DELETE ON "Entry"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_transaction_balanced();

-- ---------------------------------------------------------------------------
-- 3. A auditoria não se reescreve
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_log_is_append_only() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'AuditLog e append-only: % nao e permitido nesta tabela', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_log_no_update"
  BEFORE UPDATE ON "AuditLog"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_is_append_only();

CREATE TRIGGER "audit_log_no_delete"
  BEFORE DELETE ON "AuditLog"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_is_append_only();

-- ---------------------------------------------------------------------------
-- 4. Quilometragem impossível
--    Não se pode chegar com menos quilómetros do que se partiu.
-- ---------------------------------------------------------------------------
ALTER TABLE "MileageLog"
  ADD CONSTRAINT "mileage_end_after_start"
  CHECK ("endMetres" >= "startMetres");

ALTER TABLE "MileageLog"
  ADD CONSTRAINT "mileage_total_is_difference"
  CHECK ("totalMetres" = "endMetres" - "startMetres");

ALTER TABLE "MileageLog"
  ADD CONSTRAINT "mileage_start_not_negative"
  CHECK ("startMetres" >= 0);

-- ---------------------------------------------------------------------------
-- 5. Valores que não fazem sentido negativos
-- ---------------------------------------------------------------------------
ALTER TABLE "Vehicle"
  ADD CONSTRAINT "vehicle_odometer_not_negative"
  CHECK ("currentMetres" >= 0);

ALTER TABLE "FuelLog"
  ADD CONSTRAINT "fuel_positive_amounts"
  CHECK ("litersMl" > 0 AND "pricePerLiterE4" >= 0 AND "totalCents" >= 0
         AND "odometerMetres" >= 0);

ALTER TABLE "WorkJob"
  ADD CONSTRAINT "workjob_not_negative"
  CHECK ("distanceMetres" >= 0 AND "deliveries" >= 0 AND "hoursTenths" >= 0
         AND "ratePerKmCents" >= 0 AND "ratePerDeliveryCents" >= 0
         AND "ratePerHourCents" >= 0 AND "grossCents" >= 0);

ALTER TABLE "BudgetLine"
  ADD CONSTRAINT "budget_planned_not_negative"
  CHECK ("plannedCents" >= 0);

-- ---------------------------------------------------------------------------
-- 6. Índice para o cálculo de saldo por conta
-- ---------------------------------------------------------------------------
CREATE INDEX "Entry_account_balance_idx"
  ON "Entry" ("accountId") INCLUDE ("amountCents")
  WHERE "accountId" IS NOT NULL;
