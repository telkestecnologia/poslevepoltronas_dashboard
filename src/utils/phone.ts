export function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits ? `(${digits}` : ''
  const areaCode = `(${digits.slice(0, 2)}) `
  const number = digits.slice(2)
  const prefixLength = digits.length === 11 ? 5 : 4
  return number.length > prefixLength
    ? `${areaCode}${number.slice(0, prefixLength)}-${number.slice(prefixLength)}`
    : `${areaCode}${number}`
}

/**
 * Telefone do cliente para MOSTRAR (não usar ao digitar): tira o 55 do país e devolve o 9 que o WhatsApp omite em
 * alguns celulares (556798335272 → 67998335272). Fixos (começam com 2 a 5) ficam como estão.
 */
export function brazilPhoneDigits(value: string) {
  let digits = value.replace(/\D/g, '')
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) digits = digits.slice(2)
  if (digits.length === 10 && /[6-9]/.test(digits[2])) digits = `${digits.slice(0, 2)}9${digits.slice(2)}`
  return digits
}

/** (67) 99833-5272 */
export function displayPhone(value: string) {
  const digits = brazilPhoneDigits(value)
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return value
}
