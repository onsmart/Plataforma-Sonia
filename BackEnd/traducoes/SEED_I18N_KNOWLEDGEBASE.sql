-- ============================================
-- SEED I18N: Knowledge Base
-- ============================================
-- Traduções para a página de Knowledge Base
-- Idiomas: pt-BR, en-US, es-ES
-- ============================================

INSERT INTO public.tb_i18n_translations (companies_id, language, namespace, key, value, description)
VALUES
  -- ============================================
  -- HEADER
  -- ============================================
  (NULL, 'pt-BR', 'knowledgeBase', 'header.title', 'Knowledge Base (RAG)', 'Título da página'),
  (NULL, 'pt-BR', 'knowledgeBase', 'header.description', 'Faça upload de documentos para treinar seus agentes com conhecimento específico da empresa.', 'Descrição da página'),
  (NULL, 'pt-BR', 'knowledgeBase', 'header.syncStatus', 'Base de Conhecimento Sincronizada', 'Status de sincronização'),
  
  (NULL, 'en-US', 'knowledgeBase', 'header.title', 'Knowledge Base (RAG)', 'Page title'),
  (NULL, 'en-US', 'knowledgeBase', 'header.description', 'Upload documents to train your agents on company-specific knowledge.', 'Page description'),
  (NULL, 'en-US', 'knowledgeBase', 'header.syncStatus', 'Knowledge Base Synchronized', 'Sync status'),
  
  (NULL, 'es-ES', 'knowledgeBase', 'header.title', 'Base de Conocimiento (RAG)', 'Título de la página'),
  (NULL, 'es-ES', 'knowledgeBase', 'header.description', 'Sube documentos para entrenar a tus agentes con conocimiento específico de la empresa.', 'Descripción de la página'),
  (NULL, 'es-ES', 'knowledgeBase', 'header.syncStatus', 'Base de Conocimiento Sincronizada', 'Estado de sincronización'),

  -- ============================================
  -- UPLOAD CARD
  -- ============================================
  (NULL, 'pt-BR', 'knowledgeBase', 'upload.title', 'Upload de Documentos e Imagens', 'Título do card de upload'),
  (NULL, 'pt-BR', 'knowledgeBase', 'upload.description', 'Formatos suportados: TXT, MD, CSV, JSON, PNG, JPG (Máx 10MB)', 'Descrição dos formatos'),
  (NULL, 'pt-BR', 'knowledgeBase', 'upload.dragDrop', 'Arraste e solte arquivos aqui', 'Texto principal do upload'),
  (NULL, 'pt-BR', 'knowledgeBase', 'upload.clickToSelect', 'ou clique para selecionar do computador', 'Texto secundário do upload'),
  (NULL, 'pt-BR', 'knowledgeBase', 'upload.selectFiles', 'Selecionar Arquivos', 'Botão de seleção'),
  (NULL, 'pt-BR', 'knowledgeBase', 'upload.uploading', 'Enviando...', 'Status durante upload'),
  (NULL, 'pt-BR', 'knowledgeBase', 'upload.progress', '{{percent}}% concluído', 'Progresso do upload'),
  
  (NULL, 'en-US', 'knowledgeBase', 'upload.title', 'Document & Image Upload', 'Upload card title'),
  (NULL, 'en-US', 'knowledgeBase', 'upload.description', 'Supported formats: TXT, MD, CSV, JSON, PNG, JPG (Max 10MB)', 'Format description'),
  (NULL, 'en-US', 'knowledgeBase', 'upload.dragDrop', 'Drag & drop files here', 'Main upload text'),
  (NULL, 'en-US', 'knowledgeBase', 'upload.clickToSelect', 'or click to select from computer', 'Secondary upload text'),
  (NULL, 'en-US', 'knowledgeBase', 'upload.selectFiles', 'Select Files', 'Selection button'),
  (NULL, 'en-US', 'knowledgeBase', 'upload.uploading', 'Uploading...', 'Upload status'),
  (NULL, 'en-US', 'knowledgeBase', 'upload.progress', '{{percent}}% completed', 'Upload progress'),
  
  (NULL, 'es-ES', 'knowledgeBase', 'upload.title', 'Carga de Documentos e Imágenes', 'Título de la tarjeta de carga'),
  (NULL, 'es-ES', 'knowledgeBase', 'upload.description', 'Formatos soportados: TXT, MD, CSV, JSON, PNG, JPG (Máx 10MB)', 'Descripción de formatos'),
  (NULL, 'es-ES', 'knowledgeBase', 'upload.dragDrop', 'Arrastra y suelta archivos aquí', 'Texto principal de carga'),
  (NULL, 'es-ES', 'knowledgeBase', 'upload.clickToSelect', 'o haz clic para seleccionar del ordenador', 'Texto secundario de carga'),
  (NULL, 'es-ES', 'knowledgeBase', 'upload.selectFiles', 'Seleccionar Archivos', 'Botón de selección'),
  (NULL, 'es-ES', 'knowledgeBase', 'upload.uploading', 'Subiendo...', 'Estado durante carga'),
  (NULL, 'es-ES', 'knowledgeBase', 'upload.progress', '{{percent}}% completado', 'Progreso de carga'),

  -- ============================================
  -- USAGE QUOTA CARD
  -- ============================================
  (NULL, 'pt-BR', 'knowledgeBase', 'quota.title', 'Cota de Uso', 'Título do card de quota'),
  (NULL, 'pt-BR', 'knowledgeBase', 'quota.storageUsed', 'Armazenamento Usado', 'Label de armazenamento usado'),
  (NULL, 'pt-BR', 'knowledgeBase', 'quota.used', 'Usado', 'Label usado'),
  (NULL, 'pt-BR', 'knowledgeBase', 'quota.limit', 'Limite', 'Label limite'),
  (NULL, 'pt-BR', 'knowledgeBase', 'quota.totalFiles', 'Total de Arquivos', 'Label total de arquivos'),
  (NULL, 'pt-BR', 'knowledgeBase', 'quota.files', 'arquivos', 'Texto plural de arquivos'),
  (NULL, 'pt-BR', 'knowledgeBase', 'quota.deletedFiles', 'Arquivos Deletados', 'Label arquivos deletados'),
  (NULL, 'pt-BR', 'knowledgeBase', 'quota.info', 'Os arquivos ficam no bucket na pasta da sua empresa. A cota usa o tamanho registrado no banco ao enviar cada arquivo; a exclusão na tela remove o arquivo do storage e do banco.', 'Informação sobre armazenamento'),
  
  (NULL, 'en-US', 'knowledgeBase', 'quota.title', 'Usage Quota', 'Quota card title'),
  (NULL, 'en-US', 'knowledgeBase', 'quota.storageUsed', 'Storage Used', 'Storage used label'),
  (NULL, 'en-US', 'knowledgeBase', 'quota.used', 'Used', 'Used label'),
  (NULL, 'en-US', 'knowledgeBase', 'quota.limit', 'Limit', 'Limit label'),
  (NULL, 'en-US', 'knowledgeBase', 'quota.totalFiles', 'Total Files', 'Total files label'),
  (NULL, 'en-US', 'knowledgeBase', 'quota.files', 'files', 'Files plural text'),
  (NULL, 'en-US', 'knowledgeBase', 'quota.deletedFiles', 'Deleted Files', 'Deleted files label'),
  (NULL, 'en-US', 'knowledgeBase', 'quota.info', 'Files live in your company folder in the bucket. Quota uses each file size stored when you upload; deleting from this screen removes the file from storage and the database.', 'Storage information'),
  
  (NULL, 'es-ES', 'knowledgeBase', 'quota.title', 'Cuota de Uso', 'Título de la tarjeta de cuota'),
  (NULL, 'es-ES', 'knowledgeBase', 'quota.storageUsed', 'Almacenamiento Usado', 'Etiqueta de almacenamiento usado'),
  (NULL, 'es-ES', 'knowledgeBase', 'quota.used', 'Usado', 'Etiqueta usado'),
  (NULL, 'es-ES', 'knowledgeBase', 'quota.limit', 'Límite', 'Etiqueta límite'),
  (NULL, 'es-ES', 'knowledgeBase', 'quota.totalFiles', 'Total de Archivos', 'Etiqueta total de archivos'),
  (NULL, 'es-ES', 'knowledgeBase', 'quota.files', 'archivos', 'Texto plural de archivos'),
  (NULL, 'es-ES', 'knowledgeBase', 'quota.deletedFiles', 'Archivos Eliminados', 'Etiqueta archivos eliminados'),
  (NULL, 'es-ES', 'knowledgeBase', 'quota.info', 'Los archivos están en el bucket en la carpeta de su empresa. La cuota usa el tamaño guardado al subir cada archivo; borrar desde esta pantalla elimina el archivo del storage y de la base.', 'Información de almacenamiento'),

  -- ============================================
  -- DOCUMENTS LIST
  -- ============================================
  (NULL, 'pt-BR', 'knowledgeBase', 'documents.title', 'Documentos Indexados', 'Título da lista de documentos'),
  (NULL, 'pt-BR', 'knowledgeBase', 'documents.description', 'Gerencie arquivos disponíveis para seus agentes.', 'Descrição da lista'),
  (NULL, 'pt-BR', 'knowledgeBase', 'documents.empty', 'Nenhum documento enviado ainda.', 'Estado vazio'),
  (NULL, 'pt-BR', 'knowledgeBase', 'documents.status.active', 'Ativo', 'Status ativo'),
  (NULL, 'pt-BR', 'knowledgeBase', 'documents.status.indexing', 'Indexando', 'Status indexando'),
  (NULL, 'pt-BR', 'knowledgeBase', 'documents.status.deleted', 'Deletado', 'Status deletado'),
  (NULL, 'pt-BR', 'knowledgeBase', 'documents.status.error', 'Erro', 'Status erro'),
  (NULL, 'pt-BR', 'knowledgeBase', 'documents.actions.restore', 'Restaurar', 'Botão restaurar'),
  (NULL, 'pt-BR', 'knowledgeBase', 'documents.actions.deletePermanently', 'Deletar Permanentemente', 'Botão deletar permanentemente'),
  
  (NULL, 'en-US', 'knowledgeBase', 'documents.title', 'Indexed Documents', 'Documents list title'),
  (NULL, 'en-US', 'knowledgeBase', 'documents.description', 'Manage files available to your agents.', 'List description'),
  (NULL, 'en-US', 'knowledgeBase', 'documents.empty', 'No documents uploaded yet.', 'Empty state'),
  (NULL, 'en-US', 'knowledgeBase', 'documents.status.active', 'Active', 'Active status'),
  (NULL, 'en-US', 'knowledgeBase', 'documents.status.indexing', 'Indexing', 'Indexing status'),
  (NULL, 'en-US', 'knowledgeBase', 'documents.status.deleted', 'Deleted', 'Deleted status'),
  (NULL, 'en-US', 'knowledgeBase', 'documents.status.error', 'Error', 'Error status'),
  (NULL, 'en-US', 'knowledgeBase', 'documents.actions.restore', 'Restore', 'Restore button'),
  (NULL, 'en-US', 'knowledgeBase', 'documents.actions.deletePermanently', 'Delete Permanently', 'Delete permanently button'),
  
  (NULL, 'es-ES', 'knowledgeBase', 'documents.title', 'Documentos Indexados', 'Título de la lista de documentos'),
  (NULL, 'es-ES', 'knowledgeBase', 'documents.description', 'Gestiona archivos disponibles para tus agentes.', 'Descripción de la lista'),
  (NULL, 'es-ES', 'knowledgeBase', 'documents.empty', 'Aún no se han subido documentos.', 'Estado vacío'),
  (NULL, 'es-ES', 'knowledgeBase', 'documents.status.active', 'Activo', 'Estado activo'),
  (NULL, 'es-ES', 'knowledgeBase', 'documents.status.indexing', 'Indexando', 'Estado indexando'),
  (NULL, 'es-ES', 'knowledgeBase', 'documents.status.deleted', 'Eliminado', 'Estado eliminado'),
  (NULL, 'es-ES', 'knowledgeBase', 'documents.status.error', 'Error', 'Estado error'),
  (NULL, 'es-ES', 'knowledgeBase', 'documents.actions.restore', 'Restaurar', 'Botón restaurar'),
  (NULL, 'es-ES', 'knowledgeBase', 'documents.actions.deletePermanently', 'Eliminar Permanentemente', 'Botón eliminar permanentemente'),

  -- ============================================
  -- ADMIN ACTIONS
  -- ============================================
  (NULL, 'pt-BR', 'knowledgeBase', 'admin.cleanup.cleaning', 'Limpando...', 'Status limpando'),
  (NULL, 'pt-BR', 'knowledgeBase', 'admin.cleanup.button', 'Limpar {{count}} deletado(s)', 'Botão limpar'),
  (NULL, 'pt-BR', 'knowledgeBase', 'admin.cleanup.noFiles', '(Admin - Nenhum arquivo deletado para limpar)', 'Mensagem sem arquivos'),
  (NULL, 'pt-BR', 'knowledgeBase', 'admin.cleanup.confirmSingle', 'Tem certeza que deseja deletar permanentemente "{{name}}"? Esta ação não pode ser desfeita.', 'Confirmação deletar único'),
  (NULL, 'pt-BR', 'knowledgeBase', 'admin.cleanup.confirmMultiple', 'Tem certeza que deseja deletar permanentemente {{count}} arquivo(s)?\n\nEsta ação não pode ser desfeita e os arquivos serão removidos do storage.', 'Confirmação deletar múltiplo'),
  (NULL, 'pt-BR', 'knowledgeBase', 'admin.cleanup.successSingle', 'Arquivo deletado permanentemente', 'Sucesso deletar único'),
  (NULL, 'pt-BR', 'knowledgeBase', 'admin.cleanup.successMultiple', '{{count}} arquivo(s) deletado(s) permanentemente', 'Sucesso deletar múltiplo'),
  (NULL, 'pt-BR', 'knowledgeBase', 'admin.cleanup.error', 'Erro ao deletar arquivos permanentemente', 'Erro ao deletar'),
  (NULL, 'pt-BR', 'knowledgeBase', 'admin.cleanup.noFilesToClean', 'Nenhum arquivo deletado para limpar', 'Sem arquivos para limpar'),
  
  (NULL, 'en-US', 'knowledgeBase', 'admin.cleanup.cleaning', 'Cleaning...', 'Cleaning status'),
  (NULL, 'en-US', 'knowledgeBase', 'admin.cleanup.button', 'Clean {{count}} deleted', 'Clean button'),
  (NULL, 'en-US', 'knowledgeBase', 'admin.cleanup.noFiles', '(Admin - No deleted files to clean)', 'No files message'),
  (NULL, 'en-US', 'knowledgeBase', 'admin.cleanup.confirmSingle', 'Are you sure you want to permanently delete "{{name}}"? This action cannot be undone.', 'Confirm delete single'),
  (NULL, 'en-US', 'knowledgeBase', 'admin.cleanup.confirmMultiple', 'Are you sure you want to permanently delete {{count}} file(s)?\n\nThis action cannot be undone and files will be removed from storage.', 'Confirm delete multiple'),
  (NULL, 'en-US', 'knowledgeBase', 'admin.cleanup.successSingle', 'File deleted permanently', 'Success delete single'),
  (NULL, 'en-US', 'knowledgeBase', 'admin.cleanup.successMultiple', '{{count}} file(s) deleted permanently', 'Success delete multiple'),
  (NULL, 'en-US', 'knowledgeBase', 'admin.cleanup.error', 'Error deleting files permanently', 'Error deleting'),
  (NULL, 'en-US', 'knowledgeBase', 'admin.cleanup.noFilesToClean', 'No deleted files to clean', 'No files to clean'),
  
  (NULL, 'es-ES', 'knowledgeBase', 'admin.cleanup.cleaning', 'Limpiando...', 'Estado limpiando'),
  (NULL, 'es-ES', 'knowledgeBase', 'admin.cleanup.button', 'Limpiar {{count}} eliminado(s)', 'Botón limpiar'),
  (NULL, 'es-ES', 'knowledgeBase', 'admin.cleanup.noFiles', '(Admin - No hay archivos eliminados para limpiar)', 'Mensaje sin archivos'),
  (NULL, 'es-ES', 'knowledgeBase', 'admin.cleanup.confirmSingle', '¿Estás seguro de que deseas eliminar permanentemente "{{name}}"? Esta acción no se puede deshacer.', 'Confirmar eliminar único'),
  (NULL, 'es-ES', 'knowledgeBase', 'admin.cleanup.confirmMultiple', '¿Estás seguro de que deseas eliminar permanentemente {{count}} archivo(s)?\n\nEsta acción no se puede deshacer y los archivos serán eliminados del almacenamiento.', 'Confirmar eliminar múltiple'),
  (NULL, 'es-ES', 'knowledgeBase', 'admin.cleanup.successSingle', 'Archivo eliminado permanentemente', 'Éxito eliminar único'),
  (NULL, 'es-ES', 'knowledgeBase', 'admin.cleanup.successMultiple', '{{count}} archivo(s) eliminado(s) permanentemente', 'Éxito eliminar múltiple'),
  (NULL, 'es-ES', 'knowledgeBase', 'admin.cleanup.error', 'Error al eliminar archivos permanentemente', 'Error al eliminar'),
  (NULL, 'es-ES', 'knowledgeBase', 'admin.cleanup.noFilesToClean', 'No hay archivos eliminados para limpiar', 'Sin archivos para limpiar'),

  -- ============================================
  -- DELETE CONFIRMATIONS
  -- ============================================
  (NULL, 'pt-BR', 'knowledgeBase', 'delete.confirmSoft', 'Marcar este arquivo como deletado? (soft delete)', 'Confirmação soft delete'),
  (NULL, 'pt-BR', 'knowledgeBase', 'delete.error', 'Erro ao deletar arquivo', 'Erro ao deletar'),
  
  (NULL, 'en-US', 'knowledgeBase', 'delete.confirmSoft', 'Mark this file as deleted? (soft delete)', 'Confirm soft delete'),
  (NULL, 'en-US', 'knowledgeBase', 'delete.error', 'Error deleting file', 'Error deleting'),
  
  (NULL, 'es-ES', 'knowledgeBase', 'delete.confirmSoft', '¿Marcar este archivo como eliminado? (soft delete)', 'Confirmar soft delete'),
  (NULL, 'es-ES', 'knowledgeBase', 'delete.error', 'Error al eliminar archivo', 'Error al eliminar'),

  -- ============================================
  -- UPLOAD ERRORS
  -- ============================================
  (NULL, 'pt-BR', 'knowledgeBase', 'upload.error', 'Falha no upload: {{message}}', 'Erro no upload'),
  
  (NULL, 'en-US', 'knowledgeBase', 'upload.error', 'Upload failed: {{message}}', 'Upload error'),
  
  (NULL, 'es-ES', 'knowledgeBase', 'upload.error', 'Error en la carga: {{message}}', 'Error de carga')

ON CONFLICT (companies_id, language, namespace, key) 
DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();
