# Segurança de documentos e dados pessoais — MASTER SERV

## Objetivo
Definir os controles mínimos antes de receber documentos de identidade, comprovantes e outros dados pessoais de clientes e prestadores. Este documento registra o estado observado no código e os critérios para liberar a funcionalidade; não substitui avaliação jurídica ou teste de segurança independente.

## Estado verificado no repositório

### Já existe no modelo de dados
- A tabela/modelo `ProviderDocument` registra proprietário (`providerUserId`), tipo, chave de armazenamento, nome original, MIME, tamanho, situação da análise, validade e responsável pela revisão.
- A migração SQL exige tamanho maior que zero e limita os estados de revisão.
- A tabela `PrivacyConsent` registra finalidade, versão da política, concessão e revogação.
- Há trilha de auditoria `AuditEvent`, já usada no fluxo administrativo de aprovação/rejeição de prestadores.
- A autenticação JWT e a verificação de papéis administrativos estão implementadas na API.

### Ainda não está implementado/verificado
- Não foi encontrado módulo/controller de upload, download ou revisão de documentos na API.
- Não há integração de armazenamento de objetos configurada no código examinado.
- Não há implementação comprovada de URL assinada, varredura antivírus, validação real do conteúdo do arquivo ou rotina de expiração/exclusão.
- O modelo de consentimento existe, mas não foi localizado fluxo de API para registrar/consultar/revogar consentimentos.
- Os eventos de auditoria de aprovação de prestadores não comprovam auditoria de cada acesso ou alteração de documento.
- Não há banco PostgreSQL conectado nem teste ponta a ponta com armazenamento real.

**Conclusão:** o banco está preparado para guardar metadados, mas o ciclo seguro de arquivos ainda não está pronto para uso real. Não solicitar documentos de clientes/prestadores nem habilitar upload em produção nesta etapa.

## Requisitos obrigatórios para a implementação

1. **Armazenamento privado:** bucket/container sem acesso público; bloquear listagem pública e servir arquivos apenas pela API autorizada ou URL assinada de curta duração.
2. **Upload controlado:** autenticar o usuário; permitir somente tipos documentais definidos; impor limite de tamanho; validar extensão, MIME declarado e assinatura/conteúdo real; gerar nome/chave aleatória no servidor; nunca confiar em caminho ou nome enviado pelo navegador.
3. **Quarentena e análise:** manter o arquivo indisponível até concluir varredura antimalware; marcar falha/pendência e impedir download quando a análise não for aprovada.
4. **Autorização por objeto:** prestador acessa apenas seus próprios documentos; equipe administrativa somente com papel e escopo autorizados. Verificar autorização em cada leitura, alteração e exclusão, não apenas na tela.
5. **Download:** emitir URL assinada somente após autorização, com validade curta e sem expor `storageKey`; não incluir documento, CPF ou dados sensíveis em URLs, logs ou respostas públicas.
6. **Metadados:** validar tamanho positivo e limites máximos, tipo documental por lista permitida, datas e estados; não aceitar `reviewedBy`, status de aprovação ou chave de storage livremente do cliente.
7. **Auditoria:** registrar upload, tentativa de acesso negada, visualização/download, revisão, aprovação/rejeição, substituição e exclusão; incluir ator, documento, horário, request ID e resultado, sem registrar conteúdo ou segredos.
8. **Retenção e direitos:** definir prazo por finalidade, descarte seguro, correção e atendimento a solicitações do titular; preservar somente o que tiver base legal e prazo aplicável.
9. **Proteção operacional:** criptografia em trânsito e em repouso, gestão de segredos fora do Git, backup protegido, controle de acesso mínimo, monitoramento e plano de resposta a incidentes.
10. **Testes:** cobrir usuário tentando acessar documento de outro prestador, cliente tentando acessar documentos, papel administrativo insuficiente, arquivo inválido/excessivo, malware, URL expirada, chave inexistente, replay e falha do storage.

## Sequência de entrega
- [ ] Escolher provedor de armazenamento privado e definir região, criptografia, retenção e credenciais.
- [ ] Implementar módulo de documentos com upload em quarentena e download autorizado.
- [ ] Implementar revisão administrativa e trilha de auditoria completa.
- [ ] Implementar consentimentos e política de retenção conforme orientação jurídica/LGPD.
- [ ] Adicionar testes unitários e integração com PostgreSQL e storage de teste.
- [ ] Executar revisão de segurança antes de habilitar dados reais.

## Regra de liberação
A funcionalidade só poderá ser considerada pronta após testes automatizados e manuais com PostgreSQL e storage configurados, verificação dos controles acima e aprovação operacional. A aprovação do CI que valida build e testes unitários não equivale a essa liberação.
