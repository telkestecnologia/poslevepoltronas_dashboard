import { useEffect, useState } from 'react'
import { Megaphone } from 'lucide-react'
import { api, type LeadOrigin } from '../../api'
import { leadOriginDetail, leadSourceLabel } from './leadOrigin'
import './leads.css'

/** "Veio de: Instagram • campanha X". Some enquanto carrega; mostra "Não informado" quando ainda não se sabe. */
export function LeadOriginChip({ credentials, phone, conversationId }: {
  credentials: string; phone?: string | null; conversationId?: string | null
}) {
  const [origin, setOrigin] = useState<LeadOrigin | null | undefined>(undefined)

  useEffect(() => {
    let active = true
    setOrigin(undefined)
    if (!phone && !conversationId) { setOrigin(null); return }
    api.leadOrigin(credentials, { phone, conversationId })
      .then(found => { if (active) setOrigin(found) }, () => { if (active) setOrigin(null) })
    return () => { active = false }
  }, [credentials, phone, conversationId])

  if (origin === undefined) return null
  const detail = origin ? leadOriginDetail(origin) : ''
  return <span className={`lead-origin-chip${origin?.source ? '' : ' unknown'}`} title={origin?.referrer ? `Chegou por ${origin.referrer}` : undefined}>
    <Megaphone size={13} /> Veio de: <b>{leadSourceLabel(origin?.source)}</b>{detail && <> • {detail}</>}
  </span>
}
