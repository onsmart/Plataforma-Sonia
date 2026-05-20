type AppointmentSlotLike = {
  slotId?: unknown
  startsAt?: unknown
  doctor?: unknown
  unit?: unknown
  mode?: unknown
  consultationType?: unknown
}

function normalizeMessage(value: unknown): string {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function readAppointmentSlots(data: Record<string, unknown>): AppointmentSlotLike[] {
  if (!Array.isArray(data.appointment_slots)) return []
  return data.appointment_slots.filter((slot) => slot && typeof slot === 'object') as AppointmentSlotLike[]
}

function formatSlotDateTime(value: unknown): string {
  const iso = String(value || '').trim()
  if (!iso) return 'Horario a confirmar'

  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date)
}

function formatSlotLine(slot: AppointmentSlotLike, index: number): string {
  const startsAt = formatSlotDateTime(slot.startsAt)
  const doctor = String(slot.doctor || '').trim()
  const unit = String(slot.unit || '').trim()
  const mode = String(slot.mode || slot.consultationType || '').trim()

  const details = [doctor, unit, mode].filter(Boolean).join(' | ')
  return details ? `${index + 1}. ${startsAt} - ${details}` : `${index + 1}. ${startsAt}`
}

function isAwaitingAppointmentSlotSelection(data: Record<string, unknown>): boolean {
  if (data.__awaiting_appointment_slot === true) return true

  const resumeNodeId = String(data.__flow_resume_node_id || data.__resume_from_node_id || '').trim()
  const waitingNodeId = String(data.__flow_waiting_node_id || '').trim()
  const pauseReason = String(data.__flow_pause_reason || '').trim()
  const runtime = (data.__flow_runtime || {}) as {
    appointmentState?: { bookNodeId?: string | null; chooseSlotNodeId?: string | null }
  }
  const bookNodeId = String(runtime.appointmentState?.bookNodeId || '').trim()
  const chooseSlotNodeId = String(runtime.appointmentState?.chooseSlotNodeId || '').trim()

  return (
    pauseReason === 'missing_appointment_slot' ||
    (!!bookNodeId && resumeNodeId === bookNodeId) ||
    (!!chooseSlotNodeId && waitingNodeId === chooseSlotNodeId)
  )
}

export function applyAppointmentSlotSelectionFromUserMessage(data: Record<string, unknown>): void {
  if (String(data.appointment_selected_slot_id || '').trim()) {
    return
  }

  if (!isAwaitingAppointmentSlotSelection(data)) {
    return
  }

  const slots = readAppointmentSlots(data)
  if (slots.length === 0) return

  const userMessage = normalizeMessage(data.userMessage || data.message || data.originalMessage)
  if (!userMessage) return

  const numericChoice = userMessage.match(/^\s*(\d{1,2})\s*$/)
  if (numericChoice) {
    const optionIndex = Number.parseInt(numericChoice[1], 10) - 1
    const selected = optionIndex >= 0 ? slots[optionIndex] : null
    const selectedSlotId = String(selected?.slotId || '').trim()
    if (selectedSlotId) {
      data.appointment_selected_slot_id = selectedSlotId
      data.appointment_selected_slot_index = optionIndex + 1
    }
    return
  }

  const directSlot = slots.find((slot) => {
    const slotId = normalizeMessage(slot.slotId)
    return slotId && userMessage === slotId
  })
  const directSlotId = String(directSlot?.slotId || '').trim()
  if (directSlotId) {
    data.appointment_selected_slot_id = directSlotId
  }
}

export function buildAppointmentSlotSelectionMessage(data: Record<string, unknown>): string {
  const slots = readAppointmentSlots(data)
  const specialty = String(data.specialty || 'a especialidade solicitada').trim()

  if (slots.length === 0) {
    return (
      `No momento nao encontrei horarios disponiveis para ${specialty}.\n\n` +
      'Posso seguir com a lista de espera ou encaminhar para a equipe verificar outras opcoes.'
    )
  }

  const renderedSlots = slots.slice(0, 5).map((slot, index) => formatSlotLine(slot, index)).join('\n')
  return (
    `Encontrei horarios disponiveis para ${specialty}:\n\n` +
    `${renderedSlots}\n\n` +
    'Responda com o numero da opcao desejada para eu confirmar o agendamento.'
  )
}
