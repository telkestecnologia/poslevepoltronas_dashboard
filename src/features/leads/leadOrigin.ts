import type { LeadOrigin } from '../../api'

/** Nome de cada fonte para a equipe (mesmos códigos do backend). */
export const LEAD_SOURCE_LABELS: Record<string, string> = {
  INSTAGRAM: 'Instagram', FACEBOOK: 'Facebook', META_ADS: 'Anúncio Instagram/Facebook', GOOGLE: 'Google',
  GOOGLE_ADS: 'Anúncio Google', INDICACAO: 'Indicação', MEDICO: 'Médico ou clínica', WHATSAPP: 'WhatsApp',
  SITE_DIRETO: 'Site (acesso direto)', OUTRO: 'Outro', NAO_INFORMADO: 'Não informado',
}

export const leadSourceLabel = (source: string | null | undefined) =>
  LEAD_SOURCE_LABELS[source ?? 'NAO_INFORMADO'] ?? source ?? 'Não informado'

/** Detalhe curto: campanha ou anúncio, ou o que o cliente disse à Isa. */
export function leadOriginDetail(origin: LeadOrigin) {
  if (origin.adHeadline) return `anúncio "${origin.adHeadline}"`
  if (origin.campaign) return `campanha ${origin.campaign}`
  if (origin.declared) return `disse: "${origin.declared}"`
  if (origin.via === 'WHATSAPP_AD') return 'anúncio de clique para o WhatsApp'
  return ''
}
