import { useCallback, useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { api, type Branch, type ManualOrderPrefill, type Order } from '../../api'
import { dateLabel, orderStatusLabel } from '../../data/orders'
import { branchLabel, chairName } from '../../utils/branches'
import { getMessage } from '../../utils/errors'
import { ManualOrderModal } from './ManualOrderModal'
import { OrderFlags } from './OrderExtras'

/**
 * Menu "Pedido manual": cadastro dos clientes de antes do sistema e das exceções, e os últimos pedidos cadastrados à mão.
 * Os pedidos que chegam pelo site e pela Isa ficam em "Pedido automático".
 */
export function ManualOrderPage({ credentials, onOpenOrder, conversationId }: {
  credentials: string; onOpenOrder: (id: string) => void
  /** Aberto pelo botão da conversa: o formulário já vem com o que a cliente passou para a Isa. */
  conversationId?: string | null
}) {
  const [branches, setBranches] = useState<Branch[] | null>(null)
  const [recent, setRecent] = useState<Order[] | null>(null)
  const [error, setError] = useState('')
  const [prefill, setPrefill] = useState<{ id: string; data: ManualOrderPrefill | null } | null>(null)

  const loadRecent = useCallback(() => api.orderPage(credentials, { source: 'MANUAL' }, 0, 10)
    .then(page => setRecent(page.items)).catch(cause => setError(getMessage(cause))), [credentials])

  useEffect(() => {
    let active = true
    api.branches(credentials).then(list => { if (active) setBranches(list) }).catch(cause => { if (active) setError(getMessage(cause)) })
    void loadRecent()
    if (conversationId) api.manualOrderPrefill(credentials, conversationId)
      .then(data => { if (active) setPrefill({ id: conversationId, data }) })
      .catch(() => { if (active) setPrefill({ id: conversationId, data: null }) })
    return () => { active = false }
  }, [credentials, loadRecent, conversationId])

  const waitingPrefill = Boolean(conversationId) && prefill?.id !== conversationId

  return <>
    <div className="page-heading">
      <div><span className="eyebrow">OPERAÇÃO • PEDIDO MANUAL</span><h1>Pedido manual</h1>
        <p className="page-subtitle">Clientes de antes do sistema e exceções. O pedido ocupa a poltrona e segue para entrega e retirada.</p></div>
    </div>
    {error && <div className="form-error" role="alert">{error}</div>}
    {conversationId && prefill?.data && <div className="od-notice info"><p>Dados trazidos da conversa com a Isa. Confira e complete antes de cadastrar.</p></div>}
    {branches === null || waitingPrefill ? <div className="empty-state" role="status"><p>Carregando...</p></div>
      : <ManualOrderModal key={conversationId ?? 'novo'} inline credentials={credentials} branches={branches}
        initial={prefill?.data} onCreated={order => onOpenOrder(order.id)} />}

    <section className="panel mo-recent" aria-labelledby="mo-recent-title">
      <h2 id="mo-recent-title">Últimos pedidos manuais</h2>
      {recent === null ? <p className="order-muted">Carregando...</p>
        : recent.length === 0 ? <p className="order-muted">Nenhum pedido manual cadastrado ainda.</p>
          : <ul>{recent.map(order => <li key={order.id}>
            <button type="button" onClick={() => onOpenOrder(order.id)}>
              <span><strong>{order.customerName}</strong>
                <small>{dateLabel(order.start)} a {dateLabel(order.end)} • {chairName(order.chairCode, order.branchName)} • {branchLabel(order.branchName)}</small>
                <OrderFlags order={order} /></span>
              <span className={`order-status status-${order.status.toLowerCase()}`}>{orderStatusLabel(order)}</span>
              <ArrowRight size={15} aria-hidden="true" />
            </button></li>)}</ul>}
    </section>
  </>
}
