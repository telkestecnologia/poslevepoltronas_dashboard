import { useRef, useState, type FormEvent } from 'react'
import { ArrowRight, Plus, Store, X } from 'lucide-react'
import { FormIntro } from '../../components/FormIntro'
import type { Branch, BranchInput, Municipality } from '../../api'

type Area = { code: string; freight: string; free: boolean; districts: { name: string; freight: string }[] }
const reaisText = (cents: number) => (cents / 100).toFixed(2).replace('.', ',')
/** "120" ou "120,50" em centavos; null se não for um valor válido. */
function toCents(text: string) {
  const input = text.trim()
  if (!/^\d+(,\d{1,2})?$/.test(input)) return null
  const [reais, centavos = ''] = input.split(',')
  const cents = Number(reais) * 100 + Number(centavos.padEnd(2, '0'))
  return Number.isSafeInteger(cents) && cents <= 2147483647 ? cents : null
}

export function BranchModal({
  modal,
  municipalities,
  saving,
  error,
  onClose,
  onSave,
  inline,
}: {
  modal: { kind: 'newBranch' } | { kind: 'editBranch'; branch: Branch }
  municipalities: Municipality[]
  saving: boolean
  error: string
  onClose: () => void
  onSave: (data: BranchInput) => Promise<void>
  /** Dentro da página da filial: o formulário aparece direto, sem a janela por cima. */
  inline?: boolean
}) {
  const branch = modal.kind === 'editBranch' ? modal.branch : null
  const [name, setName] = useState(branch?.name ?? '')
  // free: frete grátis nesta cidade (o preço fica desligado e vai como R$ 0,00). O frete grátis da filial inteira
  // (o antigo) aparece como grátis em todas as cidades dela.
  // districts: bairros com frete próprio da cidade (os outros bairros usam o frete da cidade).
  const [areas, setAreas] = useState<Area[]>(
    branch?.municipalities.map((city) => ({
      code: city.code,
      freight: reaisText(city.freightCents),
      free: branch.freeShipping || city.freightCents === 0,
      districts: (city.districts ?? []).map(item => ({ name: item.name, freight: reaisText(item.freightCents) })),
    })) ?? [],
  )
  const editDistricts = (code: string, change: (list: Area['districts']) => Area['districts']) =>
    setAreas(current => current.map(item => item.code === code ? { ...item, districts: change(item.districts) } : item))
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
      current.some((area) => area.code === code) ? current : [...current, { code, freight: '', free: false, districts: [] }],
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
      const districts: { name: string; freightCents: number }[] = []
      for (const item of area.districts) {
        if (!item.name.trim() && !item.freight.trim()) continue
        const cents = toCents(item.freight)
        if (!item.name.trim() || cents === null) {
          setLocalError('Informe o nome e um frete válido para cada bairro (ex.: Aldeota, 60,00).')
          return
        }
        districts.push({ name: item.name.trim(), freightCents: cents })
      }
      if (area.free) { priced.push({ code: area.code, freightCents: 0, districts }); continue }
      const freightCents = toCents(area.freight)
      if (freightCents === null) {
        setLocalError('Informe um frete válido em reais para cada município (ex.: 120,00).')
        return
      }
      priced.push({ code: area.code, freightCents, districts })
    }
    setLocalError('')
    void onSave({ name: name.trim(), municipalities: priced, active })
  }

  const form = (
        <form onSubmit={submit} className="modal-form">
          {!inline && !branch && <FormIntro icon={<Store size={24} />} title="Nova filial">
            Dê um nome à filial e escolha as cidades que ela atende, com o valor do frete.</FormIntro>}
          {/* Na página da filial fica só o Atendendo; no cadastro aparece o nome. */}
          {!inline && (
          <label>
            Nome da filial
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              placeholder="Ex.: Serra da Ibiapaba"
              required
              autoFocus={!inline}
            />
          </label>
          )}
          {/* Na página da filial, cidades e frete abre e fecha (começa fechado). */}
          <details className="municipality-picker" open={!inline}>
            <summary><strong>Cidades atendidas e frete ({areas.length})</strong></summary>
            {/* No computador: dois passos lado a lado (adicionar cidades | frete de cada uma). No celular fica como antes. */}
            <div className="mp-body">
            <div className="mp-add">
            <div className="mp-step"><b>1</b><div><strong>Adicione as cidades</strong><small>Escolha o estado, busque e clique no + para incluir.</small></div></div>
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
            </div>
            <div className="mp-fees">
            <div className="mp-step"><b>2</b><div><strong>Frete de cada cidade ({areas.length})</strong><small>Digite o valor da entrega ou marque Frete grátis.</small></div></div>
            {areas.length === 0 && <p className="mp-empty">Nenhuma cidade ainda. Adicione no passo 1.</p>}
            {areas.length > 0 && (
              <div className="municipality-selected">
                <strong>Frete de entrega por município</strong>
                {areas.map((area) => {
                  // Nome pelo catálogo; se ele ainda não carregou, pelo que já vem na própria filial.
                  const city = municipalities.find((item) => item.code === area.code)
                    ?? branch?.municipalities.find((item) => item.code === area.code)
                  return (
                    <div className="municipality-fee" key={area.code}>
                      <span>{city ? `${city.name} – ${city.uf}` : area.code}</span>
                      <label>
                        R${' '}
                        <input
                          type="text"
                          inputMode="decimal"
                          value={area.free ? '0,00' : area.freight}
                          disabled={area.free}
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
                          required={!area.free}
                        />
                      </label>
                      {/* Frete grátis nesta cidade: o preço fica desligado. */}
                      <label className="municipality-free">
                        <input type="checkbox" checked={area.free}
                          onChange={(event) => setAreas((current) => current.map((item) =>
                            item.code === area.code ? { ...item, free: event.target.checked } : item))} />
                        Frete grátis
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
                      {/* Bairros com frete diferente do valor da cidade (ex.: Fortaleza). */}
                      <details className="district-fees">
                        <summary>Frete por bairro{area.districts.length ? ` (${area.districts.length})` : ''}</summary>
                        <p className="district-help">Os bairros que não estiverem aqui pagam o frete da cidade.</p>
                        {area.districts.map((item, index) => <div className="district-fee" key={index}>
                          <input value={item.name} maxLength={80} placeholder="Bairro (ex.: Aldeota)" aria-label="Nome do bairro"
                            onChange={event => editDistricts(area.code, list => list.map((row, at) => at === index ? { ...row, name: event.target.value } : row))} />
                          <label>R$ <input inputMode="decimal" value={item.freight} placeholder="60,00" aria-label={`Frete do bairro ${item.name}`}
                            onChange={event => editDistricts(area.code, list => list.map((row, at) => at === index ? { ...row, freight: event.target.value } : row))} /></label>
                          <button type="button" aria-label={`Remover bairro ${item.name}`}
                            onClick={() => editDistricts(area.code, list => list.filter((_, at) => at !== index))}><X size={14} /></button>
                        </div>)}
                        <button type="button" className="district-add" onClick={() => editDistricts(area.code, list => [...list, { name: '', freight: '' }])}>
                          <Plus size={14} /> Adicionar bairro</button>
                      </details>
                    </div>
                  )
                })}
              </div>
            )}
            </div>
            </div>
            <small className="field-help">
              A cobertura inclui todos os CEPs dos municípios escolhidos, inclusive zona rural.
              Use 0,00 para zerar apenas este município; o botão na lista de filiais zera todos temporariamente.
            </small>
            {inline && <button type="submit" className="button primary branch-inline-save" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar alterações'}</button>}
          </details>
          {/* Na página da filial, ligar e desligar fica no botão ao lado de "Atendendo", no topo. */}
          {!inline && <label className="branch-option">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
            />
            <span>Filial ativa</span>
          </label>}
          {(localError || error) && (
            <div className="form-error" role="alert">
              {localError || error}
            </div>
          )}
          {!inline && <div className="modal-actions">
            {!inline && <button type="button" className="button secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </button>}
            <button type="submit" className="button primary" disabled={saving}>
              {saving ? 'Salvando...' : branch ? 'Salvar alterações' : 'Criar filial'}{' '}
              <ArrowRight size={17} />
            </button>
          </div>}
        </form>
  )

  if (inline) return <div className="branch-inline-form">{form}</div>

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
        {form}
      </section>
    </div>
  )
}
