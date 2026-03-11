-- ============================================
-- SEED I18N: Insights & Analytics
-- ============================================
-- Traduções para a página de Insights
-- Idiomas: pt-BR, en-US, es-ES
-- ============================================

INSERT INTO public.tb_i18n_translations (companies_id, language, namespace, key, value, description)
VALUES
  -- ============================================
  -- HEADER
  -- ============================================
  (NULL, 'pt-BR', 'insights', 'header.title', 'Insights e Analytics', 'Título da página'),
  (NULL, 'pt-BR', 'insights', 'header.description', 'Métricas em tempo real da sua força de trabalho de IA.', 'Descrição da página'),
  (NULL, 'pt-BR', 'insights', 'header.period', 'Período', 'Label do seletor de período'),
  (NULL, 'pt-BR', 'insights', 'header.period.7d', 'Últimos 7 dias', 'Opção período 7 dias'),
  (NULL, 'pt-BR', 'insights', 'header.period.30d', 'Últimos 30 dias', 'Opção período 30 dias'),
  
  (NULL, 'en-US', 'insights', 'header.title', 'Insights & Analytics', 'Page title'),
  (NULL, 'en-US', 'insights', 'header.description', 'Real-time metrics from your AI workforce.', 'Page description'),
  (NULL, 'en-US', 'insights', 'header.period', 'Period', 'Period selector label'),
  (NULL, 'en-US', 'insights', 'header.period.7d', 'Last 7 days', 'Period option 7 days'),
  (NULL, 'en-US', 'insights', 'header.period.30d', 'Last 30 days', 'Period option 30 days'),
  
  (NULL, 'es-ES', 'insights', 'header.title', 'Insights y Analytics', 'Título de la página'),
  (NULL, 'es-ES', 'insights', 'header.description', 'Métricas en tiempo real de tu fuerza de trabajo de IA.', 'Descripción de la página'),
  (NULL, 'es-ES', 'insights', 'header.period', 'Período', 'Etiqueta del selector de período'),
  (NULL, 'es-ES', 'insights', 'header.period.7d', 'Últimos 7 días', 'Opción período 7 días'),
  (NULL, 'es-ES', 'insights', 'header.period.30d', 'Últimos 30 días', 'Opción período 30 días'),

  -- ============================================
  -- EXPORT
  -- ============================================
  (NULL, 'pt-BR', 'insights', 'export.title', 'Exportar Relatório', 'Título do menu de exportação'),
  (NULL, 'pt-BR', 'insights', 'export.excel', 'Exportar para Excel', 'Opção exportar Excel'),
  (NULL, 'pt-BR', 'insights', 'export.pdf', 'Exportar para PDF', 'Opção exportar PDF'),
  (NULL, 'pt-BR', 'insights', 'export.success.excel', 'Relatório Excel exportado: {{fileName}}', 'Sucesso exportar Excel'),
  (NULL, 'pt-BR', 'insights', 'export.success.pdf', 'Relatório PDF exportado: {{fileName}}', 'Sucesso exportar PDF'),
  (NULL, 'pt-BR', 'insights', 'export.error.noData', 'Nenhum dado disponível para exportar', 'Erro sem dados'),
  (NULL, 'pt-BR', 'insights', 'export.error.excel', 'Erro ao exportar Excel', 'Erro exportar Excel'),
  (NULL, 'pt-BR', 'insights', 'export.error.pdf', 'Erro ao exportar PDF', 'Erro exportar PDF'),
  
  (NULL, 'en-US', 'insights', 'export.title', 'Export Report', 'Export menu title'),
  (NULL, 'en-US', 'insights', 'export.excel', 'Export to Excel', 'Export Excel option'),
  (NULL, 'en-US', 'insights', 'export.pdf', 'Export to PDF', 'Export PDF option'),
  (NULL, 'en-US', 'insights', 'export.success.excel', 'Excel report exported: {{fileName}}', 'Success export Excel'),
  (NULL, 'en-US', 'insights', 'export.success.pdf', 'PDF report exported: {{fileName}}', 'Success export PDF'),
  (NULL, 'en-US', 'insights', 'export.error.noData', 'No data available to export', 'Error no data'),
  (NULL, 'en-US', 'insights', 'export.error.excel', 'Error exporting Excel', 'Error export Excel'),
  (NULL, 'en-US', 'insights', 'export.error.pdf', 'Error exporting PDF', 'Error export PDF'),
  
  (NULL, 'es-ES', 'insights', 'export.title', 'Exportar Informe', 'Título del menú de exportación'),
  (NULL, 'es-ES', 'insights', 'export.excel', 'Exportar a Excel', 'Opción exportar Excel'),
  (NULL, 'es-ES', 'insights', 'export.pdf', 'Exportar a PDF', 'Opción exportar PDF'),
  (NULL, 'es-ES', 'insights', 'export.success.excel', 'Informe Excel exportado: {{fileName}}', 'Éxito exportar Excel'),
  (NULL, 'es-ES', 'insights', 'export.success.pdf', 'Informe PDF exportado: {{fileName}}', 'Éxito exportar PDF'),
  (NULL, 'es-ES', 'insights', 'export.error.noData', 'No hay datos disponibles para exportar', 'Error sin datos'),
  (NULL, 'es-ES', 'insights', 'export.error.excel', 'Error al exportar Excel', 'Error exportar Excel'),
  (NULL, 'es-ES', 'insights', 'export.error.pdf', 'Error al exportar PDF', 'Error exportar PDF'),

  -- ============================================
  -- KPI CARDS
  -- ============================================
  (NULL, 'pt-BR', 'insights', 'kpi.totalInteractions', 'Total de Interações', 'KPI total interações'),
  (NULL, 'pt-BR', 'insights', 'kpi.tokenCost', 'Custo Estimado de Tokens', 'KPI custo tokens'),
  (NULL, 'pt-BR', 'insights', 'kpi.activeChannels', 'Canais Ativos', 'KPI canais ativos'),
  (NULL, 'pt-BR', 'insights', 'kpi.ragUsage', 'Taxa de Uso de RAG', 'KPI uso RAG'),
  (NULL, 'pt-BR', 'insights', 'kpi.trend.relative', 'em relação ao período anterior', 'Texto tendência'),
  (NULL, 'pt-BR', 'insights', 'kpi.trend.insufficient', 'Baseado no período selecionado', 'Texto período de dados'),
  (NULL, 'pt-BR', 'insights', 'kpi.rag.agents', '{{count}} agente(s) com arquivos vinculados', 'Texto agentes RAG'),
  (NULL, 'pt-BR', 'insights', 'kpi.csat', 'CSAT Score', 'KPI CSAT score'),
  (NULL, 'pt-BR', 'insights', 'kpi.nps', 'NPS Score', 'KPI NPS score'),
  (NULL, 'pt-BR', 'insights', 'kpi.averageSentiment', 'Sentimento Médio', 'KPI sentimento médio'),
  (NULL, 'pt-BR', 'insights', 'kpi.humanTransferRate', 'Transferência Humana', 'KPI taxa de transferência humana'),
  
  (NULL, 'en-US', 'insights', 'kpi.totalInteractions', 'Total Interactions', 'KPI total interactions'),
  (NULL, 'en-US', 'insights', 'kpi.tokenCost', 'Est. Token Cost', 'KPI token cost'),
  (NULL, 'en-US', 'insights', 'kpi.activeChannels', 'Active Channels', 'KPI active channels'),
  (NULL, 'en-US', 'insights', 'kpi.ragUsage', 'RAG Usage Rate', 'KPI RAG usage'),
  (NULL, 'en-US', 'insights', 'kpi.trend.relative', 'compared to previous period', 'Trend text'),
  (NULL, 'en-US', 'insights', 'kpi.trend.insufficient', 'Based on selected period', 'Period data text'),
  (NULL, 'en-US', 'insights', 'kpi.rag.agents', '{{count}} agent(s) with linked files', 'RAG agents text'),
  (NULL, 'en-US', 'insights', 'kpi.csat', 'CSAT Score', 'KPI CSAT score'),
  (NULL, 'en-US', 'insights', 'kpi.nps', 'NPS Score', 'KPI NPS score'),
  (NULL, 'en-US', 'insights', 'kpi.averageSentiment', 'Average Sentiment', 'KPI average sentiment'),
  (NULL, 'en-US', 'insights', 'kpi.humanTransferRate', 'Human Transfer Rate', 'KPI human transfer rate'),
  
  (NULL, 'es-ES', 'insights', 'kpi.totalInteractions', 'Total de Interacciones', 'KPI total interacciones'),
  (NULL, 'es-ES', 'insights', 'kpi.tokenCost', 'Costo Estimado de Tokens', 'KPI costo tokens'),
  (NULL, 'es-ES', 'insights', 'kpi.activeChannels', 'Canales Activos', 'KPI canales activos'),
  (NULL, 'es-ES', 'insights', 'kpi.ragUsage', 'Tasa de Uso de RAG', 'KPI uso RAG'),
  (NULL, 'es-ES', 'insights', 'kpi.trend.relative', 'respecto al período anterior', 'Texto tendencia'),
  (NULL, 'es-ES', 'insights', 'kpi.trend.insufficient', 'Basado en el período seleccionado', 'Texto período de datos'),
  (NULL, 'es-ES', 'insights', 'kpi.rag.agents', '{{count}} agente(s) con archivos vinculados', 'Texto agentes RAG'),
  (NULL, 'es-ES', 'insights', 'kpi.csat', 'Puntuación CSAT', 'KPI CSAT score'),
  (NULL, 'es-ES', 'insights', 'kpi.nps', 'Puntuación NPS', 'KPI NPS score'),
  (NULL, 'es-ES', 'insights', 'kpi.averageSentiment', 'Sentimiento Medio', 'KPI sentimiento medio'),
  (NULL, 'es-ES', 'insights', 'kpi.humanTransferRate', 'Tasa de Transferencia Humana', 'KPI tasa de transferencia humana'),

  -- ============================================
  -- TABS
  -- ============================================
  (NULL, 'pt-BR', 'insights', 'tabs.overview', 'Visão Geral', 'Tab overview'),
  (NULL, 'pt-BR', 'insights', 'tabs.agents', 'Performance de Agentes', 'Tab agents'),
  (NULL, 'pt-BR', 'insights', 'tabs.channels', 'Canais', 'Tab channels'),
  
  (NULL, 'en-US', 'insights', 'tabs.overview', 'Overview', 'Tab overview'),
  (NULL, 'en-US', 'insights', 'tabs.agents', 'Agent Performance', 'Tab agents'),
  (NULL, 'en-US', 'insights', 'tabs.channels', 'Channels', 'Tab channels'),
  
  (NULL, 'es-ES', 'insights', 'tabs.overview', 'Resumen', 'Tab overview'),
  (NULL, 'es-ES', 'insights', 'tabs.agents', 'Rendimiento de Agentes', 'Tab agents'),
  (NULL, 'es-ES', 'insights', 'tabs.channels', 'Canales', 'Tab channels'),

  -- ============================================
  -- OVERVIEW TAB
  -- ============================================
  (NULL, 'pt-BR', 'insights', 'overview.title', 'Tendência de Volume de Interações', 'Título gráfico overview'),
  (NULL, 'pt-BR', 'insights', 'overview.description', 'Sessões ativas diárias.', 'Descrição gráfico overview'),
  (NULL, 'pt-BR', 'insights', 'overview.empty', 'Nenhum dado disponível para o período selecionado', 'Estado vazio overview'),
  (NULL, 'pt-BR', 'insights', 'overview.costs.title', 'Custos de Tokens', 'Título gráfico custos'),
  (NULL, 'pt-BR', 'insights', 'overview.costs.description', 'Custos diários de tokens utilizados', 'Descrição gráfico custos'),
  (NULL, 'pt-BR', 'insights', 'overview.costs.empty', 'Nenhum dado de custo disponível', 'Estado vazio custos'),
  (NULL, 'pt-BR', 'insights', 'overview.costs.tooltip', 'Custo', 'Tooltip custo'),
  
  (NULL, 'en-US', 'insights', 'overview.title', 'Interaction Volume Trend', 'Overview chart title'),
  (NULL, 'en-US', 'insights', 'overview.description', 'Daily active sessions.', 'Overview chart description'),
  (NULL, 'en-US', 'insights', 'overview.empty', 'No data available for the selected period', 'Overview empty state'),
  (NULL, 'en-US', 'insights', 'overview.costs.title', 'Token Costs', 'Costs chart title'),
  (NULL, 'en-US', 'insights', 'overview.costs.description', 'Daily token usage costs', 'Costs chart description'),
  (NULL, 'en-US', 'insights', 'overview.costs.empty', 'No cost data available', 'Costs empty state'),
  (NULL, 'en-US', 'insights', 'overview.costs.tooltip', 'Cost', 'Cost tooltip'),
  
  (NULL, 'es-ES', 'insights', 'overview.title', 'Tendencia de Volumen de Interacciones', 'Título gráfico overview'),
  (NULL, 'es-ES', 'insights', 'overview.description', 'Sesiones activas diarias.', 'Descripción gráfico overview'),
  (NULL, 'es-ES', 'insights', 'overview.empty', 'No hay datos disponibles para el período seleccionado', 'Estado vacío overview'),
  (NULL, 'es-ES', 'insights', 'overview.costs.title', 'Costos de Tokens', 'Título gráfico costos'),
  (NULL, 'es-ES', 'insights', 'overview.costs.description', 'Costos diarios de tokens utilizados', 'Descripción gráfico costos'),
  (NULL, 'es-ES', 'insights', 'overview.costs.empty', 'No hay datos de costo disponibles', 'Estado vacío costos'),
  (NULL, 'es-ES', 'insights', 'overview.costs.tooltip', 'Costo', 'Tooltip costo'),

  -- ============================================
  -- AGENTS TAB
  -- ============================================
  (NULL, 'pt-BR', 'insights', 'agents.title', 'Pontuação de Confiança do Agente', 'Título gráfico agents'),
  (NULL, 'pt-BR', 'insights', 'agents.description', 'Confiança média de IA por agente.', 'Descrição gráfico agents'),
  (NULL, 'pt-BR', 'insights', 'agents.empty', 'Nenhum dado de agente disponível', 'Estado vazio agents'),
  (NULL, 'pt-BR', 'insights', 'agents.tooltip', 'Confiança: {{score}}%', 'Tooltip confiança'),
  (NULL, 'pt-BR', 'insights', 'agents.performance.excellent', 'Excelente', 'Performance excelente'),
  (NULL, 'pt-BR', 'insights', 'agents.performance.normal', 'Normal', 'Performance normal'),
  (NULL, 'pt-BR', 'insights', 'agents.performance.attention', 'Atenção', 'Performance atenção'),
  (NULL, 'pt-BR', 'insights', 'agents.performance.critical', 'Crítico', 'Performance crítico'),
  
  (NULL, 'en-US', 'insights', 'agents.title', 'Agent Confidence Score', 'Agents chart title'),
  (NULL, 'en-US', 'insights', 'agents.description', 'Average AI confidence by agent.', 'Agents chart description'),
  (NULL, 'en-US', 'insights', 'agents.empty', 'No agent data available', 'Agents empty state'),
  (NULL, 'en-US', 'insights', 'agents.tooltip', 'Confidence: {{score}}%', 'Confidence tooltip'),
  (NULL, 'en-US', 'insights', 'agents.performance.excellent', 'Excellent', 'Excellent performance'),
  (NULL, 'en-US', 'insights', 'agents.performance.normal', 'Normal', 'Normal performance'),
  (NULL, 'en-US', 'insights', 'agents.performance.attention', 'Attention', 'Attention performance'),
  (NULL, 'en-US', 'insights', 'agents.performance.critical', 'Critical', 'Critical performance'),
  
  (NULL, 'es-ES', 'insights', 'agents.title', 'Puntuación de Confianza del Agente', 'Título gráfico agents'),
  (NULL, 'es-ES', 'insights', 'agents.description', 'Confianza media de IA por agente.', 'Descripción gráfico agents'),
  (NULL, 'es-ES', 'insights', 'agents.empty', 'No hay datos de agente disponibles', 'Estado vacío agents'),
  (NULL, 'es-ES', 'insights', 'agents.tooltip', 'Confianza: {{score}}%', 'Tooltip confianza'),
  (NULL, 'es-ES', 'insights', 'agents.performance.excellent', 'Excelente', 'Rendimiento excelente'),
  (NULL, 'es-ES', 'insights', 'agents.performance.normal', 'Normal', 'Rendimiento normal'),
  (NULL, 'es-ES', 'insights', 'agents.performance.attention', 'Atención', 'Rendimiento atención'),
  (NULL, 'es-ES', 'insights', 'agents.performance.critical', 'Crítico', 'Rendimiento crítico'),

  -- ============================================
  -- CHANNELS TAB
  -- ============================================
  (NULL, 'pt-BR', 'insights', 'channels.distribution.title', 'Distribuição por Canal', 'Título gráfico distribuição'),
  (NULL, 'pt-BR', 'insights', 'channels.distribution.description', 'Agentes ativos por tipo de canal.', 'Descrição gráfico distribuição'),
  (NULL, 'pt-BR', 'insights', 'channels.distribution.empty', 'Nenhum canal encontrado para o período selecionado', 'Estado vazio distribuição'),
  (NULL, 'pt-BR', 'insights', 'channels.legend.title', 'Canais Ativos', 'Título legenda'),
  (NULL, 'pt-BR', 'insights', 'channels.legend.description', 'Distribuição por tipo', 'Descrição legenda'),
  (NULL, 'pt-BR', 'insights', 'channels.legend.empty', 'Nenhum canal encontrado', 'Estado vazio legenda'),
  (NULL, 'pt-BR', 'insights', 'channels.total', 'Agentes', 'Label total agentes'),
  (NULL, 'pt-BR', 'insights', 'channels.label.whatsapp', 'WhatsApp', 'Label WhatsApp'),
  (NULL, 'pt-BR', 'insights', 'channels.label.webchat', 'Webchat', 'Label Webchat'),
  (NULL, 'pt-BR', 'insights', 'channels.label.email', 'Email', 'Label Email'),
  (NULL, 'pt-BR', 'insights', 'channels.label.linkedin', 'LinkedIn', 'Label LinkedIn'),
  (NULL, 'pt-BR', 'insights', 'channels.label.phone', 'Telefonia', 'Label Telefonia'),
  
  (NULL, 'en-US', 'insights', 'channels.distribution.title', 'Channel Distribution', 'Distribution chart title'),
  (NULL, 'en-US', 'insights', 'channels.distribution.description', 'Active agents by channel type.', 'Distribution chart description'),
  (NULL, 'en-US', 'insights', 'channels.distribution.empty', 'No channels found for the selected period', 'Distribution empty state'),
  (NULL, 'en-US', 'insights', 'channels.legend.title', 'Active Channels', 'Legend title'),
  (NULL, 'en-US', 'insights', 'channels.legend.description', 'Distribution by type', 'Legend description'),
  (NULL, 'en-US', 'insights', 'channels.legend.empty', 'No channels found', 'Legend empty state'),
  (NULL, 'en-US', 'insights', 'channels.total', 'Agents', 'Total agents label'),
  (NULL, 'en-US', 'insights', 'channels.label.whatsapp', 'WhatsApp', 'WhatsApp label'),
  (NULL, 'en-US', 'insights', 'channels.label.webchat', 'Webchat', 'Webchat label'),
  (NULL, 'en-US', 'insights', 'channels.label.email', 'Email', 'Email label'),
  (NULL, 'en-US', 'insights', 'channels.label.linkedin', 'LinkedIn', 'LinkedIn label'),
  (NULL, 'en-US', 'insights', 'channels.label.phone', 'Telephony', 'Telephony label'),
  
  (NULL, 'es-ES', 'insights', 'channels.distribution.title', 'Distribución por Canal', 'Título gráfico distribución'),
  (NULL, 'es-ES', 'insights', 'channels.distribution.description', 'Agentes activos por tipo de canal.', 'Descripción gráfico distribución'),
  (NULL, 'es-ES', 'insights', 'channels.distribution.empty', 'No se encontraron canales para el período seleccionado', 'Estado vacío distribución'),
  (NULL, 'es-ES', 'insights', 'channels.legend.title', 'Canales Activos', 'Título leyenda'),
  (NULL, 'es-ES', 'insights', 'channels.legend.description', 'Distribución por tipo', 'Descripción leyenda'),
  (NULL, 'es-ES', 'insights', 'channels.legend.empty', 'No se encontraron canales', 'Estado vacío leyenda'),
  (NULL, 'es-ES', 'insights', 'channels.total', 'Agentes', 'Etiqueta total agentes'),
  (NULL, 'es-ES', 'insights', 'channels.label.whatsapp', 'WhatsApp', 'Etiqueta WhatsApp'),
  (NULL, 'es-ES', 'insights', 'channels.label.webchat', 'Webchat', 'Etiqueta Webchat'),
  (NULL, 'es-ES', 'insights', 'channels.label.email', 'Email', 'Etiqueta Email'),
  (NULL, 'es-ES', 'insights', 'channels.label.linkedin', 'LinkedIn', 'Etiqueta LinkedIn'),
  (NULL, 'es-ES', 'insights', 'channels.label.phone', 'Telefonía', 'Etiqueta Telefonía'),

  -- ============================================
  -- PDF EXPORT
  -- ============================================
  (NULL, 'pt-BR', 'insights', 'pdf.title', 'Relatório de Insights & Analytics', 'Título PDF'),
  (NULL, 'pt-BR', 'insights', 'pdf.period.7d', 'Últimos 7 dias', 'Período 7 dias PDF'),
  (NULL, 'pt-BR', 'insights', 'pdf.period.30d', 'Últimos 30 dias', 'Período 30 dias PDF'),
  (NULL, 'pt-BR', 'insights', 'pdf.generated', 'Data de geração: {{date}}', 'Data geração PDF'),
  (NULL, 'pt-BR', 'insights', 'pdf.summary.title', 'Resumo Geral', 'Título resumo PDF'),
  (NULL, 'pt-BR', 'insights', 'pdf.summary.metric', 'Métrica', 'Coluna métrica PDF'),
  (NULL, 'pt-BR', 'insights', 'pdf.summary.value', 'Valor', 'Coluna valor PDF'),
  (NULL, 'pt-BR', 'insights', 'pdf.summary.totalInteractions', 'Total de Interações', 'Métrica total interações'),
  (NULL, 'pt-BR', 'insights', 'pdf.summary.totalCost', 'Custo Total Estimado', 'Métrica custo total'),
  (NULL, 'pt-BR', 'insights', 'pdf.summary.activeChannels', 'Canais Ativos', 'Métrica canais ativos'),
  (NULL, 'pt-BR', 'insights', 'pdf.summary.ragRate', 'Uso de RAG (Rate)', 'Métrica RAG rate'),
  (NULL, 'pt-BR', 'insights', 'pdf.summary.totalTokens', 'Total de Tokens', 'Métrica total tokens'),
  (NULL, 'pt-BR', 'insights', 'pdf.history.title', 'Histórico de Interações', 'Título histórico PDF'),
  (NULL, 'pt-BR', 'insights', 'pdf.history.date', 'Data', 'Coluna data PDF'),
  (NULL, 'pt-BR', 'insights', 'pdf.history.interactions', 'Interações', 'Coluna interações PDF'),
  (NULL, 'pt-BR', 'insights', 'pdf.history.cost', 'Custo (USD)', 'Coluna custo PDF'),
  (NULL, 'pt-BR', 'insights', 'pdf.agents.title', 'Performance dos Agentes', 'Título agentes PDF'),
  (NULL, 'pt-BR', 'insights', 'pdf.agents.agent', 'Agente', 'Coluna agente PDF'),
  (NULL, 'pt-BR', 'insights', 'pdf.agents.confidence', 'Confiança Média (%)', 'Coluna confiança PDF'),
  (NULL, 'pt-BR', 'insights', 'pdf.channels.title', 'Distribuição por Canal', 'Título canais PDF'),
  (NULL, 'pt-BR', 'insights', 'pdf.channels.channel', 'Canal', 'Coluna canal PDF'),
  (NULL, 'pt-BR', 'insights', 'pdf.channels.interactions', 'Interações', 'Coluna interações canais PDF'),
  
  (NULL, 'en-US', 'insights', 'pdf.title', 'Insights & Analytics Report', 'PDF title'),
  (NULL, 'en-US', 'insights', 'pdf.period.7d', 'Last 7 days', 'Period 7 days PDF'),
  (NULL, 'en-US', 'insights', 'pdf.period.30d', 'Last 30 days', 'Period 30 days PDF'),
  (NULL, 'en-US', 'insights', 'pdf.generated', 'Generation date: {{date}}', 'PDF generation date'),
  (NULL, 'en-US', 'insights', 'pdf.summary.title', 'General Summary', 'PDF summary title'),
  (NULL, 'en-US', 'insights', 'pdf.summary.metric', 'Metric', 'PDF metric column'),
  (NULL, 'en-US', 'insights', 'pdf.summary.value', 'Value', 'PDF value column'),
  (NULL, 'en-US', 'insights', 'pdf.summary.totalInteractions', 'Total Interactions', 'Total interactions metric'),
  (NULL, 'en-US', 'insights', 'pdf.summary.totalCost', 'Total Estimated Cost', 'Total cost metric'),
  (NULL, 'en-US', 'insights', 'pdf.summary.activeChannels', 'Active Channels', 'Active channels metric'),
  (NULL, 'en-US', 'insights', 'pdf.summary.ragRate', 'RAG Usage (Rate)', 'RAG rate metric'),
  (NULL, 'en-US', 'insights', 'pdf.summary.totalTokens', 'Total Tokens', 'Total tokens metric'),
  (NULL, 'en-US', 'insights', 'pdf.history.title', 'Interaction History', 'PDF history title'),
  (NULL, 'en-US', 'insights', 'pdf.history.date', 'Date', 'PDF date column'),
  (NULL, 'en-US', 'insights', 'pdf.history.interactions', 'Interactions', 'PDF interactions column'),
  (NULL, 'en-US', 'insights', 'pdf.history.cost', 'Cost (USD)', 'PDF cost column'),
  (NULL, 'en-US', 'insights', 'pdf.agents.title', 'Agent Performance', 'PDF agents title'),
  (NULL, 'en-US', 'insights', 'pdf.agents.agent', 'Agent', 'PDF agent column'),
  (NULL, 'en-US', 'insights', 'pdf.agents.confidence', 'Average Confidence (%)', 'PDF confidence column'),
  (NULL, 'en-US', 'insights', 'pdf.channels.title', 'Channel Distribution', 'PDF channels title'),
  (NULL, 'en-US', 'insights', 'pdf.channels.channel', 'Channel', 'PDF channel column'),
  (NULL, 'en-US', 'insights', 'pdf.channels.interactions', 'Interactions', 'PDF channel interactions column'),
  
  (NULL, 'es-ES', 'insights', 'pdf.title', 'Informe de Insights y Analytics', 'Título PDF'),
  (NULL, 'es-ES', 'insights', 'pdf.period.7d', 'Últimos 7 días', 'Período 7 días PDF'),
  (NULL, 'es-ES', 'insights', 'pdf.period.30d', 'Últimos 30 días', 'Período 30 días PDF'),
  (NULL, 'es-ES', 'insights', 'pdf.generated', 'Fecha de generación: {{date}}', 'Fecha generación PDF'),
  (NULL, 'es-ES', 'insights', 'pdf.summary.title', 'Resumen General', 'Título resumen PDF'),
  (NULL, 'es-ES', 'insights', 'pdf.summary.metric', 'Métrica', 'Columna métrica PDF'),
  (NULL, 'es-ES', 'insights', 'pdf.summary.value', 'Valor', 'Columna valor PDF'),
  (NULL, 'es-ES', 'insights', 'pdf.summary.totalInteractions', 'Total de Interacciones', 'Métrica total interacciones'),
  (NULL, 'es-ES', 'insights', 'pdf.summary.totalCost', 'Costo Total Estimado', 'Métrica costo total'),
  (NULL, 'es-ES', 'insights', 'pdf.summary.activeChannels', 'Canales Activos', 'Métrica canales activos'),
  (NULL, 'es-ES', 'insights', 'pdf.summary.ragRate', 'Uso de RAG (Tasa)', 'Métrica RAG rate'),
  (NULL, 'es-ES', 'insights', 'pdf.summary.totalTokens', 'Total de Tokens', 'Métrica total tokens'),
  (NULL, 'es-ES', 'insights', 'pdf.history.title', 'Historial de Interacciones', 'Título histórico PDF'),
  (NULL, 'es-ES', 'insights', 'pdf.history.date', 'Fecha', 'Columna fecha PDF'),
  (NULL, 'es-ES', 'insights', 'pdf.history.interactions', 'Interacciones', 'Columna interacciones PDF'),
  (NULL, 'es-ES', 'insights', 'pdf.history.cost', 'Costo (USD)', 'Columna costo PDF'),
  (NULL, 'es-ES', 'insights', 'pdf.agents.title', 'Rendimiento de Agentes', 'Título agentes PDF'),
  (NULL, 'es-ES', 'insights', 'pdf.agents.agent', 'Agente', 'Columna agente PDF'),
  (NULL, 'es-ES', 'insights', 'pdf.agents.confidence', 'Confianza Media (%)', 'Columna confianza PDF'),
  (NULL, 'es-ES', 'insights', 'pdf.channels.title', 'Distribución por Canal', 'Título canales PDF'),
  (NULL, 'es-ES', 'insights', 'pdf.channels.channel', 'Canal', 'Columna canal PDF'),
  (NULL, 'es-ES', 'insights', 'pdf.channels.interactions', 'Interacciones', 'Columna interacciones canales PDF'),

  -- ============================================
  -- EXCEL EXPORT
  -- ============================================
  (NULL, 'pt-BR', 'insights', 'excel.overview.date', 'Data', 'Coluna data Excel'),
  (NULL, 'pt-BR', 'insights', 'excel.overview.interactions', 'Interações', 'Coluna interações Excel'),
  (NULL, 'pt-BR', 'insights', 'excel.overview.cost', 'Custo (USD)', 'Coluna custo Excel'),
  (NULL, 'pt-BR', 'insights', 'excel.channels.channel', 'Canal', 'Coluna canal Excel'),
  (NULL, 'pt-BR', 'insights', 'excel.channels.quantity', 'Quantidade', 'Coluna quantidade Excel'),
  (NULL, 'pt-BR', 'insights', 'excel.agents.agent', 'Agente', 'Coluna agente Excel'),
  (NULL, 'pt-BR', 'insights', 'excel.agents.confidence', 'Confiança Média (%)', 'Coluna confiança Excel'),
  (NULL, 'pt-BR', 'insights', 'excel.summary.metric', 'Métrica', 'Coluna métrica Excel'),
  (NULL, 'pt-BR', 'insights', 'excel.summary.value', 'Valor', 'Coluna valor Excel'),
  (NULL, 'pt-BR', 'insights', 'excel.summary.totalInteractions', 'Total de Interações', 'Métrica total interações Excel'),
  (NULL, 'pt-BR', 'insights', 'excel.summary.totalCost', 'Custo Total (USD)', 'Métrica custo total Excel'),
  (NULL, 'pt-BR', 'insights', 'excel.summary.activeChannels', 'Canais Ativos', 'Métrica canais ativos Excel'),
  (NULL, 'pt-BR', 'insights', 'excel.summary.ragUsage', 'Uso de RAG', 'Métrica uso RAG Excel'),
  
  (NULL, 'en-US', 'insights', 'excel.overview.date', 'Date', 'Excel date column'),
  (NULL, 'en-US', 'insights', 'excel.overview.interactions', 'Interactions', 'Excel interactions column'),
  (NULL, 'en-US', 'insights', 'excel.overview.cost', 'Cost (USD)', 'Excel cost column'),
  (NULL, 'en-US', 'insights', 'excel.channels.channel', 'Channel', 'Excel channel column'),
  (NULL, 'en-US', 'insights', 'excel.channels.quantity', 'Quantity', 'Excel quantity column'),
  (NULL, 'en-US', 'insights', 'excel.agents.agent', 'Agent', 'Excel agent column'),
  (NULL, 'en-US', 'insights', 'excel.agents.confidence', 'Average Confidence (%)', 'Excel confidence column'),
  (NULL, 'en-US', 'insights', 'excel.summary.metric', 'Metric', 'Excel metric column'),
  (NULL, 'en-US', 'insights', 'excel.summary.value', 'Value', 'Excel value column'),
  (NULL, 'en-US', 'insights', 'excel.summary.totalInteractions', 'Total Interactions', 'Total interactions metric Excel'),
  (NULL, 'en-US', 'insights', 'excel.summary.totalCost', 'Total Cost (USD)', 'Total cost metric Excel'),
  (NULL, 'en-US', 'insights', 'excel.summary.activeChannels', 'Active Channels', 'Active channels metric Excel'),
  (NULL, 'en-US', 'insights', 'excel.summary.ragUsage', 'RAG Usage', 'RAG usage metric Excel'),
  
  (NULL, 'es-ES', 'insights', 'excel.overview.date', 'Fecha', 'Columna fecha Excel'),
  (NULL, 'es-ES', 'insights', 'excel.overview.interactions', 'Interacciones', 'Columna interacciones Excel'),
  (NULL, 'es-ES', 'insights', 'excel.overview.cost', 'Costo (USD)', 'Columna costo Excel'),
  (NULL, 'es-ES', 'insights', 'excel.channels.channel', 'Canal', 'Columna canal Excel'),
  (NULL, 'es-ES', 'insights', 'excel.channels.quantity', 'Cantidad', 'Columna cantidad Excel'),
  (NULL, 'es-ES', 'insights', 'excel.agents.agent', 'Agente', 'Columna agente Excel'),
  (NULL, 'es-ES', 'insights', 'excel.agents.confidence', 'Confianza Media (%)', 'Columna confianza Excel'),
  (NULL, 'es-ES', 'insights', 'excel.summary.metric', 'Métrica', 'Columna métrica Excel'),
  (NULL, 'es-ES', 'insights', 'excel.summary.value', 'Valor', 'Columna valor Excel'),
  (NULL, 'es-ES', 'insights', 'excel.summary.totalInteractions', 'Total de Interacciones', 'Métrica total interacciones Excel'),
  (NULL, 'es-ES', 'insights', 'excel.summary.totalCost', 'Costo Total (USD)', 'Métrica costo total Excel'),
  (NULL, 'es-ES', 'insights', 'excel.summary.activeChannels', 'Canales Activos', 'Métrica canales activos Excel'),
  (NULL, 'es-ES', 'insights', 'excel.summary.ragUsage', 'Uso de RAG', 'Métrica uso RAG Excel')

ON CONFLICT (companies_id, language, namespace, key) 
DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();
