# 🔍 Como Verificar se o Cloudflare Tunnel Está Funcionando

Guia rápido para verificar o status do túnel.

## ✅ Verificação Rápida

### 1. Verificar Status do Serviço

```bash
sudo systemctl status cloudflared
```

**Deve mostrar:**
- `Active: active (running)`
- Sem erros nos logs

### 2. Ver Logs Recentes

```bash
sudo journalctl -u cloudflared -f
```

**Deve mostrar:**
- Mensagens de conexão bem-sucedida
- Sem erros de conexão

### 3. Verificar Processo

```bash
ps aux | grep cloudflared
```

**Deve mostrar:**
- Processo `cloudflared` rodando

### 4. Testar URL do Túnel

```bash
# Substitua pelo seu domínio
curl https://webhook.onsmart.ai.com/whatsapp/webhook
```

**Deve retornar:**
- HTTP 404 (rota não encontrada, mas túnel funcionando)
- Ou HTTP 200 (se o webhook responder)

## 🚀 Script Automatizado

Execute o script de verificação:

```bash
cd ~/plataform-backend/BackEnd
chmod +x scripts/verificar-tunel.sh
./scripts/verificar-tunel.sh
```

## 📋 Checklist de Verificação

- [ ] Serviço `cloudflared` está ativo
- [ ] Logs não mostram erros
- [ ] Processo está rodando
- [ ] URL do túnel responde (mesmo que 404)
- [ ] Backend está rodando em `localhost:3333`

## 🐛 Problemas Comuns

### Túnel não está rodando

```bash
# Iniciar serviço
sudo systemctl start cloudflared
sudo systemctl enable cloudflared

# Verificar status
sudo systemctl status cloudflared
```

### Erro de conexão nos logs

```bash
# Ver logs detalhados
sudo journalctl -u cloudflared -n 50

# Verificar configuração
cat ~/.cloudflared/config.yml
```

### URL não responde

1. Verificar se o túnel está rodando
2. Verificar se o domínio está configurado corretamente
3. Verificar se o backend está rodando em `localhost:3333`
4. Verificar DNS do domínio

## 🔧 Comandos Úteis

```bash
# Reiniciar túnel
sudo systemctl restart cloudflared

# Ver logs em tempo real
sudo journalctl -u cloudflared -f

# Parar túnel
sudo systemctl stop cloudflared

# Ver configuração
cat ~/.cloudflared/config.yml

# Testar URL
curl -v https://webhook.onsmart.ai.com/whatsapp/webhook
```

---

**Execute o script de verificação para diagnóstico completo!**
