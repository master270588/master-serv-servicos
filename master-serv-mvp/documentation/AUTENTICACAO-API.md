# Autenticação da API — MASTER SERV SERVIÇOS

## Rotas implementadas

Todas as rotas usam o prefixo global `/api`.

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/auth/register` | Público, limitado | Cadastro de cliente ou prestador |
| POST | `/auth/login` | Público, limitado | Login por e-mail ou telefone |
| POST | `/auth/refresh` | Refresh token, limitado | Rotaciona a sessão |
| POST | `/auth/logout` | Refresh token, limitado | Revoga a sessão |
| GET | `/auth/me` | JWT Bearer | Retorna o perfil autenticado |

| GET | `/admin/providers/pending` | Admin/super_admin | Lista prestadores aguardando análise |
| PATCH | `/admin/providers/:id/approve` | Admin/super_admin | Aprova e ativa o cadastro |
| PATCH | `/admin/providers/:id/reject` | Admin/super_admin | Rejeita e bloqueia o cadastro |

## Regras atuais

- Senhas são derivadas com Argon2id; nunca devem ser armazenadas em texto puro.
- Access token JWT tem validade de 15 minutos.
- Refresh token aleatório tem validade de 30 dias; somente seu SHA-256 é persistido.
- Renovação revoga o token anterior antes de emitir uma nova sessão.
- Cadastro público só aceita os papéis `customer` e `provider`; nunca aceita papel administrativo.
- Prestadores são criados como `pending` e não recebem tokens até aprovação/ativação administrativa.
- Contas bloqueadas ou não ativas não podem autenticar; o guard consulta o status atual da conta.
- Limitação global configurada em 60 requisições/minuto; cadastro e login em 5/minuto; refresh em 10/minuto.
- Guards JWT e de papéis estão disponíveis para proteger controladores.
- A administração de prestadores exige `admin` ou `super_admin`; aprovação/rejeição atualiza o perfil e a conta na mesma transação e grava evento de auditoria.

## Configuração

Defina em ambiente seguro:
- `DATABASE_URL`
- `JWT_ACCESS_SECRET` com pelo menos 32 caracteres aleatórios
- `CORS_ORIGINS` com a lista exata dos domínios autorizados

Nunca publique o arquivo `.env`, segredos, tokens ou dados reais.

## Banco de dados

Antes de usar autenticação, aplique em ambiente de desenvolvimento, nesta ordem:
1. `database/001_initial_schema.sql`
2. `database/002_operations_finance_privacy.sql`
3. `database/003_auth_sessions.sql`

Não execute migrações em produção sem backup, revisão e plano de rollback.

## Verificação

O workflow GitHub Actions em `.github/workflows/api-check.yml` executa validação do schema Prisma e build da API a cada alteração relevante. A execução precisa terminar com sucesso antes de considerar a compilação validada.

## Pendências antes de produção

- Testes automatizados de cadastro, login, rotação, logout, bloqueio e autorização.
- Integração e teste com PostgreSQL real de desenvolvimento.
- Fluxo administrativo auditado para aprovar prestadores e atribuir permissões.
- Proteção adicional contra abuso distribuído (rate limit compartilhado entre instâncias), monitoramento e alertas.
- Política de recuperação de senha e verificação de e-mail/telefone.
- Revisão de segurança independente e configuração de HTTPS/segredos no provedor de hospedagem.
