/**
 * Bairros de Fortaleza com um frete sugerido por região, para preencher a lista de uma vez. Os valores são só ponto de
 * partida: a equipe confere e ajusta antes de salvar. Mesma lista no app.
 *  - R$ 150: leste, perto da sede (Edson Queiroz, Aldeota, Cocó...);
 *  - R$ 200: centro e anel intermediário;
 *  - R$ 230: oeste e sul mais distantes;
 *  - R$ 260: extremo sudoeste (Grande Bom Jardim, Conjunto Ceará...).
 */
const TIERS: [number, string[]][] = [
  [15000, ['Aerolândia', 'Aldeota', 'Alto da Balança', 'Cais do Porto', 'Cambeba', 'Cidade dos Funcionários', 'Cocó', 'De Lourdes',
    'Dias Macedo', 'Dionísio Torres', 'Edson Queiroz', 'Engenheiro Luciano Cavalcante', 'Guararapes', 'Jardim das Oliveiras',
    'Joaquim Távora', 'Manuel Dias Branco', 'Meireles', 'Mucuripe', 'Papicu', 'Parque Manibura', 'Praia do Futuro I',
    'Praia do Futuro II', 'Salinas', 'São João do Tauape', 'Sapiranga/Coité', 'Varjota', 'Vicente Pinzón']],
  [20000, ['Aeroporto', 'Alagadiço Novo', 'Álvaro Weyne', 'Amadeu Furtado', 'Barroso', 'Bela Vista', 'Benfica', 'Boa Vista', 'Bom Futuro',
    'Cajazeiras', 'Carlito Pamplona', 'Castelão', 'Centro', 'Cidade 2000', 'Couto Fernandes', 'Cristo Redentor', 'Curió', 'Damas',
    'Demócrito Rocha', 'Dendê', 'Dunas', 'Ellery', 'Farias Brito', 'Fátima', 'Floresta', 'Guajeru', 'Itaoca', 'Itaperi', 'Jacarecanga',
    'Jardim América', 'Jardim Cearense', 'Jardim Guanabara', 'Jardim Iracema', 'José Bonifácio', 'José de Alencar', 'Lagoa Redonda',
    'Messejana', 'Monte Castelo', 'Montese', 'Moura Brasil', 'Padre Andrade', 'Pan Americano', 'Parangaba', 'Parque Iracema',
    'Parquelândia', 'Parreão', 'Passaré', 'Pici', 'Pirambu', 'Praia de Iracema', 'Presidente Kennedy', 'Rodolfo Teófilo',
    'Sabiaguaba', 'São Gerardo', 'Serrinha', 'Vila Ellery', 'Vila Peri', 'Vila União']],
  [23000, ['Ancuri', 'Antônio Bezerra', 'Autran Nunes', 'Barra do Ceará', 'Coaçu', 'Conjunto Esperança', 'Conjunto Palmeiras',
    'Dom Lustosa', 'Henrique Jorge', 'Jangurussu', 'João XXIII', 'Jóquei Clube', 'Manoel Sátiro', 'Maraponga', 'Mondubim',
    'Novo Mondubim', 'Olavo Oliveira', 'Parque Dois Irmãos', 'Parque Presidente Vargas', 'Parque Santa Rosa', 'Paupina', 'Pedras',
    'Planalto Ayrton Senna', 'Prefeito José Walter', 'Quintino Cunha', 'São Bento', 'Vila Manoel Sátiro', 'Vila Velha']],
  [26000, ['Bom Jardim', 'Bonsucesso', 'Canindezinho', 'Conjunto Ceará I', 'Conjunto Ceará II', 'Genibaú', 'Granja Lisboa',
    'Granja Portugal', 'Parque São José', 'Siqueira']],
]

export const FORTALEZA_DISTRICTS: { name: string; freightCents: number }[] = TIERS
  .flatMap(([cents, names]) => names.map(name => ({ name, freightCents: cents })))
  .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
