/** Horário de entrega/retirada: fixo ("14:00") ou faixa ("08:00-12:00", combinada pela Isa no WhatsApp). */
export function timeLabel(time: string | null | undefined) {
  if (!time) return ''
  const [start, end] = time.split('-')
  return end ? `entre ${start} e ${end}` : `às ${start}`
}

/** Na agenda: horário marcado ("14:00"); se for só a faixa, o turno ("Manhã" ou "Tarde"); sem nada, "A combinar". */
export function agendaTime(time: string | null | undefined) {
  if (!time) return 'A combinar'
  const [start, end] = time.split('-')
  if (!end) return start
  return Number(start.slice(0, 2)) < 12 ? 'Manhã' : 'Tarde'
}

/** Forma curta para listas e agenda: "14:00" ou "08:00–12:00". */
export function timeShort(time: string | null | undefined) {
  return time ? time.replace('-', '–') : ''
}
