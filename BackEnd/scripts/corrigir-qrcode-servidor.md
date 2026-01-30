# Como Corrigir QR Code no Servidor Linux

## Opção 1: Executar Script Diretamente no Servidor

```bash
# Conectar ao servidor
ssh servidoronsmart@SEU_IP

# Ir para a pasta do projeto
cd ~/plataform-backend/BackEnd

# Dar permissão de execução
chmod +x scripts/corrigir-qrcode.sh

# Executar
bash scripts/corrigir-qrcode.sh
```

## Opção 2: Comandos Manuais no Servidor

```bash
# 1. Listar instâncias
curl -X GET "http://192.168.15.31:8081/instance/fetchInstances" \
  -H "apikey: dRppeelqikQ1nUXTtaNtRRcQsQO15HPEvDRgqjnfkzi5E72t/U9Em5Ico9RDW34qaislql2yEM1edJ/6cSW/uA=="

# 2. Deletar instância (substitua NOME_DA_INSTANCIA)
curl -X DELETE "http://192.168.15.31:8081/instance/delete/NOME_DA_INSTANCIA" \
  -H "apikey: dRppeelqikQ1nUXTtaNtRRcQsQO15HPEvDRgqjnfkzi5E72t/U9Em5Ico9RDW34qaislql2yEM1edJ/6cSW/uA=="

# 3. Aguardar 5 segundos
sleep 5

# 4. Recriar instância
curl -X POST "http://192.168.15.31:8081/instance/create" \
  -H "apikey: dRppeelqikQ1nUXTtaNtRRcQsQO15HPEvDRgqjnfkzi5E72t/U9Em5Ico9RDW34qaislql2yEM1edJ/6cSW/uA==" \
  -H "Content-Type: application/json" \
  -d '{"instanceName": "NOME_DA_INSTANCIA", "token": "", "qrcode": true}'

# 5. Obter QR Code
curl -X GET "http://192.168.15.31:8081/instance/connect/NOME_DA_INSTANCIA" \
  -H "apikey: dRppeelqikQ1nUXTtaNtRRcQsQO15HPEvDRgqjnfkzi5E72t/U9Em5Ico9RDW34qaislql2yEM1edJ/6cSW/uA=="
```

## Opção 3: Se Houver Loop nos Logs

```bash
# 1. Parar containers
docker-compose down

# 2. Limpar volumes (CUIDADO: apaga todas as instâncias)
docker volume rm evolution_instances evolution_store

# 3. Subir novamente
docker-compose up -d

# 4. Aguardar 30 segundos
sleep 30

# 5. Criar nova instância
curl -X POST "http://192.168.15.31:8081/instance/create" \
  -H "apikey: dRppeelqikQ1nUXTtaNtRRcQsQO15HPEvDRgqjnfkzi5E72t/U9Em5Ico9RDW34qaislql2yEM1edJ/6cSW/uA==" \
  -H "Content-Type: application/json" \
  -d '{"instanceName": "SEU_NUMERO", "token": "", "qrcode": true}'
```
