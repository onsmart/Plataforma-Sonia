# Voz por agente com ElevenLabs

## Visao geral

A configuracao de voz agora pertence ao agente e aparece na tela de configuracao do agente no frontend, em `FrontEnd/src/pages/AgentConfig.tsx`, usando o componente `AgentVoiceSettings`.

O backend expoe a camada de voz em `BackEnd/src/modules/voice/` e mantem a chave da ElevenLabs somente no servidor.

## Variaveis de ambiente

Adicionar no backend:

```env
ELEVENLABS_API_KEY=
ELEVENLABS_DEFAULT_MODEL_ID=
```

- `ELEVENLABS_API_KEY`: chave privada usada apenas no backend para listar vozes, gerar preview e gerar audio final.
- `ELEVENLABS_DEFAULT_MODEL_ID`: modelo padrao usado quando o agente nao define um `modelId` proprio.

## Persistencia

Foi adicionada a tabela `tb_agent_voice_profiles` com migracoes em:

- `BackEnd/database/migrations/MIGRATION_AGENT_VOICE_PROFILES.sql`
- `supabase/migrations/20260424103000_agent_voice_profiles.sql`
- `docs/sql/2026-04-24-agent-voice-profiles.sql`

Ela persiste a voz por agente com `agent_id`, `voice_id`, `model_id`, parametros de sintese, `preview_text` e `enabled`.

## Endpoints

- `GET /agents/:agentId/voice-profile`
- `PUT /agents/:agentId/voice-profile`
- `POST /agents/:agentId/voice-preview`
- `POST /agents/:agentId/generate-voice-response`
- `GET /voice/elevenlabs/voices`

Todos usam autenticacao existente do backend. A API key nunca vai para o frontend.

## Fluxo de configuracao

1. O usuario abre a configuracao do agente.
2. Na secao `Voz do Agente`, o frontend carrega o perfil salvo e a lista de vozes da ElevenLabs via backend.
3. O usuario escolhe a voz, ajusta estabilidade, similarity boost, style e speaker boost.
4. O botao `Ouvir voz` chama o endpoint de preview e reproduz o audio na propria tela.
5. O botao `Salvar` persiste o perfil de voz do agente no Supabase.

## WhatsApp audio

O runtime de voz ja foi conectado aos principais pontos onde respostas de agente seguem para o WhatsApp. O comportamento atual e progressivo:

- se houver suporte real a envio de audio por midia, o projeto pode registrar um `WhatsAppMediaSender` no runtime;
- se o sender nao existir, o backend faz fallback para texto sem quebrar a conversa;
- se a geracao de audio falhar, o backend tambem faz fallback para texto;
- a conversao de audio para WhatsApp usa `ffmpeg` quando necessario, via `audioConversion.service.ts`.

Hoje o repositorio ainda nao implementa o sender real de audio do WhatsApp Cloud API, entao o fallback para texto continua sendo o comportamento padrao seguro.

## WhatsApp Calling API e realtime

O projeto ainda nao conecta chamadas de voz do WhatsApp em tempo real. Para nao simular suporte inexistente, foram deixados contratos explicitos em `voice.types.ts` e `voiceRuntime.service.ts`:

- `VoiceCallSession`
- `VoiceCallProvider`
- `WhatsAppCallingProvider`
- `RealtimeVoiceAgentService`

Tambem existe `UnsupportedRealtimeVoiceAgentService` com TODO explicito para a futura integracao.

## Limitacoes atuais

- STT/transcricao da ElevenLabs ainda nao foi conectada ao fluxo real do projeto.
- O envio real de audio pelo WhatsApp ainda depende de um sender de midia do canal.
- Conversao para `ogg/opus` exige `ffmpeg` disponivel no ambiente onde o backend roda.

## Testes adicionados

Foram adicionados testes em Vitest para:

- provider da ElevenLabs com `fetch` mockado;
- persistencia do perfil de voz do agente;
- geracao de preview;
- controllers de voz;
- fallback de runtime para texto no fluxo WhatsApp.
