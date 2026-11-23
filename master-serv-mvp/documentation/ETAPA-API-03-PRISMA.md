# ETAPA API 03 — Prisma e PostgreSQL

## Implementado
- Prisma ORM 6 configurado na API NestJS.
- PrismaService conecta/desconecta no ciclo de vida do NestJS.
- Schema Prisma mapeia as tabelas SQL de usuários, papéis, prestadores, chamados, documentos, financeiro, fidelidade, consentimentos, notificações e sessões.
- CI aplica as migrações SQL 001–006 em PostgreSQL descartável e compara o schema resultante ao Prisma.
- A migração 006 adiciona áreas de atendimento, vínculo do endereço ao chamado e restrições de unicidade/atribuição.

## Validação
O workflow do GitHub Actions no commit mais recente é a referência de build/teste. A conexão com PostgreSQL gerenciado, credenciais de produção, backups, restauração e deploy continuam dependendo de provisionamento real.

## Operação segura
- SQL versionado é a fonte de migração atual. Não executar Prisma Migrate em paralelo sem baseline e plano.
- Aplicar primeiro em banco descartável/homologação.
- Nunca armazenar `.env`, senhas ou tokens no repositório.
- Antes de produção, usar usuário de banco com privilégio mínimo, TLS, backup restaurável e plano de rollback.
