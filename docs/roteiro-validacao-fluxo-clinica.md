# Roteiro de Validacao - Fluxo da Clinica

Este roteiro foi preparado para validar o fluxo principal da clinica e os subfluxos com foco em:

- ordem entre fluxo principal e subfluxos;
- diferenca entre `fim do fluxo` e `fim do subfluxo`;
- comportamento dos caminhos principais de negocio;
- prontidao minima para testes manuais com integracoes reais.

## 1. Pre-validacao

Antes de iniciar os testes manuais, confirme:

- o backend esta rodando na porta `3333`;
- o frontend esta abrindo normalmente;
- o fluxo da clinica ja foi provisionado com `npx tsx scripts/seed-medical-clinic-demo.ts`;
- existe pelo menos uma integracao Calendly ativa;
- se for testar handoff operacional, `TEAM_NOTIFY_EMAIL` e/ou `TEAM_NOTIFY_WHATSAPP` estao configurados.

Observacoes:

- HubSpot e email podem ficar vazios para validar estrutura e navegacao do fluxo;
- Calendly real e obrigatorio para validar o caminho completo de agendamento;
- WhatsApp Meta com webhook publico so e obrigatorio para testes reais no canal WhatsApp.

## 2. O que ja foi validado tecnicamente

Checklist executado nesta validacao:

- build do backend com `npm.cmd run build`;
- build do frontend com `npm.cmd run build`;
- testes automatizados:
  - `src/__test__/flow-executor.test.ts`
  - `src/__test__/flow-channel-runtime.test.ts`
  - `src/__test__/whatsapp-flow-message.service.test.ts`

Cobertura relevante desses testes:

- execucao de fluxo simples e subfluxos;
- subfluxos encadeados com compartilhamento de contexto;
- diferenca entre `stop` do fluxo principal e `stop` de subfluxo;
- injecao de contexto do canal WhatsApp;
- envio de mensagens 24h e protecao contra entrega duplicada;
- notificacao de handoff humano por WhatsApp.

## 3. Roteiro manual no editor

### 3.1 Estrutura do fluxo

1. Abrir a tela de fluxos.
2. Selecionar o fluxo principal da clinica.
3. Confirmar que os subfluxos da familia aparecem vinculados ao fluxo principal.
4. Abrir cada subfluxo principal:
   - cadastro e triagem;
   - agendamento;
   - remarcacao;
   - cancelamento;
   - documentos;
   - especialidades;
   - handoff humano;
   - follow-ups.

Resultado esperado:

- o fluxo principal mostra blocos `subflow` apontando para os subfluxos corretos;
- cada subfluxo abre sem perder o vinculo com o fluxo principal;
- os blocos de parada dentro de subfluxos aparecem como `Fim do subfluxo`;
- os blocos de parada do fluxo principal aparecem como `Fim do fluxo`.

### 3.2 Semantica do fim

1. Entrar em um subfluxo.
2. Localizar o bloco `Fim do subfluxo`.
3. Voltar ao fluxo principal.
4. Verificar qual bloco vem depois do bloco `subflow` correspondente.

Resultado esperado:

- `Fim do subfluxo` significa apenas encerramento daquela etapa reutilizavel;
- quando o bloco `subflow` no fluxo pai tiver proximo node conectado, a execucao continua no fluxo principal;
- `Fim do fluxo` so deve existir onde a intencao e realmente encerrar aquela linha do fluxo principal.

## 4. Cenarios funcionais da clinica

### Cenario A - Agendamento com continuidade correta

Entrada sugerida:

- mensagem de abertura pedindo consulta;
- dados suficientes para cadastro;
- especialidade conhecida;
- horario escolhido entre os slots retornados.

Validar:

- o fluxo entra no subfluxo de intake;
- sai do intake e volta ao fluxo principal;
- segue para o subfluxo de agendamento;
- ao terminar o subfluxo de agendamento, volta ao fluxo principal sem encerrar tudo antes da hora;
- se houver confirmacao e follow-up conectados, eles permanecem no caminho esperado.

### Cenario B - Remarcacao

Entrada sugerida:

- paciente informa que deseja remarcar;
- informa dado suficiente para localizar a consulta;
- informa nova preferencia de horario.

Validar:

- o fluxo vai direto ao subfluxo de remarcacao;
- `Fim do subfluxo` nao deve ser interpretado como encerramento total do fluxo pai;
- a mensagem final do caminho faz sentido para remarcacao concluida ou falha com handoff.

### Cenario C - Cancelamento

Entrada sugerida:

- paciente pede cancelamento;
- informa email/telefone cadastrado;
- informa consulta alvo se necessario.

Validar:

- o fluxo chama o subfluxo de cancelamento;
- o retorno do subfluxo respeita o fluxo pai;
- em falha, o handoff e disparado sem quebrar a execucao.

### Cenario D - Documentos

Entrada sugerida:

- paciente envia pedido, exame ou documento;
- ou entra no caminho de documentos sem anexo.

Validar:

- sem arquivo, o status fica em `pending_upload`;
- com arquivo, o bloco de intake registra `received`;
- o caminho de handoff/notificacao da equipe acontece conforme configurado.

### Cenario E - Humano / urgencia

Entrada sugerida:

- paciente pede uma pessoa;
- ou descreve sinal de urgencia.

Validar:

- o fluxo roteia para handoff humano;
- se houver urgencia, a priorizacao e preservada;
- notificacao interna por email/WhatsApp ocorre quando configurada;
- o bloco de handoff nao se confunde com `fim do fluxo`.

## 5. Cenarios de aceite rapido

Considere o fluxo apto para teste manual real quando todos estes pontos estiverem verdadeiros:

- o editor diferencia visualmente `Fim do fluxo` e `Fim do subfluxo`;
- um subfluxo encerrado retorna ao fluxo pai quando existe proximo node conectado;
- o caminho de agendamento nao encerra o fluxo principal cedo demais;
- remarcacao e cancelamento entram nos subfluxos corretos;
- documentos e handoff humano nao quebram a execucao;
- backend e frontend compilam sem erro;
- testes automatizados de executor/runtime/mensagem WhatsApp passam.

## 6. Limites desta validacao

Esta validacao nao substitui testes reais de integracao externa. Ainda e necessario validar manualmente quando quiser confirmar:

- slots reais do Calendly;
- webhook publico do Calendly;
- webhook e templates da Meta;
- notificacoes operacionais em email/WhatsApp com integracoes reais;
- comportamento real de CRM em HubSpot.
