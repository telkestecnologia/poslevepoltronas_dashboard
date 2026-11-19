import { useEffect, useState } from 'react'
import { api, REAL_SOURCES } from '../api'
import type { Page } from '../types'

const POLL_MS = 30_000

/**
 * Números em vermelho no menu (os mesmos do app): conversas que precisam de resposta em Atendimento e poltronas
 * para entregar em Pedidos e dúvidas sem resposta em O que a Isa sabe.
 */
export function useMenuCounts(credentials: string | null): Partial<Record<Page, number>> {
  const [counts, setCounts] = useState<Partial<Record<Page, number>>>({})

  useEffect(() => {
    if (!credentials) { setCounts({}); return }
    const auth = credentials
    let active = true
    async function check() {
      const [conversations, deliveries, unanswered] = await Promise.allSettled([
        api.conversations(auth),
        api.orderPage(auth, { source: REAL_SOURCES, statuses: ['PAYMENT_CONFIRMED', 'DELIVERY_PENDING'] }, 0, 1),
        api.aiUnanswered(auth),
      ])
      if (!active) return
      setCounts(current => ({
        conversations: conversations.status === 'fulfilled'
          ? conversations.value.items.filter(item => item.needsAttention).length : current.conversations,
        agenda: deliveries.status === 'fulfilled' ? deliveries.value.total : current.agenda,
        // Dúvidas que a Isa não soube responder: quantas esperam resposta.
        ai: unanswered.status === 'fulfilled' ? unanswered.value.length : current.ai,
      }))
    }
    void check()
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void check() }, POLL_MS)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [credentials])

  return counts
}
