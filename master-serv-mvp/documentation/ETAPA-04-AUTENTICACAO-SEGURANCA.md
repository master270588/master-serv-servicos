# ETAPA 04 — Autenticação e controle de acesso

## Implementado no repositório
- Cadastro público de cliente e solicitação de cadastro de prestador.
- Hash de senha Argon2id; JWT de 15 minutos; refresh token de 30 dias com hash persistido e rotação; logout/revogação.
- Guards JWT e de papéis; consulta dos papéis atuais no banco.
- Cadastro de prestador com nome e seleção de categorias; conta permanece pendente até decisão administrativa.
- Aprovação/rejeição de prestador por admin/super_admin, com atualização de conta e trilha de auditoria na mesma transação.
- Rate limit por endpoint via Nest Throttler.

## Papéis
`customer`, `provider`, `support`, `finance`, `admin`, `super_admin`.
Os papéis support e finance estão cadastrados, mas ainda não têm rotas específicas. Atribuição do primeiro superadministrador ocorre por script controlado, nunca pelo cadastro público.

## Limitações e controles pendentes
- Verificação de e-mail/telefone e recuperação de senha.
- Sessão web por cookie HttpOnly/Secure; o refresh atual usa corpo JSON e requer adaptação para site/painel.
- Rate limit compartilhado entre instâncias.
- Revisão de segurança e testes ponta a ponta com banco de homologação.
- Política LGPD, consentimentos e retenção.
- Provisionamento de segredos e HTTPS no ambiente de hospedagem.

## Verificação automatizada
O workflow `.github/workflows/api-check.yml` valida schema, aplica SQL 001–006 em PostgreSQL descartável, compara o banco ao Prisma, executa testes e compila a API/imagem Docker. A aprovação do CI não equivale a implantação ou liberação de dados reais.

Consulte `documentation/AUTENTICACAO-API.md` e `documentation/CONTRATO-API-V1.md` para rotas e regras de integração.
