-- MASTER SERV SERVIÇOS — Migração 003
-- Sessões de autenticação com refresh token armazenado somente como hash.
-- Executar primeiro em banco de desenvolvimento após as migrações 001 e 002.
BEGIN;

CREATE TABLE auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auth_sessions_user_revoked
  ON auth_sessions(user_id, revoked_at);
CREATE INDEX idx_auth_sessions_expires
  ON auth_sessions(expires_at);

COMMIT;

-- Regras para a camada de aplicação:
-- * Nunca persistir refresh token em texto puro.
-- * Rotacionar refresh token a cada renovação e revogar o anterior.
-- * Invalidar sessões no logout e quando a conta for bloqueada.
-- * Validar expiração e revogação em cada renovação.
-- * Não expor hashes nem identificadores de sessão em respostas públicas.
