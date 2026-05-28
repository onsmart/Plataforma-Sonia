export type TeamPermissionKey = 'basic.admin' | 'basic.write' | 'basic.read'

export const TEAM_PERMISSION_INFO: Record<
  TeamPermissionKey,
  { label: string; description: string }
> = {
  'basic.admin': {
    label: 'Administrador',
    description:
      'Acesso completo: configurações, faturamento, equipe, agentes, fluxos, integrações e base de conhecimento.',
  },
  'basic.write': {
    label: 'Editor',
    description:
      'Cria e edita agentes, fluxos, base de conhecimento e atendimentos. Não gerencia faturamento nem convites.',
  },
  'basic.read': {
    label: 'Leitor',
    description:
      'Visualiza dashboards, inbox e relatórios. Não altera configurações críticas nem convida membros.',
  },
}

export function getPermissionInfo(key: string) {
  return TEAM_PERMISSION_INFO[key as TeamPermissionKey] ?? {
    label: key,
    description: 'Permissão personalizada da plataforma.',
  }
}
