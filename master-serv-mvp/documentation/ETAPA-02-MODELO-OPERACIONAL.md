# Etapa técnica 02 — Modelo de operação, finanças e privacidade

## Estado confirmado no repositório
- Branch padrão: `main`.
- API NestJS contém somente endpoint de saúde `GET /api/health`.
- A migração 001 cria usuários, papéis, prestadores, categorias, chamados, orçamentos e eventos de auditoria.
- O PostgreSQL está descrito no Docker Compose, mas a conexão da API e a execução das migrações ainda não foram demonstradas.

## Entrega desta etapa
A migração `database/002_operations_finance_privacy.sql` acrescenta endereços, metadados de documentos privados, lotes e candidatos de distribuição, atribuições, transações, razão financeiro, comissão, fidelidade, consentimentos e notificações.

## Premissas preservadas
- Distribuição individual ou simultânea.
- Prestadores aprovados administrativamente antes de receber chamados (a regra precisa ser aplicada na consulta/serviço da API).
- Orçamento aprovado pelo cliente antes do início do serviço (a transição de estado precisa ser validada na API).
- Comissão padrão de 10% (1000 pontos-base).
- Fidelidade: 1 ponto por R$ 1 elegível; 1.000 pontos equivalem a R$ 10, conforme regras finais.
- Pagamentos mistos: o modelo registra transações por método; conciliação e gateway ainda precisam ser implementados.

## Segurança e limites
- A tabela de documentos guarda somente metadados e uma chave de armazenamento privado, não o arquivo.
- Bucket privado, URLs assinadas curtas, verificação de MIME/tamanho/antivírus e autorização por proprietário são requisitos da camada de aplicação ainda não implementados.
- Não há ainda autenticação, autorização efetiva, RLS, gateway de pagamento, conciliação, testes automatizados ou implantação.
- A migração é uma proposta versionada; ainda precisa ser executada e testada em PostgreSQL de desenvolvimento.

## Próximos passos
1. Executar 001 e 002 em banco descartável de desenvolvimento.
2. Validar constraints, índices e rollback.
3. Adicionar Prisma/TypeORM e conexão PostgreSQL à API NestJS.
4. Implementar autenticação e autorização baseada em papéis e propriedade do recurso.
5. Implementar fluxo de chamados/orçamentos com transições transacionais.
6. Adicionar testes automatizados e CI antes de qualquer publicação.
