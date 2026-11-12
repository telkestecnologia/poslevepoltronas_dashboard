import { useSyncExternalStore } from 'react'
import type { Page } from './types'

// Rotas do painel na URL: F5 mantém a tela aberta e um pedido ou conversa tem link próprio (/pedidos/:id).
const paths: Record<Page, string> = {
  overview: '/',
  finance: '/financeiro',
  chairs: '/poltronas',
  branches: '/filiais',
  couriers: '/entregadores',
  agenda: '/agenda',
  orders: '/pedidos',
  conversations: '/conversas',
  ai: '/contexto-ia',
  notifications: '/alertas-ia',
  payments: '/pagamentos-e-precos',
  profile: '/perfil',
}

export type Route = { page: Page; id?: string }

const changeEvent = 'posleve:navigate'

export function parseRoute(pathname: string): Route {
  const [first = '', second] = pathname.replace(/^\/+|\/+$/g, '').split('/')
  const page = (Object.keys(paths) as Page[]).find(key => paths[key] === `/${first}`) ?? 'overview'
  const id = second && (page === 'orders' || page === 'conversations') ? decodeURIComponent(second) : undefined
  return id ? { page, id } : { page }
}

export function routePath(route: Route, query?: URLSearchParams) {
  const base = paths[route.page] + (route.id ? `/${encodeURIComponent(route.id)}` : '')
  const search = query?.toString()
  return search ? `${base}?${search}` : base
}

/** Troca a URL sem recarregar a página. replace = não cria uma entrada nova no "voltar" do navegador. */
export function go(path: string, options: { replace?: boolean; state?: Record<string, unknown> } = {}) {
  if (path === `${window.location.pathname}${window.location.search}`) return
  const state = options.state ?? null
  if (options.replace) window.history.replaceState(state, '', path)
  else window.history.pushState(state, '', path)
  window.dispatchEvent(new Event(changeEvent))
}

/** Grava os filtros da tela na URL (sem entrada nova no histórico), para o "voltar" do pedido devolver a lista igual. */
export function replaceQuery(values: Record<string, string | undefined>) {
  const params = new URLSearchParams(window.location.search)
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value)
    else params.delete(key)
  }
  const search = params.toString()
  go(`${window.location.pathname}${search ? `?${search}` : ''}`, { replace: true, state: window.history.state ?? undefined })
}

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange)
  window.addEventListener(changeEvent, onChange)
  return () => {
    window.removeEventListener('popstate', onChange)
    window.removeEventListener(changeEvent, onChange)
  }
}

const snapshot = () => `${window.location.pathname}${window.location.search}`

/** Rota atual e os parâmetros da URL; atualiza com o voltar/avançar do navegador. */
export function useLocation() {
  const href = useSyncExternalStore(subscribe, snapshot)
  const url = new URL(href, window.location.origin)
  return { route: parseRoute(url.pathname), params: url.searchParams }
}
