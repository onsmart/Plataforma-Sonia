# Status da sessão — Fluxos, IA e WhatsApp

Documento de continuidade: o que foi feito e o que ainda precisa de atenção.

---

## Onde paramos (entregas feitas)

### Editor de fluxo
- **Remover conexão:** selecionar a linha (aresta) e usar **Delete** ou **Backspace** (com foco no canvas, sem modal de edição aberto). Melhoria em `AnimatedEdge`: área de clique maior (`interactionWidth`) e `pointer-events: none` no traço animado para não bloquear o clique.
- **Salvar fluxo:** removido o modal que pedia o nome a cada salvamento. O **nome** fica em campo **inline** ao lado do seletor de fluxo; **Salvar** grava direto e **mantém o fluxo selecionado** após PUT. Fluxo novo (POST) passa a receber o `id` na resposta e é selecionado automaticamente.

### Validação lógica (roteiro por `intent`)
- Foi validado em conversa que a cascata **agendar → metodologia → servicos → suporte → severity → humano → fallback** é coerente, com ressalvas: `contém` é **case-sensitive**, variáveis (`intent`, `severity`) precisam existir no contexto, e o **ELSE final** deve ter destino explícito.

### MVP “Criar com IA” (fluxo mínimo)
- Botão **Criar com IA** na página de Fluxos abre modal: nome (para salvar depois), **idioma em que os agentes falam** (lista alinhada a `SUPPORTED_AGENT_LANGUAGES` em `FrontEnd/src/lib/agent-language.ts`), descrição livre.
- Backend: `POST /flows/generate-mvp` (admin). Refino da descrição + escolha de **um** template ou agente + montagem **Início → 1 nó agente/template → Fim**.
- **Refino da descrição:** OpenAI e/ou **Anthropic (Claude)** — Google/Gemini foi **substituído por Claude** no código.
- **Rótulos de idiomas** na UI dos agentes / modal: exibidos **em português** (ex.: Inglês (EUA), Espanhol).

### Variáveis de ambiente relevantes (BackEnd) — MVP IA + Claude
- `FLOW_DESCRIPTION_REFINER`: `openai` (padrão), `claude` / `anthropic` (e legado `google`/`gemini` tratados como preferência Claude), ou `none`.
- Claude: `ANTHROPIC_API_KEY` (ou `CLAUDE_API_KEY` / `ANTHROPIC_AUTH_TOKEN`); opcional `ANTHROPIC_MODEL` ou `CLAUDE_MODEL` (padrão no código: `claude-3-5-haiku-20241022`).
- **Ainda necessário para o MVP:** `OPENAI_API_KEY` + `OPENAI_MODEL` — a etapa que **escolhe** template/agente e monta o JSON estruturado continua usando **OpenAI**.

### WhatsApp (apenas diagnóstico, sem mudança de código na sessão)
- O status **“desconectado / ERRO”** na configuração é calculado com **GET** na Graph API (`/{phone-number-id}` + Bearer token salvo em **`tb_integrations`**). Não depende do webhook para esse indicador.
- Causa mais comum sem “mexer na tela”: **token Meta expirado/revogado** ou divergência entre token/Phone Number ID na base e no Meta.

---

## Problemas / pendências a resolver

### 1. WhatsApp em erro (bloqueia teste real do fluxo no número)
- **Ação:** renovar **Access Token** no Meta e atualizar na integração na plataforma; conferir **Phone Number ID** e permissões do app.
- **Opcional:** inspecionar logs do backend (`[whatsapp.dispatcher] Falha ao validar conexao com a Meta`) para ver a mensagem exata retornada pela Meta.

### 2. MVP “Criar com IA” depende de OpenAI na escolha do recurso
- Se a intenção for **não usar OpenAI** nesse fluxo, falta implementar chamada equivalente (ex.: Claude com JSON) para `pickResource` / geração estruturada do mini fluxo.

### 3. Evoluções desejadas (não implementadas nesta sessão)
- Chat com a Sonia no modal (**até 3 perguntas** + geração de fluxo mais rica com vários nós/condicionais).
- Exibir na UI o **erro detalhado da Meta** ao validar WhatsApp (hoje a mensagem é genérica).
- Revisar se o fluxo alocado ao número WhatsApp está selecionado (print sugeria dropdown de fluxo vazio ou cortado).

### 4. Segurança / operação
- Garantir que **chaves de API** (OpenAI, Anthropic, Meta, etc.) no `.env` **não** sejam commitadas; rotacionar se expostas em repositório ou prints.

---

## Arquivos tocados (referência rápida)

| Área | Arquivos principais |
|------|---------------------|
| Canvas / arestas | `FrontEnd/src/components/flows/AnimatedEdge.tsx` |
| Fluxos / salvar / IA | `FrontEnd/src/pages/Flows.tsx`, `FrontEnd/src/components/flows/GenerateFlowAiDialog.tsx` |
| Idiomas agentes | `FrontEnd/src/lib/agent-language.ts` |
| Geração MVP + Claude | `BackEnd/src/services/flows/flow-generate-mvp.service.ts` |
| Rota API | `BackEnd/src/api/routes/flows.routes.ts`, `BackEnd/src/api/controllers/flows.controller.ts` |
| Status WhatsApp | `BackEnd/src/services/integrations/whatsapp/whatsapp.dispatcher.ts`, `BackEnd/src/api/controllers/whatsapp.controller.ts` |

---

*Última atualização: documento criado a pedido para retomada do trabalho.*
