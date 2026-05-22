import { supabase } from '../utils/supabase/client'

export type WhatsappIntegrationOption = {
  id: string
  phone_number?: string | null
  provider?: string | null
  email_address?: string | null
  is_active?: boolean | null
}

async function resolveCompaniesId(input: {
  userId?: string | null
  companiesId?: string | null
}): Promise<string | null> {
  if (input.companiesId) return input.companiesId
  if (!input.userId) return null

  const { data, error } = await supabase
    .from('tb_company_users')
    .select('companies_id')
    .eq('user_id', input.userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.warn('[workspace-integrations] tb_company_users:', error.message)
    return null
  }
  return data?.companies_id ? String(data.companies_id) : null
}

/** Lista integrações WhatsApp do workspace sem RPC que exige tb_users por e-mail. */
export async function fetchWhatsappIntegrationsForWorkspace(input: {
  userId?: string | null
  companiesId?: string | null
}): Promise<WhatsappIntegrationOption[]> {
  const companiesId = await resolveCompaniesId(input)
  if (!companiesId) return []

  const { data, error } = await supabase
    .from('tb_integrations')
    .select('id, phone_number, provider, email_address, is_active')
    .eq('companies_id', companiesId)
    .eq('provider', 'whatsapp')
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('[workspace-integrations] tb_integrations whatsapp:', error.message)
    return []
  }
  return (data || []) as WhatsappIntegrationOption[]
}
