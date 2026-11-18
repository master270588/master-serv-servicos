# Banco de dados — MASTER SERV SERVIÇOS

## Fonte do modelo

O modelo de dados da API está em `apps/api/prisma/schema.prisma`. Ele representa as tabelas operacionais criadas pelas migrações SQL deste diretório, incluindo usuários, prestadores, chamados, orçamentos, distribuição, pagamentos, financeiro, comissões, fidelidade, consentimentos LGPD, notificações e sessões.

As migrações SQL são a sequência de criação/evolução do banco. O Prisma Client é gerado a partir do schema; não execute `prisma migrate dev` para criar uma segunda sequência concorrente sem uma decisão explícita de migração.

## Ordem das migrações

1. `001_initial_schema.sql`
2. `002_operations_finance_privacy.sql`
3. `003_auth_sessions.sql`
4. `004_audit_indexes.sql`
5. `005_provider_document_scan_status.sql`

Execute e valide primeiro em um banco PostgreSQL descartável/de desenvolvimento. As migrações devem ser aplicadas uma única vez e na ordem indicada. As migrações 004 e 005 usam `IF NOT EXISTS` para permitir repetição segura dos índices/coluna. A 005 separa o status da análise administrativa (`review_status`) do estado da verificação antivírus (`scan_status`).

## Validação do modelo

A partir de `apps/api`, configure `DATABASE_URL` apontando para o PostgreSQL de desenvolvimento e execute:

```bash
npx prisma validate
npx prisma generate
```

Para comparar o modelo Prisma com um banco já migrado, use uma conexão de desenvolvimento e revise o resultado de:

```bash
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma
```

A saída deve ser revisada: diferenças podem indicar drift entre SQL e Prisma. Não aplique automaticamente alterações sugeridas em produção.

## Segurança e produção

- Não coloque credenciais, tokens ou arquivos de documentos no Git.
- Faça backup testado antes de qualquer alteração em ambiente real.
- Não execute estas migrações em produção sem revisão, janela de manutenção e plano de rollback.
- Documentos de prestadores devem ficar em armazenamento privado; o banco guarda apenas metadados e a chave interna do objeto.
- Pagamentos, comissões e pontos exigem transações e chaves de idempotência.
