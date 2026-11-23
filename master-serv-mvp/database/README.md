# Banco de dados MASTER SERV

As migrações SQL são a fonte versionada do esquema PostgreSQL. Aplicar em ordem, uma única vez por ambiente, usando banco descartável primeiro:

1. 001 — usuários, papéis, categorias, chamados, orçamentos e auditoria.
2. 002 — endereços, documentos, distribuição, atribuições, pagamentos, ledger, comissão, fidelidade, consentimentos e notificações.
3. 003 — sessões e refresh tokens em hash.
4. 004 — índices de auditoria.
5. 005 — estado de análise antimalware de documentos.
6. 006 — áreas de atendimento, categorias iniciais, vínculo do endereço ao chamado e restrições de distribuição/orçamentos.

A migração 006 cadastra a cobertura inicial da Grande Vitória: Vitória, Vila Velha, Serra, Cariacica, Viana, Guarapari e Fundão. A expansão para outros municípios do Espírito Santo deve ocorrer ativando/cadastrando áreas após decisão operacional; não significa cobertura já disponível.

## Aplicação local (desenvolvimento)

A partir da pasta `master-serv-mvp`, com o PostgreSQL local iniciado:

```bash
for file in database/00*.sql; do
  docker exec -i master-serv-postgres psql -v ON_ERROR_STOP=1 -U master_serv_dev -d master_serv < "$file"
done
```

Depois execute na pasta `apps/api`:

```bash
npx prisma validate
npx prisma generate
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code
npm test -- --runInBand
npm run build
```

Não aplicar diretamente em produção sem backup restaurável, janela de manutenção, revisão do diff e plano de rollback. Não misturar SQL versionado e Prisma Migrate sem planejar formalmente a transferência de baseline.

## Regras comerciais codificadas como premissas

- A comissão padrão permanece 10% (1.000 pontos-base); cálculo e liquidação dependem do módulo financeiro/gateway.
- Pontos: regra aprovada de 1 ponto por R$ 1 elegível e 1.000 pontos = R$ 10 de desconto; ainda exige regras de elegibilidade, estorno e limite de uso.
- Garantia comercial proposta de 90 dias não substitui nem reduz direitos legais do consumidor.
- Orçamento precisa estar aprovado pelo cliente antes de o prestador iniciar. A API bloqueia a transição para `in_progress` sem orçamento aprovado.
