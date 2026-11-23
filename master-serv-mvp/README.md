# MASTER SERV SERVIÇOS — base técnica do MVP

Este repositório contém a API central, o modelo de dados, migrações e infraestrutura de desenvolvimento. **Ainda não é uma plataforma pronta para clientes e não há produção implantada confirmada.**

## Arquitetura
- API central: NestJS 11 + Prisma 6.
- Banco: PostgreSQL 16.
- Documentos: Cloudflare R2 privado em quarentena + ClamAV (provisionamento real pendente).
- Quatro interfaces planejadas: site público, app do cliente, app do prestador e painel administrativo.
- Operação inicial na Grande Vitória/ES; expansão para o restante do Espírito Santo por ativação controlada de municípios.

## O que já existe no código
- Autenticação, sessões rotativas e autorização por papéis.
- Cadastro e aprovação administrativa de prestadores, incluindo categorias de serviço.
- Endereços de clientes, catálogo público e cobertura ativa.
- Abertura e acompanhamento de chamados.
- Distribuição individual e simultânea, aceite/recusa e envio de orçamento.
- Aprovação de orçamento pelo cliente obrigatória antes do início do serviço.
- Trilha de auditoria para ações principais.
- Upload documental em quarentena e worker ClamAV, dependentes de serviços externos provisionados.

## Banco de dados
Migrações SQL versionadas em `database/`, aplicadas em ordem 001–006. Consulte `database/README.md`. O CI aplica todas em PostgreSQL descartável e compara com o schema Prisma.

## Integração das quatro interfaces
O contrato REST está em `documentation/CONTRATO-API-V1.md`. As telas e aplicativos ainda precisam ser construídos e integrados; nenhum deles deve conectar diretamente ao banco ou ao armazenamento de documentos.

## Preparar ambiente local
Requisitos: Node.js 20+, npm, Docker Compose e Git. Siga as instruções em `apps/api/README.md` e `database/README.md`. Use apenas dados fictícios no desenvolvimento.

## Segurança e produção
O checklist está em `documentation/PRODUCAO-CHECKLIST.md`. Banco gerenciado, R2, ClamAV agendado, domínio, TLS, backups testados, monitoramento, política LGPD, gateway de pagamentos e interfaces finais ainda exigem configuração e verificação reais.

## Regras de produto preservadas
- Prestadores aprovados pela administração antes de receber chamados.
- Orçamento aprovado pelo cliente antes do início.
- Comissão padrão de 10%.
- Pagamentos mistos (gateway e liquidação ainda pendentes).
- Fidelidade: 1 ponto por R$ 1 elegível; 1.000 pontos = R$ 10 de desconto (regras de resgate/estorno pendentes).
- Garantia comercial proposta de 90 dias, sem reduzir direitos legais do consumidor.
