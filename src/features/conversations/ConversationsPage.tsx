import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, MessageCircle, Paperclip, RefreshCw, Send, X, MessagesSquare } from 'lucide-react'
import { api, sendConversationAttachment, type Conversation, type ConversationAnalysis, type ConversationMessage } from '../../api'
import { conversationState, customerLabel, customerNumber, nameColor, stageTone } from '../../utils/conversations'
import { MessageImages, WhatsAppText } from './WhatsAppText'
import { VoiceRecorder } from './VoiceRecorder'
import { conversationRecap } from './conversationRecap'
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
  const [replyTo, setReplyTo] = useState<ConversationMessage | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [analysis, setAnalysis] = useState<{ data?: ConversationAnalysis; error?: string; loading: boolean }>({ loading: false })
  // Abrir o resumo pede a análise da IA (o backend guarda a última até chegar mensagem nova).
  function openSummary() {
    if (!selected) return
    setSummaryOpen(true)
    setAnalysis(current => ({ ...current, loading: true, error: undefined }))
    api.conversationAnalysis(credentials, selected.id).then(data => setAnalysis({ data, loading: false }),
      failure => setAnalysis({ error: getMessage(failure), loading: false }))
  }
  const fileInput = useRef<HTMLInputElement>(null)
  const [voiceRecording, setVoiceRecording] = useState(false)
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

  // Anexo: foto, vídeo, PDF ou o áudio gravado; a mensagem digitada vai como legenda.
  async function sendFile(file: File | undefined) {
    if (!file || !selected) return
    setBusy(true)
    try {
      const message = await sendConversationAttachment(credentials, selected.id, file, draft)
      setMessages(current => current.some(item => item.id === message.id) ? current : [...current, message])
      setDraft('')
      setChatError('')
      await loadChat(selected.id)
      void loadList()
    } catch (failure) {
      setChatError(getMessage(failure))
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function send(event: React.FormEvent) {
    event.preventDefault()
    const typed = draft.trim()
    if (!typed || !selected) return
    // Resposta a uma mensagem escolhida: vai com a pergunta citada, como no WhatsApp (igual ao app).
    const text = replyTo?.content ? `_“${quoteOf(replyTo.content)}”_\n\n${typed}` : typed
    setBusy(true)
    try {
      const message = await api.replyConversation(credentials, selected.id, text)
      // A atualização automática pode ter trazido esta mensagem enquanto o envio respondia: não duplica.
      setMessages(current => current.some(item => item.id === message.id) ? current : [...current, message])
      setDraft('')
      setReplyTo(null)
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
      <div><span className="eyebrow">WHATSAPP E SITE • ISA</span><h1>Atendimento</h1></div>
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
            <span className="wa-avatar" style={{ background: whatsAppRow ? '#25d366' : '#127a84' }}>
              {whatsAppRow ? <MessageCircle size={22} color="#fff" /> : <MessagesSquare size={21} color="#fff" />}</span>
            <span className="wa-row-body">
              <span className="wa-row-top"><strong>{customerLabel(item)}{customerNumber(item) && <small className="wa-number"> {customerNumber(item)}</small>}</strong>
                <small className={item.needsAttention ? 'unread' : ''}>{timeLabel(item.lastMessageAt)}</small></span>
              <span className="wa-row-top"><span className="wa-preview">
                {item.lastMessageRole !== 'CUSTOMER' && <span className="wa-ticks">✓✓ </span>}
                {`${item.lastMessageRole === 'AI' ? 'Isa: ' : item.lastMessageRole === 'STAFF' ? `${item.staffName ?? 'Equipe'}: ` : ''}${item.lastMessagePreview ?? ''}`}</span>
                {item.needsAttention && <span className="wa-badge">!</span>}</span>
              <span className={`wa-state ${rowState.tone}`}>{rowState.label} • {whatsAppRow ? 'WhatsApp' : 'Site'}</span>
              {(() => {
                // Etapa do atendimento antes de abrir a conversa; sem pedido ainda, é o primeiro contato.
                const stage = item.stage ?? 'Primeiro contato'
                return stage && <span className={`wa-stage ${stageTone(stage).tone}`}>{stageTone(stage).icon} {stage}</span>
              })()}
              {item.needsAttention && <span className="wa-problem"><strong>⚠️ {item.state === 'HUMAN' ? 'Pediu atendimento humano' : 'A Isa não soube responder'}</strong>
                {item.lastCustomerMessage && <span>“{item.lastCustomerMessage}”</span>}</span>}
            </span>
          </button>
        })}
      </aside>

      <section className="wa-chat" aria-label="Conversa selecionada">
        {!selected || !state ? <div className="wa-placeholder"><p>Escolha uma conversa para ler.</p></div> : <>
          <header className="wa-chat-head">
            <button type="button" className="wa-back" aria-label="Voltar para a lista" onClick={() => onSelect(null)}><ArrowLeft size={20} /></button>
            <div className="wa-chat-title"><strong>{customerLabel(selected)}{customerNumber(selected) && <small className="wa-number"> {customerNumber(selected)}</small>}</strong>
              <small className="wa-chat-meta"><button type="button" className={`wa-state wa-state-link ${state.tone}`} onClick={() => openSummary()}
                title="Ver o resumo do atendimento">{state.label} ⓘ</button>
                {` • ${selected.channel === 'WHATSAPP' ? 'WhatsApp' : 'Site'} • desde ${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(selected.startedAt))}`}</small>
              <span className={`wa-stage ${stageTone(selected.stage ?? 'Primeiro contato').tone}`}>{stageTone(selected.stage ?? 'Primeiro contato').icon} Etapa: {selected.stage ?? 'Primeiro contato'}</span></div>
            <button type="button" className={`wa-assign${selected.state === 'HUMAN' ? ' outline' : ''}`} disabled={busy} onClick={() => void toggleAssignment(selected)}>
              {selected.state === 'HUMAN' ? 'Devolver para a Isa' : 'Assumir conversa'}</button>
          </header>
          {summaryOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSummaryOpen(false) }}>
            <section className="modal wa-summary" role="dialog" aria-modal="true" aria-label="Resumo do atendimento">
              <div className="modal-head"><div><h2>Resumo do atendimento</h2></div>
                <button className="icon-button" aria-label="Fechar" onClick={() => setSummaryOpen(false)}><X size={20} /></button></div>
              <p className="wa-summary-meta">{[customerLabel(selected), customerNumber(selected), selected.channel === 'WHATSAPP' ? 'WhatsApp' : 'Chat do site',
                selected.state === 'HUMAN' ? `com ${selected.staffName ?? 'a equipe'}` : 'com a Isa',
                `desde ${summaryDate.format(new Date(selected.startedAt))}`].filter(Boolean).join(' • ')}</p>
              {/* O que aconteceu até agora, tirado das mensagens: não precisa ler a conversa toda. */}
              {(() => {
                const recap = conversationRecap(selected, messages)
                return <div className="wa-recap">
                  <div className="wa-ai"><h3>✨ Análise da IA</h3>
                    {analysis.loading ? <p className="wa-ai-loading">Analisando o atendimento...</p>
                      : analysis.error ? <p>{analysis.error}</p>
                      : analysis.data && <>
                        {([['Resumo', analysis.data.summary], ['Cliente', analysis.data.customer], ['Atendimento', analysis.data.service],
                          ['Sugestão', analysis.data.suggestion]] as const).filter(([, value]) => value)
                          .map(([label, value]) => <div key={label}><h4>{label}</h4><p>{value}</p></div>)}
                        {analysis.data.attention && <div className="wa-summary-alert"><h4>⚠️ Atenção</h4><p>{analysis.data.attention}</p></div>}
                      </>}
                  </div>
                  <div className="wa-recap-box"><h3>Até agora</h3><ul>{recap.facts.map(fact => <li key={fact}>{fact}</li>)}</ul></div>
                  {recap.lastQuestion && <div className={selected.needsAttention ? 'wa-summary-alert' : 'wa-recap-box'}>
                    <h3>{selected.needsAttention ? '⚠️ A Isa não soube responder' : 'Última mensagem do cliente'}</h3><p>“{recap.lastQuestion}”</p></div>}
                  {recap.lastAnswer && <div className="wa-recap-box"><h3>Última resposta ({recap.lastAnswer.who})</h3><p>“{recap.lastAnswer.text}”</p></div>}
                  <div className="wa-recap-next"><h3>Próximo passo</h3><p>{recap.next}</p></div>
                </div>
              })()}
            </section>
          </div>}
          <div className="wa-thread" ref={thread}>
            {messages.map((message, index) => {
              const customer = message.role === 'CUSTOMER'
              const previous = messages[index - 1]
              const first = !previous || previous.role !== message.role || previous.staffName !== message.staffName
              const missed = customer && (isUnanswered(messages[index + 1])
                || (selected.needsAttention && !!message.content && message.content === selected.lastCustomerMessage))
              const chosen = replyTo?.id === message.id
              return <div key={message.id} className={`wa-bubble ${customer ? 'in' : 'out'}${first ? ' first' : ''}${missed ? ' missed' : ''}${chosen ? ' chosen' : ''}`}
                role={customer ? 'button' : undefined} tabIndex={customer ? 0 : undefined} title={customer ? 'Clique para responder a esta mensagem' : undefined}
                onClick={customer ? () => setReplyTo(chosen ? null : message) : undefined}>
                {missed && <span className="wa-missed-tag">⚠️ A Isa não soube responder</span>}
                {!customer && first && <span className="wa-author" style={{ color: message.role === 'AI' ? '#06cf9c' : nameColor(message.staffName ?? '') }}>
                  {message.role === 'AI' ? 'Isa (assistente)' : message.staffName ?? 'Equipe Pós Leve'}</span>}
                <MessageImages images={message.images} />
                {message.attachments?.map(file => file.kind === 'IMAGE'
                  ? <a key={file.url} className="wa-photo" href={file.url} target="_blank" rel="noopener noreferrer"><img src={file.url} alt={file.filename} loading="lazy" /></a>
                  : file.kind === 'VIDEO' ? <video key={file.url} className="wa-video" src={file.url} controls preload="metadata" />
                    : file.kind === 'AUDIO' ? <audio key={file.url} className="wa-audio" src={file.url} controls preload="metadata" />
                      : <a key={file.url} className="wa-file" href={file.url} target="_blank" rel="noopener noreferrer">📄 {file.filename}</a>)}
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
                : 'A Isa está atendendo. Para digitar, clique em “Assumir conversa”. Clique numa mensagem do cliente para responder a ela.'}</p>}
            {replyTo && <div className="wa-quote"><div><strong>Respondendo a</strong><span>{replyTo.content}</span></div>
              <button type="button" aria-label="Cancelar resposta" onClick={() => setReplyTo(null)}><X size={16} /></button></div>}
            <form className={`wa-input${selected.state === 'HUMAN' ? '' : ' locked'}`} onSubmit={event => void send(event)}>
              <input ref={fileInput} type="file" hidden accept="image/jpeg,image/png,video/mp4,video/3gpp,application/pdf"
                onChange={event => void sendFile(event.target.files?.[0])} />
              {!voiceRecording && <>
                <button type="button" className="wa-attach" aria-label="Enviar foto, vídeo ou PDF" title="Enviar foto, vídeo ou PDF"
                  disabled={selected.state !== 'HUMAN' || busy || windowClosed} onClick={() => fileInput.current?.click()}><Paperclip size={18} /></button>
                <input value={draft} onChange={event => setDraft(event.target.value)} maxLength={2000} aria-label="Mensagem"
                  disabled={selected.state !== 'HUMAN'}
                  placeholder={selected.state === 'HUMAN' ? 'Mensagem' : '🔒 Bloqueado enquanto a Isa atende'} />
              </>}
              {/* Sem texto digitado, o botão é o microfone para gravar e enviar áudio, como no WhatsApp. */}
              {draft.trim() && !voiceRecording
                ? <button type="submit" disabled={selected.state !== 'HUMAN' || busy} aria-label="Enviar mensagem"><Send size={18} /></button>
                : <VoiceRecorder disabled={selected.state !== 'HUMAN' || busy || windowClosed} onRecordingChange={setVoiceRecording}
                  onRecorded={file => void sendFile(file)} onError={setChatError} />}
            </form>
          </footer>
        </>}
      </section>
    </div>
  </>
}

/** A pergunta que a Isa não soube responder: a que recebeu a frase de "vou confirmar com a equipe". */
function isUnanswered(next?: ConversationMessage) {
  return !!next && next.role === 'AI' && /vou confirmar com a nossa equipe/i.test(next.content ?? '')
}

function quoteOf(text: string) {
  const line = text.replace(/\s+/g, ' ').trim()
  return line.length > 120 ? `${line.slice(0, 117)}...` : line
}

const summaryDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
