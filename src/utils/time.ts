/** Horário de entrega/retirada: fixo ("14:00") ou faixa ("08:00-12:00", combinada pela Isa no WhatsApp). */
/** Horário a combinar (pedido do WhatsApp sem turno): a equipe combina com a cliente depois do pagamento. */
export const TO_ARRANGE = '08:00-18:00'

export function timeLabel(time: string | null | undefined) {
  if (!time || time === TO_ARRANGE) return ''
  // Faixa escolhida pela cliente vira o turno (de manhã / à tarde); horário marcado aparece como está.
  const [start, end] = time.split('-')
  return end ? (Number(start.slice(0, 2)) < 12 ? 'de manhã' : 'à tarde') : `às ${start}`
}

/** Na agenda: horário marcado ("14:00"); se for só a faixa, o turno ("Manhã" ou "Tarde"); sem nada, "A combinar". */
export function agendaTime(time: string | null | undefined) {
  if (!time || time === TO_ARRANGE) return 'A combinar'
  const [start, end] = time.split('-')
  if (!end) return start
  return Number(start.slice(0, 2)) < 12 ? 'Manhã' : 'Tarde'
}

/** Forma curta para listas e agenda: "14:00" ou "08:00–12:00". */
export function timeShort(time: string | null | undefined) {
  return time && time !== TO_ARRANGE ? time.replace('-', '–') : ''
}
