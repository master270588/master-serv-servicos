# Contrato de integração API v1 — MASTER SERV

## Arquitetura de integração

As quatro interfaces devem consumir a mesma API central HTTPS; nenhuma interface deve conectar diretamente ao PostgreSQL, ao R2 ou ao ClamAV.

| Interface | Escopo principal | Autorização |
|---|---|---|
| Site público | Catálogo, cobertura e entrada para cadastro/login | Rotas públicas |
| Aplicativo do cliente | Endereços, abertura e acompanhamento de chamados, aprovação de orçamento | JWT + papel `customer`; dados limitados ao titular |
| Aplicativo do prestador | Categorias, chamados distribuídos, orçamento e execução | JWT + papel `provider`; cadastro ativo e aprovação administrativa |
| Painel administrativo | Prestadores, documentos, chamados e distribuição | JWT + `admin` ou `super_admin` |

Prefixo de todas as rotas: `/api`. O contrato é REST/JSON, exceto upload documental multipart. O frontend deve tratar códigos HTTP 401 (sessão inválida), 403 (papel insuficiente), 404 (recurso não encontrado) e 409 (conflito de estado) sem tentar contornar a autorização.

## Site público

| Método | Rota | Uso |
|---|---|---|
| GET | `/api/public/service-categories` | Categorias ativas |
| GET | `/api/public/service-areas` | Municípios com atendimento ativo |
| POST | `/api/auth/register` | Criar conta |
| POST | `/api/auth/login` | Entrar |

Cobertura inicial cadastrada: Vitória, Vila Velha, Serra, Cariacica, Viana, Guarapari e Fundão (ES). A lista retornada pela API é a fonte de verdade; a expansão para outros municípios depende de ativação operacional.

## Aplicativo do cliente

| Método | Rota | Uso |
|---|---|---|
| POST | `/api/customer/addresses` | Cadastrar endereço próprio |
| GET | `/api/customer/addresses` | Listar endereços próprios |
| POST | `/api/customer/orders` | Abrir chamado usando endereço próprio |
| GET | `/api/customer/orders` | Listar chamados próprios e orçamentos |
| GET | `/api/customer/orders/:id` | Detalhe do chamado e endereço próprio |
| POST | `/api/customer/orders/:orderId/quotes/:quoteId/decision` | Aprovar ou rejeitar orçamento |

Exemplo de endereço:

```json
{
  "label": "Casa",
  "postalCode": "29100-000",
  "street": "Rua Exemplo",
  "number": "100",
  "neighborhood": "Centro",
  "city": "Vila Velha",
  "stateCode": "ES"
}
```

Exemplo de abertura de chamado:

```json
{
  "categoryId": "UUID_DA_CATEGORIA",
  "addressId": "UUID_DO_ENDERECO_DO_CLIENTE",
  "description": "Descrever o serviço necessário com detalhes."
}
```

Decisão de orçamento:

```json
{ "decision": "approved" }
```

Use `rejected` para rejeitar. A aprovação de um orçamento encerra as demais propostas pendentes e libera a etapa de execução para o prestador escolhido.

## Aplicativo do prestador

Cadastro público de prestador exige `accountType: "provider"`, `displayName` e ao menos uma categoria em `serviceCategoryIds`. A conta começa pendente e não recebe tokens até aprovação administrativa.

| Método | Rota | Uso |
|---|---|---|
| GET | `/api/providers/me/dispatches` | Chamados distribuídos ao prestador |
| POST | `/api/providers/me/dispatches/:batchId/respond` | Aceitar ou recusar distribuição |
| GET | `/api/providers/me/orders` | Atribuições ativas e próprios orçamentos |
| POST | `/api/providers/me/orders/:orderId/quotes` | Enviar orçamento em centavos |
| POST | `/api/providers/me/orders/:orderId/start` | Iniciar após aprovação do cliente |
| POST | `/api/providers/me/orders/:orderId/complete` | Informar conclusão |
| POST | `/api/providers/me/documents` | Enviar documento para quarentena |
| GET | `/api/providers/me/documents` | Consultar metadados próprios |

Exemplo de orçamento: `{ "amountCents": 25000 }` representa R$ 250,00. O servidor não aceita início do serviço sem orçamento com estado `approved`. O endereço completo do cliente só é retornado ao prestador atribuído após a aprovação do orçamento.

Distribuição individual aceita um prestador por rodada; simultânea aceita de 2 a 20 prestadores. Cada rodada expira em 30 minutos. O painel administrativo pode criar outra rodada após o encerramento da anterior.

## Painel administrativo

| Método | Rota | Uso |
|---|---|---|
| GET | `/api/admin/providers/pending` | Fila de prestadores |
| PATCH | `/api/admin/providers/:id/approve` | Aprovar prestador |
| PATCH | `/api/admin/providers/:id/reject` | Rejeitar prestador |
| GET | `/api/admin/orders?status=requested` | Listar chamados |
| POST | `/api/admin/orders/:id/dispatch` | Criar rodada individual/simultânea |
| GET | `/api/admin/providers/:providerId/documents` | Consultar documentos |
| GET | `/api/admin/provider-documents/:documentId/file` | Abrir documento após análise limpa |
| PATCH | `/api/admin/provider-documents/:documentId/review` | Aprovar/rejeitar documento |

Exemplo de distribuição simultânea:

```json
{
  "mode": "simultaneous",
  "providerUserIds": ["UUID_PRESTADOR_1", "UUID_PRESTADOR_2"]
}
```

A API valida se todos os prestadores estão ativos, aprovados e habilitados na categoria do chamado. A interface administrativa não deve enviar nem escolher papéis administrativos por cadastro público.

## Estados principais do chamado

```text
requested -> dispatching -> awaiting_customer_approval -> approved -> in_progress -> completed
                          \-> quoted (quando todas as propostas forem rejeitadas)
```

Cancelamento, disputa, confirmação do cliente, reembolso e garantia ainda precisam de fluxos próprios. Não simular esses estados apenas na interface.

## Autenticação e armazenamento no cliente

- Access token: JWT Bearer de 15 minutos.
- Refresh token: rotativo, 30 dias; enviar a `/api/auth/refresh` e substituir imediatamente pelo novo.
- Logout: `POST /api/auth/logout` com o refresh token atual.
- Aplicativos móveis: guardar tokens em armazenamento seguro do sistema operacional.
- Site e painel: preferir sessão protegida por cookie HttpOnly/Secure/SameSite via camada de backend; o backend atual ainda recebe refresh token no corpo e precisa de adaptação antes de uso web em produção.
- Nunca colocar token, documento, chave de storage ou segredo em URL, analytics ou logs.
- CORS em produção deve listar somente as origens oficiais.

## Limites explícitos desta versão

Este documento descreve o contrato da API implementado no repositório, não prova que as quatro interfaces visuais existem ou estejam publicadas. Ainda não há frontends completos, gateway de pagamento, split financeiro, notificações externas, fluxo de consentimento/retensão LGPD, recuperação de senha ou testes ponta a ponta com serviços reais. Comissão de 10%, fidelidade (1 ponto por R$ 1 elegível; 1.000 pontos = R$ 10) e garantia comercial proposta de 90 dias estão registradas como regras de produto, mas cálculo/liquidação e regulamento operacional ainda precisam ser implementados e revisados.
