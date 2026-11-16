import { useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import '../overview/attention.css'

const notifyKey = 'posleve.desktop-notifications'

/** Ligadas por padrão: só ficam desligadas quando a pessoa desliga no Perfil. */
export function desktopNotificationsWanted() {
  try {
    return localStorage.getItem(notifyKey) !== 'off'
  } catch {
    return true
  }
}

/** true quando a pessoa não desligou as notificações e o navegador permite. */
export function desktopNotificationsOn() {
  return desktopNotificationsWanted() && typeof Notification !== 'undefined' && Notification.permission === 'granted'
}

/**
 * Notificações já ativadas: no primeiro clique da pessoa no painel, pede a permissão do navegador sozinho
 * (o navegador só deixa pedir depois de um clique). Se ela desligou no Perfil, não pede.
 */
export function autoRequestNotifications() {
  if (typeof Notification === 'undefined' || Notification.permission !== 'default' || !desktopNotificationsWanted()) return
  const ask = () => {
    window.removeEventListener('pointerdown', ask)
    if (Notification.permission === 'default') void Notification.requestPermission()
  }
  window.addEventListener('pointerdown', ask, { once: true })
}

const blockedText = 'Ligadas. Falta o navegador permitir: cadeado do site → Notificações → Permitir.'

/** Liga e desliga os avisos urgentes no computador. Fica no Perfil, como no app. */
export function NotificationToggle() {
  // Ligada por padrão (preferência da pessoa); ela desliga ou liga quando quiser.
  const [on, setOn] = useState(desktopNotificationsWanted)
  const [message, setMessage] = useState(() => typeof Notification !== 'undefined' && Notification.permission === 'denied' && desktopNotificationsWanted() ? blockedText : '')

  async function toggle() {
    if (typeof Notification === 'undefined') return setMessage('Este navegador não mostra notificações.')
    if (on) {
      setOn(false)
      setMessage('')
      try { localStorage.setItem(notifyKey, 'off') } catch { /* sem armazenamento local */ }
      return
    }
    try { localStorage.setItem(notifyKey, 'on') } catch { /* sem armazenamento local */ }
    setOn(true)
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
    if (permission !== 'granted') return setMessage(blockedText)
    setMessage('')
    new Notification('Pós Leve • Notificações ativadas', { body: 'Você vai receber aqui os avisos urgentes do painel.', icon: '/logo-pos-leve-icon.webp' })
  }

  return <button type="button" className={`glass-card notify-toggle${on ? ' on' : ''}`} role="switch" aria-checked={on} onClick={() => void toggle()}>
    <span className="notify-icon">{on ? <Bell size={18} /> : <BellOff size={18} />}</span>
    <span className="notify-text"><strong>{on ? 'Notificações ativadas' : 'Ativar notificações'}</strong>
      <small>{message || 'Avisos urgentes no computador.'}</small></span>
    <span className={`notify-switch${on ? ' on' : ''}`}><i /></span>
  </button>
}
