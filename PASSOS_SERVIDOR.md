# 🚀 Passos no Servidor - Guia Completo

## ✅ Upload Concluído!

O BackEnd.zip foi enviado com sucesso para o servidor.

## 📋 Próximos Passos no Servidor

### 1. Conectar ao Servidor

```bash
ssh servidoronsmart@192.168.15.31
```

### 2. Navegar para a Pasta

```bash
cd ~/plataform-backend
```

### 3. Verificar se o Arquivo Chegou

```bash
ls -lh BackEnd.zip
```

Você deve ver o arquivo BackEnd.zip listado.

### 4. Descompactar o BackEnd.zip

**Opção A: Usando o Script (Recomendado)**

```bash
# Se o script já está no servidor dentro do ZIP
unzip -o BackEnd.zip
cd BackEnd
chmod +x scripts/descompactar-backend.sh
cd ..
./BackEnd/scripts/descompactar-backend.sh
```

**Opção B: Manual (Mais Rápido)**

```bash
unzip -o BackEnd.zip
rm BackEnd.zip
```

### 5. Verificar Estrutura

```bash
ls -la BackEnd/
```

Você deve ver:
- `package.json`
- `src/`
- `scripts/`
- `docker-compose.yml`
- etc.

### 6. Configurar Variáveis de Ambiente

```bash
cd BackEnd
cp .env.example .env
nano .env
```

**Preencha as variáveis obrigatórias:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `EVOLUTION_API_URL=http://192.168.15.31:8081`
- `EVOLUTION_API_KEY`
- `REDIS_URL=redis://localhost:6379`
- `WEBHOOK_TUNNEL_URL` (será configurado depois do túnel)

Salve e saia: `Ctrl+X`, depois `Y`, depois `Enter`

### 7. Instalar Dependências

```bash
npm install
```

### 8. Compilar TypeScript

```bash
npm run build
```

### 9. Setup Inicial do Servidor (Primeira Vez)

```bash
sudo ./scripts/setup-server.sh
```

Isso vai instalar:
- Docker
- Docker Compose
- Node.js
- Configurar permissões

**⚠️ IMPORTANTE:** Após este passo, faça logout/login para aplicar permissões do Docker.

### 10. Configurar Cloudflare Tunnel

```bash
sudo ./scripts/setup-cloudflare-tunnel.sh
```

O script vai pedir:
- Nome do túnel (padrão: `sonia-platform-webhook`)
- Domínio (ex: `webhook.seudominio.com`)
- Porta do backend (padrão: `3333`)

### 11. Atualizar .env com URL do Túnel

```bash
nano .env
```

Adicione ou atualize:
```
WEBHOOK_TUNNEL_URL=https://webhook.seudominio.com/whatsapp/webhook
```

### 12. Primeiro Deploy

```bash
./scripts/deploy.sh
```

## 🔍 Verificação Final

```bash
# Ver status dos containers
docker-compose ps

# Ver logs
docker-compose logs -f

# Testar backend
curl http://localhost:3333/agents

# Testar Evolution API
curl http://192.168.15.31:8081
```

## 🐛 Problemas Comuns

### Erro: "unzip não encontrado"

```bash
sudo apt-get update
sudo apt-get install unzip
```

### Erro: "npm não encontrado"

```bash
# O setup-server.sh deve instalar, mas se não:
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Erro: "Docker não encontrado"

```bash
# Execute o setup-server.sh novamente
sudo ./scripts/setup-server.sh
```

### Erro de Permissão

```bash
# Dar permissão de execução aos scripts
chmod +x scripts/*.sh

# Verificar permissões
ls -la scripts/
```

---

**Pronto para começar! Execute os passos acima no servidor! 🚀**
