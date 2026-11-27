import { useCallback, useEffect, useState } from 'react'
import { FastForward, RefreshCw, X } from 'lucide-react'
import {
  api, ApiError, type Anticipation, type AnticipationOverview, type AnticipationSimulation, type CardReceivable, type OrderAnticipation,
} from '../../api'
import { currency, dateLabel, dateTimeLabel } from '../../data/orders'
import { getMessage } from '../../utils/errors'
import { go } from '../../router'
import { announceSaved } from '../../components/SavedToast'
import './anticipation.css'

const STATUS: Record<string, { label: string; tone: 'wait' | 'ok' | 'bad' }> = {
  PENDING: { label: 'Em análise no Asaas', tone: 'wait' },
  SCHEDULED: { label: 'Agendada', tone: 'wait' },
  CREDITED: { label: 'Creditada', tone: 'ok' },
  DEBITED: { label: 'Concluída', tone: 'ok' },
  DENIED: { label: 'Negada', tone: 'bad' },
  CANCELLED: { label: 'Cancelada', tone: 'bad' },
  OVERDUE: { label: 'Vencida', tone: 'bad' },
}
const statusOf = (status: string) => STATUS[status] ?? { label: status, tone: 'wait' as const }

function parcelsText(item: CardReceivable) {
  return item.parcels > 1 ? `${item.parcels} parcelas a cair` : 'à vista no cartão'
}
function creditText(item: CardReceivable) {
  if (!item.firstCreditDate) return ''
  if (!item.lastCreditDate || item.lastCreditDate === item.firstCreditDate) return `cai em ${dateLabel(item.firstCreditDate)}`
  return `cai de ${dateLabel(item.firstCreditDate)} a ${dateLabel(item.lastCreditDate)}`
}

export function AnticipationStatusTag({ status }: { status: string }) {
  const info = statusOf(status)
  return <span className={`ant-tag ${info.tone}`}>{info.label}</span>
}

/**
 * Confirmação da antecipação: simula no Asaas (taxa e líquido) e só pede depois do clique em "Antecipar".
 * No sandbox o Asaas não simula; mostra o valor do recebível e avisa.
 */
export function AnticipationModal({ credentials, receivable, onClose, onDone }: {
  credentials: string; receivable: CardReceivable; onClose: () => void; onDone: (created: Anticipation) => void
}) {
  const [simulation, setSimulation] = useState<AnticipationSimulation | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api.simulateAnticipation(credentials, receivable.orderId)
      .then(result => { if (active) setSimulation(result) })
      .catch(err => { if (active) setError(getMessage(err)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [credentials, receivable.orderId])

  async function confirm() {
    setSending(true)
    setError('')
    try {
      const created = await api.requestAnticipation(credentials, receivable.orderId)
      announceSaved('Antecipação pedida. O Asaas analisa e avisa o resultado.')
      onDone(created)
    } catch (err) {
      setError(getMessage(err))
      setSending(false)
    }
  }

  const blocked = !simulation || simulation.documentationRequired
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !sending) onClose() }}>
    <section className="modal ant-modal" role="dialog" aria-modal="true" aria-labelledby="ant-modal-title">
      <div className="modal-head"><div><span className="eyebrow">FINANCEIRO • ANTECIPAÇÃO</span>
        <h2 id="ant-modal-title">Antecipar recebível</h2></div>
        <button className="icon-button" aria-label="Fechar" onClick={onClose} disabled={sending}><X size={20} /></button></div>
      <div className="modal-form">
        <p className="ant-who"><strong>{receivable.customerName ?? 'Pedido'}</strong>
          <span>{parcelsText(receivable)}{creditText(receivable) ? ` • ${creditText(receivable)}` : ''}</span></p>
        {loading && <p className="order-muted" role="status">Consultando a taxa no Asaas...</p>}
        {simulation && <dl className="ant-figures">
          <div><dt>Valor a receber</dt><dd>{currency(simulation.valueCents)}</dd></div>
          <div><dt>Taxa da antecipação</dt><dd className="fee">{simulation.simulated ? `− ${currency(simulation.feeCents)}` : '—'}</dd></div>
          <div className="net"><dt>Você recebe{simulation.anticipationDate ? ` em ${dateLabel(simulation.anticipationDate)}` : ''}</dt>
            <dd>{simulation.simulated ? currency(simulation.netCents) : '—'}</dd></div>
        </dl>}
        {simulation && !simulation.simulated && <p className="ant-note" role="note">
          Ambiente de teste: o Asaas não simula a taxa no sandbox. O pedido é enviado mesmo assim, para testar o fluxo.</p>}
        {simulation?.documentationRequired && <p className="form-error" role="alert">
          O Asaas pede nota fiscal ou contrato para antecipar este pedido. Faça essa antecipação pelo site do Asaas.</p>}
        <p className="ant-note">O Asaas analisa o pedido e pode negar. Todas as parcelas que faltam são antecipadas juntas.</p>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose} disabled={sending}>Cancelar</button>
          <button type="button" className="button primary" onClick={() => void confirm()} disabled={blocked || sending || loading}>
            <FastForward size={16} /> {sending ? 'Pedindo...' : simulation?.simulated ? `Antecipar ${currency(simulation.netCents)}` : 'Antecipar'}
          </button>
        </div>
      </div>
    </section>
  </div>
}

/** Card no detalhe do pedido pago no cartão: botão de antecipar ou a situação da antecipação pedida. */
export function OrderAnticipationCard({ credentials, orderId }: { credentials: string; orderId: string }) {
  const [data, setData] = useState<OrderAnticipation | null>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setError('')
    // Parceiro (sem acesso de administrador) recebe 403: o card só não aparece.
    api.orderAnticipation(credentials, orderId).then(setData)
      .catch(err => { if (!(err instanceof ApiError && err.status === 403)) setError(getMessage(err)) })
  }, [credentials, orderId])
  useEffect(load, [load])

  if (error) return <section className="panel od-card ant-order admin-only" aria-label="Antecipação">
    <h2 className="od-side-title">Antecipação</h2><p className="form-error" role="alert">{error}</p>
    <button type="button" className="button secondary" onClick={load}><RefreshCw size={15} /> Tentar de novo</button></section>
  if (!data?.available || (!data.receivable && !data.latest)) return null
  const { receivable, latest } = data
  return <section className="panel od-card ant-order admin-only" aria-labelledby="ant-order-title">
    <h2 id="ant-order-title" className="od-side-title">Antecipação do cartão</h2>
    {receivable && <p className="ant-order-line"><strong>{currency(receivable.valueCents)}</strong>
      <span>{parcelsText(receivable)}{creditText(receivable) ? ` • ${creditText(receivable)}` : ''}</span></p>}
    {latest && <div className="ant-order-status"><AnticipationStatusTag status={latest.status} />
      <small>pedida por {latest.requestedBy ?? 'equipe'} em {dateTimeLabel(latest.requestedAt)}
        {latest.feeCents > 0 ? ` • taxa ${currency(latest.feeCents)}` : ''}</small>
      {latest.denialObservation && <small className="ant-denial">Motivo: {latest.denialObservation}</small>}</div>}
    {data.automatic && receivable && <p className="ant-note">A antecipação automática está ligada no Asaas: este pagamento já é antecipado.</p>}
    {receivable && !data.automatic && (receivable.anticipable
      ? <button type="button" className="button primary" onClick={() => setOpen(true)}><FastForward size={16} /> Antecipar recebível</button>
      : !latest?.status || !['PENDING', 'SCHEDULED'].includes(latest.status)
        ? <p className="ant-note">{receivable.requested ? 'Este pagamento já foi antecipado.' : 'O Asaas não libera a antecipação deste pagamento.'}</p> : null)}
    {open && receivable && <AnticipationModal credentials={credentials} receivable={receivable} onClose={() => setOpen(false)}
      onDone={() => { setOpen(false); load() }} />}
  </section>
}

/** Confirmação antes de ligar ou desligar a antecipação automática do cartão na conta Asaas. */
function AutomaticModal({ credentials, enable, onClose, onDone }: {
  credentials: string; enable: boolean; onClose: () => void; onDone: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function save() {
    setSaving(true)
    setError('')
    try {
      const saved = await api.setAutomaticAnticipation(credentials, enable)
      announceSaved(saved.enabled ? 'Antecipação automática ligada.' : 'Antecipação automática desligada.')
      onDone()
    } catch (err) {
      setError(getMessage(err))
      setSaving(false)
    }
  }
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className="modal ant-modal" role="dialog" aria-modal="true" aria-labelledby="ant-auto-title">
      <div className="modal-head"><div><span className="eyebrow">FINANCEIRO • ASAAS</span>
        <h2 id="ant-auto-title">{enable ? 'Ligar' : 'Desligar'} antecipação automática</h2></div>
        <button className="icon-button" aria-label="Fechar" onClick={onClose} disabled={saving}><X size={20} /></button></div>
      <div className="modal-form">
        {enable ? <ul className="ant-effects">
          <li>Os pagamentos <strong>novos</strong> no cartão passam a ser antecipados sozinhos pelo Asaas, enquanto houver limite.</li>
          <li>Cada antecipação tem a taxa do Asaas. No cartão parcelado, o acréscimo cobrado do cliente passa a incluir essa taxa.</li>
          <li>O botão de antecipar pedido por pedido deixa de ser usado.</li>
        </ul> : <ul className="ant-effects">
          <li>Os pagamentos <strong>novos</strong> no cartão caem na data normal de cada parcela.</li>
          <li>O que já está sendo antecipado continua; nada é cancelado.</li>
          <li>O acréscimo do parcelado deixa de incluir a taxa de antecipação. Antecipar pelo botão passa a ter a taxa descontada do valor da loja.</li>
        </ul>}
        <p className="ant-note">Muda a configuração da conta inteira no Asaas, para todas as filiais.</p>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="button" className="button primary" onClick={() => void save()} disabled={saving}>
            {saving ? 'Salvando...' : enable ? 'Ligar' : 'Desligar'}</button>
        </div>
      </div>
    </section>
  </div>
}

/** Seção do Financeiro (só administrador): limite, recebíveis do cartão a cair e antecipações pedidas. */
export function AnticipationPanel({ credentials }: { credentials: string }) {
  const [data, setData] = useState<AnticipationOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<CardReceivable | null>(null)
  const [forbidden, setForbidden] = useState(false)
  /** true/false: confirmando ligar/desligar a antecipação automática; null: fechado. */
  const [confirmAuto, setConfirmAuto] = useState<boolean | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    api.anticipations(credentials).then(setData).catch(err => {
      if (err instanceof ApiError && err.status === 403) setForbidden(true)
      else setError(getMessage(err))
    }).finally(() => setLoading(false))
  }, [credentials])
  useEffect(load, [load])

  if (forbidden || (data && !data.available)) return null
  const anticipable = data?.receivables.filter(item => item.anticipable) ?? []
  const totalCents = anticipable.reduce((sum, item) => sum + item.valueCents, 0)
  return <section className="panel ant-panel admin-only" aria-labelledby="ant-panel-title">
    <div className="finance-panel-heading"><div><span className="eyebrow">CARTÃO • ASAAS{data?.sandbox ? ' (TESTE)' : ''}</span>
      <h2 id="ant-panel-title">Recebíveis a antecipar</h2></div>
      <button type="button" className="finance-date-icon" onClick={load} disabled={loading} title="Atualizar" aria-label="Atualizar recebíveis">
        <RefreshCw size={18} /></button></div>
    {error && <div className="form-error" role="alert">{error}</div>}
    {!data && loading && <p className="order-muted" role="status">Consultando o Asaas...</p>}
    {data && <>
      <div className="ant-summary">
        <div><span>A cair no cartão</span><strong>{currency(totalCents)}</strong><small>{anticipable.length} pedido(s) que dá para antecipar</small></div>
        <div><span>Limite disponível</span><strong>{data.limitAvailableCents < 0 ? '—' : currency(data.limitAvailableCents)}</strong>
          <small>{data.limitTotalCents < 0 ? 'O Asaas não informou o limite' : `de ${currency(data.limitTotalCents)} liberados`}</small></div>
      </div>
      <div className="ant-auto">
        <div><strong>Antecipação automática do cartão</strong>
          <small>{data.automatic
            ? 'Ligada: o Asaas antecipa sozinho os pagamentos novos no cartão, enquanto houver limite.'
            : 'Desligada: o cartão cai na data de cada parcela; antecipe pedido por pedido quando precisar.'}</small></div>
        <button type="button" role="switch" aria-checked={data.automatic} className={`ant-switch${data.automatic ? ' on' : ''}`}
          onClick={() => setConfirmAuto(!data.automatic)} aria-label="Antecipação automática do cartão"><span /></button>
      </div>
      {data.receivables.length === 0 ? <p className="order-muted">Nenhum pagamento no cartão esperando crédito.</p>
        : <ul className="ant-list">{data.receivables.map(item => <li key={item.orderId}>
          <button type="button" className="ant-link" onClick={() => go(`/pedidos/${encodeURIComponent(item.orderId)}`)}>
            <strong>{item.customerName ?? 'Pedido'}</strong>
            <small>{[item.chairCode, item.branchName, parcelsText(item), creditText(item)].filter(Boolean).join(' • ')}</small></button>
          <b>{currency(item.valueCents)}</b>
          {item.anticipable && !data.automatic
            ? <button type="button" className="button secondary ant-action" onClick={() => setSelected(item)}><FastForward size={15} /> Antecipar</button>
            : <span className="ant-tag wait">{item.requested ? 'Já pedida' : data.automatic ? 'Automática' : 'Não liberada'}</span>}
        </li>)}</ul>}
      {data.requests.length > 0 && <>
        <h3 className="ant-subtitle">Antecipações pedidas</h3>
        <ul className="ant-list">{data.requests.map(item => <li key={item.id}>
          <button type="button" className="ant-link" onClick={() => go(`/pedidos/${encodeURIComponent(item.orderId)}`)}>
            <strong>{item.customerName ?? 'Pedido'}</strong>
            <small>{dateTimeLabel(item.requestedAt)} • {item.requestedBy ?? 'equipe'}{item.feeCents > 0 ? ` • taxa ${currency(item.feeCents)}` : ''}
              {item.denialObservation ? ` • ${item.denialObservation}` : ''}</small></button>
          <b>{currency(item.netCents || item.valueCents)}</b>
          <AnticipationStatusTag status={item.status} />
        </li>)}</ul></>}
    </>}
    {selected && <AnticipationModal credentials={credentials} receivable={selected} onClose={() => setSelected(null)}
      onDone={() => { setSelected(null); load() }} />}
    {confirmAuto !== null && <AutomaticModal credentials={credentials} enable={confirmAuto} onClose={() => setConfirmAuto(null)}
      onDone={() => { setConfirmAuto(null); load() }} />}
  </section>
}
