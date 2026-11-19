/** "70,00" → 7000 centavos. Aceita "70", "70,5", "1.200,00" e "R$ 1.200,00". */
export function toCents(text: string) {
  const clean = text.replace(/[^\d,]/g, '')
  if (!clean) return 0
  const [reais, centavos = ''] = clean.split(',')
  return Number(reais || '0') * 100 + Number(centavos.padEnd(2, '0').slice(0, 2))
}

/** Hoje no fuso da Pós Leve (AAAA-MM-DD). */
export const todayIso = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Fortaleza' })
