import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react'
import { api, type Courier, type OrderEvidence } from '../../api'
import { getMessage } from '../../utils/errors'

const when = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

/**
 * Fotos e vídeos de uma etapa numa janela com carrossel (igual ao app). Clicar na foto abre ela em tela cheia; o vídeo
 * toca ali mesmo.
 */
export function MediaCarousel({ credentials, orderId, phase, couriers, customer, onClose }: {
  credentials: string; orderId: string; phase: 'DELIVERY' | 'PICKUP'; couriers: Courier[]; customer: string; onClose: () => void
}) {
  const [items, setItems] = useState<OrderEvidence[] | null>(null)
  const [error, setError] = useState('')
  const [index, setIndex] = useState(0)
  const [full, setFull] = useState<OrderEvidence | null>(null)

  useEffect(() => {
    let active = true
    api.orderEvidence(credentials, orderId)
      .then(result => { if (active) { setItems(result.filter(item => item.phase === phase)); setError('') } })
      .catch(cause => { if (active) { setItems([]); setError(getMessage(cause)) } })
    return () => { active = false }
  }, [credentials, orderId, phase])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { if (full) setFull(null); else onClose() }
      if (!full && items && event.key === 'ArrowRight') setIndex(value => Math.min(items.length - 1, value + 1))
      if (!full && event.key === 'ArrowLeft') setIndex(value => Math.max(0, value - 1))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [full, items, onClose])

  const who = (item: OrderEvidence) => item.uploadedByName || couriers.find(courier => courier.id === item.courierId)?.name || 'Entregador'
  const current = items?.[index]
  const word = phase === 'DELIVERY' ? 'entrega' : 'retirada'

  return createPortal(<div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="modal media-carousel" role="dialog" aria-modal="true" aria-label={`Fotos e vídeos da ${word}`}>
      <div className="modal-head"><div><span className="eyebrow">PEDIDO • {customer}</span><h2>Fotos e vídeos da {word}</h2></div>
        <button className="icon-button" aria-label="Fechar" onClick={onClose}><X size={20} /></button></div>
      <div className="media-carousel-body">
        {error && <p className="form-error" role="alert">{error}</p>}
        {!items ? <div className="media-carousel-stage loading" role="status"><span>Carregando...</span></div>
          : items.length === 0 ? <p className="order-muted">Nenhuma foto ou vídeo da {word} enviado.</p>
          : current && <>
            <div className="media-carousel-stage">
              <button type="button" className="media-carousel-arrow left" aria-label="Anterior" disabled={index === 0}
                onClick={() => setIndex(index - 1)}><ChevronLeft size={22} /></button>
              {current.kind === 'PHOTO'
                ? <button type="button" className="media-carousel-photo" onClick={() => setFull(current)} aria-label="Abrir foto em tela cheia">
                  <img src={current.readUrl} alt={`Foto da ${word}`} /><span className="media-carousel-expand"><Maximize2 size={15} /></span></button>
                : <video key={current.id} className="media-carousel-video" src={current.readUrl} controls preload="metadata" />}
              <button type="button" className="media-carousel-arrow right" aria-label="Próxima" disabled={index === items.length - 1}
                onClick={() => setIndex(index + 1)}><ChevronRight size={22} /></button>
            </div>
            {items.length > 1 && <div className="media-carousel-dots">{items.map((item, position) =>
              <button key={item.id} type="button" aria-label={`Ir para ${position + 1}`} className={position === index ? 'on' : ''}
                onClick={() => setIndex(position)} />)}</div>}
            <p className="media-carousel-caption">{index + 1} de {items.length} • {who(current)} • {when.format(new Date(current.capturedAt))}</p>
          </>}
      </div>
    </section>
    {/* Só ao clicar na foto ela abre em tela cheia. */}
    {full && <div className="media-fullscreen" onMouseDown={() => setFull(null)} role="dialog" aria-label="Foto em tela cheia">
      <img src={full.readUrl} alt={`Foto da ${word}`} />
      <button type="button" className="media-fullscreen-close" aria-label="Fechar foto" onClick={() => setFull(null)}><X size={22} /></button>
    </div>}
  </div>, document.body)
}
