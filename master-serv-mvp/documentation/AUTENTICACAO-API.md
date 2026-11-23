# Autenticação da API — MASTER SERV SERVIÇOS

Todas as rotas usam o prefixo global `/api`.

## Rotas implementadas

| Método | Rota | Acesso |
|---|---|---|
| POST | `/auth/register` | Público, limitado |
| POST | `/auth/login` | Público, limitado |
| POST | `/auth/refresh` | Refresh token, limitado |
| POST | `/auth/logout` | Refresh token |
| GET | `/auth/me` | JWT Bearer |
| GET | `/admin/providers/pending` | admin/super_admin |
| PATCH | `/admin/providers/:id/approve` | admin/super_admin |
| PATCH | `/admin/providers/:id/reject` | admin/super_admin |

## Regras atuais
- Senhas com Argon2id; nunca armazenar texto puro.
- Access token JWT de 15 minutos; refresh token aleatório de 30 dias, com somente SHA-256 persistido e rotação por uso.
- Cadastro público só permite `customer` e `provider`; não permite atribuir papéis administrativos.
- Cadastro de prestador exige nome e ao menos uma categoria ativa em `serviceCategoryIds`; perfil e conta começam pendentes, sem token até aprovação.
- Cliente é criado ativo e recebe sessão após cadastro.
- Guard JWT verifica estado atual da conta; guard de papéis consulta papéis atuais no banco.
- Limites de requisição são aplicados pelo Throttler; em múltiplas instâncias, substituir/estender por storage compartilhado.
- Aprovação/rejeição administrativa atualiza perfil/conta e registra auditoria na mesma transação.

## Matriz de papéis

| Papel | Acesso previsto |
|---|---|
| customer | Endereços e chamados próprios; decisões de orçamento próprios |
| provider | Distribuições recebidas, atribuições próprias, orçamento e documentos próprios |
| support | Futuras rotas de atendimento com escopo mínimo; ainda sem endpoints próprios |
| finance | Futuras rotas financeiras segregadas; ainda sem endpoints próprios |
| admin | Aprovação de prestadores/documentos e distribuição de chamados |
| super_admin | Administração ampliada e inicialização do primeiro administrador |

Não criar autorização apenas escondendo botões na interface. Toda rota privada exige verificação no servidor.

## Configuração
Definir em ambiente seguro: `DATABASE_URL`, `JWT_ACCESS_SECRET` com pelo menos 32 caracteres aleatórios e `CORS_ORIGINS` com origens exatas. Nunca versionar `.env`.

## Banco
Aplicar migrações SQL 001–006 em ambiente descartável/homologação, conforme `database/README.md`. Não misturar SQL versionado e Prisma Migrate sem plano formal de baseline.

## Primeiro superadministrador
O primeiro acesso administrativo é criado pelo script de uso único `npm run admin:create`, com `SUPER_ADMIN_EMAIL` e `SUPER_ADMIN_PASSWORD` injetados pelo secret manager. Não colocar senha em GitHub, chat ou arquivos versionados.

## Pendências antes de produção
- Verificação de e-mail/telefone, recuperação de senha e política de sessão web com cookie HttpOnly/Secure.
- Rate limit distribuído, monitoramento de fraude e revisão de segurança.
- Política LGPD completa, retenção e consentimentos.
- Testes ponta a ponta em homologação com PostgreSQL, storage e clientes separados.
