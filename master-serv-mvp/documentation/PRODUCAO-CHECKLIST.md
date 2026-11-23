# Checklist de preparação para produção — MASTER SERV

Este roteiro separa o que está no repositório do que precisa ser provisionado no provedor de infraestrutura. Não há credenciais reais neste arquivo.

## 1. PostgreSQL
- [ ] Criar banco gerenciado em região adequada, com TLS obrigatório.
- [ ] Criar usuário de aplicação com privilégios mínimos e usuário separado para migrações.
- [ ] Configurar backup automático e testar restauração.
- [ ] Aplicar SQL em homologação na ordem `database/001` a `database/006`.
- [ ] Comparar esquema SQL com Prisma e revisar qualquer diferença.
- [ ] Repetir em produção somente após aprovação, backup e janela de manutenção.
- [ ] Configurar `DATABASE_URL` em secret manager.

## 2. API e interfaces
- [ ] Implantar API com HTTPS, health checks, logs protegidos e alertas.
- [ ] Configurar `JWT_ACCESS_SECRET` forte e CORS somente para origens oficiais.
- [ ] Implementar sessão web com cookie HttpOnly/Secure antes do site e painel em produção.
- [ ] Construir e testar separadamente site público, app cliente, app prestador e painel administrativo usando `documentation/CONTRATO-API-V1.md`.
- [ ] Testar autorização negativa entre clientes, prestadores, suporte, financeiro e administração.
- [ ] Criar superadministrador uma única vez via secret manager.

## 3. Documentos e dados pessoais
- [ ] Criar bucket privado R2 sem acesso público e credenciais de privilégio mínimo.
- [ ] Implantar ClamAV em rede privada e agendar `npm run documents:scan`.
- [ ] Testar upload com arquivos fictícios, scanner indisponível e arquivo EICAR somente em homologação isolada.
- [ ] Testar autorização por proprietário, revisão e download após scan limpo.
- [ ] Definir política LGPD, bases legais, retenção, descarte e atendimento aos titulares.
- [ ] Executar revisão de segurança independente antes de receber documentos reais.

## 4. Fluxo operacional e financeiro
- [ ] Testar cobertura ativa da Grande Vitória e procedimento de expansão por município.
- [ ] Testar distribuição individual e simultânea, expiração, aceite/recusa e concorrência.
- [ ] Testar orçamento rejeitado/aprovado e bloqueio de início sem aprovação.
- [ ] Definir cancelamento, disputa, conclusão confirmada pelo cliente e garantia.
- [ ] Integrar gateway, pagamentos mistos, split, conciliação, reembolsos e ledger.
- [ ] Implementar cálculo/estorno de comissão de 10% e pontos com idempotência e limites de resgate.

## 5. Operação contínua
- [ ] Backups com restauração ensaiada, métricas, alertas, gestão de incidentes e logs com retenção.
- [ ] Testes de carga, rate limit compartilhado entre instâncias e rotação de segredos.
- [ ] Plano de rollback para API e migrações.
- [ ] Teste de ponta a ponta em homologação com contas fictícias.

## Estado atual
O repositório contém API, migrações SQL 001–006, autenticação, fluxo inicial de chamados/orçamentos/distribuição, upload em quarentena e scanner. O CI valida schema, aplica migrações em PostgreSQL descartável, compara Prisma, executa testes e compila imagem Docker. Não há ambiente de produção ou quatro interfaces visuais completas confirmadas. Serviços externos, pagamentos reais e testes ponta a ponta ainda dependem de provisionamento e validação operacional.
