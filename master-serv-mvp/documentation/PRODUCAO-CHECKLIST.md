# Checklist de preparação para produção — MASTER SERV

Este roteiro separa o que está no repositório do que precisa ser provisionado no provedor de infraestrutura. Não há credenciais reais neste arquivo.

## 1. PostgreSQL
- [ ] Criar banco PostgreSQL gerenciado em região adequada, com TLS obrigatório.
- [ ] Criar usuário de aplicação com privilégios mínimos e usuário separado para migrações, se suportado.
- [ ] Configurar backup automático e testar restauração.
- [ ] Aplicar SQL em homologação na ordem `database/001` a `database/005`, conforme `database/README.md`.
- [ ] Comparar schema com Prisma e revisar qualquer diferença.
- [ ] Repetir em produção somente após aprovação, backup e janela de manutenção.
- [ ] Configurar `DATABASE_URL` em secret manager; nunca registrar no GitHub.

## 2. Cloudflare R2
- [ ] Criar bucket privado exclusivo da aplicação.
- [ ] Desabilitar acesso público e não configurar domínio público.
- [ ] Criar token/chave R2 com permissões mínimas apenas para o bucket necessário.
- [ ] Configurar `S3_ENDPOINT`, `S3_REGION=auto`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` e `S3_SECRET_ACCESS_KEY` no secret manager.
- [ ] Testar upload e exclusão em homologação com arquivo de teste, nunca com documento pessoal real.
- [ ] Monitorar objetos órfãos e erros de storage.

## 3. ClamAV
- [ ] Implantar `infra/clamav/docker-compose.yml` ou serviço equivalente em rede privada.
- [ ] Não publicar a porta TCP 3310 na internet.
- [ ] Configurar `CLAMAV_HOST` e `CLAMAV_PORT` no worker.
- [ ] Garantir atualização automática das assinaturas do ClamAV e monitorar a saúde do daemon.
- [ ] Agendar `npm run documents:scan` por um scheduler/worker manager em intervalos curtos.
- [ ] Testar caminhos `clean`, `infected` (EICAR apenas em homologação isolada) e indisponibilidade do scanner.
- [ ] Confirmar que falhas terminam em `error` e nunca em `clean`.

## 4. API e segredos
- [ ] Implantar API em serviço gerenciado com HTTPS, logs protegidos e health checks.
- [ ] Configurar `JWT_ACCESS_SECRET` aleatório com pelo menos 32 caracteres, CORS restrito aos domínios oficiais e `PORT`.
- [ ] Criar superadministrador com `SUPER_ADMIN_EMAIL` e `SUPER_ADMIN_PASSWORD` via secret manager e executar `npm run admin:create` uma única vez.
- [ ] Não compartilhar senhas, tokens ou chaves por chat, e-mail ou repositório.
- [ ] Configurar alertas de falha de autenticação, upload, banco, storage e scanner.

## 5. Portas de liberação
- [ ] Testes de integração com PostgreSQL real em homologação.
- [ ] Testes de integração com R2 privado em homologação.
- [ ] Testes de upload inválido, excesso de tamanho, assinatura incompatível e falha de persistência.
- [ ] Testes de acesso cruzado entre prestadores e autorização administrativa.
- [ ] Testes do worker ClamAV com conteúdo limpo, infectado de teste e scanner indisponível.
- [ ] Política de privacidade, retenção, descarte e atendimento LGPD revisada.
- [ ] Revisão de segurança independente antes de documentos reais.
- [ ] Implementar e testar download autorizado e URLs assinadas curtas antes de disponibilizar documentos para consulta.

## Estado atual
O código da API, upload em quarentena, worker ClamAV, testes unitários e CI estão no repositório. Banco, R2, ClamAV de produção, scheduler, domínio/API implantados e download seguro ainda dependem de provisionamento e validação operacional. A aprovação do CI não representa deploy nem aprovação para receber documentos reais.
