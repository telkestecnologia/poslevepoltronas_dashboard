import { useRef, useState, type FormEvent } from 'react'
import { ArrowRight, Plus, X } from 'lucide-react'
import type { Branch, BranchInput, Municipality } from '../../api'

export function BranchModal({
  modal,
  municipalities,
  saving,
  error,
  onClose,
  onSave,
}: {
  modal: { kind: 'newBranch' } | { kind: 'editBranch'; branch: Branch }
  municipalities: Municipality[]
  saving: boolean
  error: string
  onClose: () => void
  onSave: (data: BranchInput) => Promise<void>
}) {
  const branch = modal.kind === 'editBranch' ? modal.branch : null
  const [name, setName] = useState(branch?.name ?? '')
  const [areas, setAreas] = useState<{ code: string; freight: string }[]>(
    branch?.municipalities.map((city) => ({
      code: city.code,
      freight: (city.freightCents / 100).toFixed(2).replace('.', ','),
    })) ?? [],
  )
  const [uf, setUf] = useState(branch?.municipalities[0]?.uf ?? 'CE')
  const [search, setSearch] = useState('')
  const [active, setActive] = useState(branch?.active ?? true)
  const [localError, setLocalError] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const normalizedSearch = search
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
  const available = municipalities.filter(
    (city) =>
      city.uf === uf &&
      !areas.some((area) => area.code === city.code) &&
      (city.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('pt-BR')
        .includes(normalizedSearch) ||
        city.code.includes(normalizedSearch)),
  )

  function addMunicipality(code: string) {
    setAreas((current) =>
      current.some((area) => area.code === code) ? current : [...current, { code, freight: '' }],
    )
    setSearch('')
    setLocalError('')
    searchRef.current?.focus()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (areas.length === 0) {
      setLocalError('Selecione pelo menos um município do catálogo.')
      return
    }
    const priced: BranchInput['municipalities'] = []
    for (const area of areas) {
      const input = area.freight.trim()
      if (!/^\d+(,\d{1,2})?$/.test(input)) {
        setLocalError('Informe um frete válido em reais para cada município (ex.: 120,00).')
        return
      }
      const [reais, centavos = ''] = input.split(',')
      const freightCents = Number(reais) * 100 + Number(centavos.padEnd(2, '0'))
      if (!Number.isSafeInteger(freightCents) || freightCents > 2147483647) {
        setLocalError('Informe um frete válido em reais para cada município (ex.: 120,00).')
        return
      }
      priced.push({ code: area.code, freightCents })
    }
    setLocalError('')
    void onSave({ name: name.trim(), municipalities: priced, active })
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="branch-modal-title"
      >
        <div className="modal-head">
          <div>
            <span className="eyebrow">PÓS LEVE • FILIAIS</span>
            <h2 id="branch-modal-title">{branch ? 'Editar filial' : 'Nova filial'}</h2>
          </div>
          <button className="icon-button" aria-label="Fechar" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={submit} className="modal-form">
          <label>
            Nome da filial
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              placeholder="Ex.: Serra da Ibiapaba"
              required
              autoFocus
            />
          </label>
          <div className="municipality-picker">
            <strong>Municípios atendidos</strong>
            <div className="municipality-picker-row">
              <label>
                UF
                <select
                  value={uf}
                  onChange={(event) => {
                    setUf(event.target.value)
                    setSearch('')
                  }}
                >
                  {[...new Set(municipalities.map((city) => city.uf))].sort().map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Buscar município
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      if (normalizedSearch && available.length > 0)
                        addMunicipality(available[0].code)
                    }
                  }}
                  placeholder="Digite o nome ou código IBGE"
                />
              </label>
            </div>
            <div className="municipality-results" role="region" aria-label="Municípios encontrados">
              {available.length > 0 ? (
                <ul>
                  {available.map((city) => (
                    <li key={city.code}>
                      <button
                        type="button"
                        onClick={() => addMunicipality(city.code)}
                        aria-label={`Adicionar ${city.name}, ${city.uf}`}
                      >
                        <span>
                          {city.name} <small>– {city.uf}</small>
                        </span>
                        <Plus size={16} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Nenhum município encontrado nesta UF.</p>
              )}
            </div>
            {areas.length > 0 && (
              <div className="municipality-selected">
                <strong>Frete de entrega por município</strong>
                {areas.map((area) => {
                  const city = municipalities.find((item) => item.code === area.code)
                  return (
                    <div className="municipality-fee" key={area.code}>
                      <span>{city ? `${city.name} – ${city.uf}` : area.code}</span>
                      <label>
                        R${' '}
                        <input
                          type="text"
                          inputMode="decimal"
                          value={area.freight}
                          onChange={(event) =>
                            setAreas((current) =>
                              current.map((item) =>
                                item.code === area.code
                                  ? { ...item, freight: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder="120,00"
                          aria-label={`Frete para ${city?.name ?? area.code} em reais`}
                          required
                        />
                      </label>
                      <button
                        type="button"
                        aria-label={`Remover ${city?.name ?? area.code}`}
                        onClick={() =>
                          setAreas((current) => current.filter((item) => item.code !== area.code))
                        }
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            <small className="field-help">
              A cobertura inclui todos os CEPs dos municípios escolhidos, inclusive zona rural. Use
              0,00 para frete grátis.
            </small>
          </div>
          <label className="branch-option">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
            />
            <span>Filial ativa</span>
          </label>
          {(localError || error) && (
            <div className="form-error" role="alert">
              {localError || error}
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="button secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="button primary" disabled={saving}>
              {saving ? 'Salvando...' : branch ? 'Salvar alterações' : 'Criar filial'}{' '}
              <ArrowRight size={17} />
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
