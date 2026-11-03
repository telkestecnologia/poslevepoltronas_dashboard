import { Fragment, type ReactNode } from 'react'

const LINK = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi
const FORMAT = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|```[^`]+```)/g

/** Formatação do WhatsApp: *negrito*, _itálico_, ~riscado~ e ```monoespaçado```. */
function formatted(text: string, key: string): ReactNode[] {
  return text.split(FORMAT).filter(Boolean).map((part, index) => {
    const k = `${key}-${index}`
    if (part.startsWith('```') && part.endsWith('```') && part.length > 6) return <code key={k}>{part.slice(3, -3)}</code>
    if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) return <strong key={k}>{part.slice(1, -1)}</strong>
    if (part.length > 2 && part.startsWith('_') && part.endsWith('_')) return <em key={k}>{part.slice(1, -1)}</em>
    if (part.length > 2 && part.startsWith('~') && part.endsWith('~')) return <s key={k}>{part.slice(1, -1)}</s>
    return <Fragment key={k}>{part}</Fragment>
  })
}

/** Texto da mensagem como no WhatsApp: quebras de linha, formatação e links clicáveis. */
export function WhatsAppText({ text }: { text: string }) {
  return <p className="wa-text">{text.split(LINK).map((part, index) => {
    if (index % 2 === 0) return <Fragment key={index}>{formatted(part, String(index))}</Fragment>
    const clean = part.replace(/[),.;!?]+$/, '')
    const rest = part.slice(clean.length)
    return <Fragment key={index}><a href={clean.startsWith('http') ? clean : `https://${clean}`} target="_blank" rel="noopener noreferrer">{clean}</a>{rest}</Fragment>
  })}</p>
}

/** Fotos enviadas na conversa (ex.: a poltrona junto dos planos e valores). */
export function MessageImages({ images }: { images?: { url: string; caption?: string | null }[] | null }) {
  if (!images?.length) return null
  return <>{images.map(image => <a key={image.url} className="wa-photo" href={image.url} target="_blank" rel="noopener noreferrer">
    <img src={image.url} alt={image.caption || 'Foto enviada na conversa'} loading="lazy" />
    {image.caption && <span>{image.caption}</span>}
  </a>)}</>
}
