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

export function isOfficialBranch(name: string) {
  return officialIndex(name) >= 0
}

export function branchLabel(name: string) {
  return officialBranches[officialIndex(name)]?.label ?? name
}

/** Mantém somente as filiais oficiais, sempre na mesma ordem. */
export function onlyOfficialBranches<T>(items: T[], nameOf: (item: T) => string) {
  return items
    .filter(item => isOfficialBranch(nameOf(item)))
    .sort((a, b) => officialIndex(nameOf(a)) - officialIndex(nameOf(b)))
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
