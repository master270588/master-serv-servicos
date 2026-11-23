# MASTER SERV SERVIÇOS — API

API central da plataforma, construída com NestJS 11, Prisma 6 e PostgreSQL 16.

## Requisitos e instalação local
- Node.js 20+ (CI executa em Node 22), npm e Docker Compose.
- Copie os arquivos `.env.example` para arquivos locais `.env` e preencha segredos apenas localmente.
- Inicie PostgreSQL e ClamAV conforme o README da raiz.
- Aplique as migrações SQL versionadas 001–006 em banco de desenvolvimento vazio, seguindo `database/README.md`.
- Em `apps/api`: `npm ci`, `npx prisma validate`, `npx prisma generate`, `npm test -- --runInBand`, `npm run build`.
- Inicie com `npm run start:dev`; health check: `GET /api/health`.

## Funcionalidades no código
- Autenticação com Argon2id, JWT de curta duração, refresh token rotativo armazenado em hash e logout.
- Papéis de cliente, prestador, suporte, financeiro, administrador e superadministrador; guards de JWT e papéis.
- Cadastro de prestador com seleção de categorias e aprovação administrativa obrigatória.
- Catálogo público de categorias e áreas de atendimento.
- Cadastro/listagem de endereços próprios do cliente.
- Abertura e acompanhamento de chamados por cliente.
- Distribuição individual e simultânea pelo painel administrativo.
- Aceite/recusa de chamados pelo prestador, envio de orçamento e transição de execução somente após aprovação do cliente.
- Trilha de auditoria para criação de endereço/chamado, distribuição, resposta, orçamento e execução.
- Upload de documentos de prestador em quarentena, worker ClamAV e revisão administrativa; o acesso depende de scanner limpo e revisão aprovada.

## Rotas de integração
O contrato detalhado para site, aplicativo do cliente, aplicativo do prestador e painel administrativo está em `documentation/CONTRATO-API-V1.md`.

Principais grupos:
- Público: `/api/public/service-categories`, `/api/public/service-areas`, `/api/auth/*`.
- Cliente: `/api/customer/addresses`, `/api/customer/orders`.
- Prestador: `/api/providers/me/dispatches`, `/api/providers/me/orders`, `/api/providers/me/documents`.
- Administração: `/api/admin/providers/*`, `/api/admin/orders`, `/api/admin/provider-documents/*`.

## Cobertura e regras de negócio
A migração 006 registra Vitória, Vila Velha, Serra, Cariacica, Viana, Guarapari e Fundão como áreas iniciais. O endpoint público é a fonte de verdade da cobertura ativa; expansão para todo o Espírito Santo exige ativação de novas áreas.

A API bloqueia início de serviço sem orçamento aprovado pelo cliente. Distribuição individual é uma rodada com um prestador; simultânea, de 2 a 20. Comissão padrão de 10%, fidelidade (1 ponto por R$ 1 elegível; 1.000 pontos = R$ 10) e garantia comercial proposta de 90 dias permanecem regras registradas, mas cálculo financeiro, resgates, reembolsos e regulamento operacional ainda não estão completos.

## Ainda não liberado para produção
- Site, aplicativo do cliente, aplicativo do prestador e painel visual completos; o repositório contém o contrato da API, não os quatro frontends prontos.
- PostgreSQL gerenciado, Cloudflare R2 privado, ClamAV e scheduler implantados/testados em ambiente real.
- Gateway, split, conciliação e pagamento misto real.
- Notificações externas, recuperação/verificação de conta, consentimentos e ciclo completo LGPD.
- Cancelamento, disputa, confirmação do cliente, reembolso e garantia como fluxos de ponta a ponta.
- Sessão web com cookie HttpOnly/Secure e revisão de segurança independente.

A execução bem-sucedida do CI comprova somente as verificações automatizadas do commit; não comprova deploy, integração com serviços externos ou liberação para dados pessoais reais.
