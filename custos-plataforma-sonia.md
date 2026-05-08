# Custos Da Plataforma Sonia

Pessoal, segue um resumo dos principais servicos da plataforma Sonia que podem gerar custo operacional, explicando **de onde vem cada gasto** e quais processos mais impactam a fatura.

Os valores foram levantados em fontes oficiais dos provedores e podem mudar conforme cambio, impostos, pais, volume contratado e atualizacoes das plataformas.

---

## Resumo Dos Principais Custos

- **WhatsApp Meta:** cobra principalmente por templates entregues, especialmente campanhas de marketing.
- **OpenAI:** cobra por uso de IA em texto, embeddings e transcricao de audio.
- **Anthropic Claude:** cobra por tokens quando usado para refinar descricoes ou fluxos.
- **ElevenLabs:** cobra por creditos/minutos/caracteres na geracao de voz da IA.
- **Supabase:** cobra por banco, storage, trafego, usuarios ativos, compute e funcoes.
- **Stripe:** cobra taxas sobre pagamentos recebidos.
Principais pontos de atencao:

- **Campanhas de WhatsApp Marketing** podem escalar custo rapidamente.
- **Voz com IA** pode somar OpenAI + ElevenLabs + infraestrutura.
- **Historico longo em conversas com IA** aumenta tokens e encarece respostas.

---

## 1. Meta WhatsApp Cloud API

**Fonte oficial:** https://developers.facebook.com/docs/whatsapp/pricing

Usado para atendimento via WhatsApp, envio de templates, campanhas e comunicacao ativa com clientes.

O gasto vem do **envio de templates entregues ao usuario**. Desde julho de 2025, a Meta cobra por mensagem entregue do tipo `template`, nao mais por conversa.

Cobra em campanhas de marketing, templates fora da janela de atendimento de 24h, mensagens ativas para clientes e templates de autenticacao ou utilidade fora da janela.

Normalmente nao cobra quando o cliente envia mensagem, quando a empresa responde com mensagem comum dentro da janela de 24h, ou quando a conversa esta dentro de uma janela gratuita de entrada, como Click to WhatsApp.

Valores oficiais para Brasil em USD, rate card vigente em 01/04/2026:

- **Marketing:** US$ 0.0625 por mensagem entregue.
- **Utility:** US$ 0.0068 por mensagem entregue.
- **Authentication:** US$ 0.0068 por mensagem entregue.
- **Service:** gratuito / nao aplicavel no rate card.

Exemplos:

```text
1.000 mensagens marketing = US$ 62,50
1.000 mensagens utility fora da janela = US$ 6,80
10.000 mensagens marketing = US$ 625,00
```

Esse custo cresce conforme quantidade de clientes impactados, volume de campanhas, categoria do template, pais do destinatario e janela de atendimento.

---

## 2. OpenAI

**Fonte oficial:** https://platform.openai.com/docs/pricing

Usado para respostas dos agentes, geracao/refino de fluxos, processamento de arquivos, embeddings e transcricao de audio.

O gasto vem de:

- **Tokens de entrada:** prompt, historico, mensagem do usuario e contexto de arquivos.
- **Tokens de saida:** resposta gerada pela IA.
- **Embeddings:** processamento de arquivos/base de conhecimento.
- **Transcricao:** audio convertido em texto.

Valores principais:

- **gpt-4o-mini entrada:** US$ 0.15 / 1 milhao de tokens.
- **gpt-4o-mini entrada em cache:** US$ 0.075 / 1 milhao de tokens.
- **gpt-4o-mini saida:** US$ 0.60 / 1 milhao de tokens.
- **text-embedding-ada-002:** US$ 0.10 / 1 milhao de tokens.
- **whisper-1:** US$ 0.006, historicamente cobrado por minuto de audio transcrito.

Exemplos:

```text
Resposta curta:
2.000 tokens entrada + 500 tokens saida = aprox. US$ 0.0006

Embeddings:
1.000.000 tokens processados = US$ 0.10

Transcricao:
100 minutos de audio x US$ 0.006 = US$ 0.60
```

O custo unitario de texto costuma ser baixo, mas aumenta com volume, historico grande, muitos atendimentos e muito contexto de arquivos.

---

## 3. Anthropic Claude

**Fonte oficial:** https://docs.anthropic.com/en/docs/about-claude/pricing

Usado quando o Claude e acionado para refinar descricoes ou estruturar fluxos.

O gasto vem de tokens de entrada e saida. Modelo relacionado: Claude Haiku 3.5.

Valores oficiais:

- **Entrada:** US$ 0.80 / 1 milhao de tokens.
- **Saida:** US$ 4.00 / 1 milhao de tokens.

Exemplo:

```text
5.000 tokens entrada + 1.000 tokens saida = aprox. US$ 0.008
```

Esse custo so aparece quando o recurso e usado. Nao e custo fixo de hospedagem.

---

## 4. ElevenLabs

**Fonte oficial:** https://elevenlabs.io/pricing

Usado para gerar voz da IA, transformando texto em audio.

O gasto vem da geracao de audio falado. Quanto mais respostas faladas, mais longas as ligacoes e maior o texto convertido em audio, maior o consumo.

Planos oficiais principais:

- **Free:** US$ 0/mês, 10k creditos, aprox. 10 minutos.
- **Starter:** US$ 6/mês, 30k creditos, aprox. 30 minutos.
- **Creator:** US$ 11/mês, 121k creditos, aprox. 121 minutos.
- **Pro:** US$ 99/mês, 600k creditos, aprox. 600 minutos.
- **Scale:** US$ 299/mês, 1.8M creditos, aprox. 1.800 minutos.
- **Business:** US$ 990/mês, 6M creditos, aprox. 6.000 minutos.

Exemplo:

```text
100 atendimentos de voz x 3 minutos = 300 minutos de audio
```

Nesse exemplo, o uso ja passaria dos planos Free, Starter e Creator, aproximando-se do Pro.

---

## 5. Supabase

**Fonte oficial:** https://supabase.com/pricing

Usado como base principal para banco de dados, autenticacao, usuarios, empresas, agentes, configuracoes, arquivos, integracoes e funcoes.

O gasto vem de plano mensal, compute, armazenamento do banco, storage de arquivos, trafego de saida, usuarios ativos mensais, Edge Functions, Realtime, backups e add-ons.

Valores principais:

- **Pro:** a partir de US$ 25/mês.
- **Compute Micro:** US$ 10/mês.
- **Banco incluido no Pro:** 8 GB por projeto.
- **Banco extra:** US$ 0.125 / GB.
- **Egress incluido no Pro:** 250 GB.
- **Egress extra:** US$ 0.09 / GB.
- **Storage incluido:** 100 GB.
- **Storage extra:** US$ 0.021 / GB.
- **MAU extra:** US$ 0.00325 / usuario ativo mensal apos o limite incluido.
- **Edge Functions extra:** US$ 2 / 1 milhao de invocacoes apos o limite incluido.

Na pratica: conversas salvas aumentam banco, arquivos enviados aumentam storage, downloads/leitura podem gerar trafego, usuarios ativos contam para MAU e funcoes executadas podem contar como invocacoes.

---

## 6. Stripe

**Fonte oficial:** https://stripe.com/br/pricing

Usado para cobranca, planos e assinaturas.

O Stripe nao e custo de infraestrutura. Ele cobra **taxas sobre pagamentos recebidos**.

Valores oficiais no Brasil:

- **Cartao nacional:** 3,99% + R$ 0,39 por transacao.
- **Cartao internacional:** +2% adicional.
- **PIX:** 1,19% por PIX pago.
- **Boleto:** R$ 3,45 por boleto pago.
- **Contestacao:** R$ 55,00 por contestacao recebida.
- **Stripe Billing:** 0,7% do volume no Billing.
- **Invoicing:** 0,4% por fatura paga.

Exemplo com assinatura de R$ 100,00 via cartao nacional:

```text
Stripe Payments: 3,99% + R$ 0,39 = R$ 4,38
Stripe Billing: 0,7% = R$ 0,70
Total aproximado: R$ 5,08
Valor liquido aproximado: R$ 94,92
```

---

## Resumo Por Processo

- **Cliente conversa com agente por WhatsApp dentro da janela de 24h:** OpenAI cobra tokens e Supabase armazena dados. WhatsApp normalmente nao cobra mensagem comum dentro da janela.
- **Campanha de WhatsApp:** Meta cobra por template entregue; Supabase pode armazenar contatos, campanhas e logs.
- **Template fora da janela:** Meta cobra por mensagem entregue conforme categoria.
- **IA responde com texto:** OpenAI cobra tokens de entrada e saida.
- **Consulta/processamento de arquivos:** OpenAI cobra embeddings/consulta e Supabase armazena arquivos, vetores e dados.
- **Ligacao com IA por voz:** OpenAI transcreve audio, ElevenLabs gera voz e a infraestrutura processa midia.
- **Cliente paga assinatura:** Stripe cobra taxa por transacao e, se usado, taxa do Billing.
- **Crescimento de usuarios e dados:** Supabase pode aumentar MAU, banco, storage, egress e compute.

---

## Maiores Riscos De Custo

1. **WhatsApp Marketing:** 10.000 mensagens podem custar US$ 625,00.
2. **Voz com IA:** combina transcricao, voz sintetica e infraestrutura.
3. **Historico grande em IA:** aumenta tokens por resposta.
4. **Arquivos/base de conhecimento:** gera custo ao processar e armazenar.
5. **Storage e trafego:** arquivos grandes e muitos acessos podem aumentar Supabase.

---

## Recomendacoes

- Monitorar campanhas de WhatsApp, principalmente Marketing.
- Estimar custo antes de campanhas grandes.
- Segmentar disparos para evitar envio desnecessario.
- Limitar historico enviado para IA e usar resumos de conversa.
- Monitorar tokens por empresa/agente.
- Monitorar minutos de voz gerados.
- Evitar reprocessar arquivos ja indexados.
- Medir por cliente: mensagens, tokens, audios, transcricoes e armazenamento.
- Precificar planos considerando margem para WhatsApp, IA, Stripe e Supabase.

---

## Conclusao

Os principais gastos da Sonia vêm de WhatsApp, IA, voz, banco/infraestrutura e meios de pagamento.

O maior risco operacional e o **WhatsApp Marketing**, porque escala diretamente com mensagens entregues. O segundo maior ponto de atencao e **voz com IA**, porque soma transcricao, geracao de audio e processamento de midia.

Para manter margem saudavel, e importante medir consumo por empresa e por cliente.
