import { ChevronRight, Plus, Search, Truck } from 'lucide-react'
import { useState } from 'react'
import type { Courier } from '../../api'
import { EmptyState } from '../../components/common'

type Props = {
  couriers: Courier[]
  onNewCourier: () => void
  onEditCourier: (courier: Courier) => void
}

function phoneLabel(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return phone
}

export function CouriersPage({ couriers, onNewCourier, onEditCourier }: Props) {
  const [search, setSearch] = useState('')
  const term = search.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const filtered = couriers.filter(courier =>
    `${courier.name} ${courier.email} ${courier.phone}`.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(term))

  return <>
    <div className="page-heading with-action">
      <div><span className="eyebrow">EQUIPE • PÓS LEVE</span><h1>Entregadores</h1>
        <p>Cadastre a equipe de entregas e gerencie as credenciais de acesso.</p></div>
      <button className="button primary" onClick={onNewCourier}><Plus size={18} /> Novo entregador</button>
    </div>
    <section className="panel table-panel">
      {couriers.length > 0 && <div className="table-toolbar"><div className="search-field">
        <Search size={19} /><input aria-label="Buscar entregador" placeholder="Buscar por nome, e-mail ou telefone"
          value={search} onChange={event => setSearch(event.target.value)} />
      </div></div>}
      {couriers.length === 0 ? <EmptyState icon={Truck} title="Nenhum entregador cadastrado"
        text="Cadastre um entregador para preparar o acesso ao aplicativo."
        action={{ label: 'Cadastrar entregador', onClick: onNewCourier }} />
        : filtered.length === 0 ? <EmptyState icon={Search} title="Nenhum resultado"
          text="Tente outro nome, e-mail ou telefone." />
        : <div className="table-scroll"><table><thead><tr>
          <th>ENTREGADOR</th><th>TELEFONE</th><th>VEÍCULO</th><th>CONTA</th>
          <th><span className="sr-only">Ação</span></th>
        </tr></thead><tbody>{filtered.map(courier => <tr key={courier.id}>
          <td><div className="courier-identity"><strong>{courier.name}</strong><small>{courier.email}</small></div></td>
          <td>{phoneLabel(courier.phone)}</td><td>{courier.vehicle || '—'}</td>
          <td><span className={`courier-access ${courier.active ? 'active' : 'inactive'}`}>
            {courier.active ? 'Liberado' : 'Bloqueado'}</span></td>
          <td><button className="table-action" onClick={() => onEditCourier(courier)}>
            Editar <ChevronRight size={16} /></button></td>
        </tr>)}</tbody></table></div>}
    </section>
  </>
}
