import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowRight, Plus, Store, X } from 'lucide-react'
import { FormIntro } from '../../components/FormIntro'
import type { Branch, BranchInput, Municipality } from '../../api'

type Area = { code: string; freight: string; free: boolean; districts: { name: string; freight: string }[] }
const reaisText = (cents: number) => (cents / 100).toFixed(2).replace('.', ',')
const plain = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR').trim()
/** "120" ou "120,50" em centavos; null se não for um valor válido. */
function toCents(text: string) {
  const input = text.trim()
  if (!/^\d+(,\d{1,2})?$/.test(input)) return null
  const [reais, centavos = ''] = input.split(',')
  const cents = Number(reais) * 100 + Number(centavos.padEnd(2, '0'))
  return Number.isSafeInteger(cents) && cents <= 2147483647 ? cents : null
}

/**
 * Cadastro da filial (nova) ou só das cidades, bairros e frete (editar, aberto pelo botão da página da filial).
 * Esquerda: adicionar cidade ou bairro. Direita: a lista com o frete de cada um, na ordem Fortaleza, bairros de
 * Fortaleza e Região metropolitana (nas outras filiais, as cidades com os bairros embaixo de cada uma).
 */
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
  /** Mantido por compatibilidade: a edição agora é sempre na janela. */
  inline?: boolean
}) {
  const branch = modal.kind === 'editBranch' ? modal.branch : null
  const [name, setName] = useState(branch?.name ?? '')
  const [active, setActive] = useState(branch?.active ?? true)
  // free: frete grátis nesta cidade (vai como R$ 0,00); o frete grátis da filial inteira (o antigo) aparece em todas.
  const [areas, setAreas] = useState<Area[]>(
    branch?.municipalities.map((city) => ({
      code: city.code,
      freight: reaisText(city.freightCents),
      free: branch.freeShipping || city.freightCents === 0,
      districts: (city.districts ?? []).map(item => ({ name: item.name, freight: reaisText(item.freightCents) })),
    })) ?? [],
  )
  const [tab, setTab] = useState<'city' | 'district'>('city')
  const [uf, setUf] = useState(branch?.municipalities[0]?.uf ?? 'CE')
  const [search, setSearch] = useState('')
  const [districtCity, setDistrictCity] = useState('')
  const [districtName, setDistrictName] = useState('')
  const [localError, setLocalError] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const districtRef = useRef<HTMLInputElement>(null)

  const cityOf = (code: string) => municipalities.find(item => item.code === code) ?? branch?.municipalities.find(item => item.code === code)
  const cityName = (code: string) => cityOf(code)?.name ?? code
  const capital = areas.find(area => cityName(area.code) === 'Fortaleza')
  const others = areas.filter(area => area !== capital)
  const districtCityCode = areas.some(area => area.code === districtCity) ? districtCity : (capital ?? areas[0])?.code ?? ''

  const term = plain(search)
  const available = municipalities.filter(city => city.uf === uf && !areas.some(area => area.code === city.code)
    && (plain(city.name).includes(term) || city.code.includes(term)))

  const update = (code: string, change: (area: Area) => Area) =>
    setAreas(current => current.map(item => item.code === code ? change(item) : item))

  function addMunicipality(code: string) {
    setAreas(current => current.some(area => area.code === code) ? current : [...current, { code, freight: '', free: false, districts: [] }])
    setSearch('')
    setLocalError('')
    searchRef.current?.focus()
  }

  function addDistrict() {
    const value = districtName.trim().replace(/\s+/g, ' ')
    if (!value || !districtCityCode) return
    const area = areas.find(item => item.code === districtCityCode)
    if (area?.districts.some(item => plain(item.name) === plain(value))) { setLocalError(`${value} já está na lista.`); return }
    update(districtCityCode, item => ({ ...item, districts: [...item.districts, { name: value, freight: '' }]
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')) }))
    setDistrictName('')
    setLocalError('')
    districtRef.current?.focus()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (areas.length === 0) { setLocalError('Adicione pelo menos uma cidade.'); return }
    const priced: BranchInput['municipalities'] = []
    for (const area of areas) {
      const districts: { name: string; freightCents: number }[] = []
      for (const item of area.districts) {
        const cents = toCents(item.freight)
        if (cents === null) { setLocalError(`Informe o frete do bairro ${item.name} (ex.: 60,00).`); return }
        districts.push({ name: item.name, freightCents: cents })
      }
      if (area.free) { priced.push({ code: area.code, freightCents: 0, districts }); continue }
      const freightCents = toCents(area.freight)
      if (freightCents === null) { setLocalError(`Informe o frete de ${cityName(area.code)} (ex.: 120,00).`); return }
      priced.push({ code: area.code, freightCents, districts })
    }
    setLocalError('')
    void onSave({ name: name.trim(), municipalities: priced, active })
  }

  const cityRow = (area: Area) => <div className="bm-row" key={area.code}>
    <span className="bm-name">{cityName(area.code)}</span>
    <label className="bm-price">R$
      <input inputMode="decimal" value={area.free ? '0,00' : area.freight} disabled={area.free} placeholder="0,00" required={!area.free}
        aria-label={`Frete para ${cityName(area.code)}`} onChange={event => update(area.code, item => ({ ...item, freight: event.target.value }))} />
    </label>
    <label className="bm-free"><input type="checkbox" checked={area.free}
      onChange={event => update(area.code, item => ({ ...item, free: event.target.checked }))} /> Grátis</label>
    <button type="button" className="bm-remove" aria-label={`Remover ${cityName(area.code)}`}
      onClick={() => setAreas(current => current.filter(item => item.code !== area.code))}><X size={15} /></button>
  </div>

  const districtRows = (area: Area) => area.districts.map((item, index) => <div className="bm-row" key={item.name}>
    <span className="bm-name">{item.name}</span>
    <label className="bm-price">R$
      <input inputMode="decimal" value={item.freight} placeholder="0,00" aria-label={`Frete do bairro ${item.name}`}
        onChange={event => update(area.code, current => ({ ...current,
          districts: current.districts.map((row, at) => at === index ? { ...row, freight: event.target.value } : row) }))} />
    </label>
    <span className="bm-free-empty" />
    <button type="button" className="bm-remove" aria-label={`Remover bairro ${item.name}`}
      onClick={() => update(area.code, current => ({ ...current, districts: current.districts.filter((_, at) => at !== index) }))}><X size={15} /></button>
  </div>)

  const group = (title: string, count: number, rows: ReactNode) => <div className="bm-group">
    <h4>{title} <small>({count})</small></h4>{rows}</div>

  const form = <form onSubmit={submit} className="modal-form bm-form">
    {!branch && <FormIntro icon={<Store size={24} />} title="Nova filial">
      Dê um nome à filial e escolha as cidades e os bairros que ela atende, com o valor do frete.</FormIntro>}
    {!branch && <label>Nome da filial
      <input value={name} onChange={event => setName(event.target.value)} maxLength={100} placeholder="Ex.: Fortaleza" required autoFocus />
    </label>}

    <div className="bm-body">
      {/* 1. Adicionar cidade ou bairro. */}
      <section className="bm-card">
        <header className="bm-step"><b>1</b><div><strong>Adicione cidades e bairros</strong>
          <small>{tab === 'city' ? 'Busque a cidade e clique no + para incluir.' : 'Escolha a cidade, digite o bairro e clique em Adicionar.'}</small></div></header>
        <div className="bm-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'city'} className={tab === 'city' ? 'on' : ''} onClick={() => setTab('city')}>Cidade</button>
          <button type="button" role="tab" aria-selected={tab === 'district'} className={tab === 'district' ? 'on' : ''}
            onClick={() => { setTab('district'); setTimeout(() => districtRef.current?.focus(), 0) }}>Bairro</button>
        </div>
        {tab === 'city' ? <>
          <div className="bm-fields city">
            <label>UF
              <select value={uf} onChange={event => { setUf(event.target.value); setSearch('') }}>
                {[...new Set(municipalities.map(city => city.uf))].sort().map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label>Cidade
              <input ref={searchRef} value={search} onChange={event => setSearch(event.target.value)} placeholder="Digite o nome da cidade"
                onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); if (term && available.length) addMunicipality(available[0].code) } }} />
            </label>
          </div>
          <ul className="bm-results" aria-label="Cidades encontradas">
            {available.length ? available.map(city => <li key={city.code}>
              <button type="button" onClick={() => addMunicipality(city.code)} aria-label={`Adicionar ${city.name}`}>
                <span>{city.name} <small>– {city.uf}</small></span><Plus size={16} aria-hidden="true" /></button>
            </li>) : <li className="bm-none">Nenhuma cidade encontrada.</li>}
          </ul>
        </> : areas.length === 0 ? <p className="bm-none">Adicione uma cidade primeiro.</p> : <>
          <div className="bm-fields district">
            <label>Cidade
              <select value={districtCityCode} onChange={event => setDistrictCity(event.target.value)}>
                {[...(capital ? [capital] : []), ...others].map(area => <option key={area.code} value={area.code}>{cityName(area.code)}</option>)}
              </select>
            </label>
            <label>Bairro
              <input ref={districtRef} value={districtName} maxLength={80} placeholder="Ex.: Aldeota" onChange={event => setDistrictName(event.target.value)}
                onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addDistrict() } }} />
            </label>
          </div>
          <button type="button" className="button secondary bm-add" disabled={!districtName.trim()} onClick={addDistrict}><Plus size={16} /> Adicionar bairro</button>
          <p className="bm-hint">Bairro fora da lista paga o frete da cidade.</p>
        </>}
      </section>

      {/* 2. Frete de cada cidade e bairro, na ordem Fortaleza, bairros de Fortaleza e Região metropolitana. */}
      <section className="bm-card bm-list-card">
        <header className="bm-step"><b className="coral">2</b><div><strong>Frete</strong><small>Digite o valor da entrega de cada um.</small></div></header>
        {areas.length === 0 ? <p className="bm-none">Nenhuma cidade ainda.</p> : <div className="bm-list">
          {capital ? <>
            {group('Fortaleza', 1, cityRow(capital))}
            {capital.districts.length > 0 && group('Bairros de Fortaleza', capital.districts.length, districtRows(capital))}
            {others.length > 0 && group('Região metropolitana', others.length, others.map(area => <div key={area.code}>{cityRow(area)}{districtRows(area)}</div>))}
          </> : group('Cidades', areas.length, areas.map(area => <div key={area.code}>{cityRow(area)}{districtRows(area)}</div>))}
        </div>}
      </section>
    </div>

    {!branch && <label className="branch-option"><input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} />
      <span>Filial ativa</span></label>}
    {(localError || error) && <div className="form-error" role="alert">{localError || error}</div>}
    <div className="modal-actions">
      <button type="button" className="button secondary" onClick={onClose} disabled={saving}>Cancelar</button>
      <button type="submit" className="button primary" disabled={saving}>
        {saving ? 'Salvando...' : branch ? 'Salvar alterações' : 'Criar filial'} <ArrowRight size={17} /></button>
    </div>
  </form>

  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="modal bm-modal" role="dialog" aria-modal="true" aria-labelledby="branch-modal-title">
      <div className="modal-head">
        <div>
          <span className="eyebrow">PÓS LEVE • FILIAIS</span>
          <h2 id="branch-modal-title">{branch ? 'Cidades, bairros e frete' : 'Nova filial'}</h2>
        </div>
        <button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}><X size={20} /></button>
      </div>
      {form}
    </section>
  </div>
}
