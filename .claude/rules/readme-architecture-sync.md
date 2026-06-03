# README — contexto e sincronização (projeto Sonia)

Arquivo: **`README.md`** na raiz. É o mapa de arquitetura, rotas, fluxos e diagramas Mermaid.

## Antes de implementar ou explicar

Quando a tarefa envolver **auth/contas**, **multi-tenant**, **billing/Stripe**, **planos**, **equipe**, **WhatsApp**, **RAG**, **fluxos**, **governança** ou **novas rotas API**:

1. Leia as seções relevantes do README (sumário + [Índice de diagramas Mermaid](README.md)).
2. Use o README como contexto — não reinvente fluxos documentados sem checar o código atual.
3. Para **SQL/migrations**, use também `BackEnd/database/SUPABASE_SCHEMA_REFERENCE.md` (rule `supabase-schema-source.md`).

## Depois de alterar lógica ou contratos

Atualize o **README no mesmo esforço** da implementação quando houver:

| Gatilho | O que atualizar no README |
|---------|---------------------------|
| Nova rota ou prefixo HTTP | Tabela [Superfície da API](README.md) + diagrama [Mapa de rotas HTTP](README.md) |
| Fluxo de produto novo ou alterado | Seção em [Fluxos principais](README.md) + `sequenceDiagram`/`flowchart` Mermaid |
| Auth, cadastro PF/PJ, tenant, equipe | Cadastro, segurança multi-tenant, núcleo tenant |
| Billing, planos, gates | Planos e billing, assinatura Stripe |
| Módulo/domínio novo no BackEnd | [Mapa de módulos](README.md) ou camadas, se for entry point relevante |

**Não** atualize o README para: só CSS/UI, copy de tela, bugfix interno sem mudar contrato, ou refactors que não mudam comportamento observável.

## Como editar diagramas

- Sintaxe **Mermaid** válida (GitHub/Cursor preview).
- Ao adicionar diagrama, inclua linha no [Índice de diagramas Mermaid](README.md).
- Links para código: paths reais (`BackEnd/src/...`, `FrontEnd/src/...`).

## Outros docs (sem duplicar)

- **Schema/RPCs:** `SUPABASE_SCHEMA_REFERENCE.md` (não colar DDL longo no README).
- **Go-live / Stripe ops:** `BackEnd/docs/CHECKLIST_MVP_RECEPTIVO.md`, `PLANOS_E_PERMISSOES.md`.
- **Não criar** arquivos `.md` novos salvo pedido explícito do usuário.

## Ao encerrar a tarefa

No resumo ao usuário, indique em uma linha: **README atualizado** (quais seções) ou **README não alterado** (e por quê).
