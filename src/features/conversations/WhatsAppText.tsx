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

/** Telefone do Brasil escrito na mensagem: (85) 93577-4756, 85 935774756, +55 85 9..., etc. */
const PHONE = /((?:\+?55[\s.-]?)?\(?\b[1-9]\d\)?[\s.-]?9?[\s.-]?\d{4}[\s.-]?\d{4}\b)/g

/** Número escrito pelo cliente vira link: clicar abre a conversa com ele no WhatsApp. */
function withPhones(text: string, key: string): ReactNode[] {
  return text.split(PHONE).map((part, index) => {
    const k = `${key}-p${index}`
    if (index % 2 === 0) return <Fragment key={k}>{formatted(part, k)}</Fragment>
    let digits = part.replace(/\D/g, '')
    if (digits.length >= 12 && digits.startsWith('55')) digits = digits.slice(2)
    if (digits.length < 10 || digits.length > 11) return <Fragment key={k}>{formatted(part, k)}</Fragment>
    return <a key={k} className="wa-phone" href={`https://wa.me/55${digits}`} target="_blank" rel="noopener noreferrer"
      title="Abrir conversa no WhatsApp" onClick={event => event.stopPropagation()}>{part}</a>
  })
}

/** Texto da mensagem como no WhatsApp: quebras de linha, formatação, links e telefones clicáveis. */
export function WhatsAppText({ text }: { text: string }) {
  return <p className="wa-text">{text.split(LINK).map((part, index) => {
    if (index % 2 === 0) return <Fragment key={index}>{withPhones(part, String(index))}</Fragment>
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
