import { useState } from 'react'
import { BookOpen, MessageCircle, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import type { AiKnowledge, AiKnowledgeInput, AiUnansweredQuestion } from '../../api'
import { EmptyState } from '../../components/common'
import { getMessage } from '../../utils/errors'
import { AiEditorModal, type AiEditor } from './AiEditorModal'

type Props = {
  knowledge: AiKnowledge[]
  unanswered: AiUnansweredQuestion[]
  onCreateKnowledge: (data: AiKnowledgeInput) => Promise<void>
  onUpdateKnowledge: (id: string, data: AiKnowledgeInput) => Promise<void>
  onDeleteKnowledge: (id: string) => Promise<void>
  onRecordUnanswered: (question: string) => Promise<void>
  onAnswerUnanswered: (id: string, answer: string) => Promise<void>
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value),
  )
}

function matches(text: string, search: string) {
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
  return normalize(text).includes(normalize(search.trim()))
}

export function AiContextPage({
  knowledge,
  unanswered,
  onCreateKnowledge,
  onUpdateKnowledge,
  onDeleteKnowledge,
  onRecordUnanswered,
  onAnswerUnanswered,
}: Props) {
  const [tab, setTab] = useState<'knowledge' | 'unanswered'>('knowledge')
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<AiEditor | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const visibleKnowledge = knowledge.filter((entry) =>
    matches(`${entry.question} ${entry.answer}`, search),
  )
  const visibleUnanswered = unanswered.filter((entry) => matches(entry.question, search))

  function switchTab(next: 'knowledge' | 'unanswered') {
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
      } else if (editor.entry) {
        await onUpdateKnowledge(editor.entry.id, { question, answer })
      } else {
        await onCreateKnowledge({ question, answer })
      }
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

  return (
    <>
      <div className="page-heading with-action ai-page-heading">
        <div>
          <span className="eyebrow">ATENDIMENTO • PÓS LEVE</span>
          <h1>Contexto da IA</h1>
          <p>
            Cadastre respostas para clientes e resolva as perguntas que a IA não soube responder.
          </p>
        </div>
        <button
          className="button primary"
          onClick={() =>
            openEditor(tab === 'knowledge' ? { kind: 'knowledge' } : { kind: 'unanswered' })
          }
        >
          <Plus size={18} /> {tab === 'knowledge' ? 'Nova pergunta e resposta' : 'Registrar dúvida'}
        </button>
      </div>

      <div className="ai-summary">
        <div className="panel">
          <BookOpen size={21} />
          <span>
            <small>Respostas no contexto</small>
            <strong>{knowledge.length}</strong>
          </span>
        </div>
        <div className="panel">
          <MessageCircle size={21} />
          <span>
            <small>Dúvidas sem resposta</small>
            <strong>{unanswered.length}</strong>
          </span>
        </div>
      </div>

      <section className="panel ai-workspace">
        <div className="ai-navigation">
          <div className="ai-tabs" aria-label="Áreas do contexto da IA">
            <button
              type="button"
              className={tab === 'knowledge' ? 'active' : ''}
              aria-pressed={tab === 'knowledge'}
              onClick={() => switchTab('knowledge')}
            >
              Perguntas e respostas <span>{knowledge.length}</span>
            </button>
            <button
              type="button"
              className={tab === 'unanswered' ? 'active' : ''}
              aria-pressed={tab === 'unanswered'}
              onClick={() => switchTab('unanswered')}
            >
              Dúvidas sem resposta <span>{unanswered.length}</span>
            </button>
          </div>
          <div className="search-field">
            <Search size={18} />
            <input
              aria-label={tab === 'knowledge' ? 'Buscar no contexto' : 'Buscar dúvidas'}
              placeholder={
                tab === 'knowledge'
                  ? 'Buscar perguntas ou respostas'
                  : 'Buscar dúvidas dos clientes'
              }
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
        {error && !editor && (
          <div className="form-error ai-page-error" role="alert">
            {error}
          </div>
        )}

        {tab === 'knowledge' &&
          (knowledge.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="Nenhuma resposta cadastrada"
              text="Adicione a primeira pergunta e resposta ao contexto da IA."
              action={{
                label: 'Adicionar resposta',
                onClick: () => openEditor({ kind: 'knowledge' }),
              }}
            />
          ) : visibleKnowledge.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Nenhum resultado"
              text="Tente buscar por outra pergunta ou resposta."
            />
          ) : (
            <div className="ai-entry-list">
              {visibleKnowledge.map((entry) => (
                <article className="ai-entry" key={entry.id}>
                  <div className="ai-entry-meta">
                    <span>PERGUNTA</span>
                    <small>Atualizada em {dateLabel(entry.updatedAt)}</small>
                  </div>
                  <h3>{entry.question}</h3>
                  <p>{entry.answer}</p>
                  <div className="ai-entry-actions">
                    <button
                      type="button"
                      className="button secondary"
                      disabled={busy}
                      onClick={() => openEditor({ kind: 'knowledge', entry })}
                    >
                      <Pencil size={15} /> Editar
                    </button>
                    <button
                      type="button"
                      className="ai-remove"
                      disabled={busy}
                      onClick={() => void remove(entry)}
                    >
                      <Trash2 size={15} /> Remover
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ))}

        {tab === 'unanswered' &&
          (unanswered.length === 0 ? (
            <EmptyState
              icon={MessageCircle}
              title="Nenhuma dúvida pendente"
              text="As perguntas que a IA não souber responder aparecerão aqui. Você também pode registrar uma dúvida manualmente."
            />
          ) : visibleUnanswered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Nenhum resultado"
              text="Tente buscar por outra pergunta."
            />
          ) : (
            <div className="ai-entry-list">
              {visibleUnanswered.map((entry) => (
                <article className="ai-entry ai-pending" key={entry.id}>
                  <div className="ai-entry-meta">
                    <span>DÚVIDA DO CLIENTE</span>
                    <small>Última vez em {dateLabel(entry.lastAskedAt)}</small>
                  </div>
                  <h3>{entry.question}</h3>
                  <div className="ai-entry-actions">
                    <span className="ai-occurrences">
                      {entry.occurrences} {entry.occurrences === 1 ? 'ocorrência' : 'ocorrências'}
                    </span>
                    <button
                      type="button"
                      className="button primary"
                      disabled={busy}
                      onClick={() => openEditor({ kind: 'answer', pending: entry })}
                    >
                      Responder e adicionar ao contexto
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ))}
      </section>

      {editor && (
        <AiEditorModal
          key={
            editor.kind === 'knowledge'
              ? (editor.entry?.id ?? 'new')
              : editor.kind === 'answer'
                ? editor.pending.id
                : 'unanswered'
          }
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
