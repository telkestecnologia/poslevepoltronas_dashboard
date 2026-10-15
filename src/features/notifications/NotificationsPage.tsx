import { useState, type FormEvent } from 'react'
import { BellRing, Mail, MessageCircle, Plus, Save, Trash2 } from 'lucide-react'
import type { AiNotificationSettings } from '../../api'
import { getMessage } from '../../utils/errors'
import { formatPhone } from '../../utils/phone'

type Props = {
  settings: AiNotificationSettings
  onSave: (settings: AiNotificationSettings) => Promise<void>
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '')
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits
}

function formatWhatsApp(value: string) {
  const digits = value.replace(/\D/g, '')
  return formatPhone(digits.length > 11 && digits.startsWith('55') ? digits.slice(2) : digits)
}

export function NotificationsPage({ settings, onSave }: Props) {
  const [emails, setEmails] = useState(settings.emails)
  const [phones, setPhones] = useState(settings.whatsAppNumbers.map(formatWhatsApp))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function update(values: string[], index: number, value: string, setter: (values: string[]) => void) {
    setter(values.map((item, position) => position === index ? value : item))
    setError('')
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedEmails = emails.map(email => email.trim().toLowerCase())
    const normalizedPhones = phones.map(normalizePhone)
    if (new Set(normalizedEmails).size !== normalizedEmails.length ||
        new Set(normalizedPhones).size !== normalizedPhones.length) {
      setError('Remova contatos repetidos antes de salvar.')
      return
    }
    if (normalizedPhones.some(phone => !/^55[1-9][0-9](?:[0-9]{8}|9[0-9]{8})$/.test(phone))) {
      setError('Informe um número brasileiro com DDD e 8 ou 9 dígitos para cada WhatsApp.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onSave({ emails: normalizedEmails, whatsAppNumbers: normalizedPhones })
      setEmails(normalizedEmails)
      setPhones(normalizedPhones.map(formatWhatsApp))
    } catch (cause) {
      setError(getMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  return <>
    <div className="page-heading">
      <div>
        <span className="eyebrow">ATENDIMENTO • PÓS LEVE</span>
        <h1>Alertas da IA</h1>
        <p>Cadastre os contatos para futuros avisos sobre perguntas que a IA não souber responder.</p>
      </div>
    </div>

    <div className="notification-intro panel">
      <BellRing size={22} />
      <div>
        <strong>Cadastro de contatos</strong>
        <p>O envio de e-mails e mensagens de WhatsApp ainda não está ativado. As perguntas continuam disponíveis em Contexto da IA para você responder.</p>
      </div>
    </div>

    <form onSubmit={event => void save(event)} className="notification-form">
      <section className="panel notification-channel">
        <div className="notification-channel-head">
          <span className="notification-channel-icon"><Mail size={21} /></span>
          <div><h2>E-mail</h2><p>Endereços da equipe para futuros avisos.</p></div>
        </div>
        <div className="notification-contacts">
          {emails.map((email, index) => <div className="notification-contact" key={index}>
            <label className="sr-only" htmlFor={`notification-email-${index}`}>E-mail {index + 1}</label>
            <input id={`notification-email-${index}`} type="email" required maxLength={254}
              autoComplete="email" autoCapitalize="none" spellCheck={false}
              placeholder="nome@empresa.com.br" value={email} disabled={busy}
              onChange={event => update(emails, index, event.target.value, setEmails)}
              onBlur={event => update(emails, index, event.target.value.trim().toLowerCase(), setEmails)} />
            <button className="icon-button" type="button" aria-label={`Remover e-mail ${index + 1}`}
              title="Remover e-mail" disabled={busy} onClick={() => setEmails(emails.filter((_, position) => position !== index))}>
              <Trash2 size={17} />
            </button>
          </div>)}
          {emails.length === 0 && <p className="notification-empty">Nenhum e-mail cadastrado.</p>}
        </div>
        <button className="button secondary" type="button" disabled={busy || emails.length >= 10}
          onClick={() => setEmails([...emails, ''])}><Plus size={16} /> Adicionar e-mail</button>
      </section>

      <section className="panel notification-channel">
        <div className="notification-channel-head">
          <span className="notification-channel-icon"><MessageCircle size={21} /></span>
          <div><h2>WhatsApp</h2><p>Números com DDD e 8 ou 9 dígitos para futuros avisos.</p></div>
        </div>
        <div className="notification-contacts">
          {phones.map((phone, index) => <div className="notification-contact" key={index}>
            <label className="sr-only" htmlFor={`notification-phone-${index}`}>WhatsApp {index + 1}</label>
            <input id={`notification-phone-${index}`} type="tel" inputMode="numeric" required maxLength={24}
              autoComplete="tel-national"
              placeholder="(85) 99999-9999" value={phone} disabled={busy}
              onChange={event => update(phones, index, formatWhatsApp(event.target.value), setPhones)} />
            <button className="icon-button" type="button" aria-label={`Remover WhatsApp ${index + 1}`}
              title="Remover WhatsApp" disabled={busy} onClick={() => setPhones(phones.filter((_, position) => position !== index))}>
              <Trash2 size={17} />
            </button>
          </div>)}
          {phones.length === 0 && <p className="notification-empty">Nenhum WhatsApp cadastrado.</p>}
        </div>
        <button className="button secondary" type="button" disabled={busy || phones.length >= 10}
          onClick={() => setPhones([...phones, ''])}><Plus size={16} /> Adicionar WhatsApp</button>
      </section>

      <div className="notification-footer">
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="button primary" type="submit" disabled={busy}>
          <Save size={17} /> {busy ? 'Salvando...' : 'Salvar contatos'}
        </button>
      </div>
    </form>
  </>
}
