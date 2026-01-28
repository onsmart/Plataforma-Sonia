# 🔄 Como Atualizar o Servidor

Guia rápido para atualizar arquivos alterados no servidor.

## 📋 Arquivos que foram alterados

1. `package.json` - Adicionado pacote `openai`
2. `src/index.ts` - Removidas extensões .js dos imports
3. `src/services/integrations/whatsapp/whatsapp.service.ts` - Corrigido tipo de retorno

## 🚀 Opção 1: Upload apenas dos arquivos alterados (Mais Rápido)

### No seu computador (Windows):

```powershell
cd "C:\Users\Carlos Dias\Plataformadeatendimentosonia\BackEnd"

# Fazer upload dos arquivos alterados
scp package.json servidoronsmart@192.168.15.31:~/plataform-backend/BackEnd/
scp src/index.ts servidoronsmart@192.168.15.31:~/plataform-backend/BackEnd/src/
scp src/services/integrations/whatsapp/whatsapp.service.ts servidoronsmart@192.168.15.31:~/plataform-backend/BackEnd/src/services/integrations/whatsapp/
```

### No servidor, depois do upload:

```bash
# Instalar nova dependência (openai)
cd ~/plataform-backend/BackEnd
npm install

# Compilar novamente
npm run build
```

## 🚀 Opção 2: Upload do BackEnd.zip completo (Mais Seguro)

### No seu computador:

```powershell
# 1. Criar novo ZIP com as correções
cd "C:\Users\Carlos Dias\Plataformadeatendimentosonia"
Compress-Archive -Path BackEnd\* -DestinationPath BackEnd.zip -Force

# 2. Fazer upload
scp BackEnd.zip servidoronsmart@192.168.15.31:~/plataform-backend/
```

### No servidor:

```bash
# 1. Fazer backup (opcional)
cd ~/plataform-backend/BackEnd
cp -r dist dist.backup

# 2. Descompactar (sobrescrever)
cd ~/plataform-backend
unzip -o BackEnd.zip

# 3. Instalar dependências
cd BackEnd
npm install

# 4. Compilar
npm run build

# 5. Remover ZIP (opcional)
rm BackEnd.zip
```

## 🚀 Opção 3: Script Automatizado (Recomendado)

Crie um arquivo `atualizar-servidor.bat` no seu computador:

```batch
@echo off
echo Fazendo upload dos arquivos alterados...

scp package.json servidoronsmart@192.168.15.31:~/plataform-backend/BackEnd/
scp src/index.ts servidoronsmart@192.168.15.31:~/plataform-backend/BackEnd/src/
scp src/services/integrations/whatsapp/whatsapp.service.ts servidoronsmart@192.168.15.31:~/plataform-backend/BackEnd/src/services/integrations/whatsapp/

echo.
echo Upload concluido!
echo.
echo Agora no servidor, execute:
echo   cd ~/plataform-backend/BackEnd
echo   npm install
echo   npm run build
pause
```

## ✅ Verificação no Servidor

Depois de atualizar, verifique:

```bash
cd ~/plataform-backend/BackEnd

# Verificar se openai foi instalado
grep openai package.json
npm list openai

# Compilar
npm run build

# Se compilou com sucesso, iniciar
npm run dev
```

## 🔄 Para Futuras Atualizações

Use o script de deploy que já criamos:

```bash
# No servidor
cd ~/plataform-backend/BackEnd
./scripts/deploy.sh
```

---

**Escolha a opção que preferir! A Opção 1 é mais rápida para atualizações pequenas.**
