import { useEffect, useState } from 'react'
import type { CustomerDetails, ManualOrderPrefill, SaleDetails } from '../api'

/**
 * Rascunho do pedido manual em aberto: fica guardado neste navegador até o cadastro ser concluído ou limpo, para a
 * equipe sair da tela e continuar depois de onde parou. Arquivos (contrato e fotos) não ficam no rascunho.
 */
export type ManualDraft = {
  step?: string; reason?: string; name?: string; phone?: string; branchId?: string; cityCode?: string; street?: string
  number?: string; complement?: string; district?: string; cep?: string; delivered?: boolean | null; start?: string; end?: string
  deliveryTime?: string; pickupTime?: string; chairChoice?: string; rental?: string; freight?: string; paidState?: string
  partial?: string; method?: string; paidOn?: string; note?: string; conversationId?: string; savedAt?: number
  /** Detalhes da venda (forma de pagamento, desconto, plano, indicação, nota fiscal) e o valor do desconto digitado. */
  sale?: SaleDetails; saleDiscount?: string
  /** Ficha da cliente: CPF, e-mail, quem recebe e o local. */
  customer?: CustomerDetails
  /** Pedido já salvo (o cadastro passou de Valores): continua no contrato e no pagamento dele. */
  createdId?: string
}

const KEY = 'posleve.manualOrderDraft'
const EVENT = 'posleve:manual-draft'

export function readDraft(): ManualDraft | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) as ManualDraft : null
  } catch {
    return null
  }
}

export function writeDraft(draft: ManualDraft) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...draft, savedAt: Date.now() }))
  } catch { /* sem armazenamento: o rascunho só vale enquanto a tela estiver aberta */ }
  window.dispatchEvent(new Event(EVENT))
}

export function clearDraft() {
  try { localStorage.removeItem(KEY) } catch { /* sem armazenamento */ }
  window.dispatchEvent(new Event(EVENT))
}

/** Rascunho com algo preenchido conta como pedido manual em aberto. */
export function draftIsOpen(draft: ManualDraft | null) {
  if (!draft) return false
  return Boolean(draft.reason || draft.name || draft.phone || draft.street || draft.district || draft.start || draft.rental
    || draft.note || draft.conversationId)
}

const centsText = (cents: number | null | undefined) => cents == null ? '' : (cents / 100).toFixed(2).replace('.', ',')
const formatCep = (value: string) => {
  // CEP sempre com ponto e traço: 62.360-000.
  const digits = value.replace(/\D/g, '').slice(0, 8)
  return digits.length > 5 ? `${digits.slice(0, 2)}.${digits.slice(2, 5)}-${digits.slice(5)}`
    : digits.length > 2 ? `${digits.slice(0, 2)}.${digits.slice(2)}` : digits
}
const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

/** Rascunho novo a partir do que a cliente passou para a Isa na conversa. */
export function draftFromPrefill(conversationId: string, data: ManualOrderPrefill | null): ManualDraft {
  const shifts = ['08:00-12:00', '13:00-18:00']
  return {
    step: 'reason', conversationId,
    name: data?.customerName ?? '', phone: data?.customerPhone ? formatPhone(data.customerPhone) : '',
    branchId: data?.branchId ?? '', cityCode: data?.municipalityCode ?? '', street: data?.street ?? '', number: data?.number ?? '',
    complement: data?.complement ?? '', district: data?.district ?? '', cep: formatCep(data?.cep ?? ''),
    start: data?.start ?? '', end: data?.end ?? '',
    deliveryTime: data?.deliveryTime && shifts.includes(data.deliveryTime) ? data.deliveryTime : '',
    pickupTime: data?.pickupTime && shifts.includes(data.pickupTime) ? data.pickupTime : '',
    rental: centsText(data?.rentalCents), freight: centsText(data?.freightCents),
  }
}

/** Quantos pedidos manuais estão em aberto (hoje, 0 ou 1), para a bolinha vermelha do menu. */
export function useManualDraftCount() {
  const [count, setCount] = useState(() => draftIsOpen(readDraft()) ? 1 : 0)
  useEffect(() => {
    const update = () => setCount(draftIsOpen(readDraft()) ? 1 : 0)
    window.addEventListener(EVENT, update)
    window.addEventListener('storage', update)
    return () => { window.removeEventListener(EVENT, update); window.removeEventListener('storage', update) }
  }, [])
  return count
}
