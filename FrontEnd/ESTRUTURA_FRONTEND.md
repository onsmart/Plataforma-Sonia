# Mapa de Estrutura - FrontEnd

Este documento serve como guia para IAs entenderem a organização deste frontend. Cada item possui um breve resumo de sua responsabilidade.

---

## 📂 / (Root)
- `package.json`: Configurações de dependências e scripts npm.
- `vite.config.ts`: Configuração do bundler Vite e aliases.
- `index.html`: Arquivo HTML principal do Single Page App.
- `.env`: Variáveis de ambiente e segredos locais.
- `src/`: Diretório principal com código-fonte React.

## 📂 src/
- `App.tsx`: Gerenciador de rotas e provedores globais.
- `main.tsx`: Ponto de entrada que renderiza App.
- `index.css`: Estilos globais e configurações do Tailwind.
- `vite-env.d.ts`: Definições de tipos globais do Vite.

### 📂 src/components/
- **`ui/`**: Componentes básicos e atômicos (Shadcn/UI).
- **`layout/`**: Componentes de estrutura (Sidebar, Navbar, Rodapé).
- **`agents/`**: Lógica visual para gestão de agentes.
- **`flows/`**: Componentes para construção de fluxos conversacionais.
- **`auth/`**: Formulários e lógica visual de autenticação.
- **`configuration/`**: Componentes de ajustes e parâmetros técnicos.
- **`inbox/`**: Componentes do centro de mensagens unificado.
- **`notifications/`**: Sistema visual de alertas e avisos.
- `mode-toggle.tsx`: Botão para trocar tema claro/escuro.
- `theme-provider.tsx`: Provedor de contexto para tema visual.

### 📂 src/pages/ (Visualizações Principais)
- `Dashboard.tsx`: Resumo geral e métricas da plataforma.
- `Cockpit.tsx`: Central de controle e operações rápidas.
- `AgentsHub.tsx`: Gestão centralizada de todos os agentes.
- `Flows.tsx`: Editor e visualizador de fluxos lógicos.
- `Inbox.tsx`: Interface de atendimento e conversas reais.
- `Insights.tsx`: Análise de dados e performance detalhada.
- `KnowledgeBase.tsx`: Gestão de documentos e informações base.
- `Settings.tsx`: Configurações gerais da conta e sistema.
- `Playground.tsx`: Área de testes para interações diretas.
- `IoTDevices.tsx`: Integração e monitoramento de dispositivos IoT.
- `Governance.tsx`: Controles de acesso, logs e auditoria.
- `LiveOperations.tsx`: Monitoramento em tempo real das interações.
- `AgentConfig.tsx`: Edição individual de parâmetros do agente.
- `Team.tsx`: Gestão de membros e permissões equipe.

### 📂 src/services/
- `api.ts`: Cliente Axios e funções de requisição.

### 📂 src/contexts/
- `AuthContext.tsx`: Gerencia estado de login e usuário.
- `NavigationContext.tsx`: Controla estado de navegação e menus.

### 📂 src/utils/
- Helper functions e utilitários lógicos gerais.

### 📂 src/lib/
- `utils.ts`: Utilitários compartilhados (cn, tailwind-merge).

### 📂 src/styles/
- `globals.css`: Estilos globais e variáveis CSS/Tailwind.

### 📂 src/guidelines/
- `Guidelines.md`: Regras de estilo e boas práticas.

### 📂 src/supabase/
- Configuração e hooks para integração Supabase.
