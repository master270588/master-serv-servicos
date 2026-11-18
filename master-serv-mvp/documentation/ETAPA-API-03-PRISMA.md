# Etapa API 03 — Prisma e conexão PostgreSQL

- Adicionado Prisma ORM 6, scripts de geração/validação e modelos iniciais para app_users, roles, user_roles, provider_profiles e service_categories.
- PrismaService conecta e desconecta no ciclo de vida do NestJS; PrismaModule é global.
- Configure DATABASE_URL com as migrações SQL 001 e 002 já aplicadas.
- Na pasta apps/api: npm install; npm run db:validate; npm run build.
- Esta alteração não executa migrações, não configura hospedagem e não comprova conexão real.
- O schema mapeia inicialmente somente tabelas da migração 001.
- A API exigirá DATABASE_URL válido na inicialização. Não usar em produção antes de autenticação, guards de autorização, testes e revisão de segurança.
- Nunca versionar .env, senhas, tokens ou dados reais.
