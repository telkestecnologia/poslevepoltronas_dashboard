// Filiais exibidas no painel. O cadastro no backend não muda: o nome salvo é só reconhecido
// aqui e apresentado com o nome da região.
const officialBranches = [
  { label: 'Fortaleza e região metropolitana', pattern: /\bfortaleza\b/ },
  // Ibiapaba e Sobral viraram uma filial só (a antiga Região de Sobral também cai aqui).
  { label: 'Ibiapaba, Sobral e Regiões Vizinhas', pattern: /\bserra\b|\bibiapaba\b|\bsobral\b/ },
]

export const OFFICIAL_BRANCH_COUNT = officialBranches.length

function officialIndex(name: string) {
  const normalized = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  return officialBranches.findIndex(branch => branch.pattern.test(normalized))
}

// Filiais de teste (dev, teste, sertão) não aparecem; filiais novas cadastradas aparecem depois das oficiais.
const testBranch = /\bdev\b|\btestes?\b|\bsertao\b/

/** Filial que aparece no painel: uma das oficiais ou uma nova (só as de teste ficam fora). */
export function isOfficialBranch(name: string) {
  return officialIndex(name) >= 0 || !testBranch.test(name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())
}

export function branchLabel(name: string) {
  return officialBranches[officialIndex(name)]?.label ?? name
}

/** As três oficiais, sempre na mesma ordem, e depois as novas; as de teste ficam fora. */

/** Uma filial por região oficial: se sobrou a antiga (ex.: Região de Sobral, juntada à Ibiapaba), fica só a ativa. */
function onePerRegion<T>(items: T[], nameOf: (item: T) => string) {
  const kept = new Map<number, T>()
  const rest: T[] = []
  for (const item of items) {
    const index = officialIndex(nameOf(item))
    if (index < 0) { rest.push(item); continue }
    const current = kept.get(index)
    const active = (value: T) => (value as { active?: boolean }).active !== false
    if (!current || (!active(current) && active(item))) kept.set(index, item)
  }
  return items.filter(item => officialIndex(nameOf(item)) < 0 ? rest.includes(item) : kept.get(officialIndex(nameOf(item))) === item)
}

export function onlyOfficialBranches<T>(items: T[], nameOf: (item: T) => string) {
  const order = (item: T) => { const index = officialIndex(nameOf(item)); return index < 0 ? officialBranches.length : index }
  return onePerRegion(items, nameOf)
    .filter(item => isOfficialBranch(nameOf(item)))
    .sort((a, b) => order(a) - order(b) || nameOf(a).localeCompare(nameOf(b), 'pt-BR'))
}

/**
 * Nome da poltrona para mostrar (igual ao app): "Poltrona FOR-01", "Poltrona SER-01" ou "Poltrona SOB-01", pela filial
 * e pelo número do código (DEV-SER-01 → Poltrona SER-01). O código da etiqueta continua o mesmo no cadastro.
 */
export function chairName(code: string, branchName?: string | null) {
  const text = (branchName ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const prefix = /serra|ibiapaba/.test(text) ? 'SER' : /sobral/.test(text) ? 'SOB' : /fortaleza/.test(text) ? 'FOR' : null
  const number = code.match(/(\d+)\D*$/)?.[1]
  if (!prefix || !number) return `Poltrona ${code}`
  return `Poltrona ${prefix}-${number.padStart(2, '0')}`
}

/** Cidades da Serra da Ibiapaba; as demais da filial unida ficam em "Sobral e Regiões Vizinhas". */
const IBIAPABA_CITIES = ['carnaubal', 'croata', 'guaraciaba do norte', 'ibiapina', 'ipu', 'sao benedito', 'tiangua', 'ubajara', 'vicosa do ceara']

/**
 * Na filial Ibiapaba, Sobral e Regiões Vizinhas as cidades aparecem em dois lados: Serra da Ibiapaba e Sobral e
 * Regiões Vizinhas. Nas outras filiais, um grupo só (title vazio).
 */
export function cityRegions<T extends { name: string }>(branchName: string, cities: T[]): { title: string; cities: T[] }[] {
  const plain = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (!/\bsobral\b/.test(plain(branchName)) || !/\bibiapaba\b/.test(plain(branchName))) return [{ title: '', cities }]
  const serra = cities.filter(city => IBIAPABA_CITIES.includes(plain(city.name)))
  const sobral = cities.filter(city => !IBIAPABA_CITIES.includes(plain(city.name)))
  return [{ title: 'Serra da Ibiapaba', cities: serra }, { title: 'Sobral e Regiões Vizinhas', cities: sobral }]
}

/** Número da filial oficial: 1 = Fortaleza e região metropolitana, 2 = Ibiapaba, Sobral e Regiões Vizinhas. */
export function branchNumber(name: string): number | null {
  const index = officialIndex(name)
  return index < 0 ? null : index + 1
}
