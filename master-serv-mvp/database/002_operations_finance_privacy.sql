-- MASTER SERV SERVIÇOS — Migração 002
-- Complementa 001_initial_schema.sql. Revisar em ambiente de desenvolvimento.
-- Não armazena arquivos de documentos: somente metadados e chave privada do objeto.
BEGIN;

CREATE TABLE customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  label TEXT,
  postal_code TEXT NOT NULL,
  street TEXT NOT NULL,
  number TEXT NOT NULL,
  complement TEXT,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL,
  state_code CHAR(2) NOT NULL DEFAULT 'ES',
  reference_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_addresses_owner ON customer_addresses(customer_user_id);

CREATE TABLE provider_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_user_id UUID NOT NULL REFERENCES provider_profiles(user_id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending','approved','rejected','expired')),
  expires_at DATE,
  reviewed_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_provider_documents_review ON provider_documents(provider_user_id, review_status);

CREATE TABLE dispatch_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('individual','simultaneous')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','closed','cancelled')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE dispatch_candidates (
  batch_id UUID NOT NULL REFERENCES dispatch_batches(id) ON DELETE CASCADE,
  provider_user_id UUID NOT NULL REFERENCES provider_profiles(user_id) ON DELETE RESTRICT,
  response_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (response_status IN ('pending','accepted','declined','expired')),
  responded_at TIMESTAMPTZ,
  PRIMARY KEY (batch_id, provider_user_id)
);
CREATE INDEX idx_dispatch_candidates_provider ON dispatch_candidates(provider_user_id, response_status);

CREATE TABLE order_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  provider_user_id UUID NOT NULL REFERENCES provider_profiles(user_id) ON DELETE RESTRICT,
  assigned_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'assigned'
    CHECK (status IN ('assigned','accepted','declined','released','completed')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);
CREATE INDEX idx_assignments_order ON order_assignments(order_id, assigned_at DESC);
CREATE INDEX idx_assignments_provider ON order_assignments(provider_user_id, status);

CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE RESTRICT,
  customer_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  provider_user_id UUID REFERENCES provider_profiles(user_id) ON DELETE RESTRICT,
  method TEXT NOT NULL CHECK (method IN ('pix','card','cash','bank_transfer','other')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','authorized','paid','partially_refunded','refunded','failed','cancelled')),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  provider_reference TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_order ON payment_transactions(order_id, created_at DESC);

CREATE TABLE financial_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES payment_transactions(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE RESTRICT,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('customer_payment','provider_payout','platform_commission','refund','adjustment')),
  direction TEXT NOT NULL CHECK (direction IN ('credit','debit')),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ledger_order ON financial_ledger_entries(order_id, created_at);

CREATE TABLE commission_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE RESTRICT,
  payment_transaction_id UUID REFERENCES payment_transactions(id) ON DELETE RESTRICT,
  gross_amount_cents BIGINT NOT NULL CHECK (gross_amount_cents > 0),
  rate_basis_points INTEGER NOT NULL DEFAULT 1000 CHECK (rate_basis_points BETWEEN 0 AND 10000),
  commission_amount_cents BIGINT NOT NULL CHECK (commission_amount_cents >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (payment_transaction_id)
);

CREATE TABLE loyalty_accounts (
  customer_user_id UUID PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  balance_points BIGINT NOT NULL DEFAULT 0 CHECK (balance_points >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE loyalty_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  order_id UUID REFERENCES service_orders(id) ON DELETE RESTRICT,
  points_delta BIGINT NOT NULL CHECK (points_delta <> 0),
  description TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_loyalty_ledger_customer ON loyalty_ledger(customer_user_id, created_at DESC);

CREATE TABLE privacy_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  granted BOOLEAN NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);
CREATE INDEX idx_privacy_consents_user ON privacy_consents(user_id, recorded_at DESC);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('in_app','email','sms','push','whatsapp')),
  template_key TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','processing','sent','failed','cancelled')),
  idempotency_key TEXT NOT NULL UNIQUE,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_queue ON notifications(status, scheduled_at);

ALTER TABLE audit_events
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ip_address INET,
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS request_id TEXT;

COMMIT;

-- Segurança obrigatória na aplicação:
-- 1) arquivos em bucket privado; download somente por URL assinada de curta duração.
-- 2) validar MIME, tamanho e conteúdo; antivírus antes de liberar documentos.
-- 3) nunca expor storage_key, CPF ou documentos em respostas públicas/logs.
-- 4) aplicar autorização por proprietário/escopo em cada consulta e mutação.
-- 5) pagamentos e pontos somente via transações; respeitar idempotency_key.
-- 6) a taxa padrão de 10% corresponde a 1000 pontos-base; versionar regras comerciais.
-- 7) executar em banco de desenvolvimento e validar com backup antes de qualquer produção.
