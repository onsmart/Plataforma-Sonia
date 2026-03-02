import { TFunction } from 'i18next';

/**
 * Traduz tipos de atividade do histórico
 */
export function translateActivityType(tipo: string, t: TFunction): string {
  // Mapear tipos conhecidos para chaves de tradução
  const typeMap: Record<string, string> = {
    'Agents Alterado': 'activity.types.agentsUpdated',
    'Flows Alterado': 'activity.types.flowsUpdated',
    'Integration Alterada': 'activity.types.integrationUpdated',
    'Data expirada': 'activity.types.integrationExpired',
    'DATA EXPIRADA': 'activity.types.integrationExpired',
    'Logs Limpos': 'activity.types.logsCleaned',
    'Fallbacks Limpos': 'activity.types.fallbacksCleaned',
    'Workflow Node Executado': 'activity.types.workflowNodeExecuted',
    'Workflow Executado': 'activity.types.workflowExecuted',
    'Decisão Aprovada': 'activity.types.decisionApproved',
    'Decisão Rejeitada': 'activity.types.decisionRejected',
  };

  // Tentar traduzir
  const translationKey = typeMap[tipo] || typeMap[tipo.toLowerCase()];
  if (translationKey) {
    const translated = t(translationKey);
    // Se a tradução retornar a própria chave, significa que não existe tradução
    if (translated !== translationKey) {
      return translated;
    }
  }

  // Fallback: retornar o tipo original se não houver tradução
  return tipo;
}

/**
 * Traduz mensagens de logs do sistema
 * Tenta identificar padrões comuns e traduzir
 */
export function translateLogMessage(message: string, t: TFunction): string {
  // Padrões conhecidos de mensagens de log
  if (message.includes('workflow node executed')) {
    return t('logs.workflowNodeExecuted');
  }
  if (message.includes('bloqueado') && message.includes('resposta enviada para aprovação')) {
    // Extrair nome do agente se possível
    const agentMatch = message.match(/Agente "([^"]+)"/);
    if (agentMatch) {
      return t('logs.agentBlocked', { agent: agentMatch[1] });
    }
    return t('logs.agentBlockedGeneric');
  }
  if (message.includes('workflow execution completed')) {
    return t('logs.workflowExecutionCompleted');
  }
  if (message.includes('decision approved')) {
    return t('logs.decisionApproved');
  }
  if (message.includes('decision rejected')) {
    return t('logs.decisionRejected');
  }

  // Se não houver padrão conhecido, retornar mensagem original
  return message;
}

/**
 * Traduz mensagens de fallbacks
 * Tenta identificar padrões comuns e traduzir
 */
export function translateFallbackMessage(message: string, t: TFunction): string {
  // Padrão: "Condição avaliada com X variável(is) faltando: Y. Usando resultado padrão: Z."
  const conditionPattern = /Condição avaliada com (\d+) variável\(is\) faltando: ([^.]+)\. Usando resultado padrão: (true|false)\./;
  const conditionMatch = message.match(conditionPattern);
  
  if (conditionMatch) {
    const [, count, variable, defaultValue] = conditionMatch;
    return t('fallbacks.conditionDefaulted', {
      count: parseInt(count),
      variable: variable.trim(),
      defaultValue,
    });
  }
  
  // Padrão em inglês também
  const conditionPatternEn = /Condition evaluated with (\d+) missing variable\(s\): ([^.]+)\. Using default result: (true|false)\./;
  const conditionMatchEn = message.match(conditionPatternEn);
  
  if (conditionMatchEn) {
    const [, count, variable, defaultValue] = conditionMatchEn;
    return t('fallbacks.conditionDefaulted', {
      count: parseInt(count),
      variable: variable.trim(),
      defaultValue,
    });
  }

  // Padrão: "Template substitution failed"
  if (message.includes('template substitution failed') || message.includes('substituição de template falhou')) {
    return t('fallbacks.templateSubstitutionFailed');
  }

  // Padrão: "Input defaulted"
  if (message.includes('input defaulted') || message.includes('entrada padrão')) {
    return t('fallbacks.inputDefaulted');
  }

  // Padrão: "Variable missing"
  if (message.includes('variável') && message.includes('faltando')) {
    return t('fallbacks.variableMissing');
  }

  // Se não houver padrão conhecido, retornar mensagem original
  return message;
}
