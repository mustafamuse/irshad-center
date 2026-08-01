/**
 * Extract the first whitespace-delimited token from a full name. Returns
 * empty string when input is blank — callers should fall back to a friendly
 * placeholder if they need user-facing copy.
 */
export function extractFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? ''
}

/**
 * Canonicalize a person's name for fuzzy matching during public lookup.
 *
 * Pipeline: NFD-decompose -> strip combining marks (diacritics) -> trim ->
 * collapse whitespace -> lowercase -> token-level alias map.
 *
 * Output is whitespace-joined, lowercase, no diacritics. Designed for
 * application-side comparison after a small DOB-narrowed candidate fetch
 * (not for indexed DB queries).
 */
export function normalizeName(input: string): string {
  if (!input) return ''
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .split(' ')
    .map((token) => NAME_ALIASES[token] ?? token)
    .filter(Boolean)
    .join(' ')
}

/**
 * Token-level alias map for common Arabic-Somali name spellings.
 *
 * Each variant maps to a single canonical token. To extend: add the
 * variant -> canonical mapping. The canonical form should also map to
 * itself for clarity.
 */
const NAME_ALIASES: Record<string, string> = {
  // Mohammed family
  mohammed: 'mohamed',
  muhammad: 'mohamed',
  mohamad: 'mohamed',
  mohammad: 'mohamed',
  mohamed: 'mohamed',
  muhamad: 'mohamed',
  // Yusuf family
  yusuf: 'yusuf',
  yousuf: 'yusuf',
  yousef: 'yusuf',
  yusif: 'yusuf',
  yousif: 'yusuf',
  // Aisha family
  aisha: 'aisha',
  ayesha: 'aisha',
  aaisha: 'aisha',
  aishah: 'aisha',
  ayisha: 'aisha',
  // Ibrahim family
  ibrahim: 'ibrahim',
  ibraheem: 'ibrahim',
  ebrahim: 'ibrahim',
  // Fatima family
  fatima: 'fatima',
  fatimah: 'fatima',
  fatema: 'fatima',
  fatemah: 'fatima',
  // Khadija family
  khadija: 'khadija',
  khadijah: 'khadija',
  // Omar family
  omar: 'omar',
  umar: 'omar',
  // Ali family
  ali: 'ali',
  aly: 'ali',
  // Abdullah / Abdallah
  abdullah: 'abdullah',
  abdallah: 'abdullah',
  abdulah: 'abdullah',
  // Hassan / Hasan
  hassan: 'hassan',
  hasan: 'hassan',
  // Hussein / Hussain / Husayn
  hussein: 'hussein',
  hussain: 'hussein',
  husayn: 'hussein',
  husain: 'hussein',
  // Maryam / Mariam
  maryam: 'maryam',
  mariam: 'maryam',
  meryam: 'maryam',
}
