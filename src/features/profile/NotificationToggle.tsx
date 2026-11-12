import { useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import '../overview/attention.css'

const notifyKey = 'posleve.desktop-notifications'

/** true quando a pessoa ligou as notificações e o navegador permite. */
export function desktopNotificationsOn() {
  try {
    return localStorage.getItem(notifyKey) === 'on' && typeof Notification !== 'undefined' && Notification.permission === 'granted'
  } catch {
    return false
  }
}

/** Liga e desliga os avisos urgentes no computador. Fica no Perfil, como no app. */
export function NotificationToggle() {
  const [on, setOn] = useState(desktopNotificationsOn)
  const [message, setMessage] = useState('')

  async function toggle() {
    if (typeof Notification === 'undefined') return setMessage('Este navegador não mostra notificações.')
    if (on) {
      setOn(false)
      try { localStorage.setItem(notifyKey, 'off') } catch { /* sem armazenamento local */ }
      return
    }
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
    if (permission !== 'granted') return setMessage('O navegador bloqueou as notificações. Libere nas configurações do site.')
    try { localStorage.setItem(notifyKey, 'on') } catch { /* sem armazenamento local */ }
    setMessage('')
    setOn(true)
    new Notification('Pós Leve • Notificações ativadas', { body: 'Você vai receber aqui os avisos urgentes do painel.', icon: '/logo-pos-leve-icon.webp' })
  }

  return <button type="button" className={`glass-card notify-toggle${on ? ' on' : ''}`} role="switch" aria-checked={on} onClick={() => void toggle()}>
    <span className="notify-icon">{on ? <Bell size={18} /> : <BellOff size={18} />}</span>
    <span className="notify-text"><strong>{on ? 'Notificações ativadas' : 'Ativar notificações'}</strong>
      <small>{message || 'Avisos urgentes no computador.'}</small></span>
    <span className={`notify-switch${on ? ' on' : ''}`}><i /></span>
  </button>
}
