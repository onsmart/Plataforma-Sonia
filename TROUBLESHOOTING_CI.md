# 🔍 Troubleshooting - CI + Smoke Tests

## Status Atual

Baseado no email que você recebeu:
- ✅ **SQL Functions - Sintaxe**: Passou (15 segundos)
- ✅ **Integridade - Estrutura e Dependências**: Passou (11 segundos)
- ❌ **Backend - Compilação e Estrutura**: Falhou (15 segundos)
- ❌ **Frontend - Compilação e Estrutura**: Falhou (20 segundos)

## 🔴 Possíveis Causas das Falhas

### 1. **Backend - Compilação TypeScript**

**Problemas comuns:**
- Erros de sintaxe TypeScript
- Dependências faltando no `package.json`
- Tipos faltando (`@types/*`)
- Imports quebrados

**Como verificar localmente:**
```bash
cd BackEnd
npm install
npm run build
```

**O que procurar:**
- Erros como `Cannot find module`
- Erros como `Property does not exist`
- Erros de tipo TypeScript

### 2. **Frontend - Compilação Vite**

**Problemas comuns:**
- Erros de sintaxe JSX/TSX
- Dependências faltando
- Variáveis de ambiente faltando (mas já temos placeholders)
- Imports quebrados
- Problemas com plugins do Vite

**Como verificar localmente:**
```bash
cd FrontEnd
npm install
npm run build
```

**O que procurar:**
- Erros de compilação do Vite
- Erros de import
- Erros de tipo TypeScript

## 🔧 Como Diagnosticar

### Passo 1: Ver os Logs Detalhados

1. Vá no GitHub → **Actions**
2. Clique no workflow que falhou
3. Clique no job que falhou (ex: "Backend - Compilação e Estrutura")
4. Expanda os steps para ver os erros específicos

### Passo 2: Testar Localmente

**Backend:**
```bash
cd BackEnd
npm ci  # Instala dependências exatamente como no CI
npm run build  # Tenta compilar
```

**Frontend:**
```bash
cd FrontEnd
npm ci  # Instala dependências exatamente como no CI
npm run build  # Tenta compilar
```

### Passo 3: Verificar Erros Comuns

#### Erro: "Cannot find module"
**Solução:** Verifique se a dependência está no `package.json` e execute `npm install`

#### Erro: "Property does not exist on type"
**Solução:** Pode ser um erro de tipo TypeScript. Verifique se os tipos estão corretos.

#### Erro: "Module not found"
**Solução:** Verifique se o caminho do import está correto.

#### Erro: "Build failed"
**Solução:** Veja os logs completos para identificar o erro específico.

## 📋 Checklist de Verificação

Antes de fazer push, verifique:

- [ ] Backend compila localmente (`cd BackEnd && npm run build`)
- [ ] Frontend compila localmente (`cd FrontEnd && npm run build`)
- [ ] Todos os arquivos críticos existem
- [ ] `package-lock.json` está commitado
- [ ] Não há erros de sintaxe TypeScript
- [ ] Todas as dependências estão no `package.json`

## 🚀 Próximos Passos

1. **Veja os logs detalhados no GitHub Actions**
   - Vá em Actions → Clique no workflow → Veja os erros específicos

2. **Teste localmente**
   - Execute `npm run build` em ambos os diretórios
   - Corrija os erros que aparecerem

3. **Faça commit e push novamente**
   - O workflow executará automaticamente
   - Agora com mais informações sobre o que está falhando

## 💡 Dica

O workflow agora está configurado para:
- ✅ Continuar mesmo se a compilação falhar (para ver outros erros)
- ✅ Mostrar exatamente quais arquivos estão faltando
- ✅ Dar mensagens de erro mais claras

Isso ajuda a identificar o problema específico que está causando a falha.

## 📞 Se Precisar de Ajuda

Envie:
1. Os logs completos do GitHub Actions (copie e cole)
2. O resultado de `npm run build` localmente
3. Qualquer erro específico que aparecer

Assim posso ajudar a identificar e corrigir o problema exato!
