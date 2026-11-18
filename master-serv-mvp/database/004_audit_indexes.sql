-- MASTER SERV SERVIÇOS — Migração 004
-- Alinha os índices de auditoria declarados no Prisma ao banco PostgreSQL.
-- Executar somente após 001, 002 e 003 em ambiente de desenvolvimento.
BEGIN;

CREATE INDEX IF NOT EXISTS idx_audit_events_actor_created
  ON audit_events(actor_user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_audit_events_entity_created
  ON audit_events(entity_type, entity_id, created_at);

COMMIT;
