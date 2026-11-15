import { currency } from '../../data/orders'

type RulerPlan = { id: string; name: string; days: number; priceCents: number }

/** Cor de cada plano pela posição (do menor para o maior): o do meio em laranja (igual ao app). */
export function planTone(position: number, total: number) {
  return position === 0 ? 'teal' : position === total - 1 ? 'deep' : 'coral'
}

/**
 * Régua do preço (igual ao app): do período mínimo ao máximo, de quantos a quantos dias vale a diária avulsa e cada
 * plano, com o valor de cada dia. As faixas crescem animadas, uma depois da outra.
 */
export function PriceRuler({ plans, dailyCents, minDays, maxDays }: { plans: RulerPlan[]; dailyCents: number; minDays: number; maxDays: number }) {
  const sorted = [...plans].filter(plan => plan.days > 0 && Number.isFinite(plan.priceCents)).sort((a, b) => a.days - b.days)
  if (!Number.isFinite(dailyCents) || !(maxDays > 0) || !(minDays > 0) || minDays > maxDays) return null
  const total = maxDays - minDays + 1
  const segments: { key: string; label: string; from: number; to: number; perDay: number; tone: string }[] = []
  const firstPlan = sorted[0]?.days ?? maxDays + 1
  if (firstPlan > minDays) segments.push({ key: 'avulsa', label: 'Diária avulsa', from: minDays, to: Math.min(maxDays, firstPlan - 1), perDay: dailyCents, tone: 'gray' })
  sorted.forEach((plan, index) => {
    const from = Math.max(minDays, plan.days)
    const to = Math.min(maxDays, (sorted[index + 1]?.days ?? maxDays + 1) - 1)
    if (from <= to) segments.push({ key: plan.id, label: plan.name, from, to, perDay: Math.round(plan.priceCents / plan.days), tone: planTone(index, sorted.length) })
  })
  return <div className="pay-ruler">
    <strong>📈 Quanto custa cada dia</strong>
    <p>Do período mínimo ao máximo: até o primeiro plano vale a diária avulsa; a partir de cada plano, a diária dele.</p>
    <div className="pay-ruler-bar">{segments.map((segment, index) =>
      <span key={segment.key} className={`tone-${segment.tone}`} style={{ flex: (segment.to - segment.from + 1) / total, animationDelay: `${index * 180}ms` }} />)}</div>
    <div className="pay-ruler-marks"><small>{minDays} {minDays === 1 ? 'dia' : 'dias'}</small><small>{maxDays} dias</small></div>
    <ul>{segments.map(segment => <li key={segment.key}><i className={`tone-${segment.tone}`} /><span>{segment.label}</span>
      <small>{segment.from === segment.to ? `${segment.from} dias` : `${segment.from} a ${segment.to} dias`}</small>
      <b>{currency(segment.perDay)}/dia</b></li>)}</ul>
  </div>
}
