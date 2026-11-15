# MASTER SERV SERVIÇOS — MVP (base inicial)

Este pacote é um **esqueleto inicial de desenvolvimento**, não uma plataforma pronta.
Stack proposta: NestJS + PostgreSQL. O site, os aplicativos e o painel serão conectados à API em etapas posteriores.

## Pré-requisitos
- Node.js 20+
- npm
- Docker Desktop com Docker Compose

## Estrutura
- `apps/api`: API NestJS inicial
- `database`: estrutura SQL inicial
- `docker-compose.yml`: PostgreSQL local
- `.env.example`: variáveis de ambiente de exemplo

## Próximos passos
1. Criar um repositório Git e enviar estes arquivos.
2. Instalar NestJS CLI e gerar o projeto em `apps/api`.
3. Configurar Prisma ou TypeORM e criar migrações revisadas.
4. Implementar autenticação, autorização e testes antes de expor a API.
5. Integrar os quatro ambientes: site, app do cliente, app do prestador e painel administrativo.

## Avisos importantes
- Não use dados reais de clientes ou documentos pessoais neste ambiente inicial.
- Não coloque senhas, tokens ou chaves no Git.
- O SQL é uma primeira modelagem para revisão; ainda não foi executado nem validado em PostgreSQL.
- Pagamentos, comissões, LGPD, auditoria e permissões exigem implementação e testes antes de produção.
