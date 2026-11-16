import { useState, type ReactNode } from 'react'
import { BookOpen, Check, MessageCircle, Pencil, Plus, RefreshCw, Search, Sparkles, Trash2 } from 'lucide-react'
import type { AiKnowledge, AiKnowledgeInput, AiUnansweredQuestion } from '../../api'
import { EmptyState } from '../../components/common'
import { getMessage } from '../../utils/errors'
import { AiEditorModal, type AiEditor } from './AiEditorModal'
import { IsaReportButton } from './IsaReportButton'
import { WhatsAppText } from '../conversations/WhatsAppText'
import './ai.css'

type Props = {
  credentials: string
  knowledge: AiKnowledge[]
  unanswered: AiUnansweredQuestion[]
  onCreateKnowledge: (data: AiKnowledgeInput) => Promise<void>
  onUpdateKnowledge: (id: string, data: AiKnowledgeInput) => Promise<void>
  onDeleteKnowledge: (id: string) => Promise<void>
  onAnswerUnanswered: (id: string, answer: string) => Promise<void>
  onDeleteUnanswered: (id: string) => Promise<void>
  onRecordUnanswered: (question: string) => Promise<void>
  onRefresh: () => void
  /** Aba Avisos: quem da equipe é avisado quando a Isa não sabe responder. */
  alerts?: ReactNode
}

function dateLabel(value: string) {
  if (!value) return 'data indisponível'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function matches(text: string, search: string) {
  const normalize = (value: string) =>
    value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return normalize(text).includes(normalize(search.trim()))
}

export function AiContextPage({ credentials, knowledge, unanswered, onCreateKnowledge, onUpdateKnowledge, onDeleteKnowledge, onAnswerUnanswered, onDeleteUnanswered, onRecordUnanswered, onRefresh, alerts }: Props) {
  const [tab, setTab] = useState<'knowledge' | 'unanswered' | 'alerts'>('knowledge')
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<AiEditor | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const visibleKnowledge = knowledge.filter(entry => matches(`${entry.question} ${entry.answer}`, search))
  const visibleUnanswered = unanswered.filter(entry => matches(entry.question, search))

  function switchTab(next: 'knowledge' | 'unanswered' | 'alerts') {
    setTab(next)
    setSearch('')
    setError('')
  }

  function openEditor(next: AiEditor) {
    setError('')
    setEditor(next)
  }

  async function save(question: string, answer: string) {
    if (!editor) return
    setBusy(true)
    setError('')
    try {
      if (editor.kind === 'answer') {
        await onAnswerUnanswered(editor.pending.id, answer)
        setTab('knowledge')
      } else if (editor.kind === 'unanswered') {
        await onRecordUnanswered(question)
      } else if (editor.entry) await onUpdateKnowledge(editor.entry.id, { question, answer })
      else await onCreateKnowledge({ question, answer })
      setSearch('')
      setEditor(null)
    } catch (cause) {
      setError(getMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  async function remove(entry: AiKnowledge) {
    if (!window.confirm(`Remover a resposta para “${entry.question}” do contexto da IA?`)) return
    setBusy(true)
    setError('')
    try {
      await onDeleteKnowledge(entry.id)
    } catch (cause) {
      setError(getMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  async function removeUnanswered(entry: AiUnansweredQuestion) {
    if (!window.confirm(`Excluir a dúvida “${entry.question}” sem respondê-la?`)) return
    setBusy(true)
    setError('')
    try {
      await onDeleteUnanswered(entry.id)
    } catch (cause) {
      setError(getMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="page-heading with-action ai-page-heading">
        <div>
          <span className="eyebrow">ATENDIMENTO • PÓS LEVE</span>
          {/* PDF do relatório geral do atendimento, ao lado do título (só o administrador). */}
          <div className="ai-title-row"><h1>O que a Isa sabe</h1>
            <span className="admin-only"><IsaReportButton credentials={credentials} /></span></div>
        </div>
        <div className="ai-heading-actions">
          <button className="button secondary" type="button" onClick={onRefresh}>
            <RefreshCw size={17} /> Atualizar
          </button>
          {tab !== 'alerts' && <button className="button primary admin-only" type="button" onClick={() => openEditor(tab === 'knowledge' ? { kind: 'knowledge' } : { kind: 'unanswered' })}>
            <Plus size={18} /> {tab === 'knowledge' ? 'Nova pergunta e resposta' : 'Registrar dúvida'}
          </button>}
        </div>
      </div>

      {/* Só no computador: a Isa sentada, com balões de conversa animados e os números do que ela sabe. */}
      <section className="isa-hero" aria-label="A Isa, assistente de atendimento">
        <div className="isa-hero-glow" aria-hidden="true" />
        <div className="isa-hero-copy">
          <span className="isa-hero-eyebrow"><Sparkles size={14} /> ATENDIMENTO • PÓS LEVE</span>
          <div className="ai-title-row"><h1>O que a Isa sabe</h1>
            <span className="admin-only"><IsaReportButton credentials={credentials} /></span></div>
          <p>Tudo o que a Isa responde no WhatsApp e no site vem daqui. Quanto mais você ensina, melhor ela atende.</p>
          <div className="isa-hero-stats">
            <button type="button" className={`isa-stat known${tab === 'knowledge' ? ' active' : ''}`} onClick={() => switchTab('knowledge')}>
              <BookOpen size={20} /><span><strong>{knowledge.length}</strong> respostas que ela já sabe</span>
            </button>
            <button type="button" className={`isa-stat pending${tab === 'unanswered' ? ' active' : ''}`} onClick={() => switchTab('unanswered')}>
              <MessageCircle size={20} /><span><strong>{unanswered.length}</strong> {unanswered.length === 1 ? 'dúvida esperando' : 'dúvidas esperando'} você</span>
            </button>
          </div>
          <div className="isa-hero-actions">
            {tab !== 'alerts' && <button className="button primary admin-only" type="button" onClick={() => openEditor(tab === 'knowledge' ? { kind: 'knowledge' } : { kind: 'unanswered' })}>
              <Plus size={18} /> {tab === 'knowledge' ? 'Ensinar uma resposta' : 'Registrar dúvida'}
            </button>}
            <button className="button secondary" type="button" onClick={onRefresh}><RefreshCw size={17} /> Atualizar</button>
          </div>
        </div>
        <div className="isa-hero-stage" aria-hidden="true">
          <div className="isa-bubble b1">Oi! Eu sou a Isa 👋</div>
          <div className="isa-bubble b2">Já sei responder <b>{knowledge.length}</b> perguntas</div>
          <div className={`isa-bubble b3${unanswered.length ? ' alert' : ''}`}>
            {unanswered.length ? <>Me ensina <b>{unanswered.length}</b> {unanswered.length === 1 ? 'dúvida' : 'dúvidas'}? 🙏</> : <>Tudo respondido! ✨</>}</div>
          <div className="isa-bubble b4 typing"><i /><i /><i /></div>
          <span className="isa-spark s1">✦</span><span className="isa-spark s2">✦</span><span className="isa-spark s3">✦</span>
          <img src="/isa-sentada.webp" alt="" className="isa-hero-img" />
        </div>
      </section>

      <section className="panel ai-workspace">
        <div className="ai-navigation">
          <div className="ai-tabs" aria-label="Áreas do contexto da IA">
            <button type="button" className={tab === 'knowledge' ? 'active' : ''} aria-pressed={tab === 'knowledge'} onClick={() => switchTab('knowledge')}>
              Perguntas e respostas <span>{knowledge.length}</span>
            </button>
            <button type="button" className={tab === 'unanswered' ? 'active' : ''} aria-pressed={tab === 'unanswered'} onClick={() => switchTab('unanswered')}>
              Dúvidas sem resposta <span>{unanswered.length}</span>
            </button>
            <button type="button" className={tab === 'alerts' ? 'active' : ''} aria-pressed={tab === 'alerts'} onClick={() => switchTab('alerts')}>
              Avisos
            </button>
          </div>
          {tab !== 'alerts' && <div className="search-field">
            <Search size={18} />
            <input
              aria-label={tab === 'knowledge' ? 'Buscar no contexto' : 'Buscar dúvidas'}
              placeholder={tab === 'knowledge' ? 'Buscar perguntas ou respostas' : 'Buscar dúvidas dos clientes'}
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
          </div>}
        </div>
        {error && !editor && <div className="form-error ai-page-error" role="alert">{error}</div>}
        {tab === 'knowledge' && (knowledge.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="Nenhuma resposta cadastrada"
            text="Adicione a primeira pergunta e resposta ao contexto da IA."
            action={{ label: 'Adicionar resposta', onClick: () => openEditor({ kind: 'knowledge' }) }}
          />
        ) : visibleKnowledge.length === 0 ? (
          <EmptyState icon={Search} title="Nenhum resultado" text="Tente buscar por outra pergunta ou resposta." />
        ) : (
          <div className="ai-entry-list">
            {visibleKnowledge.map(entry => (
              <article className="ai-entry" key={entry.id}>
                <div className="ai-entry-meta">
                  <span>PERGUNTA</span>
                  <small>Atualizada em {dateLabel(entry.updatedAt)} · {entry.status === 'INDEXED' ? 'Disponível para a IA' : entry.status === 'FAILED' ? 'Falha na indexação' : 'Indexando'}</small>
                </div>
                <h3>{entry.question}</h3>
                <p className="ai-entry-plain">{entry.answer}</p>
                {/* No computador: a orientação para a Isa de um lado e o exemplo de mensagem, como no WhatsApp, do outro. */}
                <AnswerView answer={entry.answer} busy={busy}
                  onSave={async answer => {
                    setBusy(true)
                    setError('')
                    try { await onUpdateKnowledge(entry.id, { question: entry.question, answer }); return true }
                    catch (cause) { setError(getMessage(cause)); return false }
                    finally { setBusy(false) }
                  }}
                  onRemove={() => void remove(entry)} />
                <div className="ai-entry-actions">
                  <button type="button" className="button secondary admin-only" disabled={busy} onClick={() => openEditor({ kind: 'knowledge', entry })}>
                    <Pencil size={15} /> Editar
                  </button>
                  <button type="button" className="ai-remove admin-only" disabled={busy} onClick={() => void remove(entry)}>
                    <Trash2 size={15} /> Remover
                  </button>
                </div>
              </article>
            ))}
          </div>
        ))}
        {tab === 'unanswered' && (unanswered.length === 0 ? (
          <EmptyState icon={MessageCircle} title="Nenhuma dúvida pendente" text="Registre uma pergunta para acompanhá-la até ser respondida ou excluída." />
        ) : visibleUnanswered.length === 0 ? (
          <EmptyState icon={Search} title="Nenhum resultado" text="Tente buscar por outra pergunta." />
        ) : (
          <div className="ai-entry-list">
            {visibleUnanswered.map(entry => (
              <article className="ai-entry ai-pending" key={entry.id}>
                <div className="ai-entry-meta">
                  <span>DÚVIDA DO CLIENTE</span>
                  <small>Última vez em {dateLabel(entry.lastAskedAt)}</small>
                </div>
                <h3>{entry.question}</h3>
                <div className="ai-entry-actions">
                  <span className="ai-occurrences">{entry.occurrences} {entry.occurrences === 1 ? 'ocorrência' : 'ocorrências'}</span>
                  <button type="button" className="button primary admin-only" disabled={busy} onClick={() => openEditor({ kind: 'answer', pending: entry })}>
                    Responder e adicionar ao contexto
                  </button>
                  <button type="button" className="ai-remove admin-only" disabled={busy} onClick={() => void removeUnanswered(entry)}>
                    <Trash2 size={15} /> Excluir
                  </button>
                </div>
              </article>
            ))}
          </div>
        ))}
        {tab === 'alerts' && alerts}
      </section>

      {editor && (
        <AiEditorModal
          key={editor.kind === 'answer' ? editor.pending.id : editor.kind === 'knowledge' ? editor.entry?.id ?? 'new' : 'unanswered'}
          editor={editor}
          busy={busy}
          error={error}
          onClose={() => setEditor(null)}
          onSave={(question, answer) => void save(question, answer)}
        />
      )}
    </>
  )
}

/** Separa a orientação ("como responder") do exemplo de mensagem ("Modelo/Exemplo de resposta:"). */
function AnswerView({ answer, busy, onSave, onRemove }: {
  answer: string; busy: boolean; onSave: (answer: string) => Promise<boolean>; onRemove: () => void
}) {
  const match = /(modelo|exemplo)s? de resposta\s*:?/i.exec(answer)
  const guide = (match ? answer.slice(0, match.index) : answer).trim()
  const sample = match ? answer.slice(match.index + match[0].length).trim() : ''
  const label = match ? match[0].trim().replace(/:?$/, ':') : 'Modelo de resposta:'
  const [editing, setEditing] = useState(false)
  const [guideDraft, setGuideDraft] = useState(guide)
  const [sampleDraft, setSampleDraft] = useState(sample)

  function start() {
    setGuideDraft(guide)
    setSampleDraft(sample)
    setEditing(true)
  }

  async function save() {
    const text = sampleDraft.trim() ? `${guideDraft.trim()} ${label}\n\n${sampleDraft.trim()}` : guideDraft.trim()
    if (!text) return
    if (await onSave(text)) setEditing(false)
  }

  return <div className={`ai-answer${sample || editing ? ' with-sample' : ''}${editing ? ' editing' : ''}`}>
    <div className="ai-answer-side">
      <div className="ai-answer-guide">
        <span className="ai-answer-label">🧭 Como a Isa deve responder</span>
        {editing ? <textarea value={guideDraft} onChange={event => setGuideDraft(event.target.value)} rows={7} maxLength={4000}
          aria-label="Como a Isa deve responder" /> : <p>{guide}</p>}
      </div>
      {/* Editar e Remover no espaço branco embaixo da orientação; Editar abre a edição aqui mesmo, sem janela. */}
      <div className="ai-answer-buttons admin-only">
        {editing ? <>
          <button type="button" className="button primary" disabled={busy || !guideDraft.trim()} onClick={() => void save()}>
            <Check size={16} /> {busy ? 'Salvando...' : 'Salvar'}</button>
          <button type="button" className="button secondary" disabled={busy} onClick={() => setEditing(false)}>Cancelar</button>
        </> : <>
          <button type="button" className="button secondary" disabled={busy} onClick={start}><Pencil size={16} /> Editar</button>
          <button type="button" className="ai-remove" disabled={busy} onClick={onRemove}><Trash2 size={15} /> Remover</button>
        </>}
      </div>
    </div>
    {(sample || editing) && <div className="ai-answer-sample">
      <span className="ai-answer-label">💬 Exemplo de mensagem da Isa{editing ? ' (edite direto no balão)' : ''}</span>
      <div className="ai-answer-bubble"><span className="ai-answer-author">Isa (assistente)</span>
        {editing ? <textarea value={sampleDraft} onChange={event => setSampleDraft(event.target.value)} rows={12} maxLength={4000}
          aria-label="Exemplo de mensagem da Isa" placeholder="Escreva como a Isa responde ao cliente. Use *negrito* como no WhatsApp." />
          : <WhatsAppText text={sample} />}</div>
    </div>}
  </div>
}
