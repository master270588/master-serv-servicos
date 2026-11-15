# MASTER SERV SERVIÇOS — API inicial

Esta é a primeira base executável da API, construída com NestJS.

## Requisitos
- Node.js 20 ou superior
- npm

## Instalação local
1. Copie `.env.example` para `.env`.
2. No terminal, dentro desta pasta, execute `npm install`.
3. Execute `npm run start:dev`.
4. Abra `http://localhost:3000/api/health`.

A resposta esperada é um JSON com `status: "ok"`.

## Rotas desta etapa
- `GET /api/health` — verifica se a API está ativa.

## Situação e próximos passos
Esta etapa ainda não conecta ao PostgreSQL e não contém login, cadastro, documentos, pagamentos ou chamados. Essas partes serão adicionadas e testadas em etapas próprias, com controles de segurança e permissões.
