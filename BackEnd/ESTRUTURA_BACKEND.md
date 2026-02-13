# Mapa de Estrutura - BackEnd

Este documento serve como guia para IAs entenderem a organização deste backend. Cada item possui um breve resumo de sua responsabilidade.

---

## 📂 / (Root)
- `package.json`: Dependências e scripts de execução/build.
- `tsconfig.json`: Configurações do compilador TypeScript.
- `.env`: Variáveis de ambiente (API Keys, DB).
- `*.sql`: Scripts de migração e funções PostgreSQL/Supabase.
- `COMO_*.md`: Manuais de implantação e manutenção.
- `src/`: Diretório principal com código TypeScript.

## 📂 src/
- `index.ts`: Ponto de entrada da aplicação Express.

### 📂 src/api/ (Interface HTTP)
- **`routes/`**: Definição dos endpoints e rotas Express.
- **`controllers/`**: Tratamento de requisições e respostas HTTP.

### 📂 src/services/ (Lógica de Negócio)
- **`agents/`**: Lógica de gestão e comportamento dos agentes.
- **`flows/`**: Processamento e execução de fluxos lógicos.
- **`integrations/`**: Conectores externos (WhatsApp, CRM, Email).
- **`llm/`**: Integração com modelos de linguagem (OpenAI/Anthropic).
- **`rag/`**: Implementação de busca em documentos (RAG).
- **`files/`**: Processamento e gestão de arquivos/conhecimento.
- `system-logs.ts`: Sistema centralizado de logs da plataforma.

### 📂 src/services/integrations/
- **`whatsapp/`**: Fluxos, webhooks e mensagens para WhatsApp.
- **`email/`**: Envio e recebimento de correio eletrônico.
- **`email_reader/`**: Automação de leitura e processamento de caixa.
- **`crm/`**: Sincronização e consulta em sistemas CRM.

### 📂 src/lib/ (Bibliotecas e Clientes)
- `supabase.ts`: Cliente de conexão com banco Supabase.
- `redis.ts`: Gestão de cache e filas com Redis.
- `logger.ts`: Configuração do logger Winston/Pino.

### 📂 src/models/
- `Agent.ts`: Definição de interfaces e tipos de dados.

### 📂 src/utils/
- Funções auxiliares, formatadores e validadores genéricos.
