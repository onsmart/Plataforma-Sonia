---
pdf_options:
  format: A4
  margin: 20mm 18mm
  printBackground: true
  displayHeaderFooter: true
  headerTemplate: "<div style=\"width:100%;font-size:8px;font-family:'Segoe UI',sans-serif;color:#94a3b8;display:flex;justify-content:space-between;padding:0 18mm;box-sizing:border-box;margin-top:6px\"><span>Plataforma de Atendimento Sônia — Documentação</span><span>Onsmart AI</span></div>"
  footerTemplate: "<div style=\"width:100%;font-size:8px;font-family:'Segoe UI',sans-serif;color:#94a3b8;display:flex;justify-content:center;padding:0 18mm;box-sizing:border-box;margin-bottom:6px\"><span class=\"pageNumber\"></span> / <span class=\"totalPages\"></span></div>"
stylesheet: sonia-doc-style.css
---

<div class="cover">
  <div class="cover-logo">Onsmart AI</div>
  <div class="cover-badge">Documentação Oficial</div>
  <div class="cover-title">Plataforma de<br>Atendimento Sônia</div>
  <div class="cover-subtitle">Tudo o que você precisa saber para usar, configurar e entender a plataforma</div>
  <div class="cover-divider"></div>
  <div class="cover-meta">
    <div class="cover-meta-item">
      <span class="cover-meta-label">Versão</span>
      <span class="cover-meta-value">1.0 — 2025</span>
    </div>
    <div class="cover-meta-item">
      <span class="cover-meta-label">Classificação</span>
      <span class="cover-meta-value">Confidencial</span>
    </div>
    <div class="cover-meta-item">
      <span class="cover-meta-label">Audiência</span>
      <span class="cover-meta-value">Equipe &amp; Clientes</span>
    </div>
    <div class="cover-meta-item">
      <span class="cover-meta-label">Status</span>
      <span class="cover-meta-value">Em Produção</span>
    </div>
  </div>
</div>

---

# O que é a Plataforma Sônia?

<div class="section-intro">
A Sônia é uma plataforma desenvolvida pela Onsmart AI que permite a qualquer empresa montar um atendimento automatizado inteligente — sem precisar programar nada. Ela conecta inteligência artificial, seus sistemas já existentes (CRM, agenda, e-mail) e os canais onde seus clientes estão (WhatsApp, por exemplo) em um lugar só.
</div>

Pense na Sônia como uma **central de atendimento digital** que trabalha 24 horas por dia, 7 dias por semana. Ela conversa com seus clientes, coleta informações, agenda consultas ou reuniões, registra dados no seu CRM e, quando necessário, transfere o atendimento para um humano — tudo de forma automática e configurável por você.

## Para quem é a Sônia?

A plataforma foi pensada para **qualquer empresa que atenda pessoas** e queira tornar esse atendimento mais rápido, organizado e escalável. Alguns exemplos:

| Tipo de Negócio | Como a Sônia Ajuda |
|---|---|
| **Clínicas e consultórios** | Agenda consultas automaticamente, faz triagem de pacientes e cadastra no sistema |
| **Prestadores de serviço** | Qualifica leads, coleta dados do cliente e registra tudo no CRM |
| **Escolas e cursos** | Responde dúvidas frequentes, orienta na matrícula e encaminha para o setor certo |
| **Comércio** | Informa sobre produtos, rastreia pedidos e dispara campanhas no WhatsApp |
| **Financeiro** | Guia o cliente no processo de adesão, coleta documentos e responde perguntas |

---

# Como a Plataforma Funciona?

<div class="section-intro">
A Sônia é dividida em três partes que trabalham juntas: os Agentes de IA (quem conversa), os Fluxos de Atendimento (como a conversa se desenrola) e as Integrações (com quais sistemas ela se conecta).
</div>

## Os Três Pilares

### 1. Agentes de IA

Um **agente** é o "atendente virtual" da sua empresa. Você define o nome dele, como ele se apresenta, qual tom de voz usa (formal, descontraído, técnico), quais informações ele pode compartilhar e em qual idioma ele atende.

É como contratar um atendente, mas você faz o treinamento uma única vez e ele nunca esquece o que aprendeu.

Você pode ter **vários agentes diferentes** — um para vendas, outro para suporte técnico, outro para agendamentos — cada um com sua personalidade e foco.

### 2. Fluxos de Atendimento

Um **fluxo** é o roteiro que o atendimento segue. Você monta visualmente, arrastando blocos numa tela, como se fosse um mapa de decisões:

> *"Se o cliente quer agendar → pede os dados → verifica horários disponíveis → confirma o agendamento. Se algo der errado → transfere para um humano."*

Você não precisa escrever código. O fluxo é configurado pela interface visual da plataforma.

### 3. Integrações

A Sônia se conecta aos sistemas que você já usa:

- **WhatsApp** — para enviar e receber mensagens
- **HubSpot / Mailchimp** — para registrar e atualizar contatos no CRM
- **Calendly** — para verificar horários e fazer agendamentos
- **E-mail** — para enviar confirmações, notificações e ler respostas
- **Voz** — para atendimento telefônico com voz sintética

---

# Os Agentes em Detalhe

## O que define um agente?

Ao criar um agente, você configura:

- **Nome e bio**: como ele se apresenta ao cliente
- **Personalidade**: o tom da conversa (formal, amigável, técnico, etc.)
- **Modelo de IA**: qual "cérebro" ele usa (mais rápido e econômico, ou mais capaz)
- **Idioma**: português, inglês ou outros
- **Canal vinculado**: por qual número de WhatsApp ou e-mail ele atende
- **CRM vinculado**: onde ele registra ou busca informações do cliente
- **Base de conhecimento**: arquivos com informações que ele pode consultar para responder perguntas

## Base de conhecimento

Você pode fazer upload de documentos — PDFs, apresentações, manuais — e o agente passa a ter acesso ao conteúdo deles. Quando um cliente fizer uma pergunta relacionada, o agente consulta esses documentos e responde com base nelas.

É útil para, por exemplo, carregar o cardápio da lanchonete, a tabela de preços do consultório ou o manual do produto.

## Atendimento por voz

Agentes também podem atender por telefone. Você escolhe a voz (existem diversas opções de vozes sintéticas disponíveis) e o agente consegue conversar em tempo real via chamada, usando a mesma lógica configurada no fluxo.

## Decisões importantes

Quando o agente precisa tomar uma decisão que você prefere revisar (como aprovar um desconto ou confirmar um caso especial), ele marca o item para aprovação humana. Você pode ver essas pendências no painel e aprovar ou rejeitar com um clique.

---

# Os Fluxos em Detalhe

## Como montar um fluxo?

O editor de fluxos é uma tela visual onde você arrasta blocos e os conecta. Cada bloco representa uma ação:

| Bloco | O que faz |
|---|---|
| **Agente** | O agente de IA conversa com o cliente naquele ponto do fluxo |
| **Condição** | Dependendo de uma resposta ou dado, o fluxo segue por caminhos diferentes |
| **CRM** | Busca, cria ou atualiza um contato no HubSpot ou Mailchimp |
| **Agendamento** | Verifica horários disponíveis no Calendly e faz ou cancela agendamentos |
| **Mensagem WhatsApp** | Envia uma mensagem direta (texto, botões de opção, lista) |
| **E-mail** | Envia um e-mail ao cliente ou para a equipe interna |
| **Coleta de documentos** | Solicita que o cliente envie um arquivo (foto, PDF, etc.) |
| **Transferir para humano** | Encaminha o atendimento para um atendente real com uma notificação |
| **Agendar** | Pausa o fluxo e o retoma em uma data/hora específica |
| **Subfluxo** | Chama outro fluxo já criado como uma etapa dentro deste |

## O fluxo "lembra" da conversa

Durante todo o atendimento, a plataforma mantém um registro de tudo que foi dito e coletado. Isso significa que, se o cliente informou o nome no começo, todos os blocos seguintes já sabem quem é aquela pessoa — sem precisar perguntar de novo.

## Pausa e retomada

Quando o fluxo precisa de uma resposta do cliente (por exemplo, para confirmar um horário), ele **pausa** e aguarda. Assim que o cliente responde, o fluxo **continua de onde parou** automaticamente — mesmo que o cliente demore horas ou dias para responder.

## Gerando um fluxo com IA

Na plataforma há um botão "Gerar com IA". Você descreve em texto o que quer que o fluxo faça, e a IA monta a estrutura inicial para você. É um ponto de partida que você pode ajustar depois.

---

# As Integrações em Detalhe

## WhatsApp

A Sônia usa a **API oficial do WhatsApp Business** (Meta), o que significa que:

- O número aparece como conta verificada para o cliente
- Você pode enviar mensagens ativas (campanhas, lembretes, confirmações) para quem deu opt-in
- Suporta botões de resposta rápida, listas de opções e envio de imagens/documentos
- Há fila de processamento para garantir que nenhuma mensagem se perca

## CRM — HubSpot e Mailchimp

A integração com CRM permite que a Sônia:

- **Verifique se o cliente já existe** antes de criar um cadastro duplicado
- **Crie ou atualize** informações do contato automaticamente
- **Registre eventos** (como um agendamento ou uma solicitação) no histórico do cliente
- **Segmente leads** para campanhas futuras

## Calendly (Agendamento)

Com a integração do Calendly, o fluxo pode:

- Perguntar ao cliente qual especialidade, serviço ou tipo de reunião deseja
- Mostrar os horários disponíveis em tempo real
- Confirmar o agendamento direto na conversa do WhatsApp
- Reagendar ou cancelar mediante solicitação

Para funcionar, você configura na plataforma quais tipos de eventos do Calendly correspondem a cada tipo de atendimento da sua empresa.

## E-mail

A Sônia consegue tanto **enviar** quanto **ler** e-mails:

- Envio de confirmações, notificações e resumos
- Leitura automática de respostas e encaminhamento para o fluxo correto
- Compatível com Gmail, Outlook, provedores próprios (SMTP) e o serviço Resend

## Pagamentos — Stripe

A plataforma integra com o Stripe para gerenciar assinaturas e controle de plano. Cada empresa tem um plano contratado que define quantos agentes podem ser criados e outras capacidades.

---

# O Painel — O que Você Vê na Tela

<div class="section-intro">
O painel da Sônia é dividido em seções. Cada uma tem um propósito específico. Abaixo está um guia rápido de onde encontrar cada coisa.
</div>

## Navegação Principal

| Seção | Para que serve |
|---|---|
| **Agents Hub** | Criar e configurar seus agentes de IA |
| **Flows** | Montar e editar fluxos de atendimento |
| **Inbox** | Ver o histórico de todas as conversas |
| **Dashboard** | Acompanhar os números: mensagens, atendimentos, conversões |
| **Insights** | Análises mais detalhadas com gráficos |
| **Configuration** | Conectar o WhatsApp, CRM, e-mail, Calendly e outros |
| **Knowledge Base** | Fazer upload dos arquivos que os agentes vão consultar |
| **Governance** | Controle de logs, auditoria e política de retenção de dados |
| **Cockpit** | Monitorar o que está acontecendo agora em tempo real |
| **Playground** | Testar um agente antes de colocá-lo em produção |
| **Settings** | Configurações da empresa, usuários e plano |
| **Profile** | Suas preferências e configurações de conta |

## Dashboard e Insights

O Dashboard mostra os principais números de forma resumida: total de mensagens trocadas, taxa de atendimentos concluídos sem precisar de um humano, agendamentos realizados e consumo de IA.

Os Insights permitem filtrar por período, agente ou canal, e exportar relatórios em PDF ou planilha.

---

# Configurações Essenciais

## Como conectar o WhatsApp

1. Acesse **Configurações → Integrações → WhatsApp**
2. Preencha com as informações da sua conta no painel da Meta (Business API)
3. Informe a URL de webhook (fornecida pela Onsmart)
4. Clique em **Testar conexão**
5. Vincule o número a um agente ou fluxo

> **Importante:** você precisa ter uma conta aprovada no WhatsApp Business API (Meta). A Onsmart pode auxiliar nesse processo.

## Como conectar o Calendly

1. Acesse **Configurações → Integrações → Calendly**
2. Cole seu token de acesso pessoal do Calendly
3. Informe seu e-mail de conta e fuso horário
4. Informe a URL base do webhook (pública e com HTTPS)
5. Clique em **Salvar**, depois **Testar** e depois **Registrar webhook**
6. Na seção **Mapeamento de especialidades**, vincule cada tipo de atendimento ao evento correto do Calendly

## Como conectar o HubSpot

1. No HubSpot, crie um Private App e copie o token de acesso
2. Acesse **Configurações → Integrações → HubSpot** na plataforma
3. Cole o token e salve
4. Clique em **Testar conexão**

> Dica: criar as propriedades `lead_source` e `last_flow_channel` no HubSpot (tipo: texto simples) melhora o registro de dados.

## Como criar um agente

1. Acesse **Agents Hub** → **Novo Agente**
2. Dê um nome e descreva brevemente o papel do agente
3. Escreva a personalidade (como ele deve se comunicar, o que pode e não pode dizer)
4. Escolha o modelo de IA (mais econômico ou mais avançado)
5. Vincule ao canal de comunicação e ao CRM
6. Opcionalmente, carregue arquivos de base de conhecimento
7. Ative e teste no **Playground**

---

# Segurança e Privacidade

## Seus dados estão separados dos de outros clientes

A Sônia é uma plataforma **multi-empresa**. Isso significa que os dados da sua empresa — clientes, conversas, agentes, fluxos — estão completamente separados dos dados de qualquer outra empresa que use a plataforma. Não há cruzamento de informações entre clientes.

## Acesso controlado por login

O acesso à plataforma é feito com e-mail e senha ou login pelo Microsoft Outlook. Cada usuário acessa somente os recursos da sua empresa.

## Retenção e exclusão de dados

Na seção **Governance**, é possível definir por quanto tempo os dados de conversas e logs serão mantidos. Após o prazo configurado, os dados são removidos automaticamente. Isso é importante para empresas que precisam seguir políticas de privacidade como a LGPD.

## Logs de auditoria

Todas as ações relevantes dentro da plataforma ficam registradas com data, hora e usuário responsável. Esses logs ficam disponíveis na seção **Governance**.

---

# Stack Tecnológica

<div class="section-intro">
Esta seção é voltada para desenvolvedores e equipes técnicas. Ela lista as tecnologias usadas na construção da plataforma.
</div>

## Backend

| Categoria | Tecnologia | Versão |
|---|---|---|
| Runtime | Node.js | 20 LTS |
| Linguagem | TypeScript | 5.9 |
| Framework HTTP | Express | 5.x |
| Banco de dados (BaaS) | Supabase (PostgreSQL) | 2.90 SDK |
| LLM | OpenAI SDK | 4.20 |
| Cache e filas | Redis | 7 Alpine |
| E-mail transacional | Resend | 6.8 |
| E-mail SMTP | Nodemailer | 8.0 |
| E-mail IMAP | Imapflow | 1.3 |
| Voz / WebRTC | Werift | 0.23 |
| Áudio codec | Opus Script | 0.1 |
| Pagamentos | Stripe SDK | 20.4 |
| Leitura de PDF | pdf-parse | 2.4 |
| Leitura de DOCX | Mammoth | 1.11 |
| HTTP client | Axios | 1.7 |
| Testes | Vitest | 4.0 |

## Frontend

| Categoria | Tecnologia | Versão |
|---|---|---|
| Framework UI | React | 18.3 |
| Linguagem | TypeScript | 5.9 |
| Build tool | Vite + SWC | 6.4 |
| Roteamento | React Router DOM | 7.12 |
| Componentes UI | Radix UI + Tailwind CSS | — |
| Editor de fluxos | ReactFlow | 11.11 |
| Formulários | React Hook Form + Zod | 7.55 / 3.x |
| Gráficos | Recharts | 2.15 |
| Notificações | Sonner | 2.0 |
| Internacionalização | i18next + react-i18next | 25.8 / 16.5 |
| Geração de PDF | jsPDF + autoTable | — |

## Infraestrutura

| Componente | Tecnologia | Papel |
|---|---|---|
| Banco principal | PostgreSQL via Supabase | Armazenamento de todos os dados |
| Busca semântica | pgvector (Supabase) | Vetores para base de conhecimento (RAG) |
| Realtime | Supabase Realtime (WebSocket) | Atualizações ao vivo |
| Armazenamento de arquivos | Supabase Storage | PDFs, documentos enviados |
| Cache e filas | Redis 7 | Estado de fluxos, fila de mensagens |
| Edge Functions | Supabase Edge Functions | Lógica isolada no servidor |
| Voz TTS | ElevenLabs API | Síntese de voz para agentes telefônicos |

---

# Glossário

Termos que aparecem na plataforma e no dia a dia da equipe:

| Termo | O que significa |
|---|---|
| **Agente** | O atendente virtual de IA que você configura |
| **Fluxo** | O roteiro automático de um atendimento, montado visualmente |
| **Subfluxo** | Um fluxo chamado dentro de outro fluxo como etapa |
| **Nó / Bloco** | Cada etapa dentro de um fluxo (agente, condição, agendamento, etc.) |
| **Contexto** | O conjunto de informações coletadas durante um atendimento (nome, e-mail, etc.) |
| **Handoff** | Quando o atendimento é transferido de um agente de IA para um humano |
| **RAG** | Sigla técnica para "base de conhecimento que o agente consulta" |
| **Event Type** | Um tipo de consulta ou reunião configurado no Calendly |
| **Mapeamento** | Vínculo entre uma categoria de atendimento e um tipo de evento do Calendly |
| **Campanha** | Envio de mensagem WhatsApp em massa para uma lista de contatos |
| **Template** | Modelo de mensagem pré-aprovado pelo WhatsApp para envios ativos |
| **CRM** | Sistema de gestão de relacionamento com clientes (HubSpot, Mailchimp, etc.) |
| **Webhook** | Endereço que a plataforma usa para receber avisos de outros sistemas |
| **Tenant** | Cada empresa cliente na plataforma (os dados de cada uma ficam isolados) |
| **LGPD** | Lei Geral de Proteção de Dados — a lei brasileira de privacidade |
| **LLM** | O modelo de linguagem de IA (o "cérebro" do agente, como o GPT da OpenAI) |
| **TTS** | Texto para fala — tecnologia que converte texto escrito em voz |
| **ElevenLabs** | Serviço de voz sintética usado nos agentes de telefone |

---

<div class="doc-footer">
  <strong style="color:#6366f1">Onsmart AI</strong> — Plataforma de Atendimento Sônia<br>
  Documentação 2025 &nbsp;·&nbsp; Confidencial &nbsp;·&nbsp; Todos os direitos reservados
</div>
