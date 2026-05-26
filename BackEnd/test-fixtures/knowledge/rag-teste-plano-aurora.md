# Base de conhecimento de teste — TechLumen Solutions (fictícia)

Este arquivo existe apenas para validar se o agente consulta o RAG. Nenhuma informação abaixo deve existir no prompt principal do agente.

## Empresa fictícia

Nome oficial: TechLumen Solutions Ltda.
Nome comercial: TechLumen.
Segmento: software B2B para gestão de energia em condomínios.
Sede fictícia: Campinas — SP (apenas para teste de RAG; não confundir com Onsmart.AI).

## Produto exclusivo: Plano Aurora

O Plano Aurora é o único plano da TechLumen que inclui monitoramento preditivo de consumo com alertas automáticos por e-mail e WhatsApp.

Características do Plano Aurora (somente neste documento):

- Valor de referência para testes: R$ 297,00 por mês por unidade monitorada (valor fictício para validação de RAG).
- Limite: até 120 unidades por contrato no Plano Aurora.
- Incluso: dashboard Aurora, relatório mensal PDF e 2 usuários administradores.
- Não incluso: instalação de hardware (cobrada à parte).

## Horário especial de atendimento TechLumen

O suporte humano da TechLumen para clientes do Plano Aurora atende exclusivamente:

- Terças, quartas e quintas-feiras
- Das 14h00 às 18h00 (horário de Brasília)
- Canal oficial de teste: suporte-aurora@techlumen-teste.invalid

Fora desse horário, o agente deve informar o horário acima e orientar a abrir chamado pelo portal (não inventar outro horário).

## Regra interna de reembolso (somente RAG)

Código interno de política: AURORA-7X.

Regra: solicitações de reembolso do Plano Aurora são aceitas somente se abertas em até 48 horas após a primeira cobrança, mediante protocolo que começa com as letras TL (exemplo: TL-2026-0001).

O agente só deve citar o código AURORA-7X se o usuário perguntar explicitamente sobre reembolso do Plano Aurora.

## Funcionamento do monitoramento (detalhe técnico fictício)

O módulo “Pulse Aurora” coleta leituras a cada 15 minutos via API TL-Pulse v2.
Latência máxima aceitável em contrato de teste: 90 segundos entre leitura e exibição no dashboard.

## Perguntas de teste e respostas esperadas

Use estas perguntas no Playground ou Inbox com este arquivo vinculado como RAG (finalidade: rag) e processado.

| Pergunta do usuário | Resposta correta esperada (trechos obrigatórios) | Falha se o agente... |
|---------------------|--------------------------------------------------|----------------------|
| Quanto custa o Plano Aurora? | Mencionar R$ 297,00/mês por unidade (fictício) | Inventar outro valor ou dizer que não sabe sem oferecer contato |
| Qual o horário de atendimento do Plano Aurora? | Terça a quinta, 14h–18h Brasília | Citar horário comercial genérico 9h–18h |
| Qual o código da política de reembolso do Plano Aurora? | AURORA-7X e janela de 48h / protocolo TL | Não souber ou inventar outro código |
| Quantas unidades o Plano Aurora permite? | Até 120 unidades | Chutar outro número |
| O que é a TechLumen? | Software B2B energia em condomínios; Campinas-SP (fictício) | Confundir com Onsmart.AI |
| Qual a latência do Pulse Aurora? | Até 90 segundos | Não mencionar ou inventar |

## O que o agente NÃO deve responder só com este RAG

- Preços ou políticas da Onsmart.AI (use o outro arquivo RAG).
- Integrações reais da plataforma Sonia (confirmar com equipe).

## Sinal de RAG ignorado

Se o usuário perguntar “Quanto custa o Plano Aurora?” e o agente responder como Onsmart.AI ou disser que não há plano com esse nome, o RAG não está vinculado, não foi processado ou a similaridade não recuperou o trecho.
