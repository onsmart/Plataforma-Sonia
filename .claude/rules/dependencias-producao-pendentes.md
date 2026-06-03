# Dependências pendentes (produção / outro momento)

Registro vivo do que **não está pronto** e foi **explicitamente adiado** para produção, configuração externa ou sprint futura.

**Ao concluir um item:** marque `[x]`, data e nota curta. **Ao adiar algo novo na conversa:** adicione na seção certa com prioridade.

Detalhe operacional (passos SMTP, Stripe, etc.): `docs/prioridades-correcoes-atualizacoes.md`.

---

## P0 — Infra e segurança (bloqueia uso real)

| Status | Item | Onde / como resolver |
|--------|------|----------------------|
| `[ ]` | SMTP custom no **Supabase Auth** (Resend) | Projeto `rmfbkyntvkpettjtgaws` → Authentication → SMTP (`smtp.resend.com:465`, sender `noreply@<domínio-verificado>`). Desbloqueia confirmação de cadastro para qualquer e-mail (incl. corporativo). |
| `[ ]` | URL Configuration Supabase Auth | Site URL + Redirect URLs (dev + produção). Links de confirmação devem voltar ao front. |
| `[ ]` | Rate limits Auth (429) | Authentication → Rate Limits, após SMTP estável. |
| `[ ]` | Deploy backend com `dist/` atualizado | Servidor (`192.168.15.31` ou produção): `npm run build` + reinício após mudanças de auth/webhook/flows. |
| `[ ]` | **SSH — manter sessão ativa (não cair por inatividade)** | **Servidor** (`servidoronsmart`): confirmar `sudo sshd -T \| grep clientalive` → `clientaliveinterval 0`; sem `TMOUT` em `/etc/profile.d/` ou `~/.bashrc`. **Não** habilitar `ClientAliveInterval`/`ClientAliveCountMax` no `sshd_config` (encerraria sessões idle). **Cliente (Windows):** criar/editar `C:\Users\<usuario>\.ssh\config` com `ServerAliveInterval 60` e `ServerAliveCountMax 0` (ou host específico do servidor). **Opcional:** `tmux` para comandos longos se a rede cair. Verificado em conversa 2026-05: servidor já OK; falta configurar keep-alive no PC. |
| `[ ]` | PM2 boot automático no servidor | Após deploy: `pm2 startup` (comando sudo exibido) + `pm2 save`. Aviso já aparece no `deploy-backend-server.ps1` se `systemctl` não listar unidade `pm2-*`. |
| `[ ]` | RLS / isolamento multi-tenant no Supabase | ADR + políticas; hoje parte do isolamento depende só de RPC/middleware. |
| `[ ]` | Revisar segredos expostos (rotacionar se necessário) | App Secret Meta, tokens, service role — sem colar secrets no git. |

---

## P1 — Auth, identidade e e-mail corporativo

| Status | Item | Onde / como resolver |
|--------|------|----------------------|
| `[ ]` | E-mail de confirmação de cadastro (fluxo completo) | Depende do SMTP Auth acima. Cadastro com `signUp` + `sp_create_user_with_company` já funciona; login bloqueia até confirmar. |
| `[ ]` | `RESEND_*` no BackEnd `.env` (e-mails da plataforma) | Billing, limites, transacionais — **separado** do SMTP do Supabase Auth. |
| `[ ]` | Allowlist de domínios no signup (opcional) | Só se regra de negócio exigir e-mails corporativos específicos (`SIGNUP_ALLOWED_EMAIL_DOMAINS` ou validação no `AuthPage`). |
| `[ ]` | OAuth Google | `signInWithOAuth({ provider: 'google' })` + sync `tb_users` / workspace pós-login (gap atual: OAuth só cria `auth.users`). |
| `[ ]` | OAuth Microsoft (Azure AD) | Provider `azure` no Supabase + app Azure + mesmo sync pós-login. Botões hoje são placeholder (`toast.info("em breve")` em `AuthPage.tsx`). |
| `[ ]` | Termos de Serviço e Política de Privacidade | Links reais na `AuthPage` (LGPD + OAuth apps). Hoje placeholder. |
| `[ ]` | Testes E2E cadastro → confirmação → login | Automatizar após SMTP estável. |

**Nota e-mail corporativo:** o cadastro já aceita `@empresa.com`; entrega depende de SMTP Auth + eventual allowlist no TI do cliente (spam/quarentena).

---

## P1 — Comercial e billing

| Status | Item | Onde / como resolver |
|--------|------|----------------------|
| `[ ]` | Produtos/preços no Stripe (6 planos REC_* / COM_*) | Valores comerciais ainda não fechados; UI mostra "A definir" / "Sob proposta". |
| `[ ]` | `STRIPE_PRICE_*` no `.env` do backend | Sem IDs reais, checkout falha. |
| `[ ]` | Webhook Stripe em produção | Handler no repo; falta `STRIPE_WEBHOOK_SECRET` + deploy estável. |
| `[ ]` | SSO corporativo (SAML / OIDC) | Previsto no catálogo de planos enterprise; não implementado. |
| `[ ]` | **Permissões por plano — matriz completa e enforcement** | Documentar e validar gates por `rec_*` / `com_*` / `free`: atendimentos/mês, agentes ativos, RAG, outbound/SDR, SSO, governança, subfluxos. Fontes: `BackEnd/src/config/plans.catalog.ts`, `BackEnd/src/utils/plan-helper.ts`, `BackEnd/docs/PLANOS_E_PERMISSOES.md`. UI deve refletir o que cada plano inclui (`BillingPlansSection`, `usePlanCapabilities`). |
| `[~]` | **Planos configurados e testados de ponta a ponta** | Catálogo + limites no repo; conta nova = `free` (0 atendimentos). **Pendente:** Stripe live, checkout → webhook → `tb_subscriptions`, smoke por plano (Start/Growth/Enterprise × Receptiva/Completa) confirmando bloqueios e liberações reais. |

**Matriz de permissões (referência rápida — validar em testes):**

| Plano | Atend/mês | Agentes | RAG | Outbound/SDR | SSO | Governança |
|-------|-----------|---------|-----|--------------|-----|------------|
| `free` | 0 | 0 | não | não | não | não |
| `rec_start` | 200 | 1 | não | não | não | não |
| `rec_growth` | 1.500 | 3 | sim | não | não | não |
| `rec_enterprise` | sob medida | ilimitado* | sim | não | sim | sim |
| `com_start` | 200 | 1 | não | sim | não | não |
| `com_growth` | 1.500 | 3 | sim | sim | não | não |
| `com_enterprise` | sob medida | ilimitado* | sim | sim | sim | sim |

\*Conforme catálogo comercial; enforcement via `canCreateAgent`, `canStartNewAtendimento`, `canUseRAG`, `canUseActiveOutbound`, etc.

---

## P1 — QA: agentes e integrações básicas

| Status | Item | Onde / como resolver |
|--------|------|----------------------|
| `[ ]` | **Suite de testes — agentes (CRUD, ativação, limites por plano)** | Criar/ativar/desativar agente; respeitar `canCreateAgent` / `canActivateAgent`; Playground com JWT; agente vinculado a fluxo. Testes existentes parciais: `plan-helper.test.ts`, `files-upload-plan.test.ts`. |
| `[ ]` | **Testes integração WhatsApp (inbound + limites)** | Webhook Meta, sessão/atendimento, bloqueio em `free` e no limite mensal. Ref.: `whatsapp-routes-auth.test.ts`, `meta-webhook*.test.ts`, `flow-channel-runtime.test.ts`. |
| `[ ]` | **Testes integração Calendly** | Agendamento via fluxo/blocos; credenciais mock ou sandbox. Ref.: `BackEnd/src/services/integrations/calendly/`. |
| `[ ]` | **Testes integração HubSpot (CRM / paciente)** | Sync contato/lead, constantes Sonia, handoff. Ref.: `hubspot-patient.service.ts`, `hubspot-sonia.constants.test.ts`, `flow-patient-intake.test.ts`. |
| `[ ]` | **Checklist manual staging** | WhatsApp + Calendly + HubSpot no workspace de teste; registrar resultado antes de produção. |

---

## P1 — Criar Agente com IA (wizard)

**Objetivo:** botão **"Criar agente com IA"** no hub de agentes, **análogo** ao **"Criar fluxo com IA"** (`FrontEnd/src/components/flows/GenerateFlowAiDialog.tsx`, `Flows.tsx`). Gera agente + fluxo associado usando **somente blocos e capacidades já existentes** na plataforma.

| Status | Item | Onde / como resolver |
|--------|------|----------------------|
| `[ ]` | Botão e dialog no front | `AgentsHub.tsx` (ou equivalente) → `GenerateAgentAiDialog.tsx` espelhando UX do fluxo IA. |
| `[ ]` | Endpoint backend de geração | Novo route/service (padrão `flows/generate` ou similar): Anthropic + validação de schema de blocos. |
| `[ ]` | Fase 1 — Configurações padrão do usuário | Carregar defaults do workspace/usuário (tom, idioma, integrações habilitadas, plano efetivo). |
| `[ ]` | Fase 2 — Descrição da funcionalidade | Campo livre: o que o agente deve fazer (caso de uso, canal, objetivo). |
| `[ ]` | Fase 3 — Seleção de personalidade | Presets + tom (alinhado a personalidades já usadas em agentes/fluxos). |
| `[ ]` | Fase 4 — Enriquecimento via Anthropic | API Anthropic recebe texto do usuário + contexto (plano, blocos disponíveis, personalidade) e devolve **prompt/spec mais completo** — sem inventar integrações ou blocos inexistentes. |
| `[ ]` | Fase 5 — Template definitivo + criação | A partir do spec enriquecido: montar template de agente (nome, role, personality, fluxo inicial) e **persistir** (`tb_agents` + fluxo vinculado). |
| `[ ]` | Fase 6 — Validação antes de criar | **Obrigatório:** rodar validação de teste do fluxo gerado (dry-run / executor de validação). Regras: cada nó deve usar **tipo de bloco existente** e **configuração suportada**; **proibido** criar funcionalidades novas ou blocos fictícios; só material do catálogo atual (`BlocksDrawer`, `flow-executor`, integrações já instaladas). Falha → mostrar erros ao usuário e não persistir. |
| `[ ]` | Testes automatizados do wizard | Mock Anthropic; casos: spec válido, bloco inválido rejeitado, plano `free` bloqueia criação se aplicável. |

**Referências no repo:** `GenerateFlowAiDialog.tsx`, `BackEnd/src/__test__/flow-generate-mvp.test.ts`, `flow-executor.test.ts`, `EditNodeDialog.tsx` (tipos de nó).

---

## P2 — UX e produto (código, não bloqueia dev interno)

| Status | Item | Onde / como resolver |
|--------|------|----------------------|
| `[ ]` | Botão "Reenviar e-mail de confirmação" | `AuthPage.tsx` → `supabase.auth.resend({ type: 'signup', email })`. |
| `[ ]` | Tela dedicada "Confirme seu e-mail" | Melhor que só toast após signup. |
| `[ ]` | CAPTCHA no signup | Supabase Auth → reduz abuso. |
| `[ ]` | Mensagens i18n para erros de auth | SMTP, 429, e-mail não confirmado. |
| `[ ]` | `VITE_API_URL` por ambiente | Consolidar localhost vs IP do servidor. |
| `[ ]` | Integração de voz na UI | `Integrations.tsx` — "em breve". |
| `[ ]` | Gmail OAuth nativo | Hoje Gmail é IMAP/SMTP + app password; OAuth seria frente separada (`docs/HANDOFF_CERTIFICADO_GMAIL.md`). |
| `[ ]` | CA corporativa para TLS Gmail/IMAP | `BackEnd/certs/` — certificado real do ambiente pendente. |

---

## P2 — Backend e arquitetura

| Status | Item | Onde / como resolver |
|--------|------|----------------------|
| `[ ]` | Rotas que ainda aceitam `email` na query/body | Padronizar `req.user.email` (como `/flows/execute`). |
| `[ ]` | Arquitetura subfluxos (módulo vs produto) | Alinhar com `SUPABASE_SCHEMA_REFERENCE.md`. |
| `[ ]` | Escalabilidade fila WhatsApp / workers | Redis + PM2 no servidor. |
| `[ ]` | Voice agent ElevenLabs realtime | `UnsupportedRealtimeVoiceAgentService` com TODO explícito. |

---

## Já implementado no código (não reimplementar sem pedido)

- `AccountSetupGate` + `requireWorkspace` (workspace obrigatório).
- `sp_create_user_with_company` + fix `pgcrypto` / `search_path`.
- UI login/cadastro (`AuthPage`, `LineWaves`), perfil/nome (`AuthContext`, `user-display.ts`).
- Catálogo dos 6 planos + `free` (0 atendimentos) no backend; UI conta gratuita + CTA faturamento (`Home.tsx`, `Settings.tsx`).
- **Criar fluxo com IA** (`GenerateFlowAiDialog.tsx`) — usar como referência de UX/API para o wizard de agente; **não** confundir com "Criar agente com IA" (pendente acima).
- Máscara CPF/CNPJ no cadastro (`formatDocument` em `account-types.ts`).

---

## Instrução para o agente

1. **Não assumir** que SMTP Auth, Stripe live, OAuth, Termos, matriz de planos testada ou "Criar agente com IA" já existem — checar esta lista.
2. **Não implementar** itens P0/P1 de infra sem o usuário pedir ou fornecer credenciais/domínio.
3. Ao gerar fluxos/agentes com IA, **nunca inventar blocos ou integrações** — validar contra catálogo existente antes de persistir.
4. Ao fechar um item, atualizar **esta rule** e, se relevante, `docs/prioridades-correcoes-atualizacoes.md`.
