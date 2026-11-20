import { useState, type FormEvent } from 'react'
import { ArrowRight, PlusCircle, X } from 'lucide-react'
import { FormIntro } from '../../components/FormIntro'
import type { Branch, Chair, ChairStatus } from '../../api'
import { branchLabel, onlyOfficialBranches } from '../../utils/branches'

export function ChairModal({
  modal,
  branches,
  saving,
  error,
  onClose,
  onChairSave,
  onDelete,
}: {
  modal: { kind: 'newChair'; branchId?: string } | { kind: 'editChair'; chair: Chair }
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
  /** Excluir poltrona: fica Inativa com o motivo registrado na observação. */
  onDelete?: (chair: Chair, reason: string) => Promise<void>
}) {
  const chair = modal.kind === 'editChair' ? modal.chair : null
  const [code, setCode] = useState(chair?.code ?? '')
  const [model, setModel] = useState(chair?.model ?? '')
  const [notes, setNotes] = useState(chair?.notes ?? '')
  const [status, setStatus] = useState<ChairStatus>(chair?.status ?? 'ACTIVE')
  // Nova poltrona aberta de dentro da filial: a filial já vem escolhida e não aparece o seletor.
  const fixedBranch = modal.kind === 'newChair' && modal.branchId ? branches.find(branch => branch.id === modal.branchId) : undefined
  // Poltrona ligada a uma filial antiga (ex.: Região de Sobral, juntada à Ibiapaba) abre na filial ativa da mesma região.
  const [branchId, setBranchId] = useState(() => {
    const current = chair?.branchId ?? fixedBranch?.id ?? ''
    const shown = onlyOfficialBranches(branches, branch => branch.name)
    if (!current || shown.some(branch => branch.id === current)) return current
    const old = branches.find(branch => branch.id === current)
    return old ? shown.find(branch => branchLabel(branch.name) === branchLabel(old.name))?.id ?? current : current
  })
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
      <section className="modal chair-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        {/* Foto da poltrona (a mesma do app) ao lado do formulário, com o código e a situação. */}
        <div className="chair-modal-photo" aria-hidden="true">
          <img src="/poltrona.webp" alt="" />
          <div><strong>{chair ? `Poltrona ${code}` : code.trim() ? `Poltrona ${code.trim()}` : 'Nova poltrona'}</strong>
            <span className={`chair-modal-pill ${status.toLowerCase()}`}>{status === 'ACTIVE' ? 'Ativa' : status === 'MAINTENANCE' ? 'Em manutenção' : 'Inativa'}</span></div>
        </div>
        <div className="chair-modal-main">
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
          {!chair && <FormIntro icon={<PlusCircle size={24} />} title="Nova poltrona">
            {fixedBranch ? <>Informe o código e o modelo. Ela entra nesta filial e, ativa, já pode ser alugada no site e no WhatsApp.</>
              : 'Informe o código e a filial. Ativa, ela já pode ser alugada no site e no WhatsApp.'}</FormIntro>}
          <>
            {/* Campos em pares (código e modelo; filial e situação) para a janela caber sem rolar. */}
            <div className="chair-modal-row">
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
            </div>
            <div className="chair-modal-row">
            {fixedBranch ? <p className="chair-fixed-branch"><span>Filial</span><strong>{branchLabel(fixedBranch.name)}</strong></p> : <label>
              Filial
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)} required>
                <option value="">Selecione uma filial</option>
                {/* Uma filial por região (a antiga Região de Sobral, juntada à Ibiapaba, não aparece). */}
                {onlyOfficialBranches(branches, (branch) => branch.name).map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branchLabel(branch.name)}
                    {!branch.active ? ' (inativa)' : ''}
                  </option>
                ))}
              </select>
            </label>}
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
            </div>
            <label>
              <span>Observações <span className="optional">(opcional)</span></span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
                rows={2}
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
            {chair && onDelete && <button type="button" className="button chair-delete" disabled={saving}
              onClick={() => {
                const reason = window.prompt(`Excluir a poltrona ${chair.code}? Ela sai do site e do WhatsApp e fica como Inativa, com o motivo registrado na observação.\n\nMotivo da exclusão:`)
                if (reason && reason.trim().length >= 3) void onDelete(chair, reason)
                else if (reason !== null) window.alert('Informe o motivo da exclusão (pelo menos 3 letras).')
              }}>
              Excluir poltrona</button>}
            <button type="button" className="button secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="button primary" disabled={saving}>
              {saving ? 'Salvando...' : chair ? 'Salvar alterações' : 'Cadastrar poltrona'}{' '}
              <ArrowRight size={17} />
            </button>
          </div>
        </form>
        </div>
      </section>
    </div>
  )
}
