import { useEffect, useState, type FormEvent } from 'react'
import { BadgeDollarSign, CreditCard, QrCode, Save } from 'lucide-react'
import { api, type PaymentOptions, type PricingCatalog, type PricingPlan } from '../../api'
import { currency } from '../../data/orders'
import { getMessage } from '../../utils/errors'
import './payments.css'

/** Até 12x sem juros na fatura do Asaas (o mesmo limite do backend). */
const MAX_INSTALLMENTS = 12
const MAX_DAYS = 90

/** "70,00" ⇄ 7000 centavos. Aceita "70", "70,5", "1.200,00". */
function toCents(text: string) {
  const clean = text.replace(/[^\d,]/g, '')
  if (!clean) return NaN
  const [reais, centavos = ''] = clean.split(',')
  return Number(reais || '0') * 100 + Number(centavos.padEnd(2, '0').slice(0, 2))
}
const toText = (cents: number) => (cents / 100).toFixed(2).replace('.', ',')

type PlanForm = Omit<PricingPlan, 'priceCents' | 'days'> & { price: string; days: string }

/** Mesmas regras do backend, para mostrar o motivo exato antes de salvar. */
function pricingError(daily: number, minDays: number, maxDays: number, plans: PlanForm[]) {
  if (!Number.isFinite(daily) || daily < 100 || daily > 1_000_000) return 'A diária deve ficar entre R$ 1,00 e R$ 10.000,00.'
  if (!Number.isInteger(maxDays) || maxDays < 1 || maxDays > MAX_DAYS) return `O período máximo vai de 1 a ${MAX_DAYS} dias.`
  if (!Number.isInteger(minDays) || minDays < 1 || minDays > maxDays) return `O período mínimo vai de 1 dia até o período máximo (${maxDays} dias).`
  for (const plan of plans) {
    const label = plan.name.trim() || plan.id
    const days = Number(plan.days)
    const price = toCents(plan.price)
    if (!plan.name.trim()) return 'Dê um nome a cada plano.'
    if (!Number.isInteger(days) || days < minDays || days > maxDays) return `O plano ${label} precisa ter de ${minDays} (o período mínimo) a ${maxDays} dias (o período máximo).`
    if (!Number.isFinite(price) || price <= 0) return `Informe o preço do plano ${label}.`
    if (price > days * daily) return `O plano ${label} (${days} dias) não pode custar mais que ${days} diárias avulsas (${currency(days * daily)}).`
  }
  if (new Set(plans.map(plan => Number(plan.days))).size !== plans.length) return 'Cada plano precisa ter uma quantidade de dias diferente.'
  return ''
}

export function PaymentsPricingPage({ credentials }: { credentials: string }) {
  const [loadError, setLoadError] = useState('')
  const [options, setOptions] = useState<PaymentOptions | null>(null)
  const [catalog, setCatalog] = useState<PricingCatalog | null>(null)
  const [daily, setDaily] = useState('')
  const [maxDays, setMaxDays] = useState('')
  const [minDays, setMinDays] = useState('')
  const [plans, setPlans] = useState<PlanForm[]>([])
  const [paymentBusy, setPaymentBusy] = useState(false)
  const [pricingBusy, setPricingBusy] = useState(false)
  const [paymentNote, setPaymentNote] = useState<{ tone: 'error' | 'ok'; text: string } | null>(null)
  const [pricingNote, setPricingNote] = useState<{ tone: 'error' | 'ok'; text: string } | null>(null)

  function fillPricing(value: PricingCatalog) {
    setCatalog(value)
    setDaily(toText(value.dailyRateCents))
    setMaxDays(String(value.maxDays))
    setMinDays(String(value.minDays ?? 1))
    setPlans(value.plans.map(plan => ({ ...plan, price: toText(plan.priceCents), days: String(plan.days) })))
  }

  useEffect(() => {
    let active = true
    Promise.all([api.paymentOptions(credentials), api.pricing(credentials)])
      .then(([payment, pricing]) => { if (active) { setOptions(payment); fillPricing(pricing) } })
      .catch(cause => { if (active) setLoadError(getMessage(cause)) })
    return () => { active = false }
  }, [credentials])

  async function savePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!options) return
    if (!options.pix && !options.card) return setPaymentNote({ tone: 'error', text: 'Deixe ao menos uma forma de pagamento ligada.' })
    setPaymentBusy(true)
    setPaymentNote(null)
    try {
      setOptions(await api.savePaymentOptions(credentials, options))
      setPaymentNote({ tone: 'ok', text: 'Formas de pagamento salvas. Valem para os próximos pagamentos no site e no WhatsApp.' })
    } catch (cause) {
      setPaymentNote({ tone: 'error', text: getMessage(cause) })
    } finally {
      setPaymentBusy(false)
    }
  }

  async function savePricing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const dailyCents = toCents(daily)
    const max = Number(maxDays)
    const min = Number(minDays)
    const problem = pricingError(dailyCents, min, max, plans)
    if (problem) return setPricingNote({ tone: 'error', text: problem })
    if (!window.confirm('Salvar os novos valores? Eles passam a valer na hora para novas cotações no site e no WhatsApp. Reservas e pedidos já feitos não mudam.')) return
    setPricingBusy(true)
    setPricingNote(null)
    try {
      fillPricing(await api.savePricing(credentials, {
        dailyRateCents: dailyCents, minDays: min, maxDays: max,
        plans: plans.map(plan => ({ id: plan.id, name: plan.name.trim(), days: Number(plan.days), priceCents: toCents(plan.price), popular: plan.popular })),
      }))
      setPricingNote({ tone: 'ok', text: 'Valores salvos. As próximas cotações já usam a nova tabela.' })
    } catch (cause) {
      setPricingNote({ tone: 'error', text: getMessage(cause) })
    } finally {
      setPricingBusy(false)
    }
  }

  const updatePlan = (id: string, change: Partial<PlanForm>) => {
    setPlans(current => current.map(plan => plan.id === id ? { ...plan, ...change }
      : change.popular ? { ...plan, popular: false } : plan))
    setPricingNote(null)
  }

  const dailyCents = toCents(daily)

  return <>
    <div className="page-heading">
      <div>
        <span className="eyebrow">CONFIGURAÇÕES • PÓS LEVE</span>
        <h1>Pagamentos e preços</h1>
        <p>Escolha como o cliente pode pagar e ajuste a diária e os planos. As mudanças valem para o site e para a Isa no WhatsApp.</p>
      </div>
    </div>

    {loadError && <div className="form-error" role="alert">{loadError}</div>}
    {!loadError && (!options || !catalog) && <p className="pay-muted">Carregando configurações...</p>}

    {options && catalog && <div className="pay-layout">
      <form className="panel pay-section" onSubmit={event => void savePayment(event)}>
        <div className="notification-channel-head">
          <span className="notification-channel-icon"><CreditCard size={21} /></span>
          <div><h2>Formas de pagamento</h2><p>Desligue uma forma para o site e a Isa deixarem de oferecê-la. Pagamentos já gerados continuam valendo.</p></div>
        </div>

        <label className="pay-toggle">
          <input type="checkbox" checked={options.pix} disabled={paymentBusy}
            onChange={event => { setOptions({ ...options, pix: event.target.checked }); setPaymentNote(null) }} />
          <span className="pay-toggle-icon"><QrCode size={18} /></span>
          <span><strong>Pix</strong><small>QR Code e copia e cola, confirmado na hora pelo Asaas.</small></span>
        </label>
        <label className="pay-toggle">
          <input type="checkbox" checked={options.card} disabled={paymentBusy}
            onChange={event => { setOptions({ ...options, card: event.target.checked }); setPaymentNote(null) }} />
          <span className="pay-toggle-icon"><CreditCard size={18} /></span>
          <span><strong>Cartão de crédito</strong><small>Pago na página segura do Asaas; os dados do cartão não passam pela Pós Leve.</small></span>
        </label>

        <label className="pay-field">
          <span>Parcelamento do cartão (sem juros)</span>
          <select value={options.maxInstallments} disabled={paymentBusy || !options.card}
            onChange={event => { setOptions({ ...options, maxInstallments: Number(event.target.value) }); setPaymentNote(null) }}>
            {Array.from({ length: MAX_INSTALLMENTS }, (_, index) => index + 1).map(count =>
              <option key={count} value={count}>{count === 1 ? 'Só à vista (1x)' : `Em até ${count}x`}</option>)}
          </select>
          <small>As taxas do parcelamento no Asaas ficam com a Pós Leve; o cliente paga o mesmo total.</small>
        </label>

        {!options.pix && !options.card && <div className="form-error" role="alert">Deixe ao menos uma forma de pagamento ligada.</div>}
        <div className="pay-footer">
          {paymentNote && <div className={paymentNote.tone === 'error' ? 'form-error' : 'pay-ok'} role={paymentNote.tone === 'error' ? 'alert' : 'status'}>{paymentNote.text}</div>}
          <button className="button primary admin-only" type="submit" disabled={paymentBusy || (!options.pix && !options.card)}>
            <Save size={17} /> {paymentBusy ? 'Salvando...' : 'Salvar formas de pagamento'}
          </button>
        </div>
      </form>

      <form className="panel pay-section" onSubmit={event => void savePricing(event)}>
        <div className="notification-channel-head">
          <span className="notification-channel-icon"><BadgeDollarSign size={21} /></span>
          <div><h2>Diária e planos</h2><p>Do período mínimo até o menor plano vale a diária avulsa. A partir de cada plano, cada dia sai pela diária dele (preço ÷ dias) até o próximo plano; acima do maior plano, vale a diária dele. O frete continua por filial.</p></div>
        </div>

        <div className="pay-grid">
          <label className="pay-field">
            <span>Diária avulsa (R$)</span>
            <input inputMode="decimal" value={daily} disabled={pricingBusy} required
              onChange={event => { setDaily(event.target.value); setPricingNote(null) }}
              onBlur={() => { const cents = toCents(daily); if (Number.isFinite(cents)) setDaily(toText(cents)) }} />
          </label>
          <label className="pay-field">
            <span>Período mínimo (dias)</span>
            <input type="number" min={1} max={Number(maxDays) || MAX_DAYS} value={minDays} disabled={pricingBusy} required
              onChange={event => { setMinDays(event.target.value); setPricingNote(null) }} />
            <small>Menor locação aceita no site e pela Isa. Prorrogações não seguem este limite.</small>
          </label>
          <label className="pay-field">
            <span>Período máximo (dias)</span>
            <input type="number" min={1} max={MAX_DAYS} value={maxDays} disabled={pricingBusy} required
              onChange={event => { setMaxDays(event.target.value); setPricingNote(null) }} />
          </label>
        </div>

        <div className="pay-plans">
          {plans.map(plan => {
            const days = Number(plan.days)
            const price = toCents(plan.price)
            // Próximo plano (por dias): até ele, os dias extras saem pela diária deste plano.
            const next = plans.map(other => Number(other.days)).filter(other => other > days).sort((a, b) => a - b)[0]
            const planDaily = days > 0 && Number.isFinite(price) ? Math.round(price / days) : NaN
            const savings = Number.isFinite(price) && Number.isFinite(dailyCents) && days > 0 ? days * dailyCents - price : NaN
            return <fieldset key={plan.id} className="pay-plan">
              <legend className="sr-only">Plano {plan.name}</legend>
              <label className="pay-field pay-plan-name">
                <span>Nome do plano</span>
                <input value={plan.name} maxLength={60} disabled={pricingBusy} required
                  onChange={event => updatePlan(plan.id, { name: event.target.value })} />
              </label>
              <label className="pay-field">
                <span>Dias</span>
                <input type="number" min={Number(minDays) || 1} max={Number(maxDays) || MAX_DAYS} value={plan.days} disabled={pricingBusy} required
                  onChange={event => updatePlan(plan.id, { days: event.target.value })} />
              </label>
              <label className="pay-field">
                <span>Preço (R$)</span>
                <input inputMode="decimal" value={plan.price} disabled={pricingBusy} required
                  onChange={event => updatePlan(plan.id, { price: event.target.value })}
                  onBlur={() => { if (Number.isFinite(price)) updatePlan(plan.id, { price: toText(price) }) }} />
              </label>
              <label className="pay-popular">
                <input type="radio" name="popular" checked={plan.popular} disabled={pricingBusy}
                  onChange={() => updatePlan(plan.id, { popular: true })} />
                Mais procurado
              </label>
              <p className="pay-muted pay-plan-hint">
                {Number.isFinite(planDaily) && <><strong>Diária de {currency(planDaily)}</strong>{' '}
                  {next ? `de ${days} a ${next - 1} dias` : `a partir de ${days} dias`}{next ? ` (ex.: ${Math.min(days + 5, next - 1)} dias = ${currency(Math.min(days + 5, next - 1) * planDaily)})` : ''}. </>}
                {Number.isFinite(savings) && savings >= 0
                  ? `Economia de ${currency(savings)} sobre ${days} diárias avulsas.`
                  : Number.isFinite(savings) ? `Mais caro que ${days} diárias avulsas: ajuste o preço.` : ''}
              </p>
            </fieldset>
          })}
        </div>

        <div className="pay-footer">
          {pricingNote && <div className={pricingNote.tone === 'error' ? 'form-error' : 'pay-ok'} role={pricingNote.tone === 'error' ? 'alert' : 'status'}>{pricingNote.text}</div>}
          <button className="button primary admin-only" type="submit" disabled={pricingBusy}>
            <Save size={17} /> {pricingBusy ? 'Salvando...' : 'Salvar diária e planos'}
          </button>
        </div>
      </form>
    </div>}
  </>
}
