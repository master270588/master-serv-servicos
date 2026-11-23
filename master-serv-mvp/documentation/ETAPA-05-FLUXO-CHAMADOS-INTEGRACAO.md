# ETAPA 05 — Fluxo de chamados e integração das interfaces

## Entregue no repositório
- Migração SQL 006: cadastro das áreas de atendimento, categorias iniciais, vínculo entre chamado e endereço do cliente, unicidade de orçamento por prestador/chamado e proteção contra atribuições ativas duplicadas.
- Cobertura inicial: Vitória, Vila Velha, Serra, Cariacica, Viana, Guarapari e Fundão.
- Cadastro de prestador passa a exigir ao menos uma categoria de serviço ativa.
- Cliente: cadastrar/listar endereços, abrir chamado, acompanhar status e decidir orçamentos.
- Administração: listar chamados e criar distribuição individual ou simultânea, com validação de prestadores aprovados, ativos e habilitados na categoria.
- Prestador: consultar distribuições, aceitar/recusar, enviar orçamento, iniciar após aprovação do cliente e registrar conclusão.
- Endereço completo não é enviado ao prestador antes da aprovação do orçamento.
- Auditoria transacional para criação de endereço/chamado, distribuição, resposta, orçamento, início e conclusão.
- Testes unitários iniciais para propriedade do endereço, aprovação do orçamento e aprovação do prestador.

## Regras operacionais aplicadas
- Individual: uma pessoa prestadora por rodada.
- Simultânea: de 2 a 20 prestadores por rodada.
- Rodada expira em 30 minutos.
- Só prestadores aprovados, ativos e habilitados na categoria recebem distribuição.
- Cada prestador envia no máximo um orçamento por chamado.
- O cliente escolhe um orçamento; os demais pendentes são rejeitados e atribuições concorrentes são liberadas.
- O prestador não inicia o serviço sem orçamento aprovado pelo cliente.

## Integração
O contrato das quatro interfaces está em `documentation/CONTRATO-API-V1.md`. O backend é compartilhado; o repositório ainda não contém os quatro frontends visuais completos.

## Validação
O CI aplica as migrações em PostgreSQL descartável, compara o banco ao schema Prisma, executa testes, verifica o worker e compila API/imagem Docker. Consultar a execução mais recente do workflow antes de considerar esta etapa validada.

## Próximo passo técnico
Construir os frontends sobre o contrato v1 e, em paralelo, concluir fluxos de cancelamento/disputa/confirmacão de conclusão, depois integrar gateway, pagamentos mistos, comissão, ledger e fidelidade com idempotência. Antes de operação real, provisionar banco gerenciado, R2 privado, ClamAV agendado, segredos, backups e observabilidade.
