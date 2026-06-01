"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.optionalAuth = optionalAuth;
exports.userCanManageBilling = userCanManageBilling;
exports.requireAdmin = requireAdmin;
exports.requireWorkspace = requireWorkspace;
exports.requirePermission = requirePermission;
const supabase_1 = require("../lib/supabase");
const logger_1 = __importDefault(require("../lib/logger"));
const company_helper_1 = require("../utils/company-helper");
/**
 * Indica falha de rede ao falar com Supabase Auth (timeout, DNS, firewall),
 * distinto de JWT inválido ou expirado.
 */
function isSupabaseAuthNetworkFailure(err) {
    const visited = new Set();
    let current = err;
    let depth = 0;
    while (current != null && depth < 10) {
        if (visited.has(current))
            break;
        visited.add(current);
        if (typeof current === 'string') {
            const s = current.toLowerCase();
            if (s.includes('fetch failed') ||
                s.includes('connect timeout') ||
                s.includes('network error') ||
                s.includes('getaddrinfo')) {
                return true;
            }
            break;
        }
        if (typeof current !== 'object')
            break;
        const o = current;
        const msg = String(o.message ?? '').toLowerCase();
        if (msg.includes('fetch failed') ||
            msg.includes('connect timeout') ||
            msg.includes('connecttimeout') ||
            msg.includes('econnrefused') ||
            msg.includes('etimedout') ||
            msg.includes('socket hang up') ||
            msg.includes('getaddrinfo')) {
            return true;
        }
        const code = typeof o.code === 'string' ? o.code.toUpperCase() : '';
        if ([
            'ETIMEDOUT',
            'ECONNREFUSED',
            'ENOTFOUND',
            'EAI_AGAIN',
            'ECONNRESET',
            'UND_ERR_CONNECT_TIMEOUT',
            'UND_ERR_SOCKET',
            'UND_ERR_HEADERS_TIMEOUT',
        ].includes(code)) {
            return true;
        }
        current = o.cause;
        depth += 1;
    }
    return false;
}
function respondAuthProviderDown(res, logContext, err) {
    const hint = err && typeof err === 'object' && 'message' in err
        ? String(err.message).slice(0, 200)
        : 'fetch failed';
    logger_1.default.error(`[${logContext}] Supabase Auth inacessível (rede/firewall/HTTPS 443):`, hint);
    return res.status(503).json({
        error: 'Serviço de autenticação temporariamente indisponível',
        details: 'O servidor não conseguiu contactar o provedor de identidade (Supabase). Verifique saída HTTPS (443), firewall e DNS nesta máquina.',
        code: 'AUTH_PROVIDER_UNAVAILABLE',
    });
}
/**
 * Middleware para validar JWT do Supabase
 * Adiciona req.user com email e userId se token for válido
 */
async function requireAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Token de autenticação não fornecido',
                details: 'Adicione o header: Authorization: Bearer <token>',
                code: 'TOKEN_MISSING'
            });
        }
        const token = authHeader.substring(7);
        // Validar token com Supabase
        const { data: { user }, error } = await supabase_1.supabase.auth.getUser(token);
        if (error && isSupabaseAuthNetworkFailure(error)) {
            return respondAuthProviderDown(res, 'requireAuth', error);
        }
        if (error || !user) {
            logger_1.default.warn('[requireAuth] Token inválido ou expirado:', {
                error: error?.message,
                hasUser: !!user
            });
            return res.status(401).json({
                error: 'Token inválido ou expirado',
                details: 'Faça login novamente',
                code: 'TOKEN_EXPIRED'
            });
        }
        // Adicionar dados do usuário ao request
        req.user = {
            email: user.email,
            userId: user.id,
            token
        };
        logger_1.default.log(`[requireAuth] ✅ Usuário autenticado: ${user.email}`);
        next();
    }
    catch (error) {
        if (isSupabaseAuthNetworkFailure(error)) {
            return respondAuthProviderDown(res, 'requireAuth', error);
        }
        logger_1.default.error('[requireAuth] Erro:', error);
        return res.status(401).json({
            error: 'Erro ao processar autenticação',
            details: error instanceof Error ? error.message : String(error),
            code: 'AUTH_ERROR'
        });
    }
}
/**
 * Middleware opcional (tenta autenticar, mas não bloqueia)
 * Útil para rotas que funcionam com ou sem autenticação
 */
async function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
            const { data: { user }, error } = await supabase_1.supabase.auth.getUser(token);
            if (error && isSupabaseAuthNetworkFailure(error)) {
                logger_1.default.warn('[optionalAuth] Supabase Auth inacessível (token não validado; rota segue sem usuário):', error.message);
            }
            else if (!error && user) {
                req.user = {
                    email: user.email,
                    userId: user.id,
                    token
                };
                logger_1.default.log(`[optionalAuth] ✅ Usuário autenticado: ${user.email}`);
            }
        }
        catch (error) {
            if (isSupabaseAuthNetworkFailure(error)) {
                logger_1.default.warn('[optionalAuth] Supabase Auth inacessível (ignorado):', error instanceof Error ? error.message : String(error));
            }
            else {
                logger_1.default.warn('[optionalAuth] Erro ao validar token (ignorado):', error);
            }
        }
    }
    next();
}
async function resolveBillingAdminContext(userEmail) {
    const { data: userData, error: userError } = await supabase_1.supabase
        .from('tb_users')
        .select('id')
        .eq('email', userEmail)
        .maybeSingle();
    if (userError || !userData?.id) {
        return { allowed: false, reason: 'user_not_found' };
    }
    const { data: companyUserData, error: companyUserError } = await supabase_1.supabase
        .from('tb_company_users')
        .select('role, companies_id')
        .eq('user_id', userData.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
    if (companyUserError) {
        return { allowed: false, reason: 'permission_check_error' };
    }
    if (!companyUserData) {
        return { allowed: false, reason: 'not_company_member' };
    }
    const role = companyUserData.role;
    const companiesId = companyUserData.companies_id;
    if (role === 'owner' || role === 'admin') {
        return { allowed: true, companiesId, role };
    }
    const { data: adminPermission, error: adminPermError } = await supabase_1.supabase
        .from('tb_permissions')
        .select('id')
        .eq('key', 'basic.admin')
        .maybeSingle();
    if (!adminPermError && adminPermission?.id) {
        const { data: userPermission, error: userPermError } = await supabase_1.supabase
            .from('tb_user_permissions')
            .select('id')
            .eq('user_id', userData.id)
            .eq('companies_id', companiesId)
            .eq('permission_id', adminPermission.id)
            .maybeSingle();
        if (!userPermError && userPermission) {
            return { allowed: true, companiesId, role, viaPermission: true };
        }
    }
    return { allowed: false, reason: 'not_admin', role };
}
/** Owner/admin ou permissão basic.admin — mesma regra do requireAdmin. */
async function userCanManageBilling(userEmail) {
    try {
        const ctx = await resolveBillingAdminContext(userEmail);
        return ctx.allowed;
    }
    catch (error) {
        logger_1.default.warn('[userCanManageBilling] Erro:', error);
        return false;
    }
}
/**
 * Middleware para verificar se o usuário é admin
 * Verifica role em tb_company_users OU permissão basic.admin
 * Deve ser usado APÓS requireAuth
 */
async function requireAdmin(req, res, next) {
    try {
        // Primeiro verifica autenticação
        if (!req.user?.email) {
            return res.status(401).json({
                error: 'Token de autenticação não fornecido',
                details: 'Faça login primeiro',
                code: 'AUTH_REQUIRED'
            });
        }
        const userEmail = req.user.email;
        const ctx = await resolveBillingAdminContext(userEmail);
        if (!ctx.allowed) {
            if (ctx.reason === 'user_not_found') {
                logger_1.default.warn('[requireAdmin] Usuário não encontrado:', userEmail);
                return res.status(403).json({
                    error: 'Usuário não encontrado',
                    code: 'USER_NOT_FOUND'
                });
            }
            if (ctx.reason === 'permission_check_error') {
                logger_1.default.error('[requireAdmin] Erro ao buscar role');
                return res.status(500).json({
                    error: 'Erro ao verificar permissões',
                    code: 'PERMISSION_CHECK_ERROR'
                });
            }
            if (ctx.reason === 'not_company_member') {
                logger_1.default.warn('[requireAdmin] Usuário não pertence a nenhuma empresa:', userEmail);
                return res.status(403).json({
                    error: 'Você não tem permissão para acessar este recurso',
                    details: 'Apenas administradores podem realizar esta ação',
                    code: 'NOT_ADMIN'
                });
            }
            logger_1.default.warn(`[requireAdmin] 🚫 Usuário NÃO é admin (role: ${ctx.role ?? 'unknown'}): ${userEmail}`);
            return res.status(403).json({
                error: 'Você não tem permissão para acessar este recurso',
                details: 'Apenas administradores podem realizar esta ação',
                code: 'NOT_ADMIN'
            });
        }
        if (ctx.viaPermission) {
            logger_1.default.log(`[requireAdmin] ✅ Usuário é admin (permissão basic.admin): ${userEmail}`);
        }
        else {
            logger_1.default.log(`[requireAdmin] ✅ Usuário é admin (role: ${ctx.role}): ${userEmail}`);
        }
        ;
        req.companiesId = ctx.companiesId;
        return next();
    }
    catch (error) {
        logger_1.default.error('[requireAdmin] Erro:', error);
        return res.status(500).json({
            error: 'Erro ao verificar permissões',
            details: error.message,
            code: 'PERMISSION_ERROR'
        });
    }
}
/**
 * Exige workspace (tb_company_users) após requireAuth.
 * PF e PJ usam o mesmo tenant em tb_companies — onboarding incompleto retorna 403.
 */
async function requireWorkspace(req, res, next) {
    try {
        if (!req.user?.email) {
            return res.status(401).json({
                error: 'Token de autenticação não fornecido',
                details: 'Faça login primeiro',
                code: 'AUTH_REQUIRED',
            });
        }
        const companiesId = await (0, company_helper_1.getCompanyIdByEmail)(req.user.email);
        if (!companiesId) {
            logger_1.default.warn('[requireWorkspace] Workspace não configurado:', req.user.email);
            return res.status(403).json({
                error: 'Workspace não configurado',
                details: 'Complete o cadastro (pessoa física ou jurídica) para continuar.',
                code: 'WORKSPACE_REQUIRED',
            });
        }
        req.user.companiesId = companiesId;
        next();
    }
    catch (error) {
        logger_1.default.error('[requireWorkspace] Erro:', error);
        return res.status(500).json({
            error: 'Erro ao validar workspace',
            details: error instanceof Error ? error.message : String(error),
            code: 'WORKSPACE_CHECK_ERROR',
        });
    }
}
const PERMISSION_RANK = {
    'basic.read': 1,
    'basic.write': 2,
    'basic.admin': 3,
};
async function getEffectivePermissionRank(userEmail, companiesId) {
    const adminCtx = await resolveBillingAdminContext(userEmail);
    if (adminCtx.allowed) {
        return PERMISSION_RANK['basic.admin'];
    }
    const { data: userData } = await supabase_1.supabase
        .from('tb_users')
        .select('id')
        .eq('email', userEmail)
        .maybeSingle();
    if (!userData?.id)
        return 0;
    const { data: companyUser } = await supabase_1.supabase
        .from('tb_company_users')
        .select('role')
        .eq('user_id', userData.id)
        .eq('companies_id', companiesId)
        .maybeSingle();
    if (!companyUser)
        return 0;
    if (companyUser.role === 'owner' || companyUser.role === 'admin') {
        return PERMISSION_RANK['basic.admin'];
    }
    let rank = PERMISSION_RANK['basic.read'];
    const { data: permissionRows } = await supabase_1.supabase
        .from('tb_user_permissions')
        .select('permission_id, tb_permissions(key)')
        .eq('user_id', userData.id)
        .eq('companies_id', companiesId);
    for (const row of permissionRows || []) {
        const key = String(row.tb_permissions?.key || '')
            .trim();
        if (key in PERMISSION_RANK) {
            rank = Math.max(rank, PERMISSION_RANK[key]);
        }
    }
    return rank;
}
/** RBAC fino — exige `requireAuth` + `requireWorkspace` antes. Owner/admin ou permissão equivalente. */
function requirePermission(minPermission) {
    return async (req, res, next) => {
        try {
            if (!req.user?.email || !req.user.companiesId) {
                return res.status(401).json({
                    error: 'Autenticação e workspace são obrigatórios',
                    code: 'AUTH_REQUIRED',
                });
            }
            const rank = await getEffectivePermissionRank(req.user.email, req.user.companiesId);
            if (rank < PERMISSION_RANK[minPermission]) {
                return res.status(403).json({
                    error: 'Permissão insuficiente para esta ação',
                    code: 'PERMISSION_DENIED',
                    required: minPermission,
                });
            }
            return next();
        }
        catch (error) {
            logger_1.default.error('[requirePermission] Erro:', error);
            return res.status(500).json({
                error: 'Erro ao verificar permissões',
                code: 'PERMISSION_ERROR',
            });
        }
    };
}
