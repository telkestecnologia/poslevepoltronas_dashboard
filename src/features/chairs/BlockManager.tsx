import { useState, type FormEvent } from 'react'
import type { ChairOption, ManualBlock } from '../../api'
import { getMessage } from '../../utils/errors'

export function BlockManager({
  chairs,
  blocks,
  onCreate,
  onDelete,
}: {
  chairs: ChairOption[]
  blocks: ManualBlock[]
  onCreate: (data: { chairId: string; start: string; end: string; reason: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [chairId, setChairId] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onCreate({ chairId, start, end, reason: reason.trim() })
      setStart('')
      setEnd('')
      setReason('')
    } catch (failure) {
      setError(getMessage(failure))
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setBusy(true)
    setError('')
    try {
      await onDelete(id)
    } catch (failure) {
      setError(getMessage(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel block-panel">
      <h2>Bloqueios por período</h2>
      <p>Registre aluguéis já combinados fora do site, manutenção ou transporte.</p>
      <form onSubmit={submit} className="block-form">
        <label>
          Poltrona
          <select value={chairId} onChange={(event) => setChairId(event.target.value)} required>
            <option value="">Selecione</option>
            {chairs.map((chair) => (
              <option key={chair.id} value={chair.id}>
                {chair.code} · {chair.model}
              </option>
            ))}
          </select>
        </label>
        <label>
          Início
          <input
            type="date"
            value={start}
            onChange={(event) => setStart(event.target.value)}
            required
          />
        </label>
        <label>
          Fim
          <input
            type="date"
            value={end}
            min={start}
            onChange={(event) => setEnd(event.target.value)}
            required
          />
        </label>
        <label>
          Motivo
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={200}
            placeholder="Ex.: aluguel por WhatsApp"
            required
          />
        </label>
        <button className="button primary" disabled={busy || chairs.length === 0} type="submit">
          Bloquear período
        </button>
      </form>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {blocks.length > 0 && (
        <div className="block-list">
          {blocks.map((block) => (
            <div key={block.id}>
              <span>
                <strong>
                  {chairs.find((chair) => chair.id === block.chairId)?.code ?? 'Poltrona removida'}
                </strong>{' '}
                · {block.start} a {block.end} · {block.reason}
              </span>
              <button
                className="table-action"
                type="button"
                disabled={busy}
                onClick={() => void remove(block.id)}
              >
                Remover
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
