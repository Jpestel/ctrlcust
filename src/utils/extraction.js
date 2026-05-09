import * as pdfjsLib from 'pdfjs-dist/build/pdf'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

// Remplace String.prototype.matchAll (absent sur iOS < 13)
function execAll(str, re) {
  const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
  const results = []
  let m
  while ((m = r.exec(str)) !== null) results.push(m)
  return results
}

// Lecture du fichier en ArrayBuffer — FileReader utilisé pour compatibilité iOS < 14.1
// (file.arrayBuffer() absent avant Safari 14.1)
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target.result)
    reader.onerror = () => reject(new Error('Impossible de lire le fichier PDF'))
    reader.readAsArrayBuffer(file)
  })
}

export async function extractTextFromPDF(file) {
  const arrayBuffer = await readFileAsArrayBuffer(file)
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  let fullText = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    fullText += reconstructPageText(content.items) + '\n'
  }
  return fullText
}

/**
 * Reconstruit le texte d'une page en utilisant les positions des items.
 * Évite le problème pdfjs mobile où chaque caractère est un item séparé
 * → "B M O U 5 1 7 1 5 3 8" au lieu de "BMOU5171538".
 *
 * Règles :
 * - Même ligne + items très proches → pas d'espace (caractères contigus)
 * - Même ligne + écart normal      → espace
 * - Ligne différente               → retour à la ligne
 */
function reconstructPageText(items) {
  const valid = items.filter(it => typeof it.str === 'string' && it.str.length > 0)
  if (valid.length === 0) return ''

  let text = ''
  let prev = null

  for (const item of valid) {
    // transform = [sx, shy, shx, sy, tx, ty]
    // tx = position x (gauche), ty = position y (bas de ligne)
    const x = item.transform[4]
    const y = item.transform[5]
    const h = Math.abs(item.transform[3]) || 12  // hauteur approximative du caractère

    if (prev === null) {
      text += item.str
    } else {
      const prevX = prev.transform[4]
      const prevY = prev.transform[5]
      const prevW = prev.width || 0
      const dy = Math.abs(y - prevY)

      if (dy > h * 0.4) {
        // Changement de ligne
        text += '\n' + item.str
      } else {
        const gap = x - (prevX + prevW)
        // Gap négatif ou très petit → items contigus, pas d'espace
        // Gap > 0.5× hauteur → vrai espace entre mots
        if (gap < h * 0.3) {
          text += item.str
        } else {
          text += ' ' + item.str
        }
      }
    }
    prev = item
  }
  return text
}

// ISO 6346 : 3 lettres + U/J/Z + 6 chiffres + 1 chiffre de contrôle = 11 chars
// (?!\d) évite de matcher dans une séquence plus longue (ex: COSU6445923520)
const CONTAINER_RE = /[A-Z]{3}[UJZ]\d{7}(?!\d)/g

export function extractContainerNumbers(text) {
  const upper = text.toUpperCase()
  const found = new Set()
  for (const m of execAll(upper, CONTAINER_RE)) {
    found.add(m[0])
  }
  return [...found]
}

// Extrait les plombs associés à chaque conteneur
// Formats gérés :
//   BMOU5171538/NJ609771  (packing list)
//   BMOU5171538 NJ609771  (tableau BL)
// Retourne { "BMOU5171538": "NJ609771", ... }
export function extractSealMap(text) {
  const upper = text.toUpperCase()
  const result = {}

  // Format slash : CONTNUM/SEALNUM ou CONTNUM / SEALNUM
  const slashRe = /([A-Z]{3}[UJZ]\d{7})\s*\/\s*([A-Z0-9]{4,15})(?![0-9]{3,})/g
  for (const m of execAll(upper, slashRe)) {
    // Ignorer si le "plomb" ressemble à un numéro de BL (trop long ou tout numérique)
    if (!/^\d{9,}$/.test(m[2])) result[m[1]] = m[2]
  }

  // Format espace : CONTNUM SEALNUM (tableau BL — le plomb suit immédiatement)
  const spaceRe = /([A-Z]{3}[UJZ]\d{7})\s+([A-Z]{1,3}\d{4,9}|\d{5,9}[A-Z]{0,3})(?=\s)/g
  for (const m of execAll(upper, spaceRe)) {
    if (!result[m[1]] && !/^\d{9,}$/.test(m[2])) result[m[1]] = m[2]
  }

  return result
}

export function extractSealNumbers(text) {
  return Object.values(extractSealMap(text))
}

// ── Extraction Bill of Lading ─────────────────────────────────────────────────
export function extractBLData(text) {
  const containers = extractContainerNumbers(text)
  const sealMap = extractSealMap(text)
  return { containers, sealMap }
}

// ── Données financières ──────────────────────────────────────────────────────

function parseNum(str) {
  // "71 907 ,45" → "71907.45"  |  "31,549.98" → "31549.98"
  const s = str.trim().replace(/\s/g, '')
  // Distinguer séparateur décimal : si virgule en dernière position avant 1-2 chiffres
  if (/,\d{1,2}$/.test(s)) return s.replace(/\./g, '').replace(',', '.')
  return s.replace(/,/g, '')
}

// Toutes les paires (nombre, devise) dans un texte
function findCurrencies(text) {
  const result = []
  const re = /(\d[\d\s.,]+)\s*(USD|EUR|GBP|CHF|CNY|JPY|CAD|AUD)\b/gi
  let m
  while ((m = re.exec(text)) !== null) {
    const val = parseFloat(parseNum(m[1]))
    if (!isNaN(val) && val > 10) {
      result.push({ valeur: parseNum(m[1]), devise: m[2].toUpperCase(), _num: val })
    }
  }
  return result
}

// Poids brut — cherche n'importe quel nombre suivi de KG ou T dans le texte
function findGrossWeight(text) {
  // Avec mot-clé (priorité)
  const kwRe = /(?:poids\s*brut|gross\s*weight|g\.?\s*w\.?|masse\s*brute)[^0-9]{0,50}([\d\s.,]+)\s*(kg|t|lbs?)\b/i
  let m = kwRe.exec(text)
  if (m) return { valeur: parseNum(m[1]), unite: m[2].toUpperCase() }

  // Sans mot-clé : prend le plus grand nombre suivi de KG (probablement le total)
  const re = /([\d\s.,]+)\s*(kg)\b/gi
  let best = null
  while ((m = re.exec(text)) !== null) {
    const val = parseFloat(parseNum(m[1]))
    if (!isNaN(val) && val > 100 && (!best || val > best._num)) {
      best = { valeur: parseNum(m[1]), unite: m[2].toUpperCase(), _num: val }
    }
  }
  return best ? { valeur: best.valeur, unite: best.unite } : null
}

// Poids net
function findNetWeight(text) {
  const kwRe = /(?:poids\s*net|net\s*weight|n\.?\s*w\.?|masse\s*nette)[^0-9]{0,50}([\d\s.,]+)\s*(kg|t|lbs?)\b/i
  const m = kwRe.exec(text)
  if (m) return { valeur: parseNum(m[1]), unite: m[2].toUpperCase() }
  return null
}

// Quantité totale
// Note : on interdit les espaces DANS le nombre ([\d.,]{0,8}) pour éviter de
// capturer "3 1312 PCE" → "31312" quand "M3" précède "1312 PCE"
function findQuantity(text) {
  const re = /(^|[^A-Za-z0-9])(\d[\d.,]{0,8})\s+(pieces?|pce|ctns?|pkgs?|colis|cartons?|unit[ée]s?)\b/gi
  let best = null
  let m
  while ((m = re.exec(text)) !== null) {
    const val = parseFloat(parseNum(m[2]))
    if (!isNaN(val) && val > 0 && val < 1000000 && (!best || val > best._num)) {
      best = { valeur: parseNum(m[1]), unite: m[2].toUpperCase(), _num: val }
    }
  }
  return best ? { valeur: best.valeur, unite: best.unite } : null
}

export function extractFinancialData(text) {
  const allCurrencies = findCurrencies(text)

  // Meilleure valeur par devise (la plus haute = le total, pas les lignes unitaires)
  const bestByDevise = {}
  for (const c of allCurrencies) {
    if (!bestByDevise[c.devise] || c._num > bestByDevise[c.devise]._num) {
      bestByDevise[c.devise] = c
    }
  }
  const valeurs = Object.values(bestByDevise).map(({ valeur, devise }) => ({ valeur, devise }))

  // Si aucune devise trouvée avec suffixe, chercher le format US$ / $  (factures chinoises)
  if (valeurs.length === 0) {
    const dollarRe = /US?\$\s*([\d,. ]+)/gi
    let m
    while ((m = dollarRe.exec(text)) !== null) {
      const val = parseFloat(parseNum(m[1]))
      if (!isNaN(val) && val > 100) {
        if (!bestByDevise['USD'] || val > bestByDevise['USD']._num) {
          bestByDevise['USD'] = { valeur: parseNum(m[1]), devise: 'USD', _num: val }
        }
      }
    }
    if (bestByDevise['USD']) valeurs.push({ valeur: bestByDevise['USD'].valeur, devise: 'USD' })
  }

  return {
    valeurs,
    poidsBrut: findGrossWeight(text),
    poidsNet: findNetWeight(text),
    quantite: findQuantity(text),
  }
}

// ─── Extraction spécifique Déclaration en douane ──────────────────────────────

// ── Parties de la déclaration (importateur, représentant) ─────────────────────

function isValidPartyName(str) {
  if (!str || str.length < 3) return false
  if (!/[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ]{2,}/i.test(str)) return false
  if (/^\d+$/.test(str.trim())) return false
  return true
}

// Tronque les noms d'entreprise à la première indication d'adresse
function cleanPartyName(str) {
  const cleaned = str
    // Stoppe sur numéro de voie suivi d'un type de voie
    .replace(/\s+\d{1,5}\s+(?:RUE|AVE?|BD|BOULEVARD|CHEMIN|ROUTE|ALL[EÉ]E|PLACE|IMP(?:ASSE)?|VOIE|ZI|ZAC|ZA|LOT)\b.*/i, '')
    // Stoppe sur code postal (5 chiffres)
    .replace(/\s+\d{5}(?:\s|$).*/g, '')
    .trim()
    .replace(/\s+/g, ' ')
  return cleaned.length >= 3 ? cleaned : str.trim().replace(/\s+/g, ' ')
}

// Cherche un nom d'entreprise dans les N premières lignes après un label
function findPartyInLines(textAfterLabel, maxLines = 8) {
  const lines = textAfterLabel.split(/\n/)
  for (const line of lines.slice(0, maxLines)) {
    const t = line.trim().replace(/\s+/g, ' ')
    if (t.length < 3) continue
    if (/^\d{1,2}$/.test(t)) continue                        // numéro de case seul
    if (/^N[o°]\s*EORI/i.test(t)) continue                  // "No EORI"
    if (/^[A-Z]{2}\d{10,}/.test(t)) continue                 // EORI : FR12345678901234
    if (/^\d[\d\s]*$/.test(t)) continue                       // ligne de chiffres seule
    if (!/[A-ZÀ-Ÿa-zà-ÿ]{2,}/.test(t)) continue             // doit contenir des lettres
    // Stop si c'est un autre label de case (ex : "14 Déclarant")
    if (/^\d{1,2}\s+[A-ZÀ-Ÿ][A-Za-zÀ-ÿ]{3,}/.test(t) && t.length < 50) break
    // Stop sur labels connus de la DEC (y compris PERSONNE A CONTACTER)
    if (/^(?:PERSONNE\s+A\s+CONTACTER|[Dd]estinataire|[Dd][eé]clarant|[Rr]epr[eé]sentant|[Ee]xp[eé]diteur|[Ee]xportateur|[Aa]gent|IMPORTATEUR|EXPORTATEUR|DECLARANT|REPRESENTANT)\b/i.test(t)) break
    return cleanPartyName(t)
  }
  return null
}

// Extrait la valeur après un label de la forme "LABEL : valeur" ou "LABEL :\nvaleur"
// Gère les deux formats :
//   - Format DELTA IE (majuscules) : EXPORTATEUR : NOM ENTREPRISE
//   - Format papier classique      : Exportateur / 2. Exportateur / Expéditeur
// Retourne null si la case est vide (label présent mais rien derrière)
function extractParty(text, patterns) {
  // Construit une regex qui matche tous les patterns fournis
  const combined = patterns.join('|')
  const re = new RegExp(`(?:${combined})`, 'gi')
  let m
  while ((m = re.exec(text)) !== null) {
    const after = text.substring(m.index + m[0].length)
    // Même ligne : "LABEL : valeur"
    const sameLine = /^[ \t]*[:\-][ \t]*([^\n]{2,120})/.exec(after)
    if (sameLine) {
      const raw = sameLine[1].trim()
      // Si la "valeur" est en fait un autre label → case vide
      if (/^(?:PERSONNE\s+A\s+CONTACTER|IMPORTATEUR|EXPORTATEUR|DECLARANT|REPRESENTANT)\b/i.test(raw)) return null
      // Retirer le numéro EORI/SIRET collé derrière le nom : "DISTRI CASH ACCESSOIRES - FR383485018"
      const nameOnly = raw.replace(/\s*[-–]\s*[A-Z]{0,2}\d{9,}.*$/i, '').trim()
      const val = cleanPartyName(nameOnly || raw)
      if (isValidPartyName(val)) return val
      if (raw.length === 0) return null
    }
    // Ligne suivante
    const result = findPartyInLines(after)
    if (result) {
      return result.replace(/\s*[-–]\s*[A-Z]{0,2}\d{9,}.*$/i, '').trim() || result
    }
  }
  return null
}

// Case 2 / EXPORTATEUR
function extractExportateur(text) {
  return extractParty(text, [
    'EXPORTATEUR\\s*:',
    '(?:\\b2\\s*[\\s\\n.]*)?(?:[Ee]xp[eé]diteur|[Ee]xportateur)(?:\\s*\\/\\s*(?:[Ee]xp[eé]diteur|[Ee]xportateur))?',
  ])
}

// Case 8 / IMPORTATEUR (Destinataire)
function extractImportateur(text) {
  return extractParty(text, [
    'IMPORTATEUR\\s*:',
    '(?:\\b8\\s*[\\s\\n.]*)?[Dd]estinataire',
  ])
}

// Case 14 / REPRESENTANT
function extractRepresentant(text) {
  return extractParty(text, [
    'REPRESENTANT\\s*:',
    '(?:\\b14\\s*[\\s\\n.]*)?[Rr]epr[eé]sentant(?:\\s+en\\s+douane)?',
  ])
}

// Case 14 / DECLARANT seul (champ séparé)
function extractDeclarant(text) {
  return extractParty(text, [
    'DECLARANT\\s*:',
    '(?:\\b14\\s*[\\s\\n.]*)?[Dd][eé]clarant',
  ])
}

function extractCRN(text) {
  const m = /N[°o]\s*d[eé]claration\s*\(CRN\)\s*[:#]?\s*([A-Z0-9]{10,25})/i.exec(text)
  if (m) return m[1].trim()
  // Fallback : CRN seul
  const m2 = /\bCRN\s*[:#]?\s*([A-Z0-9]{10,25})/i.exec(text)
  return m2 ? m2[1].trim() : null
}

function extractMRN(text) {
  let m = /MRN\s*[:#]?\s*([A-Z0-9]{17,22})/i.exec(text)
  if (m) return m[1].trim()
  m = /N[°o]\s*d[ée]claration[^:\n]{0,30}[:#]\s*([A-Z0-9]{8,22})/i.exec(text)
  if (m) return m[1].trim()
  return null
}

// Retourne les codes SH dans l'ordre d'apparition dans le texte
function extractHSCodesOrdered(text) {
  const found = []
  const seen = new Set()
  const upper = text.toUpperCase()

  // Méthode 1 — mot-clé
  const kwRe = /(?:nomenclature|code\s*n[°oc]|code\s*sh|hs\s*(?:code)?|tarif(?:aire)?)\s*[:#]?\s*(\d{8,10})\b(?!\d)/gi
  for (const m of execAll(upper, kwRe)) {
    let code = m[1]
    if (code.length === 8) code += '00'
    if (code.length === 10 && !seen.has(code)) {
      seen.add(code)
      found.push({ code, index: m.index })
    }
  }

  // Méthode 2 — fallback strict
  if (found.length === 0) {
    for (const m of execAll(upper, /(^|[^A-Z0-9])(\d{10})(?!\d)/g)) {
      if (m[2][0] !== '0' && !seen.has(m[2])) {
        seen.add(m[2])
        found.push({ code: m[2], index: m.index + m[1].length })
      }
    }
  }

  found.sort((a, b) => a.index - b.index)
  return found
}

// Termes administratifs de la DEC à exclure de la désignation commerciale
const ADMIN_LINE_RE = /^\s*(?:contingent|régime|franchise|proc[ée]dure|bureau|pays\s+d[e']|origine|pr[ée]f[ée]rence|liste|annexe|rubrique|sous.?poste|valeur\s+stat|masse\s+(?:nette|brute)|poids|quantit|colis|conditionnement|doc[ue]|certif|licen|autor|taux|base|droits?|taxe|tva|acc[iî]se|cst|pa[^r]|nd\b|na\b|article\s+\d|esp[eè]ce\s+tarifaire)/i

// Tronque la désignation dès qu'un terme administratif apparaît en milieu de ligne
const ADMIN_INLINE_RE = /\s+(?:contingent|régime|franchise|proc[ée]dure|origine|pr[ée]f[ée]rence|liste|annexe|rubrique|sous.?poste|valeur\s+stat|droits?|taxe|tva|acc[iî]se)\b.*$/i

function cleanDesignation(str) {
  return str.replace(ADMIN_INLINE_RE, '').replace(/[\s\-:,;]+$/, '').trim()
}

function extractDesignation(afterCode) {
  // Méthode 1 — mot-clé explicite (désignation / libellé)
  const kwMatch = /(?:d[ée]signation(?:\s+commerciale)?(?:\s+des?\s+marchandises?)?|lib[ée]ll[ée])\s*[:\-]?\s*([^\n\r]{5,200})/i.exec(afterCode)
  if (kwMatch) {
    const val = cleanDesignation(kwMatch[1].trim().replace(/\s+/g, ' '))
    if (!ADMIN_LINE_RE.test(val) && /[a-zA-ZÀ-ÿ]{4,}/.test(val)) return val
  }

  // Méthode 2 — première ligne qui ressemble à une description commerciale
  const lines = afterCode.split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 4)
  for (const line of lines.slice(0, 8)) {
    if (/^\d/.test(line)) continue           // commence par un chiffre → code/ref
    if (ADMIN_LINE_RE.test(line)) continue   // terme administratif en début de ligne
    if (line.length > 250) continue          // trop long
    if (!/[a-zA-ZÀ-ÿ]{4,}/.test(line)) continue  // doit contenir un vrai mot
    const cleaned = cleanDesignation(line.replace(/\s+/g, ' '))
    if (/[a-zA-ZÀ-ÿ]{4,}/.test(cleaned)) return cleaned
  }
  return null
}

function extractDecArticles(text) {
  const codesWithPos = extractHSCodesOrdered(text)
  return codesWithPos.map((item, i) => {
    const { code, index } = item

    // Zone de recherche : 800 chars après le code SH (avant le prochain code SH si présent)
    const nextCode = codesWithPos[i + 1]
    const end = nextCode ? Math.min(nextCode.index, index + 800) : index + 800
    const after = text.substring(index + code.length, end)

    // Nombre de colis dans la partie CONDITIONNEMENT de l'article
    let nombreColis = null
    const colisRe = /Nombre\s*de\s*colis\s*[:\-]?\s*(\d[\d\s]*)/i
    const mColis = colisRe.exec(after)
    if (mColis) {
      nombreColis = parseInt(mColis[1].replace(/\s/g, ''), 10)
    }

    // Type de colis (ex: "TE - Pneumatique")
    let typeColis = null
    const typeRe = /Type\s*de\s*colis\s*[:\-]?\s*([^\n]{2,50})/i
    const mType = typeRe.exec(after)
    if (mType) {
      typeColis = mType[1].trim()
    }

    return { position: i + 1, code, designation: extractDesignation(after), nombreColis, typeColis }
  })
}

function extractDecGrossWeight(text) {
  const patterns = [
    /masse\s*brute\s*(?:totale?)?\s*[:\-]?\s*([\d\s.,]+)\s*(kg|t)\b/i,
    /poids\s*brut\s*(?:total)?\s*[:\-]?\s*([\d\s.,]+)\s*(kg|t)\b/i,
    /gross\s*weight\s*[:\-]?\s*([\d\s.,]+)\s*(kg|t)\b/i,
  ]
  for (const re of patterns) {
    const m = re.exec(text)
    if (m) return parseFloat(m[1].replace(/\s/g, '').replace(',', '.'))
  }
  // Fallback : plus grand nombre suivi de kg
  let best = null
  for (const m of execAll(text, /([\d\s.,]+)\s*kg\b/gi)) {
    const val = parseFloat(m[1].replace(/\s/g, '').replace(',', '.'))
    if (!isNaN(val) && val > 100 && (!best || val > best)) best = val
  }
  return best
}

function extractDecPackageCount(text) {
  const patterns = [
    /nombre\s*(?:total\s*)?de\s*colis\s*[:\-]?\s*(\d[\d\s]*)/i,
    /total\s*colis\s*[:\-]?\s*(\d[\d\s]*)/i,
    /n(?:bre?|ombre)\s*colis\s*[:\-]?\s*(\d[\d\s]*)/i,
  ]
  for (const re of patterns) {
    const m = re.exec(text)
    if (m) {
      const val = parseInt(m[1].replace(/\s/g, ''), 10)
      if (!isNaN(val) && val > 0) return val
    }
  }
  // Fallback : plus grand nombre de colis/cartons/ctns
  const re = /(\d[\d\s]*)\s*(?:colis|ctns?|cartons?|pkgs?)\b/gi
  let best = null
  let match
  while ((match = re.exec(text)) !== null) {
    const val = parseInt(match[1].replace(/\s/g, ''), 10)
    if (!isNaN(val) && val > 0 && (!best || val > best)) best = val
  }
  return best
}

// Retourne toutes les valeurs monétaires significatives par devise { EUR: 71907.45, USD: 84369, … }
function extractDecAllValues(text) {
  const byDevise = {}

  // Priorité : patterns avec mot-clé
  const kwRe = /(?:valeur\s*(?:statistique|en\s*douane|d[ée]clar[ée]e?|totale?)|montant\s*total)\s*[:\-]?\s*([\d\s.,]+)\s*(EUR|USD|GBP|CHF|CNY)\b/gi
  for (const m of execAll(text, kwRe)) {
    const val = parseFloat(m[1].replace(/\s/g, '').replace(',', '.'))
    const dev = m[2].toUpperCase()
    if (!isNaN(val) && val > 0 && (!byDevise[dev] || val > byDevise[dev])) byDevise[dev] = val
  }

  // Fallback : toutes les paires nombre+devise > 1000
  if (Object.keys(byDevise).length === 0) {
    const re = /([\d\s.,]+)\s*(EUR|USD|GBP|CHF|CNY)\b/gi
    let m
    while ((m = re.exec(text)) !== null) {
      const val = parseFloat(m[1].replace(/\s/g, '').replace(',', '.'))
      const dev = m[2].toUpperCase()
      if (!isNaN(val) && val > 1000 && (!byDevise[dev] || val > byDevise[dev])) byDevise[dev] = val
    }
  }

  return byDevise
}

// ── Liquidation totale ────────────────────────────────────────────────────────
function extractLiquidationTotale(text) {
  function grab(label) {
    // Cherche le label (insensible casse, espaces flexibles) puis capture ce qui suit
    const re = new RegExp(label + '[\\s\\S]{0,10}?([\\d][\\d\\s.,]+(?:EUR|USD|GBP|CHF|CNY)?(?:\\s*/\\s*[\\d][\\d\\s.,]+(?:EUR|USD|GBP|CHF|CNY)?)?)', 'i')
    const m = re.exec(text)
    return m ? m[1].trim().replace(/\s+/g, ' ') : null
  }

  function grabText(label) {
    const re = new RegExp(label + '[\\s:]{0,5}([a-zA-ZÀ-ÿ][^\\n]{2,60})', 'i')
    const m = re.exec(text)
    return m ? m[1].trim() : null
  }

  return {
    montantFacture:      grab('Montant\\s*total\\s*factur[eé]\\s*:?'),
    montantACouvrir:     grab('Montant\\s*total\\s*[àa]\\s*couvrir\\s*:?'),
    montantAPayer:       grab('Montant\\s*total\\s*[àa]\\s*[Pp]ayer\\s*:?'),
    tauxChange:          grab('Taux\\s*de\\s*change\\s*:?'),
    modePaiement:        grabText('Mode\\s*de\\s*paiement\\s*:?'),
    montantNonCautionné: grab('Montant\\s*total\\s*non\\s*cautionn[eé]\\s*:?'),
    montantCautionné:    grab('Montant\\s*total\\s*cautionn[eé]\\s*:?'),
  }
}

/**
 * Extraction complète d'une déclaration en douane (DEC).
 * Retourne { mrn, articles, poidsBrut, nombreColis, valeur, tauxChange, deviseFacture, containers }
 * - valeur       : { valeur, devise } — valeur en EUR en priorité
 * - tauxChange   : nombre — taux de change DEC (1 EUR = X deviseFacture), dérivé des deux valeurs
 * - deviseFacture: string — devise étrangère détectée (ex: "USD")
 */
export function extractDeclarationData(text) {
  // DEBUG — à retirer après calibration des patterns
  const destIdx = text.search(/[Dd]estinataire/)
  const declIdx = text.search(/[Dd][eé]clarant|[Rr]epr[eé]sentant/)
  if (destIdx !== -1) console.log('[DEC] Autour de Destinataire:\n', JSON.stringify(text.substring(Math.max(0, destIdx - 20), destIdx + 300)))
  if (declIdx !== -1) console.log('[DEC] Autour de Déclarant:\n', JSON.stringify(text.substring(Math.max(0, declIdx - 20), declIdx + 300)))
  const allValues = extractDecAllValues(text)

  // Valeur principale : EUR en priorité, sinon la première trouvée
  const valeur = allValues['EUR']
    ? { valeur: allValues['EUR'], devise: 'EUR' }
    : Object.keys(allValues).length > 0
      ? { valeur: allValues[Object.keys(allValues)[0]], devise: Object.keys(allValues)[0] }
      : null

  // Taux de change : lire directement depuis "Taux de change: 1,1733" en priorité
  let tauxChange = null
  let deviseFacture = null

  // Priorité 1 : taux explicite dans la liquidation totale "Taux de change: 1,1733"
  const tauxDirectRe = /Taux\s*de\s*change\s*:?\s*([\d]+[.,][\d]+)/i
  const mTaux = tauxDirectRe.exec(text)
  if (mTaux) {
    tauxChange = parseFloat(mTaux[1].replace(',', '.'))
  }

  // Priorité 2 : "1 EUR = 1.0831 USD"
  if (!tauxChange) {
    const expliciteRe = /1\s*EUR\s*[=:]\s*([\d.,]+)\s*(USD|GBP|CHF|CNY|JPY|CAD)/i
    const mEx = expliciteRe.exec(text)
    if (mEx) {
      tauxChange = parseFloat(mEx[1].replace(',', '.'))
      deviseFacture = mEx[2].toUpperCase()
    }
  }

  // Détecter la devise étrangère depuis "Montant total facturé: 71 907,45 EUR / 84 369 USD"
  if (!deviseFacture) {
    const devRe = /Montant\s*total\s*factur[eé][^/\n]{0,30}\/[^A-Z]{0,10}(USD|GBP|CHF|CNY|JPY|CAD)/i
    const mDev = devRe.exec(text)
    if (mDev) deviseFacture = mDev[1].toUpperCase()
  }

  // Sinon dérive depuis les deux valeurs de la DEC
  if (!tauxChange && allValues['EUR']) {
    for (const dev of ['USD', 'GBP', 'CHF', 'CNY', 'JPY', 'CAD']) {
      if (allValues[dev]) {
        tauxChange = Math.round((allValues[dev] / allValues['EUR']) * 10000) / 10000
        deviseFacture = dev
        break
      }
    }
  }

  // Nombre de colis : somme des articles en priorité, sinon extraction globale
  const articlesData = extractDecArticles(text)
  const colisParArticles = articlesData.reduce((sum, art) => sum + (art.nombreColis || 0), 0)
  const nombreColis = colisParArticles > 0 ? colisParArticles : extractDecPackageCount(text)

  return {
    mrn: extractMRN(text),
    crn: extractCRN(text),
    articles: articlesData,
    poidsBrut: extractDecGrossWeight(text),
    nombreColis,
    valeur,
    tauxChange,
    deviseFacture,
    containers: extractContainerNumbers(text),
    importateur: extractImportateur(text),
    representant: extractRepresentant(text),
    exportateur: extractExportateur(text),
    declarant: extractDeclarant(text),
    liquidationTotale: extractLiquidationTotale(text),
  }
}

// Fusionne les données financières de plusieurs documents
// (utile pour combiner BL + facture + DEC)
export function mergeFinancialData(existing, incoming) {
  if (!existing) return incoming
  if (!incoming) return existing

  // Devises : prendre la valeur max par devise
  const byDevise = {}
  for (const v of [...existing.valeurs, ...incoming.valeurs]) {
    const num = parseFloat(v.valeur)
    if (!byDevise[v.devise] || num > parseFloat(byDevise[v.devise].valeur)) {
      byDevise[v.devise] = v
    }
  }

  // Poids brut : prendre la valeur max trouvée
  let poidsBrut = existing.poidsBrut
  if (incoming.poidsBrut) {
    const a = poidsBrut ? parseFloat(poidsBrut.valeur) : 0
    const b = parseFloat(incoming.poidsBrut.valeur)
    if (b > a) poidsBrut = incoming.poidsBrut
  }

  return {
    valeurs: Object.values(byDevise),
    poidsBrut,
    poidsNet: existing.poidsNet || incoming.poidsNet,
    quantite: existing.quantite || incoming.quantite,
  }
}
