import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Image as ImageIcon, Play, RefreshCw, Trash2, Upload, X } from 'lucide-react'
import { api, uploadEvidenceFile, type Courier, type OrderEvidence, type OrderStatus } from '../../api'
import { getMessage } from '../../utils/errors'
import './evidence-upload.css'

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

const PHOTO_LIMIT = 5 * 1024 * 1024
const VIDEO_LIMIT = 30 * 1024 * 1024

/** Etapas em que a equipe pode registrar mídia (mesma regra do backend e do app). */
function phasesFor(status: OrderStatus): ('DELIVERY' | 'PICKUP')[] {
  const list: ('DELIVERY' | 'PICKUP')[] = []
  if (status === 'DELIVERY_PENDING' || status === 'IN_USE') list.push('DELIVERY')
  if (status === 'IN_USE' || status === 'PICKUP_PENDING' || status === 'COMPLETED') list.push('PICKUP')
  return list
}

/** Fotos viram JPEG (o formato aceito) e são reduzidas até caber no limite de 5 MB. */
async function toJpeg(file: File): Promise<Blob> {
  if (file.type === 'image/jpeg' && file.size <= PHOTO_LIMIT) return file
  const bitmap = await createImageBitmap(file)
  let scale = Math.min(1, 2560 / Math.max(bitmap.width, bitmap.height))
  for (let attempt = 0; attempt < 5; attempt++) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82))
    if (blob && blob.size <= PHOTO_LIMIT) return blob
    scale *= 0.75
  }
  throw new Error('Não foi possível reduzir a foto para 5 MB.')
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
  const fileInput = useRef<HTMLInputElement>(null)
  const allowedPhases = phasesFor(status)
  const [uploadPhase, setUploadPhase] = useState<'DELIVERY' | 'PICKUP'>(allowedPhases.includes('PICKUP') && status !== 'IN_USE' ? 'PICKUP' : 'DELIVERY')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

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
    return items.find(item => item.courierId === id)?.uploadedByName || couriers.find(courier => courier.id === id)?.name || id
  }

  async function upload(file: File) {
    setUploadError('')
    const video = file.type.startsWith('video/')
    if (video && !['video/mp4', 'video/quicktime'].includes(file.type)) return setUploadError('Envie vídeos em MP4 ou MOV.')
    if (video && file.size > VIDEO_LIMIT) return setUploadError('O vídeo passa de 30 MB. Envie um vídeo mais curto.')
    if (!video && !file.type.startsWith('image/')) return setUploadError('Escolha uma foto ou um vídeo.')
    setUploading(true)
    try {
      const blob = video ? file : await toJpeg(file)
      const name = video ? file.name : file.name.replace(/\.[^.]+$/, '') + '.jpg'
      await uploadEvidenceFile(credentials, orderId, uploadPhase, blob, name)
      setVersion(current => current + 1)
    } catch (cause) {
      setUploadError(getMessage(cause))
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function remove(item: OrderEvidence) {
    if (!window.confirm(`Excluir ${mediaLabel(item).toLowerCase()} de ${timeLabel(item.capturedAt)}?`)) return
    try {
      await api.deleteEvidence(credentials, orderId, item.id)
      closeViewer()
      setVersion(current => current + 1)
    } catch (cause) {
      setViewerError(getMessage(cause))
    }
  }

  return <section className="order-section order-evidence" aria-labelledby="order-evidence-title">
    <div className="order-evidence-heading">
      <div>
        <h3 id="order-evidence-title">Fotos e vídeos da entrega e da devolução</h3>
        <p className="order-muted">Registros do entregador e da equipe para documentar a condição da poltrona.</p>
      </div>
      <button className="button secondary" type="button" disabled={loading}
        onClick={() => setVersion(current => current + 1)}>
        <RefreshCw size={15} /> {loading ? 'Carregando...' : 'Atualizar registros'}
      </button>
    </div>
    {allowedPhases.length > 0 && <div className="evidence-upload">
      {allowedPhases.length > 1 && <select value={uploadPhase} aria-label="Etapa do registro"
        onChange={event => setUploadPhase(event.target.value as 'DELIVERY' | 'PICKUP')}>
        <option value="DELIVERY">Entrega</option><option value="PICKUP">Retirada</option></select>}
      <button className="button primary" type="button" disabled={uploading} onClick={() => fileInput.current?.click()}>
        <Upload size={15} /> {uploading ? 'Enviando...' : `Enviar foto ou vídeo da ${uploadPhase === 'DELIVERY' ? 'entrega' : 'retirada'}`}</button>
      <input ref={fileInput} type="file" accept="image/*,video/mp4,video/quicktime" hidden
        onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file) }} />
      <small className="order-muted">Fotos até 5 MB (JPG; outros formatos são convertidos) e vídeos MP4/MOV até 30 MB.</small>
    </div>}
    {uploadError && <p className="form-error" role="alert">{uploadError}</p>}
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
            <span><small>{viewerItem.uploadedByStaff ? 'Enviado por' : 'Entregador'}</small><strong>{courierName(viewerItem.courierId)}</strong></span>
            <span><small>Arquivo</small><strong>{sizeLabel(viewerItem.sizeBytes)}</strong></span>
            <span><small>Celular</small><strong>{[viewerItem.deviceManufacturer, viewerItem.deviceModel]
              .filter(Boolean).join(' ') || 'Modelo não informado'} · {viewerItem.platform === 'ios' ? 'iOS' : 'Android'} {viewerItem.osVersion || ''}</strong></span>
            <span><small>ID da instalação</small><strong>{viewerItem.installationId}</strong></span>
          </div>
          <div className="evidence-viewer-actions">
            <a className="button secondary order-evidence-open" href={viewerItem.readUrl} target="_blank" rel="noopener noreferrer">
              Abrir ou baixar em outra aba
            </a>
            {viewerItem.uploadedByStaff && <button className="button evidence-delete" type="button" onClick={() => void remove(viewerItem)}>
              <Trash2 size={15} /> Excluir</button>}
          </div>
        </>}
      </section>
    </div>, document.body)}
  </section>
}
