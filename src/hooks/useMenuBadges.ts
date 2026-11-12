import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import type { Page } from '../types'

/** Menus que recebem novidades sozinhos (o resto só muda quando alguém da equipe altera). */
export type BadgePage = Extract<Page, 'orders' | 'conversations' | 'ai'>
const BADGE_PAGES: BadgePage[] = ['orders', 'conversations', 'ai']
const POLL_MS = 45_000

type Seen = Partial<Record<BadgePage, string>>

function storageKey(user: string) {
  return `posleve:menu-seen:${user}`
}

function readSeen(user: string): Seen {
  try { return JSON.parse(localStorage.getItem(storageKey(user)) ?? '{}') as Seen } catch { return {} }
}

function writeSeen(user: string, seen: Seen) {
  try { localStorage.setItem(storageKey(user), JSON.stringify(seen)) } catch { /* navegador sem armazenamento */ }
}

/**
 * Círculo vermelho nos menus com algo que chegou depois da última vez que a pessoa abriu aquele menu neste navegador:
 * pedido novo, mensagem de cliente (ou conversa pedindo atenção) e pergunta que a Isa não soube responder.
 * Na primeira vez neste navegador, tudo o que já existe conta como visto.
 */
export function useMenuBadges(credentials: string | null, user: string, page: Page): ReadonlySet<Page> {
  const [badges, setBadges] = useState<Set<BadgePage>>(new Set())
  const pageRef = useRef(page)
  pageRef.current = page

  // Abrir (ou estar em) um menu marca tudo dele como visto.
  useEffect(() => {
    if (!credentials || !BADGE_PAGES.includes(page as BadgePage)) return
    const seen = readSeen(user)
    writeSeen(user, { ...seen, [page]: new Date().toISOString() })
    setBadges(current => {
      if (!current.has(page as BadgePage)) return current
      const next = new Set(current)
      next.delete(page as BadgePage)
      return next
    })
  }, [credentials, page, user])

  useEffect(() => {
    if (!credentials) { setBadges(new Set()); return }
    const auth = credentials
    let active = true
    async function check() {
      const now = new Date().toISOString()
      const seen = readSeen(user)
      const first = BADGE_PAGES.filter(key => !seen[key])
      if (first.length > 0) {
        first.forEach(key => { seen[key] = now })
        writeSeen(user, seen)
      }
      const after = (key: BadgePage, at?: string | null) => !!at && Date.parse(at) > Date.parse(seen[key] ?? now)
      const [orders, conversations, unanswered] = await Promise.allSettled([
        api.orderPage(auth, {}, 0, 1),
        api.conversations(auth),
        api.aiUnanswered(auth),
      ])
      if (!active) return
      const next = new Set<BadgePage>()
      if (orders.status === 'fulfilled' && after('orders', orders.value.items[0]?.createdAt)) next.add('orders')
      if (conversations.status === 'fulfilled' && conversations.value.items.some(item =>
        (item.lastMessageRole === 'CUSTOMER' || item.needsAttention) && after('conversations', item.lastMessageAt))) next.add('conversations')
      if (unanswered.status === 'fulfilled' && unanswered.value.some(item => after('ai', item.lastAskedAt))) next.add('ai')
      // O menu aberto agora não ganha círculo: a pessoa já está vendo.
      if (BADGE_PAGES.includes(pageRef.current as BadgePage)) {
        next.delete(pageRef.current as BadgePage)
        writeSeen(user, { ...readSeen(user), [pageRef.current]: now })
      }
      setBadges(next)
    }
    void check()
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void check() }, POLL_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') void check() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [credentials, user])

  return badges
}
