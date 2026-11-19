import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Camera, Image as ImageIcon, Play, RefreshCw, Upload, Video, X } from 'lucide-react'
import { api, uploadOrderEvidenceFile, type Courier, type OrderEvidence, type OrderStatus } from '../../api'
import { getMessage } from '../../utils/errors'
import './evidence-upload.css'

/** phase: só as fotos e vídeos de uma etapa (entrega em "Aguardando entrega", retirada em "Aguardando retirada"). */
type Props = { credentials: string; orderId: string; status: OrderStatus; couriers: Courier[]; phase?: 'DELIVERY' | 'PICKUP'
  /** Avisa quantas fotos e vídeos a etapa tem (para liberar o Avançar). */
  onCount?: (count: number) => void }

/** Foto em qualquer formato (PNG, HEIC aberto pelo navegador...) vira JPEG, o único aceito pelo armazenamento. */
export async function toJpeg(file: File): Promise<Blob> {
  if (file.type === 'image/jpeg') return file
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Não foi possível ler a foto.')), 'image/jpeg', 0.9))
}

const phases = [
  { value: 'DELIVERY', label: 'Na entrega', empty: 'Nenhuma foto ou vídeo da entrega enviado.' },
  { value: 'PICKUP', label: 'Na retirada', empty: 'Nenhuma foto ou vídeo da retirada enviado.' },
] as const

function timeLabel(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function sizeLabel(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function mediaLabel(item: OrderEvidence) {
  return `${item.kind === 'PHOTO' ? 'Foto' : 'Vídeo'} da ${item.phase === 'DELIVERY' ? 'entrega' : 'retirada'}`
}

export function OrderEvidencePanel({ credentials, orderId, status, couriers, phase: only, onCount }: Props) {
  const [uploading, setUploading] = useState('')
  const [uploadError, setUploadError] = useState('')
  const photoInput = useRef<HTMLInputElement>(null)
  const videoInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  async function upload(files: FileList | null) {
    if (!files?.length || !only) return
    setUploadError('')
    try {
      for (const [index, file] of [...files].entries()) {
        setUploading(`Enviando ${index + 1} de ${files.length}...`)
        if (file.type.startsWith('image/')) {
          await uploadOrderEvidenceFile(credentials, orderId, only, await toJpeg(file), file.name.replace(/\.[^.]+$/, '') + '.jpg')
        } else if (file.type === 'video/mp4' || file.type === 'video/quicktime') {
          await uploadOrderEvidenceFile(credentials, orderId, only, file, file.name)
        } else {
          throw new Error(`“${file.name}” não é foto nem vídeo MP4/MOV.`)
        }
      }
    } catch (cause) {
      setUploadError(getMessage(cause))
    } finally {
      setUploading('')
      setVersion(current => current + 1)
    }
  }
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

  // Quantas fotos e vídeos a etapa tem: o pedido só avança com pelo menos um.
  useEffect(() => {
    if (loading) return
    onCount?.(items.filter(item => !only || item.phase === only).length)
  }, [items, loading, only, onCount])

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

  return <section className="order-section order-evidence" aria-labelledby={`order-evidence-title${only ?? ''}`}>
    <div className="order-evidence-heading">
      <div>
        <h3 id={`order-evidence-title${only ?? ''}`}>{only ? `Fotos e vídeos da ${only === 'DELIVERY' ? 'entrega' : 'retirada'}` : 'Fotos e vídeos da entrega e da retirada'}</h3>
        <p className="order-muted">{only ? 'Registre a condição da poltrona: tire fotos, grave um vídeo ou insira arquivos. Sem pelo menos um registro, a etapa não avança.'
          : 'Registros enviados para documentar a condição da poltrona.'}</p>
      </div>
      <button className="button secondary" type="button" disabled={loading}
        onClick={() => setVersion(current => current + 1)}>
        <RefreshCw size={15} /> {loading ? 'Carregando...' : 'Atualizar registros'}
      </button>
    </div>
    {only && <div className="evidence-upload-actions">
      <input ref={photoInput} type="file" accept="image/*" capture="environment" hidden onChange={event => { void upload(event.target.files); event.target.value = '' }} />
      <input ref={videoInput} type="file" accept="video/mp4,video/quicktime,video/*" capture="environment" hidden onChange={event => { void upload(event.target.files); event.target.value = '' }} />
      <input ref={fileInput} type="file" accept="image/*,video/mp4,video/quicktime" multiple hidden onChange={event => { void upload(event.target.files); event.target.value = '' }} />
      <button type="button" className="evidence-upload-button photo" disabled={!!uploading} onClick={() => photoInput.current?.click()}>
        <Camera size={20} /><span><strong>Tirar foto</strong><small>Abre a câmera</small></span></button>
      <button type="button" className="evidence-upload-button video" disabled={!!uploading} onClick={() => videoInput.current?.click()}>
        <Video size={20} /><span><strong>Gravar vídeo</strong><small>Abre a câmera</small></span></button>
      <button type="button" className="evidence-upload-button files" disabled={!!uploading} onClick={() => fileInput.current?.click()}>
        <Upload size={20} /><span><strong>Inserir fotos e vídeos</strong><small>Do computador ou do celular</small></span></button>
    </div>}
    {uploading && <p className="evidence-upload-status" role="status">{uploading}</p>}
    {uploadError && <p className="form-error" role="alert">{uploadError}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading && items.length === 0 && <p className="order-muted" role="status">Carregando registros...</p>}
    {!loading && !error && phases.filter(phase => !only || phase.value === only).map(phase => {
      const phaseItems = items.filter(item => item.phase === phase.value)
      return <div className="order-evidence-phase" key={phase.value}>
        {only ? null : <h4>{phase.label} <span>{phaseItems.length}</span></h4>}
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
          </div>
        </>}
      </section>
    </div>, document.body)}
  </section>
}
