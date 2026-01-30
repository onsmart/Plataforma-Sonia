# ✅ Como Verificar se Está Funcionando

Guia completo para verificar se tudo está funcionando corretamente.

## 🚀 Teste Rápido

### 1. Backend Local

```bash
curl http://localhost:3333/agents
```

**Deve retornar:** JSON com lista de agentes ou erro do backend (não erro de conexão)

### 2. Túnel Cloudflare

```bash
curl https://webhook.onsmart.ai/whatsapp/webhook
```

**Deve retornar:**
- HTTP 200 = ✅ Tudo funcionando!
- HTTP 404 = ⚠️ Túnel funciona, mas backend não está rodando ou rota não existe
- Erro de conexão = ❌ Túnel não está funcionando

### 3. Evolution API

```bash
curl http://192.168.15.31:8081
```

**Deve retornar:** Resposta da Evolution API

## 🔍 Script Automatizado (Recomendado)

Execute o script de teste completo:

```bash
cd ~/plataform-backend/BackEnd
chmod +x scripts/testar-tudo.sh
./scripts/testar-tudo.sh
```

O script verifica:
- ✅ Backend local
- ✅ Túnel Cloudflare
- ✅ URL do túnel
- ✅ Evolution API
- ✅ Containers Docker
- ✅ Webhook com POST

## 📋 Checklist Manual

### Backend

```bash
# Verificar se está rodando
ps aux | grep "node.*index"

# Ver logs
cd ~/plataform-backend/BackEnd
npm run dev
# (deve mostrar: "🚀 Backend rodando em http://localhost:3333")
```

### Túnel

```bash
# Ver status
sudo systemctl status cloudflared

# Ver logs
sudo journalctl -u cloudflared -n 20
```

### Docker

```bash
# Ver containers
docker-compose ps

# Ver logs
docker-compose logs evolution-api
```

## 🧪 Teste Completo do Webhook

### 1. Iniciar Backend

```bash
cd ~/plataform-backend/BackEnd
npm run dev
```

### 2. Em outro terminal, testar webhook

```bash
curl -X POST https://webhook.onsmart.ai/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "messages.upsert",
    "instance": "test",
    "data": {
      "key": {
        "remoteJid": "5511999999999@s.whatsapp.net",
        "fromMe": false
      },
      "message": {
        "conversation": "Teste"
      }
    }
  }'
```

**Deve retornar:** HTTP 200 ou resposta do backend

### 3. Verificar logs do backend

No terminal onde o backend está rodando, você deve ver logs do webhook sendo recebido.

## ✅ Sinais de que Está Funcionando

1. ✅ `curl http://localhost:3333/agents` retorna JSON
2. ✅ `curl https://webhook.onsmart.ai/whatsapp/webhook` retorna HTTP 200 ou 404 (não erro de conexão)
3. ✅ Backend mostra logs quando recebe requisições
4. ✅ Túnel mostra "Registered tunnel connection" nos logs
5. ✅ Evolution API responde em `http://192.168.15.31:8081`

## 🐛 Se Não Estiver Funcionando

### Backend não responde

```bash
# Verificar se está rodando
ps aux | grep node

# Iniciar
cd ~/plataform-backend/BackEnd
npm run dev
```

### Túnel não funciona

```bash
# Reiniciar
sudo systemctl restart cloudflared

# Ver logs
sudo journalctl -u cloudflared -f
```

### URL retorna erro

```bash
# Verificar DNS
dig webhook.onsmart.ai

# Verificar configuração
cat ~/.cloudflared/config.yml
```

---

**Execute o script de teste para verificação completa!**
