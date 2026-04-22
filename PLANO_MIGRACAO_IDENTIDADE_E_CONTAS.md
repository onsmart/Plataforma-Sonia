# Plano de Migracao de Identidade, Login, Cadastro e Separacao de Contas

## Objetivo

Este documento descreve um plano seguro e incremental para evoluir a arquitetura de login, cadastro, identidade de usuario, separacao por empresa e controle de acesso da plataforma SONIA sem quebrar os fluxos que ja estao funcionando.

O foco principal e:

- preservar login e cadastro atuais durante a transicao
- reduzir risco de inconsistencias entre autenticacao e dados internos
- preparar suporte robusto a multiempresa
- centralizar papeis, permissoes e recursos por plano
- permitir rollout em fases com rollback simples

## Contexto Atual

Hoje o projeto depende de uma combinacao de camadas:

- `Supabase Auth` para autenticacao, sessao e token
- `tb_users` como fonte interna de identidade usada por varios fluxos
- `tb_company_users` para vincular usuarios a empresas
- `role` e `basic.admin` para autorizacao administrativa
- `tb_subscriptions` e helpers de plano para liberar ou bloquear recursos por empresa

Na pratica, a conta do usuario hoje nao vive em um unico lugar. Parte dela esta no `Supabase Auth`, parte no banco interno da aplicacao e parte na estrutura de empresa/permissoes. Isso cria acoplamento e aumenta o risco de divergencia.

## Principios de Migracao

Para nao quebrar o projeto, toda implementacao deve respeitar estes principios:

1. Nao substituir o fluxo atual de uma vez.
2. Nao remover tabelas, RPCs ou campos legados na primeira etapa.
3. Ler do modelo novo com fallback para o legado antes de migrar todas as escritas.
4. Manter compatibilidade de contrato para frontend e backend durante a transicao.
5. Usar feature flags ou gates de ativacao sempre que a mudanca afetar fluxo critico.
6. Cada fase deve ter validacao objetiva e rollback simples.

## Arquitetura-Alvo

A arquitetura desejada ao final da migracao e:

- `Supabase Auth` como unica fonte de verdade para credenciais
- `user_profiles` como perfil de negocio do usuario
- `companies` como entidade de empresa
- `company_memberships` como vinculo usuario x empresa
- `active_company` explicita quando houver multiplas empresas
- `roles`, `permissions` e grants centralizados
- `entitlements` derivados do plano da empresa
- `AuthContext` unificado no frontend

### Responsabilidades da arquitetura-alvo

- Autenticacao: `Supabase Auth`
- Perfil do usuario: `user_profiles`
- Vinculo com empresa: `company_memberships`
- Empresa ativa: contexto explicito
- Autorizacao: `roles + permissions + grants`
- Liberacao de recursos: `entitlements` por plano

## Resultado Esperado

Ao final da migracao, a plataforma deve ter:

- login e logout previsiveis
- cadastro consistente
- troca de senha sem duplicidade de regra
- suporte real a multiplas empresas por usuario
- empresa ativa explicita
- autorizacao centralizada e auditavel
- separacao clara entre permissao por papel e recurso por plano

## Fase 0 - Inventario e Congelamento de Contrato

### Objetivo

Mapear todas as dependencias atuais de identidade, empresa, permissao e plano antes de qualquer refatoracao estrutural.

### Escopo

- listar arquivos do frontend que usam `session`, `userId`, `companiesId`, `hasCompany`
- listar servicos e helpers que leem `tb_users`
- listar rotas e middlewares que usam `tb_company_users`, `role` e `basic.admin`
- listar validacoes de plano e recursos liberados por assinatura
- identificar RPCs legadas que fazem parte do fluxo de conta

### Entregas

- inventario de pontos de uso
- lista de contratos legados obrigatorios
- checklist do que nao pode mudar nas primeiras fases

### Riscos

- dependencia escondida em RPC nao versionada no repositorio
- comportamento legado implicito usado por telas aparentemente nao relacionadas

### Mitigacao

- mapear o maximo de chamadas por busca textual
- validar comportamento critico em ambiente de homologacao antes de migrar

## Fase 1 - Introducao do Modelo Novo em Paralelo

### Objetivo

Criar a base do novo modelo de identidade sem alterar o fluxo em producao.

### Estruturas sugeridas

- `user_profiles`
- `companies`
- `company_memberships`
- `role_definitions`
- `permission_definitions`
- `role_permissions`
- `user_permission_grants`
- `company_entitlements`

### Regras desta fase

- nenhuma tela deve depender dessas tabelas ainda
- nenhum fluxo atual deve deixar de funcionar se as novas estruturas estiverem vazias
- o novo modelo nasce em paralelo ao legado

### Entregas

- migrations do novo modelo
- indexes e constraints essenciais
- definicao de chave de compatibilidade com dados atuais

### Riscos

- modelagem nova nao refletir casos reais do negocio
- duplicacao de relacoes sem estrategia de reconciliacao

### Mitigacao

- manter naming claro
- nao apagar o legado
- adicionar scripts ou consultas de consistencia

## Fase 2 - Backfill e Sincronizacao Inicial

### Objetivo

Popular o modelo novo com base no modelo legado sem alterar o fluxo atual.

### Escopo

- criar `user_profiles` a partir de `tb_users`
- criar `companies` quando necessario a partir das referencias existentes
- criar `company_memberships` a partir de `tb_company_users`
- inferir owner/admin inicial com base no estado atual
- gerar entitlements iniciais a partir do plano da empresa

### Entregas

- script de backfill idempotente
- relatorio de inconsistencias
- contagem de usuarios/empresas/memberships migrados

### Validacoes

- usuario legado tem profile correspondente
- membership criado aponta para empresa valida
- empresa com assinatura tem entitlements coerentes

### Riscos

- usuarios sem empresa
- empresas duplicadas
- memberships ambiguos

### Mitigacao

- marcar registros ambiguos para revisao
- nao bloquear migracao por registros anormais; apenas sinalizar

## Fase 3 - Servico Central de Identidade no Backend

### Objetivo

Parar de espalhar a logica de identidade em varios helpers, middlewares e consultas manuais.

### Proposta

Criar um servico central, por exemplo `identity.service`, responsavel por resolver:

- usuario autenticado
- profile
- memberships
- empresa ativa
- role efetiva
- permissoes efetivas
- entitlements efetivos

### Estrategia

Inicialmente esse servico usa `dual-read`:

- le primeiro do modelo novo
- se faltar dado, faz fallback para o legado

### Entregas

- servico de identidade
- DTO unico de contexto de identidade
- helper de resolucao de empresa ativa

### Beneficios

- reduz duplicacao
- facilita observabilidade
- prepara migracao do frontend

### Riscos

- regressao em middlewares de autorizacao

### Mitigacao

- manter comportamento legado como fallback
- testar rotas administrativas e de plano antes de promover uso amplo

## Fase 4 - Cadastro com Dual-Write

### Objetivo

Fazer com que novos cadastros alimentem tanto o fluxo atual quanto o novo modelo.

### Regras

- o cadastro continua autenticando no `Supabase Auth`
- o fluxo atual continua criando os registros internos esperados
- em paralelo, o novo profile e o novo membership tambem sao gravados

### Entregas

- escrita em paralelo no modelo novo
- validacao pos-cadastro
- logs estruturados de consistencia

### Checkpoints de consistencia

- usuario criado no Auth
- profile criado
- empresa criada ou vinculada
- membership criado com role correta
- empresa ativa inicial definida

### Riscos

- erro parcial entre Auth e banco interno
- cadastro concluir em uma camada e falhar em outra

### Mitigacao

- usar operacoes transacionais onde possivel
- registrar falhas de reconciliacao
- manter fallback para login manual quando auto-login falhar

## Fase 5 - AuthContext Unificado com Compatibilidade

### Objetivo

Evoluir o frontend para consumir um contexto consolidado de identidade sem quebrar telas antigas.

### Novo contexto desejado

- `user`
- `profile`
- `memberships`
- `activeCompany`
- `role`
- `permissions`
- `entitlements`

### Compatibilidade temporaria

Enquanto houver telas legadas, manter exposicao de:

- `userId`
- `companiesId`
- `hasCompany`

### Regras

- nenhuma tela antiga deve ser obrigada a migrar no mesmo commit
- adaptadores podem ser usados temporariamente
- dados novos devem chegar prontos ao frontend, evitando consultas espalhadas

### Riscos

- telas dependerem de formato legado de estado

### Mitigacao

- manter aliases temporarios
- migrar telas por bloco funcional

## Fase 6 - Empresa Ativa Explicita

### Objetivo

Eliminar a regra fragil de assumir a primeira empresa por `created_at` quando o usuario tiver mais de uma.

### Nova regra

- usuario com uma empresa entra direto
- usuario com multiplas empresas escolhe a empresa ativa
- empresa ativa pode ficar persistida por sessao ou preferencia do usuario

### Entregas

- resolvedor de empresa ativa
- persistencia da empresa ativa
- comportamento consistente para multiempresa

### Riscos

- telas antigas assumirem `companiesId` unico e imutavel

### Mitigacao

- manter `companiesId` apontando para a empresa ativa atual
- revisar servicos criticos antes de habilitar troca de empresa

## Fase 7 - Autorizacao Centralizada

### Objetivo

Unificar a autorizacao da plataforma em uma unica fonte logica.

### O que centralizar

- verificacao de admin
- verificacao de owner
- grants individuais
- permissoes derivadas de role
- recursos liberados pelo plano

### Separacao conceitual

- role determina responsabilidade organizacional
- permissao determina acesso granular
- entitlement determina o que o plano libera

### Entregas

- funcoes unificadas de autorizacao
- substituicao de checagens manuais repetidas
- auditoria mais previsivel

### Riscos

- divergencia entre permissao por role e permissao por grant

### Mitigacao

- documentar precedencia das regras
- adicionar testes especificos de combinacao role + grant + plano

## Fase 8 - Desativacao do Legado

### Objetivo

Retirar gradualmente a dependencia das estruturas antigas quando o modelo novo estiver validado.

### Criterios para iniciar

- leituras do modelo novo estaveis
- cadastros novos 100% consistentes
- fluxos principais cobertos por testes
- divergencia entre legado e novo abaixo de limite aceitavel

### Itens passiveis de aposentadoria

- RPCs legadas redundantes
- consultas diretas espalhadas a `tb_users` e `tb_company_users`
- duplicidade de senha em banco interno
- helpers antigos substituidos pelo servico central

### Riscos

- codigo pouco usado ainda depender do legado

### Mitigacao

- desativacao por etapas
- observabilidade reforcada
- rollback disponivel por feature flag

## Estrategia de Testes

Cada fase deve ter testes funcionais e validacoes manuais minimas.

### Fluxos obrigatorios

- login com conta existente
- cadastro com conta nova
- auto-login apos cadastro
- logout
- refresh de sessao
- troca de senha
- usuario sem empresa
- usuario com empresa
- usuario admin
- usuario nao admin
- plano starter
- plano pro
- plano enterprise

### Telas criticas para regressao

- Auth / Login / Cadastro
- Cockpit
- Inbox
- Agents
- Configuration
- Profile
- Knowledge Base
- Billing / Plano
- Governance

### Validacoes tecnicas

- token valido continua autenticando backend
- empresa ativa resolvida corretamente
- role e permissao retornam valores esperados
- restricoes por plano continuam funcionando

## Observabilidade

Durante a migracao, adicionar visibilidade sobre o comportamento do sistema.

### Logs recomendados

- resolucao de usuario autenticado
- resolucao de empresa ativa
- fallback do novo modelo para o legado
- falha de sincronizacao no cadastro
- diferenca entre role esperada e role efetiva
- divergencia de entitlements

### Relatorios recomendados

- usuarios sem profile
- usuarios sem membership
- memberships sem empresa
- empresas sem owner
- usuarios com mais de uma empresa sem empresa ativa definida

## Rollback

Toda fase deve poder ser revertida com baixo risco.

### Estrategia geral

- manter tabelas legadas intactas ate a fase final
- usar feature flag para leitura do modelo novo
- usar feature flag para dual-write
- nunca remover fallback antes da validacao completa

### Exemplos de rollback por fase

- Fase 1: ignorar o novo modelo
- Fase 2: parar backfill e manter legado
- Fase 3: desligar `identity.service` como fonte principal
- Fase 4: desligar dual-write
- Fase 5: voltar `AuthContext` ao formato legado
- Fase 6: voltar empresa ativa para a regra atual temporariamente

## Criterios de Conclusao

A migracao so deve ser considerada concluida quando:

- o login depender apenas do `Supabase Auth` para credenciais
- o perfil de negocio estiver centralizado
- o vinculo com empresa estiver claro e auditavel
- a empresa ativa estiver explicita
- a autorizacao estiver centralizada
- os recursos por plano forem resolvidos em camada unica
- o legado redundante puder ser removido com seguranca

## Ordem Recomendada de Implementacao

1. Inventario e congelamento de contrato
2. Criacao do novo schema
3. Backfill inicial
4. Servico central de identidade com dual-read
5. Cadastro com dual-write
6. AuthContext unificado com compatibilidade
7. Empresa ativa explicita
8. Autorizacao centralizada
9. Desativacao gradual do legado

## Decisao Recomendada para a Proxima Etapa

A proxima etapa recomendada e transformar este plano em execucao tecnica controlada, com:

- lista de arquivos a alterar por fase
- migrations especificas
- feature flags de rollout
- checklist de testes por commit
- estrategia de homologacao e validacao antes de producao

Esse passo deve ser feito antes de qualquer mudanca estrutural no codigo de autenticacao.
