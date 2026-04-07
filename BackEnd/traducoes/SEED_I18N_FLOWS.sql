-- ============================================
-- SEED I18N: Flows
-- ============================================
-- Traduções para a página de Flows
-- Idiomas: pt-BR, en-US, es-ES
-- ============================================

INSERT INTO public.tb_i18n_translations (companies_id, language, namespace, key, value, description)
VALUES
  -- ============================================
  -- BUTTONS
  -- ============================================
  (NULL, 'pt-BR', 'flows', 'button.blocks', 'Blocos', 'Botão blocos'),
  (NULL, 'pt-BR', 'flows', 'button.agents', 'Agentes', 'Botão agentes'),
  (NULL, 'pt-BR', 'flows', 'button.clearCanvas', 'Limpar Quadro', 'Botão limpar quadro'),
  (NULL, 'pt-BR', 'flows', 'button.saveFlow', 'Salvar Fluxo', 'Botão salvar fluxo'),
  (NULL, 'pt-BR', 'flows', 'button.deleteSelectedBlock', 'Remover Bloco', 'BotÃ£o remover bloco selecionado'),
  (NULL, 'pt-BR', 'flows', 'button.deleteFlow', 'Deletar flow', 'Tooltip deletar flow'),
  (NULL, 'pt-BR', 'flows', 'button.cancel', 'Cancelar', 'Botão cancelar'),
  (NULL, 'pt-BR', 'flows', 'button.save', 'Salvar', 'Botão salvar'),
  
  (NULL, 'en-US', 'flows', 'button.blocks', 'Blocks', 'Blocks button'),
  (NULL, 'en-US', 'flows', 'button.agents', 'Agents', 'Agents button'),
  (NULL, 'en-US', 'flows', 'button.clearCanvas', 'Clear Canvas', 'Clear canvas button'),
  (NULL, 'en-US', 'flows', 'button.deleteSelectedBlock', 'Remove Block', 'Remove selected block button'),
  (NULL, 'en-US', 'flows', 'button.saveFlow', 'Save Flow', 'Save flow button'),
  (NULL, 'en-US', 'flows', 'button.deleteFlow', 'Delete flow', 'Delete flow tooltip'),
  (NULL, 'en-US', 'flows', 'button.cancel', 'Cancel', 'Cancel button'),
  (NULL, 'en-US', 'flows', 'button.save', 'Save', 'Save button'),
  
  (NULL, 'es-ES', 'flows', 'button.blocks', 'Bloques', 'Botón bloques'),
  (NULL, 'es-ES', 'flows', 'button.agents', 'Agentes', 'Botón agentes'),
  (NULL, 'es-ES', 'flows', 'button.clearCanvas', 'Limpiar Lienzo', 'Botón limpiar lienzo'),
  (NULL, 'es-ES', 'flows', 'button.saveFlow', 'Guardar Flujo', 'Botón guardar flujo'),
  (NULL, 'es-ES', 'flows', 'button.deleteSelectedBlock', 'Eliminar Bloque', 'BotÃ³n eliminar bloque seleccionado'),
  (NULL, 'es-ES', 'flows', 'button.deleteFlow', 'Eliminar flujo', 'Tooltip eliminar flujo'),
  (NULL, 'es-ES', 'flows', 'button.cancel', 'Cancelar', 'Botón cancelar'),
  (NULL, 'es-ES', 'flows', 'button.save', 'Guardar', 'Botón guardar'),

  -- ============================================
  -- SELECT
  -- ============================================
  (NULL, 'pt-BR', 'flows', 'select.flow', 'Selecione um flow', 'Placeholder select flow'),
  
  (NULL, 'en-US', 'flows', 'select.flow', 'Select a flow', 'Flow select placeholder'),
  
  (NULL, 'es-ES', 'flows', 'select.flow', 'Selecciona un flujo', 'Placeholder select flujo'),

  -- ============================================
  -- EDITOR
  -- ============================================
  (NULL, 'pt-BR', 'flows', 'editor.title', 'Editor de Fluxo', 'Título do editor'),
  (NULL, 'pt-BR', 'flows', 'editor.tooltip', 'Arraste blocos do menu lateral para criar seu fluxo. Clique com botão direito nos blocos de controle para editá-los.', 'Tooltip do editor'),
  (NULL, 'pt-BR', 'flows', 'editor.description', 'Arraste, conecte e defina a lógica entre os agentes', 'Descrição do editor'),
  
  (NULL, 'en-US', 'flows', 'editor.title', 'Flow Editor', 'Editor title'),
  (NULL, 'en-US', 'flows', 'editor.tooltip', 'Drag blocks from the side menu to create your flow. Right-click on control blocks to edit them.', 'Editor tooltip'),
  (NULL, 'en-US', 'flows', 'editor.description', 'Drag, connect and define the logic between agents', 'Editor description'),
  
  (NULL, 'es-ES', 'flows', 'editor.title', 'Editor de Flujo', 'Título del editor'),
  (NULL, 'es-ES', 'flows', 'editor.tooltip', 'Arrastra bloques del menú lateral para crear tu flujo. Haz clic derecho en los bloques de control para editarlos.', 'Tooltip del editor'),
  (NULL, 'es-ES', 'flows', 'editor.description', 'Arrastra, conecta y define la lógica entre los agentes', 'Descripción del editor'),

  -- ============================================
  -- EMPTY STATES
  -- ============================================
  (NULL, 'pt-BR', 'flows', 'empty.startCreating', 'Comece criando seu fluxo', 'Título estado vazio'),
  (NULL, 'pt-BR', 'flows', 'empty.startCreatingDescription', 'Arraste blocos do menu lateral ou clique em "Blocos" para adicionar o primeiro elemento', 'Descrição estado vazio'),
  (NULL, 'pt-BR', 'flows', 'empty.noFlows', 'Nenhum flow encontrado', 'Mensagem sem flows'),
  
  (NULL, 'en-US', 'flows', 'empty.startCreating', 'Start creating your flow', 'Empty state title'),
  (NULL, 'en-US', 'flows', 'empty.startCreatingDescription', 'Drag blocks from the side menu or click "Blocks" to add the first element', 'Empty state description'),
  (NULL, 'en-US', 'flows', 'empty.noFlows', 'No flows found', 'No flows message'),
  
  (NULL, 'es-ES', 'flows', 'empty.startCreating', 'Comienza a crear tu flujo', 'Título estado vacío'),
  (NULL, 'es-ES', 'flows', 'empty.startCreatingDescription', 'Arrastra bloques del menú lateral o haz clic en "Bloques" para agregar el primer elemento', 'Descripción estado vacío'),
  (NULL, 'es-ES', 'flows', 'empty.noFlows', 'Ningún flujo encontrado', 'Mensaje sin flujos'),

  -- ============================================
  -- BLOCKS
  -- ============================================
  (NULL, 'pt-BR', 'flows', 'blocks.start', 'Início', 'Label bloco início'),
  (NULL, 'pt-BR', 'flows', 'blocks.stop', 'Fim', 'Label bloco fim'),
  (NULL, 'pt-BR', 'flows', 'blocks.ifElse', 'Condicional', 'Label bloco condicional'),
  (NULL, 'pt-BR', 'flows', 'blocks.loop', 'Loop', 'Label bloco loop'),
  (NULL, 'pt-BR', 'flows', 'blocks.comment', 'Comentário', 'Label bloco comentário'),
  (NULL, 'pt-BR', 'flows', 'blocks.delay', 'Aguardar', 'Label bloco aguardar'),
  (NULL, 'pt-BR', 'flows', 'blocks.delayDuration', '5 segundos', 'Duração padrão aguardar'),
  
  (NULL, 'en-US', 'flows', 'blocks.start', 'Start', 'Start block label'),
  (NULL, 'en-US', 'flows', 'blocks.stop', 'Stop', 'Stop block label'),
  (NULL, 'en-US', 'flows', 'blocks.ifElse', 'Conditional', 'Conditional block label'),
  (NULL, 'en-US', 'flows', 'blocks.loop', 'Loop', 'Loop block label'),
  (NULL, 'en-US', 'flows', 'blocks.comment', 'Comment', 'Comment block label'),
  (NULL, 'en-US', 'flows', 'blocks.delay', 'Wait', 'Wait block label'),
  (NULL, 'en-US', 'flows', 'blocks.delayDuration', '5 seconds', 'Default wait duration'),
  
  (NULL, 'es-ES', 'flows', 'blocks.start', 'Inicio', 'Etiqueta bloque inicio'),
  (NULL, 'es-ES', 'flows', 'blocks.stop', 'Fin', 'Etiqueta bloque fin'),
  (NULL, 'es-ES', 'flows', 'blocks.ifElse', 'Condicional', 'Etiqueta bloque condicional'),
  (NULL, 'es-ES', 'flows', 'blocks.loop', 'Bucle', 'Etiqueta bloque bucle'),
  (NULL, 'es-ES', 'flows', 'blocks.comment', 'Comentario', 'Etiqueta bloque comentario'),
  (NULL, 'es-ES', 'flows', 'blocks.delay', 'Esperar', 'Etiqueta bloque esperar'),
  (NULL, 'es-ES', 'flows', 'blocks.delayDuration', '5 segundos', 'Duración predeterminada esperar'),

  -- ============================================
  -- DIALOG: SAVE FLOW
  -- ============================================
  (NULL, 'pt-BR', 'flows', 'dialog.saveFlow.title', 'Salvar Fluxo', 'Título do diálogo'),
  (NULL, 'pt-BR', 'flows', 'dialog.saveFlow.description', 'Digite um nome para salvar este fluxo', 'Descrição do diálogo'),
  (NULL, 'pt-BR', 'flows', 'dialog.saveFlow.nameLabel', 'Nome do Fluxo', 'Label do campo nome'),
  (NULL, 'pt-BR', 'flows', 'dialog.saveFlow.namePlaceholder', 'Ex: Fluxo de Atendimento', 'Placeholder do campo nome'),
  
  (NULL, 'en-US', 'flows', 'dialog.saveFlow.title', 'Save Flow', 'Dialog title'),
  (NULL, 'en-US', 'flows', 'dialog.saveFlow.description', 'Enter a name to save this flow', 'Dialog description'),
  (NULL, 'en-US', 'flows', 'dialog.saveFlow.nameLabel', 'Flow Name', 'Name field label'),
  (NULL, 'en-US', 'flows', 'dialog.saveFlow.namePlaceholder', 'Ex: Support Flow', 'Name field placeholder'),
  
  (NULL, 'es-ES', 'flows', 'dialog.saveFlow.title', 'Guardar Flujo', 'Título del diálogo'),
  (NULL, 'es-ES', 'flows', 'dialog.saveFlow.description', 'Ingresa un nombre para guardar este flujo', 'Descripción del diálogo'),
  (NULL, 'es-ES', 'flows', 'dialog.saveFlow.nameLabel', 'Nombre del Flujo', 'Etiqueta del campo nombre'),
  (NULL, 'es-ES', 'flows', 'dialog.saveFlow.namePlaceholder', 'Ej: Flujo de Atención', 'Placeholder del campo nombre'),

  -- ============================================
  -- LOADING
  -- ============================================
  (NULL, 'pt-BR', 'flows', 'loading.loading', 'Carregando...', 'Mensagem de carregamento'),
  
  (NULL, 'en-US', 'flows', 'loading.loading', 'Loading...', 'Loading message'),
  
  (NULL, 'es-ES', 'flows', 'loading.loading', 'Cargando...', 'Mensaje de carga'),

  -- ============================================
  -- ERRORS
  -- ============================================
  (NULL, 'pt-BR', 'flows', 'errors.connectInvalidNodes', 'Erro ao conectar: nodes inválidos', 'Erro conectar nodes inválidos'),
  (NULL, 'pt-BR', 'flows', 'errors.connectNodesNotFound', 'Erro ao conectar: nodes não encontrados', 'Erro conectar nodes não encontrados'),
  (NULL, 'pt-BR', 'flows', 'errors.loadFlows', 'Erro ao carregar flows', 'Erro carregar flows'),
  (NULL, 'pt-BR', 'flows', 'errors.loadFlow', 'Erro ao carregar flow', 'Erro carregar flow'),
  (NULL, 'pt-BR', 'flows', 'errors.loadFlowCompanyNotFound', 'Erro ao carregar flow: empresa não encontrada', 'Erro carregar flow empresa'),
  (NULL, 'pt-BR', 'flows', 'errors.deleteFlow', 'Erro ao deletar flow', 'Erro deletar flow'),
  (NULL, 'pt-BR', 'flows', 'errors.deleteFlowCompanyNotFound', 'Erro ao deletar flow: empresa não encontrada', 'Erro deletar flow empresa'),
  (NULL, 'pt-BR', 'flows', 'errors.loadAgents', 'Erro ao carregar agentes', 'Erro carregar agentes'),
  (NULL, 'pt-BR', 'flows', 'errors.addNode', 'Erro ao adicionar nó. Tente novamente.', 'Erro adicionar nó'),
  (NULL, 'pt-BR', 'flows', 'errors.blockTypeNotFound', 'Tipo de bloco "{{type}}" não encontrado', 'Erro tipo bloco não encontrado'),
  (NULL, 'pt-BR', 'flows', 'errors.nameRequired', 'Por favor, informe um nome para o fluxo', 'Erro nome obrigatório'),
  (NULL, 'pt-BR', 'flows', 'errors.userNotAuthenticated', 'Usuário não autenticado', 'Erro usuário não autenticado'),
  (NULL, 'pt-BR', 'flows', 'errors.startBlockRequired', 'Por favor, adicione um bloco ''Início'' ao fluxo', 'Erro bloco início obrigatório'),
  (NULL, 'pt-BR', 'flows', 'errors.saveFlow', 'Erro ao salvar flow', 'Erro salvar flow'),
  (NULL, 'pt-BR', 'flows', 'errors.saveFlowCompanyNotFound', 'Erro ao salvar flow: empresa não encontrada', 'Erro salvar flow empresa'),
  
  (NULL, 'en-US', 'flows', 'errors.connectInvalidNodes', 'Error connecting: invalid nodes', 'Connect invalid nodes error'),
  (NULL, 'en-US', 'flows', 'errors.connectNodesNotFound', 'Error connecting: nodes not found', 'Connect nodes not found error'),
  (NULL, 'en-US', 'flows', 'errors.loadFlows', 'Error loading flows', 'Load flows error'),
  (NULL, 'en-US', 'flows', 'errors.loadFlow', 'Error loading flow', 'Load flow error'),
  (NULL, 'en-US', 'flows', 'errors.loadFlowCompanyNotFound', 'Error loading flow: company not found', 'Load flow company error'),
  (NULL, 'en-US', 'flows', 'errors.deleteFlow', 'Error deleting flow', 'Delete flow error'),
  (NULL, 'en-US', 'flows', 'errors.deleteFlowCompanyNotFound', 'Error deleting flow: company not found', 'Delete flow company error'),
  (NULL, 'en-US', 'flows', 'errors.loadAgents', 'Error loading agents', 'Load agents error'),
  (NULL, 'en-US', 'flows', 'errors.addNode', 'Error adding node. Please try again.', 'Add node error'),
  (NULL, 'en-US', 'flows', 'errors.blockTypeNotFound', 'Block type "{{type}}" not found', 'Block type not found error'),
  (NULL, 'en-US', 'flows', 'errors.nameRequired', 'Please enter a name for the flow', 'Name required error'),
  (NULL, 'en-US', 'flows', 'errors.userNotAuthenticated', 'User not authenticated', 'User not authenticated error'),
  (NULL, 'en-US', 'flows', 'errors.startBlockRequired', 'Please add a ''Start'' block to the flow', 'Start block required error'),
  (NULL, 'en-US', 'flows', 'errors.saveFlow', 'Error saving flow', 'Save flow error'),
  (NULL, 'en-US', 'flows', 'errors.saveFlowCompanyNotFound', 'Error saving flow: company not found', 'Save flow company error'),
  
  (NULL, 'es-ES', 'flows', 'errors.connectInvalidNodes', 'Error al conectar: nodos inválidos', 'Error conectar nodos inválidos'),
  (NULL, 'es-ES', 'flows', 'errors.connectNodesNotFound', 'Error al conectar: nodos no encontrados', 'Error conectar nodos no encontrados'),
  (NULL, 'es-ES', 'flows', 'errors.loadFlows', 'Error al cargar flujos', 'Error cargar flujos'),
  (NULL, 'es-ES', 'flows', 'errors.loadFlow', 'Error al cargar flujo', 'Error cargar flujo'),
  (NULL, 'es-ES', 'flows', 'errors.loadFlowCompanyNotFound', 'Error al cargar flujo: empresa no encontrada', 'Error cargar flujo empresa'),
  (NULL, 'es-ES', 'flows', 'errors.deleteFlow', 'Error al eliminar flujo', 'Error eliminar flujo'),
  (NULL, 'es-ES', 'flows', 'errors.deleteFlowCompanyNotFound', 'Error al eliminar flujo: empresa no encontrada', 'Error eliminar flujo empresa'),
  (NULL, 'es-ES', 'flows', 'errors.loadAgents', 'Error al cargar agentes', 'Error cargar agentes'),
  (NULL, 'es-ES', 'flows', 'errors.addNode', 'Error al agregar nodo. Intenta nuevamente.', 'Error agregar nodo'),
  (NULL, 'es-ES', 'flows', 'errors.blockTypeNotFound', 'Tipo de bloque "{{type}}" no encontrado', 'Error tipo bloque no encontrado'),
  (NULL, 'es-ES', 'flows', 'errors.nameRequired', 'Por favor, ingresa un nombre para el flujo', 'Error nombre obligatorio'),
  (NULL, 'es-ES', 'flows', 'errors.userNotAuthenticated', 'Usuario no autenticado', 'Error usuario no autenticado'),
  (NULL, 'es-ES', 'flows', 'errors.startBlockRequired', 'Por favor, agrega un bloque ''Inicio'' al flujo', 'Error bloque inicio obligatorio'),
  (NULL, 'es-ES', 'flows', 'errors.saveFlow', 'Error al guardar flujo', 'Error guardar flujo'),
  (NULL, 'es-ES', 'flows', 'errors.saveFlowCompanyNotFound', 'Error al guardar flujo: empresa no encontrada', 'Error guardar flujo empresa'),

  -- ============================================
  -- SUCCESS
  -- ============================================
  (NULL, 'pt-BR', 'flows', 'success.nodeUpdated', 'Node atualizado com sucesso!', 'Sucesso atualizar node'),
  (NULL, 'pt-BR', 'flows', 'success.flowLoaded', 'Flow carregado e normalizado com sucesso!', 'Sucesso carregar flow'),
  (NULL, 'pt-BR', 'flows', 'success.flowDeleted', 'Flow deletado com sucesso!', 'Sucesso deletar flow'),
  (NULL, 'pt-BR', 'flows', 'success.flowSaved', 'Fluxo salvo com sucesso!', 'Sucesso salvar flow'),
  (NULL, 'pt-BR', 'flows', 'success.connectionsDeleted', '{{count}} conexão(ões) deletada(s)', 'Sucesso deletar conexões'),
  (NULL, 'pt-BR', 'flows', 'success.nodesDeleted', '{{count}} nó(s) deletado(s)', 'Sucesso deletar nós'),
  (NULL, 'pt-BR', 'flows', 'success.agentAdded', 'Agente "{{name}}" adicionado ao fluxo', 'Sucesso adicionar agente'),
  (NULL, 'pt-BR', 'flows', 'success.blockAdded', 'Bloco "{{name}}" adicionado', 'Sucesso adicionar bloco'),
  (NULL, 'pt-BR', 'flows', 'success.canvasCleared', 'Quadro limpo com sucesso!', 'Sucesso limpar quadro'),
  
  (NULL, 'en-US', 'flows', 'success.nodeUpdated', 'Node updated successfully!', 'Update node success'),
  (NULL, 'en-US', 'flows', 'success.flowLoaded', 'Flow loaded and normalized successfully!', 'Load flow success'),
  (NULL, 'en-US', 'flows', 'success.flowDeleted', 'Flow deleted successfully!', 'Delete flow success'),
  (NULL, 'en-US', 'flows', 'success.flowSaved', 'Flow saved successfully!', 'Save flow success'),
  (NULL, 'en-US', 'flows', 'success.connectionsDeleted', '{{count}} connection(s) deleted', 'Delete connections success'),
  (NULL, 'en-US', 'flows', 'success.nodesDeleted', '{{count}} node(s) deleted', 'Delete nodes success'),
  (NULL, 'en-US', 'flows', 'success.agentAdded', 'Agent "{{name}}" added to flow', 'Add agent success'),
  (NULL, 'en-US', 'flows', 'success.blockAdded', 'Block "{{name}}" added', 'Add block success'),
  (NULL, 'en-US', 'flows', 'success.canvasCleared', 'Canvas cleared successfully!', 'Clear canvas success'),
  
  (NULL, 'es-ES', 'flows', 'success.nodeUpdated', '¡Nodo actualizado con éxito!', 'Éxito actualizar nodo'),
  (NULL, 'es-ES', 'flows', 'success.flowLoaded', '¡Flujo cargado y normalizado con éxito!', 'Éxito cargar flujo'),
  (NULL, 'es-ES', 'flows', 'success.flowDeleted', '¡Flujo eliminado con éxito!', 'Éxito eliminar flujo'),
  (NULL, 'es-ES', 'flows', 'success.flowSaved', '¡Flujo guardado con éxito!', 'Éxito guardar flujo'),
  (NULL, 'es-ES', 'flows', 'success.connectionsDeleted', '{{count}} conexión(es) eliminada(s)', 'Éxito eliminar conexiones'),
  (NULL, 'es-ES', 'flows', 'success.nodesDeleted', '{{count}} nodo(s) eliminado(s)', 'Éxito eliminar nodos'),
  (NULL, 'es-ES', 'flows', 'success.agentAdded', 'Agente "{{name}}" agregado al flujo', 'Éxito agregar agente'),
  (NULL, 'es-ES', 'flows', 'success.blockAdded', 'Bloque "{{name}}" agregado', 'Éxito agregar bloque'),
  (NULL, 'es-ES', 'flows', 'success.canvasCleared', '¡Lienzo limpiado con éxito!', 'Éxito limpiar lienzo'),

  -- ============================================
  -- INFO
  -- ============================================
  (NULL, 'pt-BR', 'flows', 'info.canvasAlreadyEmpty', 'O quadro já está vazio', 'Info quadro vazio'),
  
  (NULL, 'en-US', 'flows', 'info.canvasAlreadyEmpty', 'The canvas is already empty', 'Canvas empty info'),
  
  (NULL, 'es-ES', 'flows', 'info.canvasAlreadyEmpty', 'El lienzo ya está vacío', 'Info lienzo vacío'),

  -- ============================================
  -- CONFIRM
  -- ============================================
  (NULL, 'pt-BR', 'flows', 'confirm.deleteFlow', 'Tem certeza que deseja deletar este flow? Esta ação não pode ser desfeita.', 'Confirmação deletar flow'),
  (NULL, 'pt-BR', 'flows', 'confirm.clearCanvas', 'Tem certeza que deseja limpar o quadro? Todos os nodes e conexões serão removidos.', 'Confirmação limpar quadro'),
  
  (NULL, 'en-US', 'flows', 'confirm.deleteFlow', 'Are you sure you want to delete this flow? This action cannot be undone.', 'Delete flow confirmation'),
  (NULL, 'en-US', 'flows', 'confirm.clearCanvas', 'Are you sure you want to clear the canvas? All nodes and connections will be removed.', 'Clear canvas confirmation'),
  
  (NULL, 'es-ES', 'flows', 'confirm.deleteFlow', '¿Estás seguro de que deseas eliminar este flujo? Esta acción no se puede deshacer.', 'Confirmación eliminar flujo'),
  (NULL, 'es-ES', 'flows', 'confirm.clearCanvas', '¿Estás seguro de que deseas limpiar el lienzo? Todos los nodos y conexiones serán eliminados.', 'Confirmación limpiar lienzo'),

  -- ============================================
  -- DRAWERS: BLOCKS
  -- ============================================
  (NULL, 'pt-BR', 'flows', 'drawer.blocks.title', 'Blocos de Funções', 'Título drawer blocos'),
  (NULL, 'pt-BR', 'flows', 'drawer.blocks.description', 'Arraste ou clique para adicionar blocos ao fluxo', 'Descrição drawer blocos'),
  (NULL, 'pt-BR', 'flows', 'drawer.blocks.category.control', 'Controle de Fluxo', 'Categoria controle'),
  (NULL, 'pt-BR', 'flows', 'drawer.blocks.category.action', 'Ações', 'Categoria ações'),
  (NULL, 'pt-BR', 'flows', 'drawer.blocks.category.integration', 'Integrações', 'Categoria integrações'),
  (NULL, 'pt-BR', 'flows', 'drawer.blocks.block.start', 'Início', 'Bloco início'),
  (NULL, 'pt-BR', 'flows', 'drawer.blocks.block.startDesc', 'Ponto de partida do fluxo', 'Descrição bloco início'),
  (NULL, 'pt-BR', 'flows', 'drawer.blocks.block.stop', 'Fim', 'Bloco fim'),
  (NULL, 'pt-BR', 'flows', 'drawer.blocks.block.stopDesc', 'Finaliza a execução', 'Descrição bloco fim'),
  (NULL, 'pt-BR', 'flows', 'drawer.blocks.block.ifElse', 'Condicional', 'Bloco condicional'),
  (NULL, 'pt-BR', 'flows', 'drawer.blocks.block.ifElseDesc', 'Executa lógica condicional (Condição)', 'Descrição bloco condicional'),
  (NULL, 'pt-BR', 'flows', 'drawer.blocks.block.loop', 'Loop', 'Bloco loop'),
  (NULL, 'pt-BR', 'flows', 'drawer.blocks.block.loopDesc', 'Repete ações múltiplas vezes', 'Descrição bloco loop'),
  (NULL, 'pt-BR', 'flows', 'drawer.blocks.block.comment', 'Comentário', 'Bloco comentário'),
  (NULL, 'pt-BR', 'flows', 'drawer.blocks.block.commentDesc', 'Adiciona uma nota explicativa', 'Descrição bloco comentário'),
  (NULL, 'pt-BR', 'flows', 'drawer.blocks.block.delay', 'Aguardar', 'Bloco aguardar'),
  (NULL, 'pt-BR', 'flows', 'drawer.blocks.block.delayDesc', 'Aguarda um tempo antes de continuar', 'Descrição bloco aguardar'),
  (NULL, 'pt-BR', 'flows', 'drawer.blocks.block.agent', 'Agente IA', 'Bloco agente'),
  (NULL, 'pt-BR', 'flows', 'drawer.blocks.block.agentDesc', 'Executa um agente de IA', 'Descrição bloco agente'),
  
  (NULL, 'en-US', 'flows', 'drawer.blocks.title', 'Function Blocks', 'Blocks drawer title'),
  (NULL, 'en-US', 'flows', 'drawer.blocks.description', 'Drag or click to add blocks to the flow', 'Blocks drawer description'),
  (NULL, 'en-US', 'flows', 'drawer.blocks.category.control', 'Flow Control', 'Control category'),
  (NULL, 'en-US', 'flows', 'drawer.blocks.category.action', 'Actions', 'Actions category'),
  (NULL, 'en-US', 'flows', 'drawer.blocks.category.integration', 'Integrations', 'Integrations category'),
  (NULL, 'en-US', 'flows', 'drawer.blocks.block.start', 'Start', 'Start block'),
  (NULL, 'en-US', 'flows', 'drawer.blocks.block.startDesc', 'Starting point of the flow', 'Start block description'),
  (NULL, 'en-US', 'flows', 'drawer.blocks.block.stop', 'Stop', 'Stop block'),
  (NULL, 'en-US', 'flows', 'drawer.blocks.block.stopDesc', 'Ends execution', 'Stop block description'),
  (NULL, 'en-US', 'flows', 'drawer.blocks.block.ifElse', 'Conditional', 'Conditional block'),
  (NULL, 'en-US', 'flows', 'drawer.blocks.block.ifElseDesc', 'Executes conditional logic (Condition)', 'Conditional block description'),
  (NULL, 'en-US', 'flows', 'drawer.blocks.block.loop', 'Loop', 'Loop block'),
  (NULL, 'en-US', 'flows', 'drawer.blocks.block.loopDesc', 'Repeats actions multiple times', 'Loop block description'),
  (NULL, 'en-US', 'flows', 'drawer.blocks.block.comment', 'Comment', 'Comment block'),
  (NULL, 'en-US', 'flows', 'drawer.blocks.block.commentDesc', 'Adds an explanatory note', 'Comment block description'),
  (NULL, 'en-US', 'flows', 'drawer.blocks.block.delay', 'Wait', 'Wait block'),
  (NULL, 'en-US', 'flows', 'drawer.blocks.block.delayDesc', 'Waits for a time before continuing', 'Wait block description'),
  (NULL, 'en-US', 'flows', 'drawer.blocks.block.agent', 'AI Agent', 'Agent block'),
  (NULL, 'en-US', 'flows', 'drawer.blocks.block.agentDesc', 'Executes an AI agent', 'Agent block description'),
  
  (NULL, 'es-ES', 'flows', 'drawer.blocks.title', 'Bloques de Funciones', 'Título drawer bloques'),
  (NULL, 'es-ES', 'flows', 'drawer.blocks.description', 'Arrastra o haz clic para agregar bloques al flujo', 'Descripción drawer bloques'),
  (NULL, 'es-ES', 'flows', 'drawer.blocks.category.control', 'Control de Flujo', 'Categoría control'),
  (NULL, 'es-ES', 'flows', 'drawer.blocks.category.action', 'Acciones', 'Categoría acciones'),
  (NULL, 'es-ES', 'flows', 'drawer.blocks.category.integration', 'Integraciones', 'Categoría integraciones'),
  (NULL, 'es-ES', 'flows', 'drawer.blocks.block.start', 'Inicio', 'Bloque inicio'),
  (NULL, 'es-ES', 'flows', 'drawer.blocks.block.startDesc', 'Punto de partida del flujo', 'Descripción bloque inicio'),
  (NULL, 'es-ES', 'flows', 'drawer.blocks.block.stop', 'Fin', 'Bloque fin'),
  (NULL, 'es-ES', 'flows', 'drawer.blocks.block.stopDesc', 'Finaliza la ejecución', 'Descripción bloque fin'),
  (NULL, 'es-ES', 'flows', 'drawer.blocks.block.ifElse', 'Condicional', 'Bloque condicional'),
  (NULL, 'es-ES', 'flows', 'drawer.blocks.block.ifElseDesc', 'Ejecuta lógica condicional (Condición)', 'Descripción bloque condicional'),
  (NULL, 'es-ES', 'flows', 'drawer.blocks.block.loop', 'Bucle', 'Bloque bucle'),
  (NULL, 'es-ES', 'flows', 'drawer.blocks.block.loopDesc', 'Repite acciones múltiples veces', 'Descripción bloque bucle'),
  (NULL, 'es-ES', 'flows', 'drawer.blocks.block.comment', 'Comentario', 'Bloque comentario'),
  (NULL, 'es-ES', 'flows', 'drawer.blocks.block.commentDesc', 'Agrega una nota explicativa', 'Descripción bloque comentario'),
  (NULL, 'es-ES', 'flows', 'drawer.blocks.block.delay', 'Esperar', 'Bloque esperar'),
  (NULL, 'es-ES', 'flows', 'drawer.blocks.block.delayDesc', 'Espera un tiempo antes de continuar', 'Descripción bloque esperar'),
  (NULL, 'es-ES', 'flows', 'drawer.blocks.block.agent', 'Agente IA', 'Bloque agente'),
  (NULL, 'es-ES', 'flows', 'drawer.blocks.block.agentDesc', 'Ejecuta un agente de IA', 'Descripción bloque agente'),

  -- ============================================
  -- DRAWERS: AGENTS
  -- ============================================
  (NULL, 'pt-BR', 'flows', 'drawer.agents.title', 'Agentes Disponíveis', 'Título drawer agentes'),
  (NULL, 'pt-BR', 'flows', 'drawer.agents.description', 'Arraste ou clique para adicionar agentes ao fluxo', 'Descrição drawer agentes'),
  (NULL, 'pt-BR', 'flows', 'drawer.agents.loading', 'Carregando agentes...', 'Mensagem carregando agentes'),
  (NULL, 'pt-BR', 'flows', 'drawer.agents.empty.title', 'Nenhum agente disponível', 'Título estado vazio agentes'),
  (NULL, 'pt-BR', 'flows', 'drawer.agents.empty.description', 'Crie agentes primeiro para adicioná-los ao fluxo', 'Descrição estado vazio agentes'),
  
  (NULL, 'en-US', 'flows', 'drawer.agents.title', 'Available Agents', 'Agents drawer title'),
  (NULL, 'en-US', 'flows', 'drawer.agents.description', 'Drag or click to add agents to the flow', 'Agents drawer description'),
  (NULL, 'en-US', 'flows', 'drawer.agents.loading', 'Loading agents...', 'Loading agents message'),
  (NULL, 'en-US', 'flows', 'drawer.agents.empty.title', 'No agents available', 'Empty state agents title'),
  (NULL, 'en-US', 'flows', 'drawer.agents.empty.description', 'Create agents first to add them to the flow', 'Empty state agents description'),
  
  (NULL, 'es-ES', 'flows', 'drawer.agents.title', 'Agentes Disponibles', 'Título drawer agentes'),
  (NULL, 'es-ES', 'flows', 'drawer.agents.description', 'Arrastra o haz clic para agregar agentes al flujo', 'Descripción drawer agentes'),
  (NULL, 'es-ES', 'flows', 'drawer.agents.loading', 'Cargando agentes...', 'Mensaje cargando agentes'),
  (NULL, 'es-ES', 'flows', 'drawer.agents.empty.title', 'Ningún agente disponible', 'Título estado vacío agentes'),
  (NULL, 'es-ES', 'flows', 'drawer.agents.empty.description', 'Crea agentes primero para agregarlos al flujo', 'Descripción estado vacío agentes')

ON CONFLICT (companies_id, language, namespace, key) 
DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();
