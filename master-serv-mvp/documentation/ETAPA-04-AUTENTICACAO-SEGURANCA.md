# ETAPA 04 — Autenticação e controle de acesso

## Objetivo
Preparar a autenticação da API central para clientes, prestadores e administradores, sem liberar endpoints de produção antes dos testes de segurança.

## Estado verificado no repositório
- API baseada em NestJS 10.
- Prisma ORM 6 configurado no package.json.
- PrismaService conecta/desconecta no ciclo de vida do NestJS.
- DATABASE_URL é lida do ambiente e existe um .env.example.
- O schema Prisma contém AppUser, Role, UserRole, ProviderProfile e ServiceCategory.
- Ainda não há módulo de autenticação, endpoints de cadastro/login, emissão/validação de tokens nem guards de autorização.
- Não foi possível confirmar conexão com PostgreSQL nem executar migrações a partir do ambiente desta revisão.

## Regras obrigatórias de segurança
1. Nunca armazenar senhas em texto puro. Usar Argon2id com parâmetros atualizados e comparar hashes no servidor.
2. Não permitir que o usuário escolha seu próprio papel administrativo. Papéis privilegiados só podem ser atribuídos por processo administrativo protegido.
3. Prestadores começam com status pendente e não recebem acesso operacional até aprovação administrativa.
4. Respostas de cadastro/login não devem revelar se um e-mail ou telefone já está cadastrado.
5. Aplicar validação estrita de DTO, limite de tentativas, mensagens de erro genéricas e logs sem senhas, tokens ou documentos.
6. Tokens de acesso devem ter curta duração. Se houver refresh token, armazenar somente hash, rotacionar a cada uso e permitir revogação.
7. Usar HTTPS em produção, CORS com origens explicitamente permitidas e segredos apenas em variáveis protegidas.
8. Registrar eventos relevantes de autenticação e alterações de permissões na trilha de auditoria.
9. Aplicar autorização no servidor em todas as rotas; esconder botões na interface não é controle de acesso.
10. Documentos de prestadores devem permanecer em armazenamento privado, com autorização por proprietário e URLs assinadas de curta duração.

## Sequência de implementação
1. Conferir o schema SQL completo e alinhar o schema Prisma às tabelas reais.
2. Definir e validar os códigos de papéis: CUSTOMER, PROVIDER e ADMIN.
3. Criar módulo de autenticação, DTOs e serviço de hash de senha.
4. Implementar cadastro de cliente e solicitação de cadastro de prestador.
5. Implementar login, access token, refresh token rotativo e logout/revogação.
6. Implementar guards e decorators de papéis/permissões.
7. Implementar aprovação/reprovação administrativa de prestadores com auditoria.
8. Criar testes unitários, integração com PostgreSQL e testes de autorização negativa.

## Critérios para considerar concluído
- Build e lint sem erros.
- Testes automatizados cobrindo cadastro, login, senha inválida, token expirado, refresh reutilizado, usuário pendente e acesso indevido.
- Migrações aplicadas em banco de teste descartável e verificadas.
- Segredos e dados pessoais ausentes dos logs.
- Revisão de segurança antes de disponibilizar a API publicamente.

## Situação
Esta etapa é um plano técnico e checklist de implementação. Autenticação ainda NÃO está implementada nem testada. Não usar em produção até cumprir os critérios acima.
