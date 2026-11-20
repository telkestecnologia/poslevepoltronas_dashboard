import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, ChevronDown, ChevronUp } from 'lucide-react'
import { api, type Branch, type Order } from '../../api'
import { dateLabel, orderStatusLabel } from '../../data/orders'
import { replaceQuery } from '../../router'
import { branchLabel, chairName } from '../../utils/branches'
import { getMessage } from '../../utils/errors'
import { clearDraft, draftFromPrefill, draftIsOpen, readDraft, writeDraft } from '../../utils/manualDraft'
import { ManualOrderWizard } from './ManualOrderWizard'
import { SaleDetailsEditor } from './SaleDetailsCard'
import { OrderFlags } from './OrderExtras'

/** Tempo mínimo da tela de carregamento, para a equipe ver que os dados da Isa estão sendo trazidos. */
const MIN_LOADING_MS = 900

/**
 * Menu "Pedido manual": cadastro dos clientes de antes do sistema e das exceções, e os últimos pedidos cadastrados à mão.
 * Vindo do botão da conversa, carrega o que a Isa coletou e guarda como rascunho até o cadastro ser concluído.
 */
export function ManualOrderPage({ credentials, onOpenOrder, conversationId, editOrderId }: {
  credentials: string; onOpenOrder: (id: string) => void
  /** Aberto pelo botão "Alterar no Pedido manual" do pedido: os detalhes da venda dele, para editar. */
  editOrderId?: string | null
  /** Aberto pelo botão da conversa: o formulário já vem com o que a cliente passou para a Isa. */
  conversationId?: string | null
}) {
  const [branches, setBranches] = useState<Branch[] | null>(null)
  const [recent, setRecent] = useState<Order[] | null>(null)
  const [error, setError] = useState('')
  const [loadingFrom, setLoadingFrom] = useState<string | null>(conversationId ?? null)
  const [version, setVersion] = useState(0)
  const [editing, setEditing] = useState<Order | null>(null)
  useEffect(() => {
    if (!editOrderId) { setEditing(null); return }
    let active = true
    api.order(credentials, editOrderId).then(order => { if (active) setEditing(order) }).catch(cause => { if (active) setError(getMessage(cause)) })
    return () => { active = false }
  }, [credentials, editOrderId])
  // Abrir e fechar o formulário (lembrado neste navegador). Vindo da conversa, abre sempre.
  const [open, setOpen] = useState(() => { try { return localStorage.getItem('posleve.manualFormOpen') !== 'no' } catch { return true } })
  const toggle = () => setOpen(value => { const next = !value; try { localStorage.setItem('posleve.manualFormOpen', next ? 'yes' : 'no') } catch { /* sem armazenamento */ } return next })
  useEffect(() => { if (conversationId) setOpen(true) }, [conversationId])

  const loadRecent = useCallback(() => api.orderPage(credentials, { source: 'MANUAL' }, 0, 10)
    .then(page => setRecent(page.items)).catch(cause => setError(getMessage(cause))), [credentials])

  useEffect(() => {
    let active = true
    api.branches(credentials).then(list => { if (active) setBranches(list) }).catch(cause => { if (active) setError(getMessage(cause)) })
    void loadRecent()
    return () => { active = false }
  }, [credentials, loadRecent])

  // Vindo da conversa: traz o que a Isa coletou para o rascunho (com a tela de carregamento) e tira o ?conversa da URL,
  // para um F5 não buscar de novo por cima do que já foi digitado.
  useEffect(() => {
    if (!conversationId) return
    let active = true
    const started = Date.now()
    const existing = readDraft()
    const keep = draftIsOpen(existing) && existing?.conversationId !== conversationId
      && !window.confirm('Já existe um pedido manual em aberto. Substituir pelos dados desta conversa?')
    const finish = () => {
      window.setTimeout(() => {
        if (!active) return
        replaceQuery({ conversa: undefined })
        setLoadingFrom(null)
        setVersion(value => value + 1)
      }, Math.max(0, MIN_LOADING_MS - (Date.now() - started)))
    }
    if (keep || existing?.conversationId === conversationId) { finish(); return () => { active = false } }
    api.manualOrderPrefill(credentials, conversationId)
      .then(data => { if (active) writeDraft(draftFromPrefill(conversationId, data)) })
      .catch(() => { if (active) writeDraft(draftFromPrefill(conversationId, null)) })
      .finally(finish)
    return () => { active = false }
  }, [credentials, conversationId])

  return <div className="mo-area">
    {loadingFrom && <div className="mo-loading" role="status" aria-live="polite">
      <div className="mo-loading-box">
        <span className="mo-spinner" aria-hidden="true" />
        <strong>Carregando as informações</strong>
        <p>Trazendo o que a Isa coletou na conversa para você concluir o cadastro manual.</p>
      </div>
    </div>}
    <div className="page-heading">
      <div><span className="eyebrow">OPERAÇÃO • PEDIDO MANUAL</span><h1>Pedido manual</h1>
        <p className="page-subtitle">Clientes de antes do sistema e exceções. O pedido ocupa a poltrona e segue para entrega e retirada.</p></div>
    </div>
    {error && <div className="form-error" role="alert">{error}</div>}
    {editOrderId && <section className="panel mo-edit" aria-labelledby="mo-edit-title">
      <h2 id="mo-edit-title">Alterar detalhes da venda{editing ? ` • ${editing.customerName}` : ''}</h2>
      <p className="page-subtitle">Forma de pagamento, desconto, plano, indicação e nota fiscal deste pedido. Ao salvar, você volta para o pedido.</p>
      {editing ? <SaleDetailsEditor credentials={credentials} order={editing} onDone={() => onOpenOrder(editing.id)} /> : <p className="order-muted">Carregando...</p>}
    </section>}
    <button type="button" className="mo-toggle" aria-expanded={open} onClick={toggle}>
      <span>{open ? 'Fechar cadastro' : 'Abrir cadastro de pedido manual'}</span>
      {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
    </button>
    {!open ? null : branches === null || loadingFrom ? <div className="empty-state" role="status"><p>Carregando...</p></div>
      : <ManualOrderWizard key={version} credentials={credentials} branches={branches}
        onClear={() => { clearDraft(); setVersion(value => value + 1) }}
        onCreated={order => { void loadRecent(); onOpenOrder(order.id) }} />}

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
  </div>
}
