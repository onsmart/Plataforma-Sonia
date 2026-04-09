import { Request, Response, NextFunction } from 'express'
import { supabase } from '../lib/supabase'
import logger from '../lib/logger'

/**
 * Indica falha de rede ao falar com Supabase Auth (timeout, DNS, firewall),
 * distinto de JWT inválido ou expirado.
 */
function isSupabaseAuthNetworkFailure(err: unknown): boolean {
  const visited = new Set<unknown>()
  let current: unknown = err
  let depth = 0

  while (current != null && depth < 10) {
    if (visited.has(current)) break
    visited.add(current)

    if (typeof current === 'string') {
      const s = current.toLowerCase()
      if (
        s.includes('fetch failed') ||
        s.includes('connect timeout') ||
        s.includes('network error') ||
        s.includes('getaddrinfo')
      ) {
        return true
      }
      break
    }

    if (typeof current !== 'object') break

    const o = current as Record<string, unknown>
    const msg = String(o.message ?? '').toLowerCase()
    if (
      msg.includes('fetch failed') ||
      msg.includes('connect timeout') ||
      msg.includes('connecttimeout') ||
      msg.includes('econnrefused') ||
      msg.includes('etimedout') ||
      msg.includes('socket hang up') ||
      msg.includes('getaddrinfo')
    ) {
      return true
    }

    const code = typeof o.code === 'string' ? o.code.toUpperCase() : ''
    if (
      [
        'ETIMEDOUT',
        'ECONNREFUSED',
        'ENOTFOUND',
        'EAI_AGAIN',
        'ECONNRESET',
        'UND_ERR_CONNECT_TIMEOUT',
        'UND_ERR_SOCKET',
        'UND_ERR_HEADERS_TIMEOUT',
      ].includes(code)
    ) {
      return true
    }

    current = o.cause
    depth += 1
  }

  return false
}

function respondAuthProviderDown(res: Response, logContext: string, err: unknown) {
  const hint =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message: string }).message).slice(0, 200)
      : 'fetch failed'
  logger.error(`[${logContext}] Supabase Auth inacessível (rede/firewall/HTTPS 443):`, hint)
  return res.status(503).json({
    error: 'Serviço de autenticação temporariamente indisponível',
    details:
      'O servidor não conseguiu contactar o provedor de identidade (Supabase). Verifique saída HTTPS (443), firewall e DNS nesta máquina.',
    code: 'AUTH_PROVIDER_UNAVAILABLE',
  })
}

/**
 * Middleware para validar JWT do Supabase
 * Adiciona req.user com email e userId se token for válido
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Token de autenticação não fornecido',
        details: 'Adicione o header: Authorization: Bearer <token>',
        code: 'TOKEN_MISSING'
      })
    }

    const token = authHeader.substring(7)

    // Validar token com Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error && isSupabaseAuthNetworkFailure(error)) {
      return respondAuthProviderDown(res, 'requireAuth', error)
    }

    if (error || !user) {
      logger.warn('[requireAuth] Token inválido ou expirado:', {
        error: error?.message,
        hasUser: !!user
      })
      return res.status(401).json({
        error: 'Token inválido ou expirado',
        details: 'Faça login novamente',
        code: 'TOKEN_EXPIRED'
      })
    }

    // Adicionar dados do usuário ao request
    req.user = {
      email: user.email!,
      userId: user.id,
      token
    }

    logger.log(`[requireAuth] ✅ Usuário autenticado: ${user.email}`)
    next()
  } catch (error: unknown) {
    if (isSupabaseAuthNetworkFailure(error)) {
      return respondAuthProviderDown(res, 'requireAuth', error)
    }
    logger.error('[requireAuth] Erro:', error)
    return res.status(401).json({
      error: 'Erro ao processar autenticação',
      details: error instanceof Error ? error.message : String(error),
      code: 'AUTH_ERROR'
    })
  }
}

/**
 * Middleware opcional (tenta autenticar, mas não bloqueia)
 * Útil para rotas que funcionam com ou sem autenticação
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token)

      if (error && isSupabaseAuthNetworkFailure(error)) {
        logger.warn(
          '[optionalAuth] Supabase Auth inacessível (token não validado; rota segue sem usuário):',
          error.message
        )
      } else if (!error && user) {
        req.user = {
          email: user.email!,
          userId: user.id,
          token
        }
        logger.log(`[optionalAuth] ✅ Usuário autenticado: ${user.email}`)
      }
    } catch (error: unknown) {
      if (isSupabaseAuthNetworkFailure(error)) {
        logger.warn(
          '[optionalAuth] Supabase Auth inacessível (ignorado):',
          error instanceof Error ? error.message : String(error)
        )
      } else {
        logger.warn('[optionalAuth] Erro ao validar token (ignorado):', error)
      }
    }
  }
  
  next()
}

/**
 * Middleware para verificar se o usuário é admin
 * Verifica role em tb_company_users OU permissão basic.admin
 * Deve ser usado APÓS requireAuth
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    // Primeiro verifica autenticação
    if (!req.user?.email) {
      return res.status(401).json({
        error: 'Token de autenticação não fornecido',
        details: 'Faça login primeiro',
        code: 'AUTH_REQUIRED'
      })
    }

    const userEmail = req.user.email

    // 1️⃣ Buscar user_id
    const { data: userData, error: userError } = await supabase
      .from('tb_users')
      .select('id')
      .eq('email', userEmail)
      .maybeSingle()

    if (userError || !userData?.id) {
      logger.warn('[requireAdmin] Usuário não encontrado:', userEmail)
      return res.status(403).json({
        error: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND'
      })
    }

    // 2️⃣ Verificar role em tb_company_users
    const { data: companyUserData, error: companyUserError } = await supabase
      .from('tb_company_users')
      .select('role, companies_id')
      .eq('user_id', userData.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (companyUserError) {
      logger.error('[requireAdmin] Erro ao buscar role:', companyUserError)
      return res.status(500).json({
        error: 'Erro ao verificar permissões',
        code: 'PERMISSION_CHECK_ERROR'
      })
    }

    if (!companyUserData) {
      logger.warn('[requireAdmin] Usuário não pertence a nenhuma empresa:', userEmail)
      return res.status(403).json({
        error: 'Você não tem permissão para acessar este recurso',
        details: 'Apenas administradores podem realizar esta ação',
        code: 'NOT_ADMIN'
      })
    }

    const role = companyUserData.role
    const companiesId = companyUserData.companies_id

    // Se for owner ou admin, permite
    if (role === 'owner' || role === 'admin') {
      logger.log(`[requireAdmin] ✅ Usuário é admin (role: ${role}): ${userEmail}`)
      // Adiciona companies_id ao req para uso posterior
      ;(req as any).companiesId = companiesId
      return next()
    }

    // 3️⃣ Verificar permissão basic.admin
    const { data: adminPermission, error: adminPermError } = await supabase
      .from('tb_permissions')
      .select('id')
      .eq('key', 'basic.admin')
      .maybeSingle()

    if (adminPermError) {
      logger.warn('[requireAdmin] Erro ao buscar permissão basic.admin:', adminPermError)
    } else if (adminPermission?.id) {
      const { data: userPermission, error: userPermError } = await supabase
        .from('tb_user_permissions')
        .select('id')
        .eq('user_id', userData.id)
        .eq('companies_id', companiesId)
        .eq('permission_id', adminPermission.id)
        .maybeSingle()

      if (!userPermError && userPermission) {
        logger.log(`[requireAdmin] ✅ Usuário é admin (permissão basic.admin): ${userEmail}`)
        ;(req as any).companiesId = companiesId
        return next()
      }
    }

    // Se chegou aqui, não é admin
    logger.warn(`[requireAdmin] 🚫 Usuário NÃO é admin (role: ${role}): ${userEmail}`)
    return res.status(403).json({
      error: 'Você não tem permissão para acessar este recurso',
      details: 'Apenas administradores podem realizar esta ação',
      code: 'NOT_ADMIN'
    })
  } catch (error: any) {
    logger.error('[requireAdmin] Erro:', error)
    return res.status(500).json({
      error: 'Erro ao verificar permissões',
      details: error.message,
      code: 'PERMISSION_ERROR'
    })
  }
}
