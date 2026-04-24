# Plataforma de Atendimento Sonia

## Deploy Rapido do BackEnd

Comando principal para atualizar o backend no servidor:

```powershell
.\deploy-backend-server.ps1
```

Atalho equivalente:

```powershell
.\deploy-backend-server.bat
```

Esse script:

- empacota o `BackEnd`
- envia para `servidoronsmart@192.168.15.31`
- remove a pasta antiga `BackEnd` no servidor
- remove arquivos antigos de deploy como `BackEnd.zip`, `BackEnd.deploy.zip` e `BackEnd.deploy.tar.gz`
- preserva o `.env`
- instala dependencias
- executa `npm run build`
- tenta reiniciar o processo por `pm2` ou `systemctl`

Para validar localmente antes do deploy:

```powershell
.\deploy-backend-server.ps1 -RunLocalTests -RunLocalBuild
```

Configuracao padrao atual do script:

- servidor: `servidoronsmart@192.168.15.31`
- pasta remota: `~/plataform-backend`
- processo backend: `backend`

Se o nome do processo mudar:

```powershell
.\deploy-backend-server.ps1 -Pm2Name "backend"
```

Se quiser forcar reinicio customizado:

```powershell
.\deploy-backend-server.ps1 -RemoteRestartCommand "sudo systemctl restart backend"
```

## Observacao Importante

Esse fluxo de deploy foi ajustado para evitar problemas comuns de Windows para Linux, incluindo:

- caminhos com espaco
- quebra de linha `CRLF`
- arquivos antigos acumulados no servidor
- substituicao completa da pasta `BackEnd`

## Voz por Agente

O projeto agora possui uma camada de voz por agente usando ElevenLabs no backend. A configuracao fica na tela do agente, nao em Integracoes.

Variaveis de ambiente novas no backend:

```env
ELEVENLABS_API_KEY=
ELEVENLABS_DEFAULT_MODEL_ID=
```

Detalhes de arquitetura, endpoints, preview, persistencia e status do WhatsApp audio/calling:

- [docs/voice-agent-elevenlabs.md](docs/voice-agent-elevenlabs.md)
