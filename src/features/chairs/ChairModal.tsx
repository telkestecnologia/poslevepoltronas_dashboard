import { useState, type FormEvent } from 'react'
import { ArrowRight, X } from 'lucide-react'
import type { Branch, Chair, ChairStatus } from '../../api'

export function ChairModal({
  modal,
  branches,
  saving,
  error,
  onClose,
  onChairSave,
}: {
  modal: { kind: 'newChair' } | { kind: 'editChair'; chair: Chair }
  branches: Branch[]
  saving: boolean
  error: string
  onClose: () => void
  onChairSave: (data: {
    code: string
    model: string
    notes: string
    status: ChairStatus
    branchId: string
  }) => Promise<void>
}) {
  const chair = modal.kind === 'editChair' ? modal.chair : null
  const [code, setCode] = useState(chair?.code ?? '')
  const [model, setModel] = useState(chair?.model ?? '')
  const [notes, setNotes] = useState(chair?.notes ?? '')
  const [status, setStatus] = useState<ChairStatus>(chair?.status ?? 'ACTIVE')
  const [branchId, setBranchId] = useState(chair?.branchId ?? '')
  const title = chair ? 'Editar poltrona' : 'Nova poltrona'

  function submit(event: FormEvent) {
    event.preventDefault()
    void onChairSave({
      code: code.trim(),
      model: model.trim(),
      notes: notes.trim(),
      status,
      branchId,
    })
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-head">
          <div>
            <span className="eyebrow">PÓS LEVE • ADMINISTRAÇÃO</span>
            <h2 id="modal-title">{title}</h2>
          </div>
          <button className="icon-button" aria-label="Fechar" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={submit} className="modal-form">
          <>
            <label>
              Código da poltrona
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={32}
                placeholder="Ex.: PL-001"
                required
                disabled={Boolean(chair)}
                autoFocus={!chair}
              />
            </label>
            <label>
              Modelo
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                maxLength={120}
                placeholder="Ex.: Poltrona Power Lift"
                required
                autoFocus={Boolean(chair)}
              />
            </label>
            <label>
              Filial
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)} required>
                <option value="">Selecione uma filial</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                    {!branch.active ? ' (inativa)' : ''}
                  </option>
                ))}
              </select>
            </label>
            {chair && (
              <label>
                Estado operacional
                <select value={status} onChange={(e) => setStatus(e.target.value as ChairStatus)}>
                  <option value="ACTIVE">Ativa</option>
                  <option value="MAINTENANCE">Em manutenção</option>
                  <option value="INACTIVE">Inativa</option>
                </select>
              </label>
            )}
            <label>
              Observações <span className="optional">(opcional)</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Informações úteis sobre o equipamento"
              />
            </label>
          </>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="button secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="button primary" disabled={saving}>
              {saving ? 'Salvando...' : chair ? 'Salvar alterações' : 'Cadastrar poltrona'}{' '}
              <ArrowRight size={17} />
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
