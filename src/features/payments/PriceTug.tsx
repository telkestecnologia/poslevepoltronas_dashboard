import { useRef, useState } from 'react'
import { currency } from '../../data/orders'
import puller from '../../assets/cabo-puxando.png'
import pusher from '../../assets/cabo-empurrando.png'

type Plan = { id: string; name: string; days: number; priceCents: number }

const STEP = 1000 // R$ 10,00 por passo

/**
 * Cabo de guerra dos preços (igual ao app): a Isadora puxa a corda presa ao controle do primeiro plano e a Renata
 * empurra o cartão. Arrastar o controle muda o preço; quanto mais alto, mais força elas fazem, e notas de R$ 100 voam. O preço vai para o
 * campo do plano (salva no botão de salvar). O teto é o total em diárias avulsas, como o servidor exige.
 */
export function PriceTug({ plans, dailyCents, locked, onChange }: {
  plans: Plan[]; dailyCents: number; locked: boolean; onChange: (id: string, priceCents: number) => void
}) {
  const ranges = [...plans].filter(plan => plan.days > 0).sort((a, b) => a.days - b.days).map(plan => {
    const max = Math.max(STEP, plan.days * dailyCents)
    const min = Math.max(STEP, Math.round((max * 0.4) / STEP) * STEP)
    return { plan, min, max, tension: Math.max(0, Math.min(1, (plan.priceCents - min) / Math.max(1, max - min))) }
  })
  const [notes, setNotes] = useState<{ id: number; x: number; drift: number; spin: number }[]>([])
  const counter = useRef(0)

  function burst(x: number) {
    counter.current += 1
    if (counter.current % 2 !== 0) return
    const id = counter.current
    const note = { id, x, drift: ((id * 37) % 120) - 60, spin: ((id * 53) % 720) - 360 }
    setNotes(current => [...current.slice(-10), note])
  }

  const first = ranges[0]
  const last = ranges.length > 1 ? ranges[ranges.length - 1] : undefined
  return <div className="tug">
    <div className="tug-head"><strong>Cabo de guerra dos preços 💪</strong>
      <span>Arraste o controle de cada plano: quanto mais alto o preço, mais força elas fazem.</span></div>
    <div className="tug-sliders">
    {/* Isadora puxa a corda do primeiro plano; Renata empurra o cartão. */}
    {first && <img className="tug-puller" src={puller} alt="Isadora puxando a corda"
      style={{ transform: `translateX(${first.tension * 6}px) rotate(${first.tension * 9}deg)` }} />}
    {last && <img className="tug-pusher" src={pusher} alt="Renata empurrando"
      style={{ transform: `translateX(${last.tension * 4}px) rotate(${last.tension * 8}deg)` }} />}
      {notes.map(note => <span key={note.id} className="tug-note" aria-hidden="true"
        style={{ left: `${note.x * 100}%`, ['--drift' as string]: `${note.drift}px`, ['--spin' as string]: `${note.spin}deg` }}
        onAnimationEnd={() => setNotes(current => current.filter(item => item.id !== note.id))}>💵</span>)}
    {ranges.map(({ plan, min, max }, index) => {
      // O plano do meio em laranja (igual ao app).
      const tone = index === 0 ? 'teal' : index === ranges.length - 1 ? 'deep' : 'coral'
      const perDay = plan.days > 0 ? Math.round(plan.priceCents / plan.days) : 0
      const ratio = Math.max(0, Math.min(1, (plan.priceCents - min) / Math.max(1, max - min)))
      return <label key={plan.id} className={`tug-slider tone-${tone}`}>
        <span className="tug-slider-head"><span>{plan.name} • {plan.days} dias</span><strong>{currency(plan.priceCents)}</strong></span>
        <input type="range" min={min} max={max} step={STEP} value={Math.min(max, Math.max(min, plan.priceCents))} disabled={locked}
          style={{ ['--fill' as string]: `${ratio * 100}%` }} aria-label={`Preço do plano ${plan.name}`}
          onChange={event => { onChange(plan.id, Number(event.target.value)); burst(index === 0 ? 0.7 : 0.35) }} />
        {index === 0 && <span className="tug-rope" aria-hidden="true" style={{ left: `calc(${ratio * 100}% )` }} />}
        <span className="tug-slider-foot"><small>{currency(min)}</small><small>{currency(perDay)} por dia</small><small>{currency(max)}</small></span>
      </label>
    })}
    </div>
  </div>
}
