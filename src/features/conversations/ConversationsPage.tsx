import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Globe, Send } from 'lucide-react'
import { formatPhone } from '../../utils/phone'
import {
  conversationState, memberColors, seedConversations, teamMembers, type DemoConversation, type TeamMember,
} from './demoConversations'
import './conversations.css'

type Filter = 'ALL' | 'HELP' | 'WHATSAPP' | 'SITE'

const avatarColors = ['#53bdeb', '#a5b337', '#ff8f6b', '#7f66ff', '#00a884', '#ffbc38']

function hour(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

function customerName(item: DemoConversation) {
  return item.channel === 'SITE' ? 'Visitante do site' : item.customer
}

export function ConversationsPage() {
  const [conversations, setConversations] = useState(seedConversations)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('ALL')
  const [me, setMe] = useState<TeamMember>('Isadora Ivo')
  const [draft, setDraft] = useState('')
  const thread = useRef<HTMLDivElement>(null)

  const selected = conversations.find(item => item.id === selectedId) ?? null
  const helpCount = conversations.filter(item => item.needsHelp).length
  const visible = [...conversations]
    .sort((a, b) => (b.messages.at(-1)?.at ?? '').localeCompare(a.messages.at(-1)?.at ?? ''))
    .filter(item => filter === 'ALL'
      || (filter === 'HELP' && (item.needsHelp || item.state === 'HUMAN'))
      || (filter === 'WHATSAPP' && item.channel === 'WHATSAPP')
      || (filter === 'SITE' && item.channel === 'SITE'))

  useEffect(() => {
    thread.current?.scrollTo({ top: thread.current.scrollHeight })
  }, [selected?.messages.length, selectedId])

  function update(id: string, change: (item: DemoConversation) => DemoConversation) {
    setConversations(current => current.map(item => item.id === id ? change(item) : item))
  }

  function toggleAssignment(item: DemoConversation) {
    const takingOver = item.state === 'AI'
    const message = takingOver
      ? 'A Isa para de responder e você passa a atender este cliente.'
      : 'A Isa volta a responder este cliente sozinha.'
    if (!window.confirm(`${takingOver ? 'Assumir a conversa?' : 'Devolver para a Isa?'}\n\n${message}`)) return
    update(item.id, current => ({
      ...current, state: takingOver ? 'HUMAN' : 'AI', assignee: takingOver ? me : undefined,
      needsHelp: takingOver ? false : current.needsHelp,
    }))
  }

  function send(event: React.FormEvent) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || !selected) return
    update(selected.id, current => ({
      ...current, assignee: me,
      messages: [...current.messages, { id: `t${Date.now()}`, role: 'TEAM', author: me, text, at: new Date().toISOString() }],
    }))
    setDraft('')
  }

  return <>
    <div className="page-heading">
      <div><span className="eyebrow">ATENDIMENTO • ISA</span><h1>Conversas</h1>
        <p>Acompanhe o que a Isa conversa com os clientes e assuma quando ela precisar de ajuda.</p></div>
    </div>

    <div className={`wa${selected ? ' wa-open' : ''}`}>
      <aside className="wa-list">
        <div className="wa-demo">🔒 Conversas fictícias, só para demonstração. Nada é enviado a clientes.</div>
        <div className="wa-filters" role="tablist" aria-label="Filtrar conversas">
          {([['ALL', 'Tudo'], ['HELP', `Pediu ajuda${helpCount ? ` ${helpCount}` : ''}`], ['WHATSAPP', 'WhatsApp'], ['SITE', 'Site']] as const)
            .map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={filter === value}
              className={filter === value ? 'selected' : ''} onClick={() => setFilter(value)}>{label}</button>)}
        </div>
        {visible.length === 0 && <p className="wa-empty">Nenhuma conversa neste filtro.</p>}
        {visible.map((item, index) => {
          const last = item.messages.at(-1)
          const state = conversationState(item)
          return <button key={item.id} type="button" className={`wa-row${item.id === selectedId ? ' active' : ''}`}
            onClick={() => setSelectedId(item.id)}>
            <span className="wa-avatar" style={{ background: item.channel === 'SITE' ? '#dfe5e7' : avatarColors[index % avatarColors.length] }}>
              {item.channel === 'SITE' ? <Globe size={22} color="#667781" /> : item.customer.charAt(0)}</span>
            <span className="wa-row-body">
              <span className="wa-row-top"><strong>{customerName(item)}</strong>
                {last && <small className={item.needsHelp ? 'unread' : ''}>{hour(last.at)}</small>}</span>
              <span className="wa-row-top"><span className="wa-preview">
                {last && last.role !== 'CUSTOMER' && <span className="wa-ticks">✓✓ </span>}
                {last ? `${last.role === 'ISA' ? 'Isa: ' : last.role === 'TEAM' ? `${last.author ?? 'Equipe'}: ` : ''}${last.text}` : ''}</span>
                {item.needsHelp && <span className="wa-badge">!</span>}</span>
              <span className={`wa-state ${state.tone}`}>{state.label}{item.channel === 'SITE' ? ' • Site' : ` • ${formatPhone(item.phone ?? '')}`}</span>
            </span>
          </button>
        })}
      </aside>

      <section className="wa-chat" aria-label="Conversa selecionada">
        {!selected ? <div className="wa-placeholder"><p>Escolha uma conversa para ler.</p></div> : <>
          <header className="wa-chat-head">
            <button type="button" className="wa-back" aria-label="Voltar para a lista" onClick={() => setSelectedId(null)}><ArrowLeft size={20} /></button>
            <div className="wa-chat-title"><strong>{customerName(selected)}</strong>
              <small>{selected.channel === 'SITE' ? 'Chat do site' : `WhatsApp • ${formatPhone(selected.phone ?? '')}`}</small></div>
            <span className={`wa-state ${conversationState(selected).tone}`}>{conversationState(selected).label}</span>
            <button type="button" className={`wa-assign${selected.state === 'HUMAN' ? ' outline' : ''}`} onClick={() => toggleAssignment(selected)}>
              {selected.state === 'HUMAN' ? 'Devolver para a Isa' : 'Assumir conversa'}</button>
          </header>
          <div className="wa-thread" ref={thread}>
            <div className="wa-system">🔒 Conversa fictícia, só para demonstração. Nada é enviado ao cliente.</div>
            {selected.messages.map((message, index) => {
              const customer = message.role === 'CUSTOMER'
              const previous = selected.messages[index - 1]
              const first = !previous || previous.role !== message.role || previous.author !== message.author
              return <div key={message.id} className={`wa-bubble ${customer ? 'in' : 'out'}${first ? ' first' : ''}`}>
                {!customer && first && <span className="wa-author" style={{ color: message.role === 'ISA' ? '#06cf9c' : memberColors[message.author ?? ''] ?? '#027eb5' }}>
                  {message.role === 'ISA' ? 'Isa (assistente)' : message.author ?? 'Equipe Pós Leve'}</span>}
                <p>{message.text}</p>
                <span className="wa-meta">{hour(message.at)}{!customer && <span className="wa-ticks"> ✓✓</span>}</span>
              </div>
            })}
          </div>
          <footer className="wa-composer">
            <div className="wa-as">
              <span>Respondendo como (teste):</span>
              {teamMembers.map(member => <button key={member} type="button" aria-pressed={me === member}
                className={me === member ? 'on' : ''} style={{ color: memberColors[member] }} onClick={() => setMe(member)}>{member}</button>)}
            </div>
            {selected.channel === 'SITE'
              ? <p className="wa-note">Conversa do site: aqui você acompanha. Responder funciona nas conversas do WhatsApp.</p>
              : selected.state === 'AI'
                ? <p className="wa-note">A Isa está respondendo. Clique em “Assumir conversa” para falar com o cliente.</p>
                : <form className="wa-input" onSubmit={send}>
                  <input value={draft} onChange={event => setDraft(event.target.value)} placeholder="Mensagem" maxLength={2000} aria-label="Mensagem" />
                  <button type="submit" disabled={!draft.trim()} aria-label="Enviar mensagem"><Send size={18} /></button>
                </form>}
          </footer>
        </>}
      </section>
    </div>
  </>
}
