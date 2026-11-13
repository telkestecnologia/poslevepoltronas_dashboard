import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Page } from '../types'

const POLL_MS = 30_000

/**
 * Números em vermelho no menu (os mesmos do app): conversas que precisam de resposta em Atendimento e poltronas
 * para entregar em Pedidos.
 */
export function useMenuCounts(credentials: string | null): Partial<Record<Page, number>> {
  const [counts, setCounts] = useState<Partial<Record<Page, number>>>({})

  useEffect(() => {
    if (!credentials) { setCounts({}); return }
    const auth = credentials
    let active = true
    async function check() {
      const [conversations, deliveries] = await Promise.allSettled([
        api.conversations(auth),
        api.orderPage(auth, { source: 'CHECKOUT', statuses: ['PAYMENT_CONFIRMED', 'DELIVERY_PENDING'] }, 0, 1),
      ])
      if (!active) return
      setCounts(current => ({
        conversations: conversations.status === 'fulfilled'
          ? conversations.value.items.filter(item => item.needsAttention).length : current.conversations,
        agenda: deliveries.status === 'fulfilled' ? deliveries.value.total : current.agenda,
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
