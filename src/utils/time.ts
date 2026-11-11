/** Horário de entrega/retirada: fixo ("14:00") ou faixa ("08:00-12:00", combinada pela Isa no WhatsApp). */
export function timeLabel(time: string | null | undefined) {
  if (!time) return ''
  const [start, end] = time.split('-')
  return end ? `entre ${start} e ${end}` : `às ${start}`
}

/** Forma curta para listas e agenda: "14:00" ou "08:00–12:00". */
export function timeShort(time: string | null | undefined) {
  return time ? time.replace('-', '–') : ''
}
