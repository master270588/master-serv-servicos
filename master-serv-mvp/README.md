# MASTER SERV SERVIÇOS — base técnica do MVP

Este repositório contém a API inicial e a infraestrutura de desenvolvimento da plataforma. **Ainda não é uma plataforma pronta para clientes nem está implantada em produção.**

## Arquitetura definida

- API central: NestJS 11 + Prisma 6.
- Banco relacional: PostgreSQL 16.
- Documentos de prestadores: bucket privado Cloudflare R2 (a configurar).
- Verificação antimalware: ClamAV em rede privada.
- Ambientes planejados: site público, aplicativo do cliente, aplicativo do prestador e painel administrativo.
- Região inicial de operação: Grande Vitória/ES.

## Pré-requisitos

- Node.js 20 ou superior e npm.
- Docker Desktop com Docker Compose.
- Git.

## Preparar ambiente local

Na raiz de `master-serv-mvp`:

1. Copie `.env.example` para `.env` e defina uma senha local forte para o PostgreSQL.
2. Copie `apps/api/.env.example` para `apps/api/.env`.
3. No arquivo `apps/api/.env`, use uma URL local do PostgreSQL, um segredo JWT aleatório com pelo menos 32 caracteres e `CLAMAV_HOST=127.0.0.1` / `CLAMAV_PORT=3310` quando executar a API diretamente no computador.
4. Inicie os serviços locais:

```bash
docker compose up -d postgres clamav
docker compose ps
```

O PostgreSQL e o ClamAV são publicados somente em `127.0.0.1` neste Compose de desenvolvimento. O ClamAV pode levar alguns minutos na primeira inicialização para baixar as definições de vírus.

Para instalar e validar a API:

```bash
cd apps/api
npm ci
npx prisma validate
npx prisma generate
npm test -- --runInBand
npm run build
```

## Banco de dados

O modelo Prisma está em `apps/api/prisma/schema.prisma`. A sequência SQL versionada está em `database/` e deve ser aplicada uma única vez, nesta ordem:

1. `001_initial_schema.sql`
2. `002_operations_finance_privacy.sql`
3. `003_auth_sessions.sql`
4. `004_audit_indexes.sql`
5. `005_provider_document_scan_status.sql`

Leia `database/README.md` antes de aplicar. Faça isso primeiro em banco descartável/de desenvolvimento, compare o esquema SQL com Prisma e valide as relações. Não execute em produção sem backup testado, revisão e plano de rollback. Não misture essa sequência SQL com uma segunda sequência Prisma Migrate sem planejar a transição.

## Configuração de armazenamento e análise de documentos

- Crie no Cloudflare R2 um bucket privado, sem acesso público, e credenciais com permissões mínimas.
- Configure `S3_ENDPOINT`, `S3_REGION=auto`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` e `S3_SECRET_ACCESS_KEY` somente no ambiente de execução; nunca no Git.
- O prefixo de quarentena utilizado pela API é `quarantine/providers/`.
- Em execução local, o scanner pode acessar ClamAV em `127.0.0.1:3310`. Em produção, API e ClamAV devem compartilhar uma rede privada; não publique a porta 3310 na internet.
- O worker `npm run documents:scan` ainda precisa ser agendado e monitorado no ambiente implantado. Falhas de análise devem permanecer bloqueadas para download/aprovação.

## Segurança e produção

- Nunca envie arquivos `.env`, senhas, tokens, chaves R2 ou documentos pessoais ao Git.
- Use dados fictícios em desenvolvimento.
- Configure backup automático do PostgreSQL e teste restauração.
- Configure logs, alertas, retenção, política de privacidade/LGPD e controles de acesso antes de operar.
- Execute o script de criação do superadministrador apenas depois que o banco estiver preparado e as credenciais forem definidas com segurança no ambiente.
- Pagamentos reais, notificações, domínio, TLS, publicação dos aplicativos e deploy ainda exigem integração e validação.

## Situação atual

A validação contínua no GitHub Actions verifica instalação bloqueada (`npm ci`), auditoria de dependências, schema Prisma, testes, tipagem do worker e build da API. Os serviços externos ainda não foram conectados e não há ambiente de produção ativo confirmado.
