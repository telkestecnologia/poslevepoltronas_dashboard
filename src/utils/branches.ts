// Filiais exibidas no painel. O cadastro no backend não muda: o nome salvo é só reconhecido
// aqui e apresentado com o nome da região.
const officialBranches = [
  { label: 'Fortaleza e região metropolitana', pattern: /\bfortaleza\b/ },
  { label: 'Serra da Ibiapaba e cidades vizinhas', pattern: /\bserra\b|\bibiapaba\b/ },
  { label: 'Região de Sobral-CE', pattern: /\bsobral\b/ },
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
export function onlyOfficialBranches<T>(items: T[], nameOf: (item: T) => string) {
  const order = (item: T) => { const index = officialIndex(nameOf(item)); return index < 0 ? officialBranches.length : index }
  return items
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
