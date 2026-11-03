import type { Conversation } from '../api'

/** 5585936181059 → (85) 93618-1059. */
export function whatsAppNumber(phone: string) {
  const digits = phone.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return phone
}

export function customerLabel(item: Conversation) {
  return item.channel === 'WHATSAPP' && item.customerPhone ? whatsAppNumber(item.customerPhone) : 'Visitante do site'
}

export function conversationState(item: Conversation): { label: string; tone: 'ai' | 'help' | 'human' | 'closed' } {
  if (item.needsAttention && item.channel === 'WHATSAPP') {
    return { label: item.state === 'HUMAN' ? 'Pediu atendimento humano' : 'Isa não soube responder', tone: 'help' }
  }
  if (item.state === 'HUMAN') return { label: `${item.staffName ?? 'Equipe'} atendendo`, tone: 'human' }
  if (item.state === 'CLOSED') return { label: 'Conversa encerrada', tone: 'closed' }
  if (item.state === 'PAUSED') return { label: 'Pausada', tone: 'closed' }
  if (item.needsAttention) return { label: 'Isa pediu ajuda', tone: 'help' }
  return { label: 'Isa respondendo', tone: 'ai' }
}

/** Conversa em que a Isa não conseguiu responder e ninguém da equipe respondeu ainda. */
export function needsHelp(item: Conversation) {
  return item.needsAttention && (item.channel === 'WHATSAPP' || item.state !== 'HUMAN')
}

export function helpTitle(item: Conversation) {
  if (item.channel === 'SITE') return 'A Isa não conseguiu responder no site'
  return item.state === 'HUMAN' ? 'Cliente pediu atendimento no WhatsApp' : 'A Isa não conseguiu responder no WhatsApp'
}

export function helpDetail(item: Conversation) {
  const message = item.lastCustomerMessage ?? item.lastMessagePreview
  return item.channel === 'WHATSAPP'
    ? `${item.customerPhone ? whatsAppNumber(item.customerPhone) : 'Cliente'} escreveu: “${message}”`
    : `Cliente do site perguntou: “${message}”`
}

const nameColors = ['#027eb5', '#c4532c', '#8b3fb5', '#1f8a5b', '#b5326b', '#a06a00']

/** Each person keeps the same name color in every conversation, like a WhatsApp group. */
export function nameColor(name: string) {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return nameColors[hash % nameColors.length]
}
