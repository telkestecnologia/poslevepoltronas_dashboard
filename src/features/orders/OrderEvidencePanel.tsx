import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Image as ImageIcon, Play, RefreshCw, X } from 'lucide-react'
import { api, type Courier, type OrderEvidence, type OrderStatus } from '../../api'
import { getMessage } from '../../utils/errors'

type Props = { credentials: string; orderId: string; status: OrderStatus; couriers: Courier[] }

const phases = [
  { value: 'DELIVERY', label: 'Na entrega', empty: 'Nenhuma foto ou vídeo da entrega enviado.' },
  { value: 'PICKUP', label: 'Na devolução', empty: 'Nenhuma foto ou vídeo da devolução enviado.' },
] as const

function timeLabel(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function sizeLabel(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function mediaLabel(item: OrderEvidence) {
  return `${item.kind === 'PHOTO' ? 'Foto' : 'Vídeo'} da ${item.phase === 'DELIVERY' ? 'entrega' : 'devolução'}`
}

export function OrderEvidencePanel({ credentials, orderId, status, couriers }: Props) {
  const [items, setItems] = useState<OrderEvidence[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)
  const [viewerId, setViewerId] = useState<string | null>(null)
  const [viewerItem, setViewerItem] = useState<OrderEvidence | null>(null)
  const [viewerError, setViewerError] = useState('')
  const [viewerLoading, setViewerLoading] = useState(false)
  const [viewerVersion, setViewerVersion] = useState(0)
  const previousFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    api.orderEvidence(credentials, orderId).then(result => {
      if (active) { setItems(result); setError('') }
    }).catch(cause => {
      if (active) { setItems([]); setError(getMessage(cause)) }
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [credentials, orderId, status, version])

  useEffect(() => {
    if (!viewerId) return
    let active = true
    setViewerItem(null)
    setViewerError('')
    setViewerLoading(true)
    // A leitura do R2 é assinada por cinco minutos; obtenha uma URL nova antes de abrir.
    api.orderEvidence(credentials, orderId).then(result => {
      if (!active) return
      const item = result.find(entry => entry.id === viewerId)
      if (item) setViewerItem(item)
      else setViewerError('Este arquivo não está mais disponível no pedido.')
    }).catch(cause => {
      if (active) setViewerError(getMessage(cause))
    }).finally(() => { if (active) setViewerLoading(false) })
    return () => { active = false }
  }, [credentials, orderId, viewerId, viewerVersion])

  useEffect(() => {
    if (!viewerId) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        closeViewer()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [viewerId])

  function openViewer(id: string) {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setViewerId(id)
  }

  function closeViewer() {
    setViewerId(null)
    setViewerItem(null)
    previousFocus.current?.focus()
  }

  function courierName(id: string) {
    return couriers.find(courier => courier.id === id)?.name || id
  }

  return <section className="order-section order-evidence" aria-labelledby="order-evidence-title">
    <div className="order-evidence-heading">
      <div>
        <h3 id="order-evidence-title">Fotos e vídeos da entrega e da devolução</h3>
        <p className="order-muted">Registros enviados pelo entregador para documentar a condição da poltrona.</p>
      </div>
      <button className="button secondary" type="button" disabled={loading}
        onClick={() => setVersion(current => current + 1)}>
        <RefreshCw size={15} /> {loading ? 'Carregando...' : 'Atualizar registros'}
      </button>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading && items.length === 0 && <p className="order-muted" role="status">Carregando registros...</p>}
    {!loading && !error && phases.map(phase => {
      const phaseItems = items.filter(item => item.phase === phase.value)
      return <div className="order-evidence-phase" key={phase.value}>
        <h4>{phase.label} <span>{phaseItems.length}</span></h4>
        {phaseItems.length === 0
          ? <p className="order-muted">{phase.empty}</p>
          : <div className="order-evidence-grid">{phaseItems.map(item =>
            <button className="order-evidence-card" type="button" key={item.id}
              aria-label={`Abrir ${mediaLabel(item).toLowerCase()} de ${timeLabel(item.capturedAt)}`}
              onClick={() => openViewer(item.id)}>
              <span className="order-evidence-thumb">
                {item.kind === 'PHOTO'
                  ? <img src={item.readUrl} alt="" loading="lazy" />
                  : <span className="order-evidence-video"><Play size={28} fill="currentColor" /> Vídeo</span>}
              </span>
              <span className="order-evidence-card-info">
                <strong>{item.kind === 'PHOTO' ? <ImageIcon size={15} /> : <Play size={15} />}
                  {item.kind === 'PHOTO' ? 'Foto' : 'Vídeo'}</strong>
                <small>Registrado em {timeLabel(item.capturedAt)}</small>
                <small>Por {courierName(item.courierId)}</small>
              </span>
            </button>)}</div>}
      </div>
    })}
    {viewerId && createPortal(<div className="order-evidence-backdrop"
      onMouseDown={event => { if (event.target === event.currentTarget) closeViewer() }}>
      <section className="order-evidence-viewer" role="dialog" aria-modal="true" aria-labelledby="order-evidence-viewer-title">
        <div className="order-evidence-viewer-head">
          <h3 id="order-evidence-viewer-title">{viewerItem ? mediaLabel(viewerItem) : 'Abrindo arquivo'}</h3>
          <button className="icon-button" type="button" aria-label="Fechar arquivo" onClick={closeViewer} autoFocus>
            <X size={20} />
          </button>
        </div>
        {viewerLoading && <p className="order-muted" role="status">Carregando arquivo...</p>}
        {viewerError && <div className="order-evidence-viewer-error">
          <p className="form-error" role="alert">{viewerError}</p>
          <button className="button secondary" type="button" onClick={() => setViewerVersion(current => current + 1)}>
            <RefreshCw size={15} /> Tentar novamente
          </button>
        </div>}
        {viewerItem && !viewerLoading && !viewerError && <>
          {viewerItem.kind === 'PHOTO'
            ? <img className="order-evidence-full-media" src={viewerItem.readUrl} alt={mediaLabel(viewerItem)}
                onError={() => setViewerError('Não foi possível carregar a foto. Tente novamente.')} />
            : <video className="order-evidence-full-media" src={viewerItem.readUrl} controls playsInline preload="metadata"
                onError={() => setViewerError('Não foi possível carregar o vídeo. Tente novamente.')} />}
          <div className="order-evidence-metadata">
            <span><small>Registrado em</small><strong>{timeLabel(viewerItem.capturedAt)}</strong></span>
            <span><small>Enviado em</small><strong>{timeLabel(viewerItem.uploadedAt)}</strong></span>
            <span><small>Entregador</small><strong>{courierName(viewerItem.courierId)}</strong></span>
            <span><small>Arquivo</small><strong>{sizeLabel(viewerItem.sizeBytes)}</strong></span>
            <span><small>Celular</small><strong>{[viewerItem.deviceManufacturer, viewerItem.deviceModel]
              .filter(Boolean).join(' ') || 'Modelo não informado'} · {viewerItem.platform === 'ios' ? 'iOS' : 'Android'} {viewerItem.osVersion || ''}</strong></span>
            <span><small>ID da instalação</small><strong>{viewerItem.installationId}</strong></span>
          </div>
          <a className="button secondary order-evidence-open" href={viewerItem.readUrl} target="_blank" rel="noopener noreferrer">
            Abrir arquivo em outra aba
          </a>
        </>}
      </section>
    </div>, document.body)}
  </section>
}
