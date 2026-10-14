import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import type { AiKnowledge, AiUnansweredQuestion } from '../../api'

export type AiEditor =
  | { kind: 'knowledge'; entry?: AiKnowledge }
  | { kind: 'unanswered' }
  | { kind: 'answer'; pending: AiUnansweredQuestion }

type Props = {
  editor: AiEditor
  busy: boolean
  error: string
  onClose: () => void
  onSave: (question: string, answer: string) => void
}

export function AiEditorModal({ editor, busy, error, onClose, onSave }: Props) {
  const [question, setQuestion] = useState(
    editor.kind === 'knowledge'
      ? (editor.entry?.question ?? '')
      : editor.kind === 'answer'
        ? editor.pending.question
        : '',
  )
  const [answer, setAnswer] = useState(
    editor.kind === 'knowledge' ? (editor.entry?.answer ?? '') : '',
  )

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const title =
    editor.kind === 'answer'
      ? 'Responder dúvida'
      : editor.kind === 'unanswered'
        ? 'Registrar dúvida'
        : editor.entry
          ? 'Editar resposta'
          : 'Nova pergunta e resposta'

  function submit(event: FormEvent) {
    event.preventDefault()
    onSave(question.trim(), answer.trim())
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <section
        className="modal ai-editor-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-editor-title"
      >
        <div className="modal-head">
          <div>
            <span className="eyebrow">CONTEXTO DA IA</span>
            <h2 id="ai-editor-title">{title}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Fechar"
            disabled={busy}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <form className="modal-form" onSubmit={submit}>
          {editor.kind === 'answer' ? (
            <div className="ai-editor-question">
              <small>PERGUNTA DO CLIENTE</small>
              <strong>{editor.pending.question}</strong>
            </div>
          ) : (
            <label>
              Pergunta
              <textarea
                autoFocus
                required
                maxLength={500}
                rows={3}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder={
                  editor.kind === 'unanswered'
                    ? 'O que o cliente perguntou?'
                    : 'Ex.: Como funciona a entrega?'
                }
              />
            </label>
          )}
          {editor.kind !== 'unanswered' && (
            <label>
              Resposta
              <textarea
                autoFocus={editor.kind === 'answer'}
                required
                maxLength={5000}
                rows={6}
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder="Escreva a resposta que a IA poderá usar com os clientes."
              />
            </label>
          )}
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <div className="modal-actions">
            <button className="button secondary" type="button" disabled={busy} onClick={onClose}>
              Cancelar
            </button>
            <button className="button primary" disabled={busy} type="submit">
              {busy
                ? 'Salvando...'
                : editor.kind === 'unanswered'
                  ? 'Registrar dúvida'
                  : 'Salvar resposta'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
