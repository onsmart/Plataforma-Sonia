# 🧪 CI + Smoke Tests

Este documento explica o sistema de CI (Continuous Integration) e Smoke Tests implementado para a plataforma Sônia.

## 📋 O que foi implementado?

### 1. **GitHub Actions Workflow** (`.github/workflows/ci-smoke-tests.yml`)

Um workflow automatizado que executa testes sempre que:
- Código é enviado para `main` ou `develop`
- Um Pull Request é criado
- Execução manual (via GitHub Actions UI)

### 2. **Scripts de Smoke Tests**

Scripts bash que podem ser executados localmente para verificar:
- **Backend**: Compilação, estrutura de arquivos, dependências
- **Frontend**: Compilação, estrutura de arquivos, dependências

## 🔍 O que são Smoke Tests?

**Smoke Tests** são testes básicos e rápidos que verificam se o sistema está funcionando minimamente. Eles não testam funcionalidades completas, mas garantem que:

- ✅ O código compila sem erros
- ✅ Arquivos críticos existem
- ✅ Dependências estão instaladas
- ✅ Estrutura do projeto está correta

São chamados de "smoke tests" porque, assim como verificar se há fumaça indica que algo está queimando, esses testes indicam se algo está fundamentalmente errado.

## 🏗️ Estrutura dos Jobs

O workflow do GitHub Actions executa 4 jobs em paralelo:

### Job 1: Backend Smoke Tests
- ✅ Instala dependências
- ✅ Compila TypeScript
- ✅ Verifica estrutura de arquivos críticos
- ✅ Verifica sintaxe TypeScript

### Job 2: Frontend Smoke Tests
- ✅ Instala dependências
- ✅ Compila com Vite
- ✅ Verifica estrutura de arquivos críticos
- ✅ Verifica se build foi gerado

### Job 3: SQL Functions Check
- ✅ Verifica se arquivos SQL críticos existem
- ✅ Verifica sintaxe SQL básica (sem executar)

### Job 4: Integrity Check
- ✅ Verifica estrutura geral do projeto
- ✅ Verifica dependências críticas

## 🚀 Como usar?

### Executar localmente (Backend)

```bash
cd BackEnd
chmod +x scripts/smoke-tests.sh
./scripts/smoke-tests.sh
```

### Executar localmente (Frontend)

```bash
cd FrontEnd
chmod +x scripts/smoke-tests.sh
./scripts/smoke-tests.sh
```

### Executar no GitHub Actions

1. Faça push para `main` ou `develop`
2. Ou crie um Pull Request
3. Ou vá em "Actions" no GitHub e clique em "Run workflow"

## 📊 O que é verificado?

### Backend
- ✅ Compilação TypeScript (`npm run build`)
- ✅ Arquivos críticos existem:
  - `src/index.ts`
  - `src/lib/supabase.ts`
  - `src/services/agents/chatwithAgent.ts`
  - `src/services/flows/flow-executor.ts`
  - `src/api/routes/agents.routes.ts`
  - `src/api/routes/flows.routes.ts`
- ✅ Dependências críticas instaladas:
  - `express`
  - `@supabase/supabase-js`
  - `openai`
- ✅ Sintaxe TypeScript (sem compilar)
- ✅ Arquivos SQL críticos existem

### Frontend
- ✅ Compilação Vite (`npm run build`)
- ✅ Arquivos críticos existem:
  - `src/main.tsx`
  - `src/App.tsx`
  - `src/pages/Insights.tsx`
  - `src/pages/Cockpit.tsx`
  - `src/pages/AgentsHub.tsx`
  - `src/services/api.ts`
- ✅ Dependências críticas instaladas:
  - `react`
  - `react-dom`
  - `vite`
  - `@supabase/supabase-js`
- ✅ Build gerado (`build/index.html`)
- ✅ Componentes críticos existem

## ⚙️ Por que isso é importante?

### 1. **Detecção Precoce de Problemas**
- Erros de compilação são detectados antes do deploy
- Problemas de dependências são identificados rapidamente
- Estrutura do projeto é validada automaticamente

### 2. **Confiança no Código**
- Garante que o código compila antes de ser mergeado
- Reduz bugs em produção
- Facilita code reviews (já sabe que compila)

### 3. **Automação**
- Não precisa testar manualmente a cada mudança
- Executa automaticamente em PRs
- Histórico de execuções no GitHub

### 4. **Documentação Viva**
- Os testes servem como documentação do que é crítico
- Mostra quais arquivos são essenciais
- Indica dependências importantes

## 🔄 Próximos Passos (Opcional)

Para tornar os testes ainda mais robustos, você pode adicionar:

1. **Testes de Integração**: Testar endpoints reais (requer banco de dados)
2. **Testes Unitários**: Testar funções individuais (Jest/Vitest)
3. **Testes E2E**: Testar fluxos completos (Playwright/Cypress)
4. **Linting**: Verificar qualidade do código (ESLint)
5. **Type Checking**: Verificação mais rigorosa de tipos

## 📝 Notas

- Os smoke tests **não** testam funcionalidades completas
- Eles **não** requerem banco de dados ou serviços externos
- São **rápidos** (executam em ~2-5 minutos)
- São **confiáveis** (não dependem de estado externo)

## 🐛 Troubleshooting

### Erro: "npm ci failed"
- Verifique se `package-lock.json` está atualizado
- Execute `npm install` localmente e faça commit do `package-lock.json`

### Erro: "Build failed"
- Verifique os logs do GitHub Actions
- Execute `npm run build` localmente para reproduzir o erro

### Erro: "File not found"
- Verifique se o arquivo foi commitado
- Verifique se o caminho está correto

## ✅ Critérios de Aceite (DoD)

Para considerar os smoke tests como "passando":
- ✅ Backend compila sem erros
- ✅ Frontend compila sem erros
- ✅ Todos os arquivos críticos existem
- ✅ Todas as dependências críticas estão instaladas
- ✅ Build é gerado com sucesso

---

**Status**: ✅ Implementado e funcionando
**Última atualização**: 2025-01-XX
