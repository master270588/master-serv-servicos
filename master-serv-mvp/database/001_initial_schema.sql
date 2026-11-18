-- MASTER SERV SERVIÇOS
-- Esboço inicial de banco. Revisar antes de executar em qualquer ambiente real.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','blocked','deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE TABLE roles (
  id SMALLSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE
);

INSERT INTO roles (code) VALUES
  ('customer'), ('provider'), ('support'), ('finance'), ('admin'), ('super_admin')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role_id SMALLINT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE provider_profiles (
  user_id UUID PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  approval_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending','under_review','approved','correction_needed','rejected','blocked')),
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE provider_services (
  provider_user_id UUID NOT NULL REFERENCES provider_profiles(user_id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES service_categories(id) ON DELETE RESTRICT,
  PRIMARY KEY (provider_user_id, category_id)
);

CREATE TABLE service_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  category_id UUID NOT NULL REFERENCES service_categories(id) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  city TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','dispatching','quoted','awaiting_customer_approval',
      'approved','in_progress','completed','cancelled','disputed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE RESTRICT,
  provider_user_id UUID NOT NULL REFERENCES provider_profiles(user_id) ON DELETE RESTRICT,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted','approved','rejected','expired','withdrawn')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  customer_decided_at TIMESTAMPTZ
);

CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES app_users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_customer_created
  ON service_orders(customer_user_id, created_at DESC);
CREATE INDEX idx_orders_status_created
  ON service_orders(status, created_at);
CREATE INDEX idx_quotes_order_status
  ON quotes(order_id, status);

-- Ainda faltam: endereços, documentos privados, dispatch batches,
-- assignments, pagamentos, ledger contábil, comissões, pontos,
-- chat, notificações, consentimentos LGPD e políticas de retenção.
