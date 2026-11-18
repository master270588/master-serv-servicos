-- MASTER SERV SERVIÇOS — Migração 005
-- Separa o estado de verificação antivírus da decisão administrativa.
-- Executar somente após backup, em ambiente de desenvolvimento primeiro.
BEGIN;
ALTER TABLE provider_documents
  ADD COLUMN IF NOT EXISTS scan_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (scan_status IN ('pending','clean','infected','error'));
CREATE INDEX IF NOT EXISTS idx_provider_documents_scan_status
  ON provider_documents(scan_status, created_at);
COMMIT;
