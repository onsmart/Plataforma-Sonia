/**
 * Provisiona templates, agentes e o fluxo demo de clinica medica.
 *
 * Uso:
 *   OWNER_EMAIL=admin@suaempresa.com npx tsx scripts/seed-medical-clinic-demo.ts
 *
 * Opcionais:
 *   CRM_INTEGRATION_ID=uuid-do-hubspot
 *   EMAIL_INTEGRATION_ID=uuid-da-integracao-email
 *   CALENDLY_INTEGRATION_ID=uuid-da-integracao-calendly
 *   TEAM_NOTIFY_EMAIL=recepcao@clinica.com.br
 */

import path from 'path'
import dotenv from 'dotenv'
import { provisionMedicalClinicDemoFlow } from '../src/services/flows/flow-provision-medical-clinic.service'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

async function main() {
  const ownerEmail = String(process.env.OWNER_EMAIL || process.env.SEED_OWNER_EMAIL || '')
    .trim()
    .toLowerCase()

  if (!ownerEmail) {
    throw new Error('Defina OWNER_EMAIL (ou SEED_OWNER_EMAIL) para o seed da clinica.')
  }

  const result = await provisionMedicalClinicDemoFlow(ownerEmail, {
    crmIntegrationId: String(process.env.CRM_INTEGRATION_ID || '').trim() || undefined,
    emailIntegrationId: String(process.env.EMAIL_INTEGRATION_ID || '').trim() || undefined,
    calendlyIntegrationId: String(process.env.CALENDLY_INTEGRATION_ID || '').trim() || undefined,
    teamNotifyEmail: String(process.env.TEAM_NOTIFY_EMAIL || '').trim() || undefined,
  })

  console.log(`Fluxo criado/atualizado: ${result.flowName}`)
  console.log(`Flow ID: ${result.flowId}`)
  console.log(`Subfluxos: ${Object.keys(result.subflowIds).length}`)
  for (const [key, id] of Object.entries(result.subflowIds)) {
    console.log(`- ${key}: ${id}`)
  }
  console.log(`Appointment provider: ${result.appointmentProvider}`)
  console.log(`Appointment integration ID: ${result.appointmentIntegrationId || '(nao configurado)'}`)
  console.log(`Templates: ${result.templatesCreated.length}`)
  console.log(`Agentes: ${result.agentsCreated.length}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
