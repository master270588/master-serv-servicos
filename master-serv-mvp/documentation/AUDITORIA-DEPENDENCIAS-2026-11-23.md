# Auditoria de dependências e atualização de ORM — 23/11/2026

## Resultado observado no GitHub Actions
No workflow de API associado ao commit de verificação atual:
- Build, validação Prisma, aplicação das migrações 001–006 em PostgreSQL descartável, comparação SQL/Prisma, testes, tipagem do worker e imagem Docker: sucesso.
- `npm audit` completo: 6 achados (3 moderados e 3 altos).
- `npm audit --omit=dev`: 3 achados altos, sem críticos. Os achados altos estão no caminho `prisma` → `@prisma/config` → `effect`.

O audit não bloqueia o workflow hoje; portanto, sucesso do CI não significa dependências liberadas para produção.

## Achado prioritário
O lockfile resolve `effect@3.21.0`. O advisory GHSA-7589-6fvf-x4pw / CVE-2026-121707 afeta versões até 3.22.0 e indica correção em `effect@3.22.1`. Referência: https://github.com/Effect-TS/effect/security/advisories/GHSA-7589-6fvf-x4pw

O Prisma ORM 6 encerrou seu período de suporte em 19/11/2026. Referência oficial: https://www.prisma.io/docs/orm/release-status

## Decisão técnica
A próxima atualização deve migrar para Prisma ORM 7 estável, e não para Prisma 8 release candidate. A migração requer:
1. Atualizar `prisma` e `@prisma/client` para a mesma linha 7.x.
2. Adotar ESM e ajustar `package.json`/TypeScript.
3. Adicionar `@prisma/adapter-pg` e configurar o pool PostgreSQL explicitamente.
4. Mover a URL usada pelo CLI para `prisma.config.ts`.
5. Regenerar o lockfile em ambiente com npm e testar CI, build Docker e diff SQL/Prisma.
6. Verificar novamente `npm audit --omit=dev`; o gate de produção exige zero achados altos/críticos.

Guia oficial: https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7

## Achados moderados do conjunto completo
O audit também sinaliza a cadeia de ferramentas de desenvolvimento (`@nestjs/cli`, `glob`, `minimatch`). Atualizar o CLI para a versão compatível e corrigir as dependências transitivas, sem forçar majors incompatíveis, depois validar build e testes.

## Estado
Nenhuma dependência foi alterada nesta auditoria. A atualização requer regeneração real do package-lock com npm e validação automatizada; não editar manualmente integridades/resolved URLs. Até a conclusão e novo audit limpo, não considerar o backend pronto para produção.
