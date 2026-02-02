# Como Usar Integração CRM com Agentes

## 📋 Pré-requisitos

1. Execute o script `CRIAR_TABELAS_CRM.sql` no Supabase SQL Editor
2. Execute o script `ATUALIZAR_FUNCAO_AGENTES_CRM.sql` no Supabase SQL Editor
3. Configure uma integração CRM na tela de Integrações do frontend

## 🔧 Configuração

### 1. Conectar CRM na Tela de Integrações

1. Acesse a tela de **Integrações**
2. Clique em **"Conectar CRM"**
3. Selecione um CRM (ex: HubSpot)
4. Cole sua **API Key** do HubSpot
5. Clique em **"Salvar Integração"**

### 2. Associar CRM a um Agente

No banco de dados, atualize o agente:

```sql
UPDATE tb_agents 
SET crm_integration_id = 'ID_DA_INTEGRACAO_CRM'
WHERE id = 'ID_DO_AGENTE';
```

Ou via interface (quando implementado), selecione o CRM na configuração do agente.

## 🚀 Ações Disponíveis para Agentes

### 1. Ler Dados do CRM

O agente pode pedir para ler contatos ou negócios:

**Exemplo de prompt:**
```
"Puxe os 10 primeiros contatos do HubSpot"
"Mostre os 5 primeiros negócios do CRM"
"Liste os contatos do CRM"
```

**Ação gerada pelo LLM:**
```json
{
  "action": "read_crm",
  "entity_type": "contacts",
  "limit": 10
}
```

**Resposta:**
```json
{
  "action": "read_crm",
  "entity_type": "contacts",
  "crm": "hubspot",
  "count": 10,
  "data": [
    {
      "id": "123",
      "firstname": "João",
      "lastname": "Silva",
      "email": "joao@exemplo.com",
      "phone": "+5511999999999",
      "company": "Empresa XYZ",
      "lifecyclestage": "customer"
    }
  ]
}
```

### 2. Criar Contato no CRM

**Exemplo de prompt:**
```
"Crie um novo contato no CRM com nome João Silva, email joao@exemplo.com e telefone 11999999999"
```

**Ação gerada pelo LLM:**
```json
{
  "action": "create_crm_contact",
  "data": {
    "firstname": "João",
    "lastname": "Silva",
    "email": "joao@exemplo.com",
    "phone": "+5511999999999"
  }
}
```

### 3. Atualizar Contato no CRM

**Exemplo de prompt:**
```
"Atualize o contato 123 no CRM, mudando o email para novo@exemplo.com"
```

**Ação gerada pelo LLM:**
```json
{
  "action": "update_crm_contact",
  "contact_id": "123",
  "data": {
    "email": "novo@exemplo.com"
  }
}
```

## 🧪 Testando

### Teste Básico

1. Configure um agente com `crm_integration_id` apontando para uma integração HubSpot válida
2. No Playground, envie a mensagem:
   ```
   "Puxe os 10 primeiros contatos do HubSpot"
   ```
3. O agente deve retornar os dados dos contatos

### Verificar Logs

Os logs do backend mostrarão:
```
[getHubSpotContacts] 10 contatos encontrados
```

## 📝 Notas Importantes

- **HubSpot API Key**: Você precisa de uma API Key válida do HubSpot
- **Permissões**: A API Key precisa ter permissões para ler/escrever contatos e negócios
- **Limite**: Por padrão, retorna 10 registros. Use `limit` para alterar
- **Propriedades**: Por padrão, retorna propriedades básicas. Use `properties` para especificar campos

## 🔮 Próximos Passos

- [ ] Adicionar interface para associar CRM ao agente
- [ ] Implementar suporte para outros CRMs (Pipedrive, Salesforce, etc.)
- [ ] Adicionar mais ações (criar negócios, atualizar negócios, etc.)
- [ ] Implementar webhooks para eventos do CRM
- [ ] Adicionar mapeamento de eventos canônicos
