# Estrutura de Arquivos - BackEnd

```
BackEnd/
├── src/
│   ├── api/
│   │   ├── controllers/
│   │   │   └── agents.controller.ts ✅
│   │   └── routes/
│   │       └── agents.routes.ts ✅
│   ├── lib/
│   │   ├── logger.ts ✅
│   │   └── supabase.ts ✅
│   ├── models/
│   │   └── Agent.ts ✅
│   ├── services/
│   │   ├── agents/
│   │   │   ├── chatwithAgent.ts ✅
│   │   │   ├── getagentfromcache.ts ✅
│   │   │   └── index.ts ✅
│   │   ├── agents.service.ts ✅
│   │   ├── integrations/
│   │   └── llm/
│   │       └── openai.ts ✅
│   └── index.ts ✅
├── dist/ (compilado)
├── node_modules/ (dependências)
├── package.json ✅
├── package-lock.json ✅
├── tsconfig.json ✅
└── ESTRUTURA.md ✅
```

## Descrição dos Diretórios

### `/src/api/`
Contém os controladores e rotas da API REST.

- **controllers/**: Lógica de controle das requisições HTTP
- **routes/**: Definição das rotas da API

### `/src/lib/`
Bibliotecas e utilitários compartilhados.

- **logger.ts**: Sistema de logging
- **supabase.ts**: Cliente Supabase

### `/src/models/`
Modelos de dados e interfaces TypeScript.

- **Agent.ts**: Interface e tipos do modelo Agent

### `/src/services/`
Lógica de negócio e serviços.

- **agents/**: Serviços relacionados a agentes
  - **chatwithAgent.ts**: Lógica de chat com agente
  - **getagentfromcache.ts**: Cache de agentes
  - **index.ts**: Serviço principal de agentes
- **agents.service.ts**: Serviço adicional de agentes
- **integrations/**: Integrações com serviços externos (vazio)
- **llm/**: Serviços de Large Language Models
  - **openai.ts**: Integração com OpenAI

### `/src/`
- **index.ts**: Ponto de entrada da aplicação
