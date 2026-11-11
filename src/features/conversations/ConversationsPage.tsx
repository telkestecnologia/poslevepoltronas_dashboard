import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Globe, MessageCircle, RefreshCw, Send } from 'lucide-react'
import { api, type Conversation, type ConversationMessage } from '../../api'
import { conversationState, customerLabel, customerNumber, nameColor, stageTone } from '../../utils/conversations'
import { MessageImages, WhatsAppText } from './WhatsAppText'
import { getMessage } from '../../utils/errors'
import './conversations.css'

type Filter = 'ALL' | 'HELP' | 'WHATSAPP' | 'SITE'

function hour(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

function timeLabel(iso: string) {
  const date = new Date(iso)
  const today = new Date().toDateString() === date.toDateString()
  return new Intl.DateTimeFormat('pt-BR', today ? { hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: '2-digit' }).format(date)
}

/** Conversas do site e do WhatsApp (Isa no backend), as mesmas do app: a lista atualiza a cada 10 segundos. */
type Props = { credentials: string; selectedId: string | null; onSelect: (id: string | null) => void }

export function ConversationsPage({ credentials, selectedId, onSelect }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [whatsApp, setWhatsApp] = useState<'OK' | 'NOT_CONFIGURED' | 'ERROR' | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [listError, setListError] = useState('')
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [chatError, setChatError] = useState('')
  const [filter, setFilter] = useState<Filter>('ALL')
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const thread = useRef<HTMLDivElement>(null)
  const listRef = useRef<Conversation[]>([])
  useEffect(() => { listRef.current = conversations }, [conversations])

  // A conversa aberta vem da URL (/conversas/:id), então o aviso da Isa e o voltar do navegador funcionam.
  useEffect(() => {
    setSelected(selectedId ? listRef.current.find(item => item.id === selectedId) ?? null : null)
    setMessages([])
    setDraft('')
    setChatError('')
  }, [selectedId])

  const loadList = useCallback(() => api.conversations(credentials)
    .then(page => { setConversations(page.items); setWhatsApp(page.whatsApp ?? null); setListError('') },
      failure => setListError(getMessage(failure)))
    .finally(() => setLoaded(true)), [credentials])

  const loadChat = useCallback((id: string) => Promise.all([api.conversation(credentials, id), api.conversationMessages(credentials, id)])
    .then(([detail, list]) => { setSelected(detail); setMessages(list); setChatError('') },
      failure => setChatError(getMessage(failure))), [credentials])

  useEffect(() => {
    void loadList()
    const timer = setInterval(() => void loadList(), 10_000)
    return () => clearInterval(timer)
  }, [loadList])

  useEffect(() => {
    if (!selectedId) return
    void loadChat(selectedId)
    const timer = setInterval(() => void loadChat(selectedId), 5_000)
    return () => clearInterval(timer)
  }, [selectedId, loadChat])

  useEffect(() => {
    thread.current?.scrollTo({ top: thread.current.scrollHeight })
  }, [messages.length, selectedId])

  const helpCount = conversations.filter(item => item.needsAttention).length
  const visible = conversations.filter(item => filter === 'ALL'
    || (filter === 'HELP' && item.needsAttention)
    || (filter === 'WHATSAPP' && item.channel === 'WHATSAPP')
    || (filter === 'SITE' && item.channel === 'SITE'))

  function open(id: string) {
    if (id !== selectedId) onSelect(id)
  }

  async function toggleAssignment(item: Conversation) {
    const takingOver = item.state !== 'HUMAN'
    const text = takingOver ? 'A Isa para de responder e você passa a atender. Se não responder em 3 minutos, a conversa volta para a Isa.'
      : 'A Isa volta a responder este cliente sozinha.'
    if (!window.confirm(`${takingOver ? 'Assumir a conversa?' : 'Devolver para a Isa?'}\n\n${text}`)) return
    setBusy(true)
    try {
      setSelected(await api.setConversationState(credentials, item.id, takingOver ? 'HUMAN' : 'AI'))
      void loadList()
    } catch (failure) {
      setChatError(getMessage(failure))
    } finally {
      setBusy(false)
    }
  }

  async function send(event: React.FormEvent) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || !selected) return
    setBusy(true)
    try {
      const message = await api.replyConversation(credentials, selected.id, text)
      // A atualização automática pode ter trazido esta mensagem enquanto o envio respondia: não duplica.
      setMessages(current => current.some(item => item.id === message.id) ? current : [...current, message])
      setDraft('')
      setChatError('')
      await loadChat(selected.id)
      void loadList()
    } catch (failure) {
      setChatError(getMessage(failure))
    } finally {
      setBusy(false)
    }
  }

  const state = selected ? conversationState(selected) : null
  const windowClosed = selected?.channel === 'WHATSAPP' && selected.windowOpen === false

  return <>
    <div className="page-heading with-action">
      <div><span className="eyebrow">ATENDIMENTO • ISA</span><h1>Conversas</h1>
        <p>Conversas do site e do WhatsApp da Pós Leve, (85) 93618-1059. Assuma quando a Isa precisar de ajuda.</p></div>
      <button className="button secondary" type="button" onClick={() => void loadList()}><RefreshCw size={16} /> Atualizar</button>
    </div>

    <div className={`wa${selectedId ? ' wa-open' : ''}`}>
      <aside className="wa-list">
        {whatsApp === 'NOT_CONFIGURED' && <div className="wa-demo">As conversas do WhatsApp ainda não estão ligadas ao servidor. Por enquanto aparecem só as do site.</div>}
        {whatsApp === 'ERROR' && <div className="wa-demo wa-error">Não foi possível buscar as conversas do WhatsApp agora. Aparecem só as do site.</div>}
        {listError && <div className="wa-demo wa-error">{listError}</div>}
        <div className="wa-filters" role="tablist" aria-label="Filtrar conversas">
          {([['ALL', 'Tudo'], ['HELP', `Pediu ajuda${helpCount ? ` ${helpCount}` : ''}`], ['WHATSAPP', 'WhatsApp'], ['SITE', 'Site']] as const)
            .map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={filter === value}
              className={filter === value ? 'selected' : ''} onClick={() => setFilter(value)}>{label}</button>)}
        </div>
        {visible.length === 0 && <p className="wa-empty">{loaded ? 'Nenhuma conversa neste filtro.' : 'Carregando conversas…'}</p>}
        {visible.map(item => {
          const rowState = conversationState(item)
          const whatsAppRow = item.channel === 'WHATSAPP'
          return <button key={item.id} type="button" className={`wa-row${item.id === selectedId ? ' active' : ''}`} onClick={() => open(item.id)}>
            <span className="wa-avatar" style={{ background: whatsAppRow ? '#25d366' : '#dfe5e7' }}>
              {whatsAppRow ? <MessageCircle size={22} color="#fff" /> : <Globe size={22} color="#667781" />}</span>
            <span className="wa-row-body">
              <span className="wa-row-top"><strong>{customerLabel(item)}{customerNumber(item) && <small className="wa-number"> {customerNumber(item)}</small>}</strong>
                <small className={item.needsAttention ? 'unread' : ''}>{timeLabel(item.lastMessageAt)}</small></span>
              <span className="wa-row-top"><span className="wa-preview">
                {item.lastMessageRole !== 'CUSTOMER' && <span className="wa-ticks">✓✓ </span>}
                {`${item.lastMessageRole === 'AI' ? 'Isa: ' : item.lastMessageRole === 'STAFF' ? `${item.staffName ?? 'Equipe'}: ` : ''}${item.lastMessagePreview ?? ''}`}</span>
                {item.needsAttention && <span className="wa-badge">!</span>}</span>
              <span className={`wa-state ${rowState.tone}`}>{rowState.label} • {whatsAppRow ? 'WhatsApp' : 'Site'}</span>
              {item.stage && <span className={`wa-stage ${stageTone(item.stage).tone}`}>{stageTone(item.stage).icon} {item.stage}</span>}
            </span>
          </button>
        })}
      </aside>

      <section className="wa-chat" aria-label="Conversa selecionada">
        {!selected || !state ? <div className="wa-placeholder"><p>Escolha uma conversa para ler.</p></div> : <>
          <header className="wa-chat-head">
            <button type="button" className="wa-back" aria-label="Voltar para a lista" onClick={() => onSelect(null)}><ArrowLeft size={20} /></button>
            <div className="wa-chat-title"><strong>{customerLabel(selected)}{customerNumber(selected) && <small className="wa-number"> {customerNumber(selected)}</small>}</strong>
              <small className="wa-chat-meta"><span className={`wa-state ${state.tone}`}>{state.label}</span>
                {` • ${selected.channel === 'WHATSAPP' ? 'WhatsApp' : 'Site'} • desde ${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(selected.startedAt))}`}</small>
              {selected.stage && <span className={`wa-stage ${stageTone(selected.stage).tone}`}>{stageTone(selected.stage).icon} {selected.stage}</span>}</div>
            <button type="button" className={`wa-assign${selected.state === 'HUMAN' ? ' outline' : ''}`} disabled={busy} onClick={() => void toggleAssignment(selected)}>
              {selected.state === 'HUMAN' ? 'Devolver para a Isa' : 'Assumir conversa'}</button>
          </header>
          <div className="wa-thread" ref={thread}>
            {messages.map((message, index) => {
              const customer = message.role === 'CUSTOMER'
              const previous = messages[index - 1]
              const first = !previous || previous.role !== message.role || previous.staffName !== message.staffName
              return <div key={message.id} className={`wa-bubble ${customer ? 'in' : 'out'}${first ? ' first' : ''}`}>
                {!customer && first && <span className="wa-author" style={{ color: message.role === 'AI' ? '#06cf9c' : nameColor(message.staffName ?? '') }}>
                  {message.role === 'AI' ? 'Isa (assistente)' : message.staffName ?? 'Equipe Pós Leve'}</span>}
                <MessageImages images={message.images} />
                {message.content && <WhatsAppText text={message.content} />}
                <span className="wa-meta">{hour(message.createdAt)}{!customer && <span className="wa-ticks"> ✓✓</span>}</span>
              </div>
            })}
          </div>
          <footer className="wa-composer">
            {chatError && <p className="wa-note wa-error">{chatError}</p>}
            {windowClosed ? <p className="wa-note">Passaram 24 horas desde a última mensagem do cliente. O WhatsApp só libera nova mensagem quando ele escrever de novo.</p>
              : <p className="wa-note">{selected.state === 'HUMAN'
                ? 'Você está atendendo: a Isa não responde. Se você ficar 3 minutos sem responder, a conversa volta sozinha para a Isa.'
                : 'A Isa está atendendo. Para digitar, clique em “Assumir conversa”.'}</p>}
            <form className={`wa-input${selected.state === 'HUMAN' ? '' : ' locked'}`} onSubmit={event => void send(event)}>
              <input value={draft} onChange={event => setDraft(event.target.value)} maxLength={2000} aria-label="Mensagem"
                disabled={selected.state !== 'HUMAN'}
                placeholder={selected.state === 'HUMAN' ? 'Mensagem' : '🔒 Bloqueado enquanto a Isa atende'} />
              <button type="submit" disabled={selected.state !== 'HUMAN' || !draft.trim() || busy} aria-label="Enviar mensagem"><Send size={18} /></button>
            </form>
          </footer>
        </>}
      </section>
    </div>
  </>
}
