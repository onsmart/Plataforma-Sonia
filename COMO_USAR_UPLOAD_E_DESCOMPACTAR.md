# 📤 Como Fazer Upload e Descompactar BackEnd.zip

Guia rápido para fazer upload do BackEnd.zip para o servidor e descompactá-lo.

## 📦 Passo 1: Criar o BackEnd.zip (Local)

### Windows (PowerShell)

```powershell
cd "C:\Users\Carlos Dias\Plataformadeatendimentosonia"
Compress-Archive -Path BackEnd\* -DestinationPath BackEnd.zip -Force
```

### Linux/Mac

```bash
cd ~/Plataformadeatendimentosonia
zip -r BackEnd.zip BackEnd/
```

## 🚀 Passo 2: Fazer Upload para o Servidor

### Opção A: Script Automatizado (Recomendado)

**Windows:**
```cmd
upload-backend-zip.bat
```

**Linux/Mac:**
```bash
chmod +x upload-backend-zip.sh
./upload-backend-zip.sh
```

### Opção B: Comando Manual

**Windows (PowerShell/Git Bash):**
```bash
scp BackEnd.zip servidoronsmart@SEU_SERVIDOR:~/plataform-backend/
```

**Linux/Mac:**
```bash
scp BackEnd.zip servidoronsmart@SEU_SERVIDOR:~/plataform-backend/
```

**Substitua `SEU_SERVIDOR` pelo IP ou domínio do servidor.**

## 📂 Passo 3: Descompactar no Servidor

### Conectar ao Servidor

```bash
ssh servidoronsmart@SEU_SERVIDOR
cd ~/plataform-backend
```

### Opção A: Script Automatizado (Recomendado)

```bash
chmod +x BackEnd/scripts/descompactar-backend.sh
./BackEnd/scripts/descompactar-backend.sh
```

**OU se o arquivo foi descompactado na raiz:**

```bash
cd ~/plataform-backend
chmod +x descompactar-backend.sh
./descompactar-backend.sh
```

### Opção B: Comando Manual

```bash
# Verificar se unzip está instalado
which unzip || sudo apt-get install unzip

# Descompactar
unzip -o BackEnd.zip

# Remover ZIP (opcional)
rm BackEnd.zip
```

## ✅ Verificação

Após descompactar, verifique:

```bash
cd ~/plataform-backend
ls -la BackEnd/
```

Você deve ver:
- `package.json`
- `src/`
- `scripts/`
- `docker-compose.yml`
- etc.

## 🔧 Próximos Passos

Após descompactar:

```bash
cd ~/plataform-backend/BackEnd

# 1. Configurar .env
cp .env.example .env
nano .env

# 2. Instalar dependências
npm install

# 3. Compilar TypeScript
npm run build

# 4. Setup inicial (se primeira vez)
sudo ./scripts/setup-server.sh

# 5. Configurar Cloudflare Tunnel
sudo ./scripts/setup-cloudflare-tunnel.sh

# 6. Deploy
./scripts/deploy.sh
```

## 🐛 Troubleshooting

### Erro: "BackEnd.zip não encontrado"

- Verifique se você está na pasta correta
- Verifique se o arquivo foi enviado com sucesso: `ls -la BackEnd.zip`

### Erro: "unzip não encontrado"

```bash
# Ubuntu/Debian
sudo apt-get install unzip

# CentOS/RHEL
sudo yum install unzip
```

### Erro: "Permissão negada"

```bash
# Dar permissão de execução
chmod +x BackEnd/scripts/descompactar-backend.sh

# Ou executar com sudo (se necessário)
sudo ./BackEnd/scripts/descompactar-backend.sh
```

### Arquivo ZIP corrompido

- Verifique o tamanho do arquivo: `ls -lh BackEnd.zip`
- Tente fazer upload novamente
- Verifique a integridade: `unzip -t BackEnd.zip`

---

**Pronto! Seu BackEnd está no servidor e descompactado! 🎉**
