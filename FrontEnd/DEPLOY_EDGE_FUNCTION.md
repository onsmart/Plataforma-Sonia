# 🚀 Como Fazer Deploy da Edge Function

A Edge Function do Supabase precisa ser deployada **separadamente** do frontend. Executar apenas o frontend **NÃO atualiza** a Edge Function.

## 📋 Opção 1: Via Supabase Dashboard (Mais Fácil)

1. Acesse o [Supabase Dashboard](https://app.supabase.com)
2. Selecione seu projeto
3. Vá em **"Edge Functions"** no menu lateral
4. Clique na função **`make-server-eeb342a4`**
5. Clique em **"Deploy"** ou **"Update"**
6. Aguarde o deploy concluir

## 📋 Opção 2: Via Supabase CLI (Recomendado para Desenvolvimento)

### Pré-requisitos

1. Instalar Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Fazer login:
   ```bash
   supabase login
   ```

### Deploy

No diretório `FrontEnd`, execute:

```bash
supabase functions deploy make-server-eeb342a4 --project-ref rmfbkyntvkpettjtgaws
```

Ou use o script npm:

```bash
npm run deploy:function
```

## ⚠️ IMPORTANTE

- **Sempre faça deploy da Edge Function após alterar** `FrontEnd/src/supabase/functions/server/index.tsx`
- O frontend pode estar rodando, mas a Edge Function só será atualizada após o deploy
- Os logs da Edge Function aparecem no Supabase Dashboard em **"Edge Functions" > "Logs"**

## 🔍 Verificar se o Deploy Funcionou

1. Acesse o Supabase Dashboard
2. Vá em **"Edge Functions" > "Logs"**
3. Faça uma requisição ao endpoint `/dashboard`
4. Verifique se os logs aparecem (especialmente `[DASHBOARD] ⚡ FUNÇÃO CHAMADA ⚡`)
