-- ============================================
-- SEED I18N: Profile
-- ============================================
-- Traduções para a página de Perfil do Usuário
-- Idiomas: pt-BR, en-US, es-ES
-- ============================================

INSERT INTO public.tb_i18n_translations (companies_id, language, namespace, key, value, description)
VALUES
  -- ============================================
  -- HEADER
  -- ============================================
  (NULL, 'pt-BR', 'profile', 'header.title', 'Meu Perfil', 'Título da página'),
  (NULL, 'pt-BR', 'profile', 'header.description', 'Gerencie as configurações e preferências da sua conta.', 'Descrição da página'),
  
  (NULL, 'en-US', 'profile', 'header.title', 'My Profile', 'Page title'),
  (NULL, 'en-US', 'profile', 'header.description', 'Manage your account settings and preferences.', 'Page description'),
  
  (NULL, 'es-ES', 'profile', 'header.title', 'Mi Perfil', 'Título de la página'),
  (NULL, 'es-ES', 'profile', 'header.description', 'Gestiona la configuración y preferencias de tu cuenta.', 'Descripción de la página'),

  -- ============================================
  -- USER INFO CARD
  -- ============================================
  (NULL, 'pt-BR', 'profile', 'userInfo.defaultName', 'Usuário Admin', 'Nome padrão quando não há nome'),
  (NULL, 'pt-BR', 'profile', 'userInfo.badge', 'Super Admin', 'Badge de permissão'),
  
  (NULL, 'en-US', 'profile', 'userInfo.defaultName', 'Admin User', 'Default name when no name'),
  (NULL, 'en-US', 'profile', 'userInfo.badge', 'Super Admin', 'Permission badge'),
  
  (NULL, 'es-ES', 'profile', 'userInfo.defaultName', 'Usuario Admin', 'Nombre por defecto cuando no hay nombre'),
  (NULL, 'es-ES', 'profile', 'userInfo.badge', 'Super Admin', 'Badge de permiso'),

  -- ============================================
  -- PERSONAL INFORMATION
  -- ============================================
  (NULL, 'pt-BR', 'profile', 'personalInfo.title', 'Informações Pessoais', 'Título da seção'),
  (NULL, 'pt-BR', 'profile', 'personalInfo.description', 'Atualize seus dados pessoais.', 'Descrição da seção'),
  (NULL, 'pt-BR', 'profile', 'personalInfo.firstName', 'Nome', 'Label primeiro nome'),
  (NULL, 'pt-BR', 'profile', 'personalInfo.lastName', 'Sobrenome', 'Label sobrenome'),
  (NULL, 'pt-BR', 'profile', 'personalInfo.email', 'Endereço de Email', 'Label email'),
  (NULL, 'pt-BR', 'profile', 'personalInfo.save', 'Salvar Alterações', 'Botão salvar'),
  (NULL, 'pt-BR', 'profile', 'personalInfo.saving', 'Salvando...', 'Texto ao salvar'),
  (NULL, 'pt-BR', 'profile', 'personalInfo.saved', 'Salvo!', 'Texto quando salvo'),
  (NULL, 'pt-BR', 'profile', 'personalInfo.success', 'Informações pessoais atualizadas com sucesso!', 'Mensagem de sucesso'),
  
  (NULL, 'en-US', 'profile', 'personalInfo.title', 'Personal Information', 'Section title'),
  (NULL, 'en-US', 'profile', 'personalInfo.description', 'Update your personal details.', 'Section description'),
  (NULL, 'en-US', 'profile', 'personalInfo.firstName', 'First Name', 'First name label'),
  (NULL, 'en-US', 'profile', 'personalInfo.lastName', 'Last Name', 'Last name label'),
  (NULL, 'en-US', 'profile', 'personalInfo.email', 'Email Address', 'Email label'),
  (NULL, 'en-US', 'profile', 'personalInfo.save', 'Save Changes', 'Save button'),
  (NULL, 'en-US', 'profile', 'personalInfo.saving', 'Saving...', 'Saving text'),
  (NULL, 'en-US', 'profile', 'personalInfo.saved', 'Saved!', 'Saved text'),
  (NULL, 'en-US', 'profile', 'personalInfo.success', 'Personal information updated successfully!', 'Success message'),
  
  (NULL, 'es-ES', 'profile', 'personalInfo.title', 'Información Personal', 'Título de la sección'),
  (NULL, 'es-ES', 'profile', 'personalInfo.description', 'Actualiza tus datos personales.', 'Descripción de la sección'),
  (NULL, 'es-ES', 'profile', 'personalInfo.firstName', 'Nombre', 'Etiqueta nombre'),
  (NULL, 'es-ES', 'profile', 'personalInfo.lastName', 'Apellido', 'Etiqueta apellido'),
  (NULL, 'es-ES', 'profile', 'personalInfo.email', 'Dirección de Correo', 'Etiqueta correo'),
  (NULL, 'es-ES', 'profile', 'personalInfo.save', 'Guardar Cambios', 'Botón guardar'),
  (NULL, 'es-ES', 'profile', 'personalInfo.saving', 'Guardando...', 'Texto guardando'),
  (NULL, 'es-ES', 'profile', 'personalInfo.saved', '¡Guardado!', 'Texto guardado'),
  (NULL, 'es-ES', 'profile', 'personalInfo.success', '¡Información personal actualizada exitosamente!', 'Mensaje de éxito'),

  -- ============================================
  -- SECURITY
  -- ============================================
  (NULL, 'pt-BR', 'profile', 'security.title', 'Segurança', 'Título da seção'),
  (NULL, 'pt-BR', 'profile', 'security.description', 'Gerencie sua senha e preferências de segurança.', 'Descrição da seção'),
  (NULL, 'pt-BR', 'profile', 'security.currentPassword', 'Senha Atual', 'Label senha atual'),
  (NULL, 'pt-BR', 'profile', 'security.newPassword', 'Nova Senha', 'Label nova senha'),
  (NULL, 'pt-BR', 'profile', 'security.confirmPassword', 'Confirmar Senha', 'Label confirmar senha'),
  (NULL, 'pt-BR', 'profile', 'security.strength.weak', 'Fraca', 'Força da senha fraca'),
  (NULL, 'pt-BR', 'profile', 'security.strength.fair', 'Regular', 'Força da senha regular'),
  (NULL, 'pt-BR', 'profile', 'security.strength.good', 'Boa', 'Força da senha boa'),
  (NULL, 'pt-BR', 'profile', 'security.strength.strong', 'Forte', 'Força da senha forte'),
  (NULL, 'pt-BR', 'profile', 'security.update', 'Atualizar Senha', 'Botão atualizar senha'),
  (NULL, 'pt-BR', 'profile', 'security.updating', 'Atualizando...', 'Texto ao atualizar'),
  (NULL, 'pt-BR', 'profile', 'security.updated', 'Atualizado!', 'Texto quando atualizado'),
  (NULL, 'pt-BR', 'profile', 'security.success', 'Senha atualizada com sucesso!', 'Mensagem de sucesso'),
  (NULL, 'pt-BR', 'profile', 'security.twoFactor.title', 'Autenticação de Dois Fatores', 'Título 2FA'),
  (NULL, 'pt-BR', 'profile', 'security.twoFactor.badge', 'Em Breve', 'Badge em breve'),
  (NULL, 'pt-BR', 'profile', 'security.twoFactor.description', 'Adicione uma camada extra de segurança à sua conta.', 'Descrição 2FA'),
  (NULL, 'pt-BR', 'profile', 'security.twoFactor.button', 'Habilitar 2FA (Em Breve)', 'Botão habilitar 2FA'),
  
  (NULL, 'en-US', 'profile', 'security.title', 'Security', 'Section title'),
  (NULL, 'en-US', 'profile', 'security.description', 'Manage your password and security preferences.', 'Section description'),
  (NULL, 'en-US', 'profile', 'security.currentPassword', 'Current Password', 'Current password label'),
  (NULL, 'en-US', 'profile', 'security.newPassword', 'New Password', 'New password label'),
  (NULL, 'en-US', 'profile', 'security.confirmPassword', 'Confirm Password', 'Confirm password label'),
  (NULL, 'en-US', 'profile', 'security.strength.weak', 'Weak', 'Weak password strength'),
  (NULL, 'en-US', 'profile', 'security.strength.fair', 'Fair', 'Fair password strength'),
  (NULL, 'en-US', 'profile', 'security.strength.good', 'Good', 'Good password strength'),
  (NULL, 'en-US', 'profile', 'security.strength.strong', 'Strong', 'Strong password strength'),
  (NULL, 'en-US', 'profile', 'security.update', 'Update Password', 'Update password button'),
  (NULL, 'en-US', 'profile', 'security.updating', 'Updating...', 'Updating text'),
  (NULL, 'en-US', 'profile', 'security.updated', 'Updated!', 'Updated text'),
  (NULL, 'en-US', 'profile', 'security.success', 'Password updated successfully!', 'Success message'),
  (NULL, 'en-US', 'profile', 'security.twoFactor.title', 'Two-Factor Authentication', '2FA title'),
  (NULL, 'en-US', 'profile', 'security.twoFactor.badge', 'Soon', 'Soon badge'),
  (NULL, 'en-US', 'profile', 'security.twoFactor.description', 'Add an extra layer of security to your account.', '2FA description'),
  (NULL, 'en-US', 'profile', 'security.twoFactor.button', 'Enable 2FA (Coming Soon)', 'Enable 2FA button'),
  
  (NULL, 'es-ES', 'profile', 'security.title', 'Seguridad', 'Título de la sección'),
  (NULL, 'es-ES', 'profile', 'security.description', 'Gestiona tu contraseña y preferencias de seguridad.', 'Descripción de la sección'),
  (NULL, 'es-ES', 'profile', 'security.currentPassword', 'Contraseña Actual', 'Etiqueta contraseña actual'),
  (NULL, 'es-ES', 'profile', 'security.newPassword', 'Nueva Contraseña', 'Etiqueta nueva contraseña'),
  (NULL, 'es-ES', 'profile', 'security.confirmPassword', 'Confirmar Contraseña', 'Etiqueta confirmar contraseña'),
  (NULL, 'es-ES', 'profile', 'security.strength.weak', 'Débil', 'Fuerza de contraseña débil'),
  (NULL, 'es-ES', 'profile', 'security.strength.fair', 'Regular', 'Fuerza de contraseña regular'),
  (NULL, 'es-ES', 'profile', 'security.strength.good', 'Buena', 'Fuerza de contraseña buena'),
  (NULL, 'es-ES', 'profile', 'security.strength.strong', 'Fuerte', 'Fuerza de contraseña fuerte'),
  (NULL, 'es-ES', 'profile', 'security.update', 'Actualizar Contraseña', 'Botón actualizar contraseña'),
  (NULL, 'es-ES', 'profile', 'security.updating', 'Actualizando...', 'Texto actualizando'),
  (NULL, 'es-ES', 'profile', 'security.updated', '¡Actualizado!', 'Texto actualizado'),
  (NULL, 'es-ES', 'profile', 'security.success', '¡Contraseña actualizada exitosamente!', 'Mensaje de éxito'),
  (NULL, 'es-ES', 'profile', 'security.twoFactor.title', 'Autenticación de Dos Factores', 'Título 2FA'),
  (NULL, 'es-ES', 'profile', 'security.twoFactor.badge', 'Próximamente', 'Badge próximamente'),
  (NULL, 'es-ES', 'profile', 'security.twoFactor.description', 'Añade una capa extra de seguridad a tu cuenta.', 'Descripción 2FA'),
  (NULL, 'es-ES', 'profile', 'security.twoFactor.button', 'Habilitar 2FA (Próximamente)', 'Botón habilitar 2FA'),

  -- ============================================
  -- SESSIONS
  -- ============================================
  (NULL, 'pt-BR', 'profile', 'sessions.title', 'Sessões', 'Título da seção'),
  (NULL, 'pt-BR', 'profile', 'sessions.description', 'Gerencie suas sessões ativas.', 'Descrição da seção'),
  (NULL, 'pt-BR', 'profile', 'sessions.current', 'Sessão Atual', 'Label sessão atual'),
  (NULL, 'pt-BR', 'profile', 'sessions.location', 'São Francisco, EUA • Chrome no macOS', 'Localização da sessão'),
  (NULL, 'pt-BR', 'profile', 'sessions.active', 'Ativo Agora', 'Badge sessão ativa'),
  
  (NULL, 'en-US', 'profile', 'sessions.title', 'Sessions', 'Section title'),
  (NULL, 'en-US', 'profile', 'sessions.description', 'Manage your active sessions.', 'Section description'),
  (NULL, 'en-US', 'profile', 'sessions.current', 'Current Session', 'Current session label'),
  (NULL, 'en-US', 'profile', 'sessions.location', 'San Francisco, US • Chrome on macOS', 'Session location'),
  (NULL, 'en-US', 'profile', 'sessions.active', 'Active Now', 'Active session badge'),
  
  (NULL, 'es-ES', 'profile', 'sessions.title', 'Sesiones', 'Título de la sección'),
  (NULL, 'es-ES', 'profile', 'sessions.description', 'Gestiona tus sesiones activas.', 'Descripción de la sección'),
  (NULL, 'es-ES', 'profile', 'sessions.current', 'Sesión Actual', 'Etiqueta sesión actual'),
  (NULL, 'es-ES', 'profile', 'sessions.location', 'San Francisco, EE.UU. • Chrome en macOS', 'Ubicación de la sesión'),
  (NULL, 'es-ES', 'profile', 'sessions.active', 'Activo Ahora', 'Badge sesión activa')

ON CONFLICT (companies_id, language, namespace, key) 
DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();
