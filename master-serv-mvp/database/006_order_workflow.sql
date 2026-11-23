-- MASTER SERV SERVIÇOS — Migração 006
-- Endereços vinculados aos chamados, cobertura inicial e integridade do fluxo de orçamentos.
-- Aplicar após 001–005, primeiro em banco descartável/de desenvolvimento.
BEGIN;

CREATE TABLE service_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,
  state_code CHAR(2) NOT NULL DEFAULT 'ES',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  rollout_phase TEXT NOT NULL DEFAULT 'initial'
    CHECK (rollout_phase IN ('initial','expansion','paused')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_service_areas_city_state UNIQUE (city, state_code)
);

INSERT INTO service_areas (city, state_code, rollout_phase) VALUES
  ('Vitória','ES','initial'),
  ('Vila Velha','ES','initial'),
  ('Serra','ES','initial'),
  ('Cariacica','ES','initial'),
  ('Viana','ES','initial'),
  ('Guarapari','ES','initial'),
  ('Fundão','ES','initial')
ON CONFLICT (city, state_code) DO NOTHING;

ALTER TABLE service_orders
  ADD COLUMN customer_address_id UUID,
  ADD COLUMN state_code CHAR(2) NOT NULL DEFAULT 'ES';

ALTER TABLE service_orders
  ADD CONSTRAINT fk_service_orders_customer_address
  FOREIGN KEY (customer_address_id) REFERENCES customer_addresses(id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX idx_service_orders_customer_address
  ON service_orders(customer_address_id);

-- Um prestador envia no máximo um orçamento por chamado; evita duplicidade por repetição de requisição.
CREATE UNIQUE INDEX uq_quotes_order_provider
  ON quotes(order_id, provider_user_id);

-- Impede duas atribuições ativas simultâneas do mesmo prestador para o mesmo chamado.
CREATE UNIQUE INDEX uq_order_assignments_active_provider
  ON order_assignments(order_id, provider_user_id)
  WHERE status IN ('assigned','accepted');

INSERT INTO service_categories (name) VALUES
  ('Hidráulica'),
  ('Elétrica'),
  ('Marido de aluguel'),
  ('Instalação de torneiras'),
  ('Instalação de ventilador de teto'),
  ('Instalação de fechadura eletrônica'),
  ('Instalação de aquecedor'),
  ('Pequenos reparos')
ON CONFLICT (name) DO NOTHING;

COMMIT;
