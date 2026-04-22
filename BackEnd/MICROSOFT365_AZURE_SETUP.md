# Configuracao Microsoft 365 no Azure / Entra

Este guia foi montado para configurar a integracao de Email Microsoft 365 deste projeto.

## O que o backend espera

O codigo atual usa OAuth 2.0 Authorization Code Flow com Microsoft Graph para:

- ler emails da inbox
- enviar emails
- identificar a mailbox conectada
- renovar sessao com refresh token

Variaveis usadas pelo backend:

```env
OUTLOOK_CLIENT_ID=
OUTLOOK_CLIENT_SECRET=
OUTLOOK_TENANT_ID=
OUTLOOK_REDIRECT_URI=
OUTLOOK_STATE_SECRET=
```

Escopos solicitados pelo projeto:

```text
offline_access Mail.Read Mail.Send User.Read
```

## Checklist rapido

1. Criar um App Registration no Microsoft Entra ID
2. Configurar a plataforma como `Web`
3. Adicionar o redirect URI correto
4. Criar um `Client Secret`
5. Garantir permissoes delegadas do Microsoft Graph
6. Copiar `Client ID`, `Tenant ID` e `Client Secret` para o `.env`
7. Reiniciar o backend
8. Testar a conexao pela tela de Integracoes

## Passo a passo no portal

### 1. Criar o app

No portal:

1. Acesse `https://entra.microsoft.com`
2. Entre em `Identity > Applications > App registrations`
3. Clique em `New registration`
4. Defina um nome, por exemplo:
   `SONIA Microsoft 365 Email`
5. Em `Supported account types`, use preferencialmente:
   `Accounts in this organizational directory only`

Observacao:

- para uso interno da sua empresa, o modo single-tenant e o mais seguro e simples
- se voce realmente precisar multi-tenant, pode usar outro tipo, mas o `.env` deve refletir isso

### 2. Salvar os IDs

Depois de criar:

- copie `Application (client) ID`
- copie `Directory (tenant) ID`

Eles vao para:

```env
OUTLOOK_CLIENT_ID=<Application client ID>
OUTLOOK_TENANT_ID=<Directory tenant ID>
```

Se quiser permitir contas de qualquer tenant, voce pode usar:

```env
OUTLOOK_TENANT_ID=common
```

Mas, para ambiente corporativo fechado, prefira o `tenant id` real.

### 3. Configurar Authentication

No app registration:

1. Entre em `Authentication`
2. Clique em `Add a platform`
3. Escolha `Web`
4. Adicione o redirect URI

#### Redirect URI local

Para desenvolvimento local com este projeto:

```text
http://localhost:3333/auth/outlook/callback
```

#### Redirect URI de producao

Se seu backend publico estiver, por exemplo, em:

```text
https://api.seudominio.com
```

o redirect fica:

```text
https://api.seudominio.com/auth/outlook/callback
```

No `.env`:

```env
OUTLOOK_REDIRECT_URI=http://localhost:3333/auth/outlook/callback
```

ou em producao:

```env
OUTLOOK_REDIRECT_URI=https://api.seudominio.com/auth/outlook/callback
```

Importante:

- o redirect URI do `.env` deve bater exatamente com o cadastrado no portal
- recomendo criar um app separado para `dev` e outro para `prod`

### 4. Criar o Client Secret

No app registration:

1. Entre em `Certificates & secrets`
2. Em `Client secrets`, clique em `New client secret`
3. Dê um nome
4. Escolha expiração
5. Copie imediatamente o valor

No `.env`:

```env
OUTLOOK_CLIENT_SECRET=<valor do secret>
```

Opcional, mas recomendado:

```env
OUTLOOK_STATE_SECRET=<uma string longa e aleatoria diferente do client secret>
```

Exemplo:

```env
OUTLOOK_STATE_SECRET=sonia_m365_state_uma_chave_bem_longa_e_unica
```

Se voce nao definir `OUTLOOK_STATE_SECRET`, o projeto usa o proprio `OUTLOOK_CLIENT_SECRET` como fallback.

## Permissoes da API

No app registration:

1. Entre em `API permissions`
2. Clique em `Add a permission`
3. Escolha `Microsoft Graph`
4. Escolha `Delegated permissions`
5. Adicione:

- `User.Read`
- `Mail.Read`
- `Mail.Send`

Sobre `offline_access`:

- ele e um escopo OIDC usado para receber `refresh token`
- o projeto solicita isso no fluxo OAuth
- se o portal mostrar `offline_access` nas permissoes de OpenID, pode adicionar tambem

### Admin consent

Para essas permissoes delegadas:

- `User.Read`: normalmente nao exige admin consent
- `Mail.Read`: normalmente nao exige admin consent na forma delegada
- `Mail.Send`: normalmente nao exige admin consent na forma delegada

Mesmo assim, em tenants corporativos com consentimento restrito, um admin pode precisar clicar em:

`Grant admin consent`

Se aparecer erro de consentimento na autenticacao, esse costuma ser o primeiro ponto para revisar.

## Arquivo `.env` pronto para preencher

Adicione estas chaves ao [BackEnd/.env](/C:/Users/Mateus%20Mantovani/Desktop/Projetos/Plataformadeatendimentosonia/BackEnd/.env):

```env
# Microsoft 365 / Outlook OAuth
OUTLOOK_CLIENT_ID=
OUTLOOK_CLIENT_SECRET=
OUTLOOK_TENANT_ID=
OUTLOOK_REDIRECT_URI=http://localhost:3333/auth/outlook/callback
OUTLOOK_STATE_SECRET=
```

### Exemplo local completo

```env
# Microsoft 365 / Outlook OAuth
OUTLOOK_CLIENT_ID=11111111-2222-3333-4444-555555555555
OUTLOOK_CLIENT_SECRET=seu_secret_aqui
OUTLOOK_TENANT_ID=66666666-7777-8888-9999-aaaaaaaaaaaa
OUTLOOK_REDIRECT_URI=http://localhost:3333/auth/outlook/callback
OUTLOOK_STATE_SECRET=sonia_local_m365_state_secret_2026
```

### Exemplo producao

```env
# Microsoft 365 / Outlook OAuth
OUTLOOK_CLIENT_ID=11111111-2222-3333-4444-555555555555
OUTLOOK_CLIENT_SECRET=seu_secret_aqui
OUTLOOK_TENANT_ID=66666666-7777-8888-9999-aaaaaaaaaaaa
OUTLOOK_REDIRECT_URI=https://api.seudominio.com/auth/outlook/callback
OUTLOOK_STATE_SECRET=sonia_prod_m365_state_secret_2026
```

## O que testar depois

### 1. Backend

Reinicie o backend depois de salvar o `.env`.

### 2. Tela

Na tela `Integracoes`:

1. selecione `Microsoft 365`
2. clique em `Conectar Microsoft 365`
3. autorize a conta
4. volte para a plataforma
5. clique em `Testar conexao`

### 3. Resultado esperado

Se estiver correto:

- a autenticacao abre normalmente
- o callback salva `access_token` e `refresh_token`
- a integracao fica com status conectado
- o teste de conexao valida leitura e envio via Graph

## Erros comuns

### `OUTLOOK_CLIENT_ID deve estar configurado`

Falta preencher o `.env` do backend.

### `AADSTS50011`

O redirect URI enviado pelo projeto nao bate com o cadastrado no app registration.

Revise:

- `OUTLOOK_REDIRECT_URI`
- `Authentication > Web > Redirect URIs`

### Login abre, mas nao renova token

Normalmente falta:

- `OUTLOOK_CLIENT_SECRET`
- `OUTLOOK_TENANT_ID`
- `offline_access` no fluxo de consentimento

### Usuario nao consegue consentir

O tenant pode bloquear consentimento de usuario. Nesse caso:

- um admin precisa conceder consentimento
- ou revisar a politica de consentimento do tenant

## Recomendacoes

- use um app registration separado para `dev` e `prod`
- use um `Client Secret` com rotacao programada
- para producao, o ideal e migrar depois para certificado em vez de secret
- mantenha o redirect URI explicito no `.env`

## Fontes oficiais

- App registration:
  https://learn.microsoft.com/en-us/graph/auth-register-app-v2
- Redirect URI:
  https://learn.microsoft.com/en-us/entra/identity-platform/how-to-add-redirect-uri
- Quickstart Entra app:
  https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app
- Authorization code flow para Microsoft Graph:
  https://learn.microsoft.com/en-us/graph/auth-v2-user
- Permissoes Microsoft Graph:
  https://learn.microsoft.com/en-us/graph/permissions-reference
- Client secret:
  https://learn.microsoft.com/en-us/entra/identity-platform/how-to-add-credentials
