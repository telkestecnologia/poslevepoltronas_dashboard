import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import './saved-toast.css'

const EVENT = 'posleve:saved'

/** Mostra a confirmação de que algo foi salvo, em destaque no meio da tela (de qualquer área do painel). */
export function announceSaved(message: string) {
  if (!message) return
  window.dispatchEvent(new CustomEvent(EVENT, { detail: message }))
}

/** Confirmação central: aparece por 2,5 segundos (ou até clicar) e some sozinha. */
export function SavedToast() {
  const [message, setMessage] = useState('')
  const [stamp, setStamp] = useState(0)

  useEffect(() => {
    const onSaved = (event: Event) => {
      setMessage((event as CustomEvent<string>).detail)
      setStamp(value => value + 1)
    }
    window.addEventListener(EVENT, onSaved)
    return () => window.removeEventListener(EVENT, onSaved)
  }, [])

  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => setMessage(''), 2500)
    return () => window.clearTimeout(timer)
  }, [message, stamp])

  if (!message) return null
  return <div className="saved-toast-layer" role="status" aria-live="polite" onClick={() => setMessage('')}>
    <div className="saved-toast" key={stamp}>
      <span className="saved-toast-check"><Check size={30} strokeWidth={3} /></span>
      <strong>Salvo!</strong>
      <p>{message}</p>
    </div>
  </div>
}
