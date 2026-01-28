# Como Atualizar o Código no Servidor

## 📋 Resumo

Existem **2 formas** de atualizar o código no servidor:

1. **Via Git** (se o projeto estiver em um repositório Git)
2. **Via Upload de Arquivos** (BackEnd.zip)

---

## 🔄 Opção 1: Via Git (Recomendado se usar Git)

### Como Funciona

O script `deploy.sh` verifica automaticamente se o projeto está em um repositório Git:

```bash
# Linha 142-152 do deploy.sh
if [ -d ".git" ]; then
    log "Atualizando código do Git..."
    git pull || warn "Falha ao fazer git pull (continuando...)"
else
    warn "Diretório não é um repositório Git. Pulando atualização de código."
fi
```

### Processo Completo

1. **No seu PC (Windows):**
   ```bash
   # Fazer commit e push das alterações
   git add .
   git commit -m "Atualização do código"
   git push origin main
   ```

2. **No Servidor:**
   ```bash
   cd ~/plataform-backend/BackEnd
   bash scripts/deploy.sh
   ```

3. **O que o deploy.sh faz:**
   - ✅ Verifica se existe `.git` (repositório Git)
   - ✅ Se existir: executa `git pull` (baixa as alterações)
   - ✅ Instala dependências: `npm install`
   - ✅ Compila TypeScript: `npm run build`
   - ✅ Reinicia containers Docker
   - ✅ Verifica saúde dos serviços

### Vantagens
- ✅ Automático
- ✅ Rastreável (histórico Git)
- ✅ Mais rápido
- ✅ Pode fazer rollback fácil

### Desvantagens
- ❌ Precisa configurar Git no servidor
- ❌ Precisa ter repositório remoto (GitHub, GitLab, etc.)

---

## 📦 Opção 2: Via Upload de Arquivos (Atual)

### Como Funciona

Você compacta o código no seu PC e envia para o servidor via SCP.

### Processo Completo

1. **No seu PC (Windows):**
   ```cmd
   # Compactar o BackEnd
   cd C:\Users\Carlos Dias\Plataformadeatendimentosonia
   Compress-Archive -Path BackEnd\* -DestinationPath BackEnd.zip -Force
   
   # Enviar para o servidor
   .\upload-backend-zip.bat
   ```

2. **No Servidor:**
   ```bash
   # Descompactar
   cd ~/plataform-backend
   unzip -o BackEnd.zip
   rm BackEnd.zip
   
   # Executar deploy
   cd BackEnd
   bash scripts/deploy.sh
   ```

3. **O que o deploy.sh faz:**
   - ⚠️ Detecta que não é Git (pula `git pull`)
   - ✅ Instala dependências: `npm install`
   - ✅ Compila TypeScript: `npm run build`
   - ✅ Reinicia containers Docker
   - ✅ Verifica saúde dos serviços

### Vantagens
- ✅ Não precisa de Git
- ✅ Funciona sempre
- ✅ Controle total sobre o que envia

### Desvantagens
- ❌ Processo manual (2 passos)
- ❌ Mais lento
- ❌ Não tem histórico de versões

---

## 🎯 Qual Usar?

### Use Git se:
- ✅ Projeto está em repositório Git (GitHub, GitLab, etc.)
- ✅ Quer atualizações mais rápidas
- ✅ Quer histórico de versões

### Use Upload se:
- ✅ Projeto não está em Git
- ✅ Quer controle manual
- ✅ Não quer configurar Git no servidor

---

## 📝 Exemplo Prático: Atualização Via Upload

### Passo a Passo Completo

**1. No seu PC (Windows):**
```cmd
# Ir para a pasta do projeto
cd C:\Users\Carlos Dias\Plataformadeatendimentosonia

# Compactar BackEnd
Compress-Archive -Path BackEnd\* -DestinationPath BackEnd.zip -Force

# Enviar para servidor
.\upload-backend-zip.bat
# Digite: servidoronsmart@192.168.15.31
# Digite: ~/plataform-backend
```

**2. No Servidor (via SSH):**
```bash
# Conectar ao servidor
ssh servidoronsmart@192.168.15.31

# Ir para a pasta
cd ~/plataform-backend

# Descompactar (sobrescreve arquivos antigos)
unzip -o BackEnd.zip

# Remover zip
rm BackEnd.zip

# Ir para BackEnd
cd BackEnd

# Executar deploy (instala, compila, reinicia)
bash scripts/deploy.sh
```

**3. Pronto!** O código está atualizado e rodando.

---

## 🔍 O que o `deploy.sh` faz internamente?

```bash
1. ✅ Valida pré-requisitos (Docker, Node.js, npm)
2. ✅ Cria backup automático (opcional)
3. ✅ Atualiza código:
   - Se tem .git → git pull
   - Se não tem → pula (você já enviou os arquivos)
4. ✅ Instala dependências: npm install
5. ✅ Compila TypeScript: npm run build
6. ✅ Atualiza docker-compose.yml (webhook URL)
7. ✅ Para containers: docker-compose down
8. ✅ Atualiza imagens: docker-compose pull
9. ✅ Inicia containers: docker-compose up -d
10. ✅ Verifica saúde dos serviços
11. ✅ Testa webhook (se configurado)
```

---

## 💡 Dica: Automatizar com Git

Se quiser usar Git no futuro:

```bash
# No servidor, configurar Git
cd ~/plataform-backend/BackEnd
git init
git remote add origin https://github.com/seu-usuario/seu-repo.git
git pull origin main

# Agora o deploy.sh vai usar git pull automaticamente!
```

---

## 🚀 Opção 3: Script Automático (MAIS FÁCIL!)

Criei um script que faz **TUDO automaticamente**:

### No Servidor:

```bash
cd ~/plataform-backend
chmod +x BackEnd/scripts/atualizar-tudo.sh
bash BackEnd/scripts/atualizar-tudo.sh
```

### O que ele faz:

1. ✅ Verifica se `BackEnd.zip` existe
2. ✅ Cria backup automático
3. ✅ Descompacta o zip
4. ✅ Executa `deploy.sh` automaticamente
5. ✅ Pronto!

### Processo Completo Simplificado:

**No seu PC:**
```cmd
Compress-Archive -Path BackEnd\* -DestinationPath BackEnd.zip -Force
.\upload-backend-zip.bat
```

**No Servidor:**
```bash
bash BackEnd/scripts/atualizar-tudo.sh
```

**Pronto!** Tudo atualizado automaticamente! 🎉

---

## 📞 Resumo Rápido

**Opção Mais Fácil (Recomendada):**
1. PC: Compactar → Enviar
2. Servidor: `bash BackEnd/scripts/atualizar-tudo.sh` (faz tudo!)

**Opção Manual:**
1. PC: Compactar → Enviar
2. Servidor: Descompactar → Deploy

**Futuro (Git):**
1. PC: Commit → Push
2. Servidor: Deploy (faz git pull automaticamente)
