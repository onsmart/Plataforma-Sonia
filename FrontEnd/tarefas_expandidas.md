# Tarefas do Projeto - Plataforma de Atendimento SONIA

## BACKLOG

## Melhorias na Autenticação
Adicionar recuperação de senha e verificação de email por dois fatores para aumentar a segurança do sistema de autenticação.

## Dashboard de Métricas
Implementar gráficos e visualizações de dados para acompanhar o desempenho dos agentes e métricas de atendimento em tempo real.

## Sistema de Notificações em Tempo Real
Criar sistema de notificações push para alertar sobre eventos importantes como novos leads, escalações e erros críticos.

## Integração com CRM
Desenvolver integração com sistemas CRM populares para sincronização automática de dados de clientes e oportunidades.

## A FAZER (PRIORIZADAS)

## Validação de Formulários
Implementar validação completa nos formulários de criação de agentes e templates, incluindo feedback visual de erros e mensagens de ajuda contextual.

## Filtros e Busca Avançada
Adicionar funcionalidade de busca e filtros na lista de agentes e templates para facilitar a localização de itens específicos.

## Exportação de Dados
Criar funcionalidade para exportar listas de agentes, templates e relatórios em formatos CSV e PDF.

## Histórico de Alterações
Implementar sistema de versionamento e histórico de alterações para rastrear mudanças em agentes e configurações.

## EM ANDAMENTO

## Otimização de Performance
Melhorar o carregamento de dados e reduzir chamadas desnecessárias à API, implementando cache e paginação onde apropriado.

## Testes de Integração
Desenvolver testes automatizados para validar o fluxo completo de autenticação, criação de agentes e templates.

## EM REVISÃO / TESTES

## Correção de Loading Infinito
Verificar e garantir que os estados de loading sejam gerenciados corretamente em todas as operações assíncronas, especialmente durante a inicialização do componente.

## Validação de Permissões
Testar o sistema de filtragem por user_id para garantir que usuários só vejam e modifiquem seus próprios recursos.

## BLOQUEADO / AGUARDANDO

## Documentação da API
Aguardando definição final dos endpoints e parâmetros para documentar completamente a API do backend.

## Integração com Serviços Externos
Aguardando aprovação e credenciais para integração com serviços de terceiros como WhatsApp Business API e sistemas de telefonia.

## CONCLUÍDO

## Implementação de Autenticação com Stored Procedures
Implementado fluxo de login e registro usando stored procedures do Supabase, incluindo criptografia SHA-256 de senhas e armazenamento global de user_id.

## Criação de Templates de Agentes
Desenvolvido sistema completo para criação e gerenciamento de templates de agentes, incluindo seleção de skills via combobox e validação de campos.

## Integração de Tooltips Informativos
Adicionados tooltips contextuais em todos os campos do formulário de criação de templates para melhorar a experiência do usuário.

## Filtragem por User ID
Implementada filtragem de agentes e templates por user_id em todas as operações de busca e criação para garantir isolamento de dados entre usuários.

## Correção de Navegação Pós-Login
Corrigido redirecionamento após login para a página correta (Cockpit/Dashboard) usando o contexto de navegação adequado.

## Armazenamento Global de Dados do Usuário
Implementado armazenamento global de user_id, nome e sobrenome no AuthContext para acesso em toda a aplicação.
