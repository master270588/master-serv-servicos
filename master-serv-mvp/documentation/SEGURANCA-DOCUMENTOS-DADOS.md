# Segurança de documentos e dados pessoais — MASTER SERV

## Objetivo
Definir os controles mínimos antes de receber documentos de identidade, comprovantes e outros dados pessoais de clientes e prestadores. Este documento registra o estado observado no código e os critérios para liberar a funcionalidade; não substitui avaliação jurídica ou teste de segurança independente.

## Estado verificado no repositório

### Já existe no modelo de dados
- A tabela/modelo `ProviderDocument` registra proprietário (`providerUserId`), tipo, chave de armazenamento, nome original, MIME, tamanho, situação da análise, validade e responsável pela revisão.
- A migração SQL exige tamanho maior que zero e limita os estados de revisão.
- A tabela `PrivacyConsent` registra finalidade, versão da política, concessão e revogação.
- Há trilha de auditoria `AuditEvent`.

### Já implementado na API
- Autenticação obrigatória para as rotas do módulo de documentos.
- Prestador autenticado pode consultar somente os próprios metadados documentais: `GET /api/providers/me/documents`.
- Administradores e superadministradores podem consultar documentos de um prestador: `GET /api/admin/providers/:providerId/documents`.
- Administradores e superadministradores podem revisar documento pendente: `PATCH /api/admin/provider-documents/:documentId/review`.
- Revisão aceita `approved` ou `rejected`; rejeição exige justificativa.
- A atualização condicional impede duas revisões concorrentes do mesmo documento e grava evento de auditoria na mesma transação.
- As respostas das listagens não expõem `storageKey`.

### Ainda não está implementado/verificado
- O código de upload em quarentena para Cloudflare R2 foi implementado, com limite de 10 MiB, allowlist de PDF/JPEG/PNG e validação de assinatura binária. O uso real depende de bucket e credenciais configurados.
- A rotina de compensação tenta remover o objeto da quarentena se a gravação dos metadados no PostgreSQL falhar.
- Um worker de varredura ClamAV foi adicionado. Ele deve ser executado em rede privada, com acesso ao bucket e ao PostgreSQL; ainda requer implantação e teste de integração real.
- Download e URLs assinadas não estão liberados.
- O modelo de consentimento existe, mas não foi localizado fluxo de API para registrar/consultar/revogar consentimentos.
- Não há banco PostgreSQL conectado nem teste ponta a ponta com armazenamento real.

**Conclusão:** o fluxo de upload em quarentena e o worker ClamAV existem no código, mas dependem de provisionamento e testes ponta a ponta. Não solicitar documentos reais nem habilitar uso em produção antes de validar storage, PostgreSQL, scanner, autorização e recuperação de falhas.

## Decisão de armazenamento
A opção técnica selecionada para a próxima implementação é **Cloudflare R2 usando a API compatível com S3**.

Configuração prevista:
- Bucket privado, sem domínio público ou acesso anônimo.
- Endpoint da conta R2, região `auto` e credenciais de API com permissões mínimas restritas ao bucket da aplicação.
- Objetos inicialmente enviados para uma área/prefixo de quarentena; só depois de varredura antimalware bem-sucedida poderão ser disponibilizados para download.
- Chaves de objeto aleatórias geradas no servidor. O nome original será mantido somente como metadado sanitizado.
- Segredos fornecidos por variáveis de ambiente ou gerenciador de segredos do ambiente de execução; nunca armazenados no GitHub, código-fonte, mensagens ou logs.
- Limite inicial planejado de 10 MiB por arquivo, sujeito a revisão dos tipos documentais aceitos.

As variáveis de configuração de referência estão em `apps/api/.env.example`. São apenas nomes e valores ilustrativos: a integração ainda não foi conectada, as credenciais não foram criadas e o bucket não foi provisionado.

## Requisitos obrigatórios para a implementação
1. **Armazenamento privado:** bucket/container sem acesso público; bloquear listagem pública e servir arquivos apenas pela API autorizada ou URL assinada de curta duração.
2. **Upload controlado:** autenticar o usuário; permitir somente tipos documentais definidos; impor limite de tamanho; validar extensão, MIME declarado e assinatura/conteúdo real; gerar nome/chave aleatória no servidor; nunca confiar em caminho ou nome enviado pelo navegador.
3. **Quarentena e análise:** manter o arquivo indisponível até concluir varredura antimalware; impedir download quando a análise não for aprovada.
4. **Autorização por objeto:** prestador acessa apenas seus próprios documentos; equipe administrativa somente com papel e escopo autorizados. Verificar autorização em cada leitura, alteração e exclusão.
5. **Download:** emitir URL assinada somente após autorização, com validade curta e sem expor `storageKey`; não incluir documentos ou dados sensíveis em URLs, logs ou respostas públicas.
6. **Metadados:** validar tamanho, tipo documental, datas e estados; não aceitar `reviewedBy`, status de aprovação ou chave de storage livremente do cliente.
7. **Auditoria:** registrar upload, tentativa de acesso negada, visualização/download, revisão, substituição e exclusão, sem registrar conteúdo ou segredos.
8. **Retenção e direitos:** definir prazo por finalidade, descarte seguro e atendimento a solicitações do titular conforme orientação jurídica/LGPD.
9. **Proteção operacional:** criptografia em trânsito e em repouso, gestão de segredos fora do Git, backup protegido, controle de acesso mínimo, monitoramento e plano de resposta a incidentes.
10. **Testes:** cobrir acesso cruzado entre prestadores, papel administrativo insuficiente, arquivo inválido/excessivo, malware, URL expirada, chave inexistente e falha do storage.

## Sequência de entrega
- [x] Selecionar Cloudflare R2 como alvo de armazenamento privado compatível com S3.
- [x] Criar rotas autenticadas de consulta de metadados e revisão administrativa.
- [x] Registrar auditoria de aprovação/rejeição de documentos na mesma transação.
- [ ] Provisionar bucket privado e credenciais com privilégio mínimo.
- [x] Implementar upload em quarentena com validação de MIME/assinatura e compensação em falha de persistência.
- [x] Criar worker ClamAV fail-closed para marcar arquivos como clean/infected/error e registrar auditoria.
- [ ] Provisionar R2 e executar teste de integração do upload.
- [ ] Implantar ClamAV em rede privada e agendar o worker `npm run documents:scan`.
- [ ] Implementar download autorizado e URLs assinadas curtas.
- [ ] Implementar consentimentos e política de retenção.
- [ ] Adicionar testes de integração com PostgreSQL e storage de teste.
- [ ] Executar revisão de segurança antes de habilitar dados reais.

## Regra de liberação
A funcionalidade só poderá ser considerada pronta após testes automatizados e manuais com PostgreSQL e storage configurados, verificação dos controles acima e aprovação operacional. A aprovação do CI de build e testes unitários não equivale a essa liberação.


## Operação da varredura ClamAV

O worker está em `apps/api/scripts/scan-pending-documents.ts` e é executado com:

```bash
npm run documents:scan
```

Configurar `CLAMAV_HOST`, `CLAMAV_PORT`, `S3_*` e `DATABASE_URL` no ambiente do worker. O serviço ClamAV de referência está em `infra/clamav/docker-compose.yml`; ele não publica a porta do daemon no host. O worker e o daemon devem compartilhar uma rede privada e o daemon não pode ficar acessível pela internet.

O worker lê lotes pequenos de documentos pendentes, transmite o conteúdo ao ClamAV pelo protocolo INSTREAM e grava `clean`, `infected` ou `error`. Falhas de conexão, leitura ou resposta resultam em `error`, nunca em `clean`. Cada resultado é registrado em `AuditEvent`. O worker não aprova documentos automaticamente: a aprovação administrativa continua exigindo `scanStatus = clean`.

Agendar a execução em intervalo curto por cron/worker manager, monitorar erros e reprocessar documentos com estado `error` somente após corrigir a causa. Antes da produção, validar com arquivos de teste inofensivos e com o arquivo de teste EICAR em ambiente isolado, sem usar documentos pessoais reais. Nunca disponibilizar o arquivo antes do estado `clean`.
