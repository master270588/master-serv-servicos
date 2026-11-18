# MASTER SERV SERVIÇOS — API

API central inicial da plataforma, construída com NestJS, Prisma e PostgreSQL.

## Requisitos
- Node.js 20 ou superior
- npm
- PostgreSQL compatível com o schema e as migrações SQL do projeto

## Instalação local
1. Copie `.env.example` para `.env`.
2. Configure `DATABASE_URL` e `JWT_ACCESS_SECRET` com valores locais seguros.
3. Na pasta `apps/api`, execute `npm install`.
4. Execute `npm run db:validate` e `npm run db:generate`.
5. Aplique as migrações SQL revisadas na ordem indicada em `database/README.md` a um banco de desenvolvimento vazio.
6. Execute `npm run start:dev`.
7. Verifique `http://localhost:3000/api/health`.

## Funcionalidades já presentes no código
- Health check.
- Cadastro/login, sessão com refresh token rotativo e logout.
- Guardas JWT e autorização por papéis.
- Aprovação/rejeição administrativa de prestadores.
- Consulta dos metadados dos próprios documentos pelo prestador.
- Consulta e revisão administrativa de documentos, com trilha de auditoria.

## Ainda não liberado
- Download de documentos e URLs assinadas (não implementados).
- Provisionamento/teste real do Cloudflare R2 e PostgreSQL (dependem de credenciais e ambiente).
- Execução agendada do worker ClamAV em rede privada (código presente; implantação pendente).
- Fluxo completo de consentimento e retenção LGPD.
- Conexão e validação ponta a ponta com banco gerenciado/produção.
- Site público, aplicativos cliente/prestador e painel web final.
- Integrações de pagamento e notificações em ambiente real.

## Upload em quarentena e antivírus
- `POST /api/providers/me/documents` recebe um arquivo `file` e `documentType` (`identity`, `address`, `professional_certificate` ou `other`).
- Limite de 10 MiB; MIME permitido PDF/JPEG/PNG e validação da assinatura binária no serviço de storage.
- O objeto é gravado no prefixo privado `quarantine/`; o banco registra `scanStatus=pending` e `reviewStatus=pending`.
- Se a gravação dos metadados falhar, a API tenta excluir o objeto recém-enviado para evitar órfãos.
- O worker `npm run documents:scan` usa ClamAV em rede privada. Configurar `CLAMAV_HOST`/`CLAMAV_PORT` e executar em agenda operacional. Resultado `clean`, `infected` ou `error`; falhas nunca são tratadas como limpas.
- Aprovação administrativa exige `scanStatus=clean`. Download não está implementado e arquivos não devem ser usados até integração e teste reais.

## Segurança
Nunca coloque senhas, tokens, chaves R2 ou dados pessoais reais no GitHub ou em mensagens. Use variáveis de ambiente e um gerenciador de segredos. Não use documentos reais até a conclusão dos controles e testes descritos em `documentation/SEGURANCA-DOCUMENTOS-DADOS.md`.

A aprovação do CI verifica o fluxo automatizado configurado no repositório; não significa que o banco, o storage ou a plataforma estejam implantados em produção.
