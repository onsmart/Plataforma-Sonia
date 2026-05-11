# Fluxo de teste: condicional + múltiplas opções

Foi adicionado um gerador backend que cria automaticamente:

- 1 template compartilhado
- 4 agentes de teste
- 1 fluxo salvo em `tb_flows`

Estrutura do fluxo:

1. `Início`
2. `Agente Classificador`
3. `Condicional`: verifica `intent_detected`
4. `Múltiplas opções`: roteia `intent`
5. `Agente Comercial` ou `Agente de Suporte` ou `Agente Financeiro`
6. `Fim`

Comportamento:

- Se `intent_detected = false`, o fluxo cai no agente de suporte/fallback para pedir esclarecimento.
- Se `intent_detected = true`, o switch roteia para uma das 3 opções:
  - `comercial`
  - `suporte`
  - `financeiro`
- O `default` do switch também cai em suporte.

Endpoint:

```http
POST /flows/generate-test-conditional-switch
```

Body opcional:

```json
{
  "name": "Fluxo Teste Atendimento",
  "language": "pt-BR"
}
```

Resposta:

- `template`: id e nome do template compartilhado
- `agents`: 4 agentes criados
- `flowId`: id do fluxo salvo
- `flow`: JSON completo do canvas
