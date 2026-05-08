// Remplace String.prototype.matchAll (absent sur iOS < 13)
function execAll(str, re) {
  const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
  const results = []
  let m
  while ((m = r.exec(str)) !== null) results.push(m)
  return results
}

// ── Extraction champs spécifiques par type de document ───────────────────────

function extractBLNumber(text) {
  // DEC : "N760 - TAOB95452"
  let m = /N760\s*[-–]\s*([A-Z0-9]{6,20})/i.exec(text)
  if (m) return m[1].trim()
  // Factures / BL : "B/L NO.:COSU6445923520/TAOB95452"
  m = /B\/?L\.?\s*N[°O]?\.?\s*[:.]\s*([A-Z0-9]{6,25}(?:\/[A-Z0-9]{4,20})?)/i.exec(text)
  if (m) return m[1].trim()
  return null
}

function extractHSCodes(text) {
  const found = new Set()
  const upper = text.toUpperCase()

  // Méthode 1 — avec mot-clé (très fiable) :
  // "Nomenclature: 4011100000", "Code NC : 40111000", "HS 4011100000"
  const kwRe = /(?:nomenclature|code\s*n[°oc]|code\s*sh|hs\s*(?:code)?|tarif(?:aire)?)\s*[:#]?\s*(\d{8,10})\b(?!\d)/gi
  for (const m of execAll(upper, kwRe)) {
    let code = m[1]
    if (code.length === 8) code = code + '00'  // compléter à 10 chiffres
    if (code.length === 10) found.add(code)
  }

  // Méthode 2 — sans mot-clé, règles strictes pour éviter les faux positifs :
  // • non précédé d'une lettre ou d'un chiffre (exclut COSU6445923520)
  // • ne commence pas par 0 (exclut réf. comme 0003858321, 0005438120…)
  if (found.size === 0) {
    for (const m of execAll(upper, /(^|[^A-Z0-9])(\d{10})(?!\d)/g)) {
      if (m[2][0] !== '0') found.add(m[2])
    }
  }

  return [...found]
}

function extractDeclarationNumber(text) {
  // MRN : "MRN : 26FRD000I5438120MR2"  (format EU, 18-20 chars alphanumériques)
  let m = /MRN\s*[:#]?\s*([A-Z0-9]{17,22})/i.exec(text)
  if (m) return m[1].trim()
  // N° déclaration / CRN sur une ligne dédiée
  m = /N[°o]\s*d[ée]claration[^:\n]{0,30}[:#]\s*([A-Z0-9]{8,22})/i.exec(text)
  if (m) return m[1].trim()
  // BAE : "FR 26FRD0005438120CR2"
  m = /(?:BAE|bon\s*[aà]\s*enlever)\s*[:#]?\s*((?:FR|[A-Z]{2})\s*[A-Z0-9]{13,20})/i.exec(text)
  if (m) return m[1].replace(/\s+/g, '').trim()
  return null
}

function extractVessel(text) {
  // "BY SHIP: OOCL PORTUGAL 006W"
  let m = /BY SHIP:\s*([A-Z0-9][A-Z0-9\s]+?)(?=\s*\n|\s{3,}|$)/i.exec(text)
  if (m) return m[1].trim()
  // "Vessel: OOCL PORTUGAL   Voyage: 006W"
  m = /VESSEL\s*(?:NAME)?\s*:?\s*([A-Z0-9][A-Z0-9\s]+?)(?:\s+\d|\s*VOYAGE|\n)/i.exec(text)
  if (m) return m[1].trim()
  return null
}

function extractConsignee(text) {
  const upper = text.toUpperCase()
  // DEC : "IMPORTATEUR : DISTRI CASH ACCESSOIRES - FR..."
  let m = /IMPORTATEUR\s*:\s*([A-Z][A-Z\s]{4,50?}?)(?:\s*-\s*FR|\s*\n|\s{3,})/i.exec(upper)
  if (m) return m[1].trim()
  // BL : section Consignee (première ligne non vide après "Consignee")
  m = /CONSIGNEE\s*(?:\([^)]*\))?\s*\n?\s*([A-Z][A-Z\s]{4,50}?)(?:\n|ZA |Z\.A\.|\bRUE\b|\bAVENUE\b|\d{5})/i.exec(upper)
  if (m) return m[1].trim()
  return null
}

function extractGrossWeightNum(text) {
  // "31549.980 KG" ou "31 549,980 KG" — prend le plus grand
  let best = null
  for (const m of execAll(text, /([\d\s.,]+)\s*KG\b/gi)) {
    const val = parseFloat(m[1].replace(/\s/g, '').replace(',', '.'))
    if (!isNaN(val) && val > 100 && (!best || val > best)) best = val
  }
  return best
}

function extractTotalQuantityNum(text) {
  // "3472 Piece(s)" ou "3472 PCE" — prend le plus grand SANS capturer les chiffres précédents
  let best = null
  for (const m of execAll(text, /(^|[^A-Z0-9])(\d{2,6})\s*(pieces?|pce|ctns?)\b/gi)) {
    const val = parseInt(m[2], 10)
    if (!isNaN(val) && val > 0 && val < 100000 && (!best || val > best)) best = val
  }
  return best
}

// Normalise un nom de société pour comparaison : majuscules, sans ponctuation, sans mots génériques
function normalizeName(s) {
  return s.toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\b(SAS|SARL|SA|EURL|SNC|GIE|LTD|CO|LLC|INC|CORP|FR\d+)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function nameSimilarity(a, b) {
  if (!a || !b) return null
  const na = normalizeName(a)
  const nb = normalizeName(b)
  if (na === nb) return 'ok'
  // Un nom est-il contenu dans l'autre ?
  const wordsA = new Set(na.split(' ').filter(w => w.length > 3))
  const wordsB = new Set(nb.split(' ').filter(w => w.length > 3))
  const common = [...wordsA].filter(w => wordsB.has(w))
  const ratio = common.length / Math.max(wordsA.size, wordsB.size, 1)
  if (ratio >= 0.5) return 'ok'
  if (ratio >= 0.25) return 'warning'
  return 'error'
}

function numClose(a, b, tolerancePct = 1) {
  if (a == null || b == null) return null
  const diff = Math.abs(a - b) / Math.max(a, b, 1)
  return diff <= tolerancePct / 100 ? 'ok' : 'error'
}

// ── Extraction complète d'un document ─────────────────────────────────────────

export function extractAllFields(text, docType) {
  return {
    docType,
    blNumber: extractBLNumber(text),
    hsCodes: extractHSCodes(text),
    vessel: extractVessel(text),
    consignee: extractConsignee(text),
    grossWeightNum: extractGrossWeightNum(text),
    totalQuantityNum: extractTotalQuantityNum(text),
    declarationNumber: docType === 'declaration' ? extractDeclarationNumber(text) : null,
  }
}

// ── Concordance Step 0 : saisie utilisateur vs DEC ───────────────────────────

function parseNumFr(str) {
  if (str === null || str === undefined || str === '') return null
  const s = String(str).trim().replace(/\s/g, '')
  if (/,\d{1,2}$/.test(s)) return parseFloat(s.replace(/\./g, '').replace(',', '.'))
  return parseFloat(s.replace(/,/g, ''))
}

/**
 * Compare les valeurs saisies par l'utilisateur avec les données extraites de la DEC.
 * @param {object} decData  — résultat de extractDeclarationData()
 * @param {object} userInput — { totalFactures, monnaie, tauxConversion, poidsBrut, nombreColis }
 * @returns {Array} checks compatibles avec ConcordancePanel
 */
export function buildStep0Concordance(decData, userInput) {
  const checks = []

  // ── 1. Poids brut ─────────────────────────────────────────────────────────────
  const userWeight = parseNumFr(userInput.poidsBrut)
  const decWeight = decData.poidsBrut
  if (userWeight != null && !isNaN(userWeight) && decWeight != null) {
    const diff = Math.abs(userWeight - decWeight) / Math.max(userWeight, decWeight) * 100
    const status = diff <= 1 ? 'ok' : diff <= 5 ? 'warning' : 'error'
    checks.push({
      id: 'weight',
      label: 'Poids brut',
      status,
      rows: [{
        label: 'Poids brut (kg)',
        values: [
          { source: 'Documents commerciaux', value: `${userWeight.toLocaleString('fr-FR')} kg` },
          { source: 'Déclaration en douane', value: `${decWeight.toLocaleString('fr-FR')} kg` },
        ],
        status,
        message: status === 'ok'
          ? 'Concordant'
          : `Écart : ${diff.toFixed(1)}% (${Math.abs(userWeight - decWeight).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} kg)`,
      }],
    })
  }

  // ── 2. Nombre de colis ────────────────────────────────────────────────────────
  const userColisRaw = String(userInput.nombreColis || '').replace(/\s/g, '')
  const userColis = userColisRaw ? parseInt(userColisRaw, 10) : NaN
  const decColis = decData.nombreColis
  if (!isNaN(userColis) && userColis > 0 && decColis != null) {
    const diff = Math.abs(userColis - decColis) / Math.max(userColis, decColis) * 100
    const status = diff === 0 ? 'ok' : diff <= 3 ? 'warning' : 'error'
    checks.push({
      id: 'colis',
      label: 'Nombre de colis',
      status,
      rows: [{
        label: 'Total colis',
        values: [
          { source: 'Documents commerciaux', value: userColis.toLocaleString('fr-FR') },
          { source: 'Déclaration en douane', value: decColis.toLocaleString('fr-FR') },
        ],
        status,
        message: status === 'ok' ? 'Concordant' : `Écart : ${Math.abs(userColis - decColis)} colis`,
      }],
    })
  }

  // ── 3. Valeur facturée vs valeur déclarée ─────────────────────────────────────
  const userValeur = parseNumFr(userInput.totalFactures)
  const userDevise = userInput.monnaie || 'EUR'
  const userTaux = parseNumFr(userInput.tauxConversion) || 1
  const decVal = decData.valeur

  if (userValeur != null && !isNaN(userValeur) && userValeur > 0 && decVal) {
    let userValConverti = userValeur
    let deviseRef = userDevise

    if (userDevise !== decVal.devise) {
      if (decVal.devise === 'EUR' && userTaux > 0) {
        // Factures en devise étrangère → convertir en EUR
        userValConverti = userValeur / userTaux
        deviseRef = 'EUR'
      } else if (userDevise === 'EUR' && userTaux > 0) {
        // Factures en EUR → convertir dans la devise DEC
        userValConverti = userValeur * userTaux
        deviseRef = decVal.devise
      } else {
        // Devises différentes, pas de taux → avertissement
        checks.push({
          id: 'value',
          label: 'Valeur déclarée',
          status: 'warning',
          rows: [{
            label: 'Valeur',
            values: [
              { source: 'Documents commerciaux', value: `${userValeur.toLocaleString('fr-FR')} ${userDevise}` },
              { source: 'Déclaration en douane', value: `${decVal.valeur.toLocaleString('fr-FR')} ${decVal.devise}` },
            ],
            status: 'warning',
            message: 'Devises différentes — saisissez le taux de conversion pour comparer',
          }],
        })
        return checks
      }
    }

    const ecartAbsolu = Math.abs(userValConverti - decVal.valeur)
    const diff = ecartAbsolu / Math.max(userValConverti, decVal.valeur) * 100
    const status = ecartAbsolu < 0.01 ? 'ok' : diff <= 5 ? 'warning' : 'error'
    const labelConv = userDevise !== deviseRef
      ? `${userValeur.toLocaleString('fr-FR')} ${userDevise} → ${userValConverti.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ${deviseRef}`
      : `${userValeur.toLocaleString('fr-FR')} ${deviseRef}`

    checks.push({
      id: 'value',
      label: 'Valeur déclarée',
      status,
      rows: [{
        label: `Valeur en ${deviseRef}`,
        values: [
          { source: 'Documents commerciaux', value: labelConv },
          { source: 'Déclaration en douane', value: `${decVal.valeur.toLocaleString('fr-FR')} ${decVal.devise}` },
        ],
        status,
        message: status === 'ok'
          ? 'Concordant'
          : `Écart : ${ecartAbsolu.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ${deviseRef} (${diff.toFixed(2)}%)`,
      }],
    })
  }

  return checks
}

// ── Analyse de concordance multi-documents (ancienne version, conservée) ───────

/**
 * docs : tableau de { name, type, text?, containers[], sealMap{}, financial{}, fields{} }
 * Retourne un tableau de checks : { id, label, status, rows }
 */
export function buildConcordance(docs) {
  if (!docs || docs.length < 2) return []
  const checks = []

  const byType = {}
  for (const d of docs) {
    if (!byType[d.type]) byType[d.type] = []
    byType[d.type].push(d)
  }

  const allContainers = [...new Set(docs.flatMap(d => d.containers || []))]

  // ── 1. Conteneurs ───────────────────────────────────────────────────────────
  if (allContainers.length > 0) {
    const rows = allContainers.map(cnum => {
      const sources = docs.filter(d => (d.containers || []).includes(cnum))
      const missing = docs.filter(d => (d.containers || []).length > 0 && !(d.containers || []).includes(cnum))
      return {
        label: cnum,
        values: docs.map(d => ({
          source: d.name,
          found: (d.containers || []).includes(cnum),
        })),
        status: missing.length > 0 ? 'warning' : 'ok',
        message: missing.length > 0
          ? `Absent de : ${missing.map(d => d.name).join(', ')}`
          : 'Présent dans tous les documents',
      }
    })
    const hasError = rows.some(r => r.status !== 'ok')
    checks.push({ id: 'containers', label: 'Numéros de conteneurs', status: hasError ? 'warning' : 'ok', rows })
  }

  // ── 2. Plombs BL ────────────────────────────────────────────────────────────
  const docsWithSeals = docs.filter(d => Object.keys(d.sealMap || {}).length > 0)
  if (docsWithSeals.length >= 2 && allContainers.length > 0) {
    const rows = allContainers.map(cnum => {
      const sealValues = docsWithSeals
        .map(d => ({ source: d.name, seal: (d.sealMap || {})[cnum] || null }))
        .filter(s => s.seal)
      const uniqueSeals = [...new Set(sealValues.map(s => s.seal))]
      const status = sealValues.length < 2 ? 'missing'
        : uniqueSeals.length === 1 ? 'ok' : 'error'
      return {
        label: cnum,
        values: sealValues,
        status,
        message: status === 'ok'
          ? `Plomb concordant : ${uniqueSeals[0]}`
          : status === 'error'
            ? `Divergence : ${sealValues.map(s => `${s.seal} (${s.source})`).join(' ≠ ')}`
            : 'Plomb trouvé dans un seul document',
      }
    })
    const hasError = rows.some(r => r.status === 'error')
    const hasMissing = rows.some(r => r.status === 'missing')
    checks.push({
      id: 'seals',
      label: 'Plombs / Scellés',
      status: hasError ? 'error' : hasMissing ? 'warning' : 'ok',
      rows,
    })
  }

  // ── 3. N° de BL ─────────────────────────────────────────────────────────────
  const blNums = docs.filter(d => d.fields?.blNumber).map(d => ({ source: d.name, value: d.fields.blNumber }))
  if (blNums.length >= 2) {
    // Concordance : le numéro d'un doc est-il contenu dans celui d'un autre ?
    const normalized = blNums.map(b => ({ ...b, key: b.value.toUpperCase() }))
    const refKey = normalized[0].key
    const allMatch = normalized.every(b => b.key.includes(refKey) || refKey.includes(b.key))
    checks.push({
      id: 'blNumber',
      label: 'N° Bill of Lading',
      status: allMatch ? 'ok' : 'warning',
      rows: [{ label: 'Référence BL', values: blNums, status: allMatch ? 'ok' : 'warning', message: allMatch ? 'Concordant' : 'Références différentes — vérifier' }],
    })
  }

  // ── 4. Poids brut ────────────────────────────────────────────────────────────
  const weights = docs.filter(d => d.fields?.grossWeightNum).map(d => ({ source: d.name, value: d.fields.grossWeightNum }))
  if (weights.length >= 2) {
    const vals = weights.map(w => w.value)
    const min = Math.min(...vals), max = Math.max(...vals)
    const status = numClose(min, max, 1) === 'ok' ? 'ok' : numClose(min, max, 5) === 'ok' ? 'warning' : 'error'
    checks.push({
      id: 'weight',
      label: 'Poids brut',
      status,
      rows: [{
        label: 'Poids brut total',
        values: weights.map(w => ({ source: w.source, value: `${w.value.toLocaleString('fr-FR')} KG` })),
        status,
        message: status === 'ok' ? 'Concordant' : `Écart : ${(max - min).toLocaleString('fr-FR')} KG`,
      }],
    })
  }

  // ── 5. Quantité totale ────────────────────────────────────────────────────────
  const quantities = docs.filter(d => d.fields?.totalQuantityNum).map(d => ({ source: d.name, value: d.fields.totalQuantityNum }))
  if (quantities.length >= 2) {
    const vals = quantities.map(q => q.value)
    const min = Math.min(...vals), max = Math.max(...vals)
    const status = min === max ? 'ok' : numClose(min, max, 2) === 'ok' ? 'warning' : 'error'
    checks.push({
      id: 'quantity',
      label: 'Quantité totale',
      status,
      rows: [{
        label: 'Nombre d\'unités',
        values: quantities.map(q => ({ source: q.source, value: `${q.value.toLocaleString('fr-FR')} PCE` })),
        status,
        message: status === 'ok' ? 'Concordant' : `Écart : ${max - min} unités`,
      }],
    })
  }

  // ── 6. Valeur facturée ────────────────────────────────────────────────────────
  // Comparer la somme des factures vs la valeur DEC (même devise)
  const factures = docs.filter(d => d.type === 'facture')
  const decs = docs.filter(d => d.type === 'declaration')
  if (factures.length > 0 && decs.length > 0) {
    const currencies = new Set([
      ...factures.flatMap(d => (d.financial?.valeurs || []).map(v => v.devise)),
      ...decs.flatMap(d => (d.financial?.valeurs || []).map(v => v.devise)),
    ])
    const valueRows = []
    for (const devise of currencies) {
      const facTotal = factures.reduce((sum, d) => {
        const v = (d.financial?.valeurs || []).find(x => x.devise === devise)
        return sum + (v ? parseFloat(v.valeur) : 0)
      }, 0)
      const decVal = decs.flatMap(d => d.financial?.valeurs || []).find(v => v.devise === devise)
      if (facTotal === 0 || !decVal) continue
      const decNum = parseFloat(decVal.valeur)
      const status = numClose(facTotal, decNum, 1) === 'ok' ? 'ok'
        : numClose(facTotal, decNum, 5) === 'ok' ? 'warning' : 'error'
      valueRows.push({
        label: `Valeur en ${devise}`,
        values: [
          { source: 'Factures (total)', value: `${facTotal.toLocaleString('fr-FR')} ${devise}` },
          { source: decs[0].name, value: `${decNum.toLocaleString('fr-FR')} ${devise}` },
        ],
        status,
        message: status === 'ok' ? 'Concordant'
          : `Écart : ${Math.abs(facTotal - decNum).toLocaleString('fr-FR')} ${devise}`,
      })
    }
    if (valueRows.length > 0) {
      const hasError = valueRows.some(r => r.status === 'error')
      const hasWarn = valueRows.some(r => r.status === 'warning')
      checks.push({
        id: 'value',
        label: 'Valeur facturée',
        status: hasError ? 'error' : hasWarn ? 'warning' : 'ok',
        rows: valueRows,
      })
    }
  }

  // ── 7. Codes SH (Nomenclature) ────────────────────────────────────────────────
  const factureHSCodes = new Set(docs.filter(d => d.type === 'facture').flatMap(d => d.fields?.hsCodes || []))
  const decHSCodes = new Set(docs.filter(d => d.type === 'declaration').flatMap(d => d.fields?.hsCodes || []))
  if (factureHSCodes.size > 0 && decHSCodes.size > 0) {
    const allCodes = [...new Set([...factureHSCodes, ...decHSCodes])]
    const rows = allCodes.map(code => {
      const inFac = factureHSCodes.has(code)
      const inDec = decHSCodes.has(code)
      const status = inFac && inDec ? 'ok' : 'warning'
      return {
        label: code,
        values: [
          { source: 'Factures', value: inFac ? '✓ Présent' : '— Absent' },
          { source: 'DEC', value: inDec ? '✓ Présent' : '— Absent' },
        ],
        status,
        message: status === 'ok' ? 'Code présent dans les deux' : inFac ? 'Code absent de la DEC' : 'Code absent des factures',
      }
    })
    const hasError = rows.some(r => r.status !== 'ok')
    checks.push({ id: 'hsCodes', label: 'Codes SH (Nomenclature)', status: hasError ? 'warning' : 'ok', rows })
  }

  // ── 8. Destinataire / Importateur ─────────────────────────────────────────────
  const consignees = docs.filter(d => d.fields?.consignee).map(d => ({ source: d.name, value: d.fields.consignee }))
  if (consignees.length >= 2) {
    const ref = consignees[0].value
    const allSimilar = consignees.every(c => nameSimilarity(ref, c.value) !== 'error')
    const status = consignees.every(c => nameSimilarity(ref, c.value) === 'ok') ? 'ok' : allSimilar ? 'warning' : 'error'
    checks.push({
      id: 'consignee',
      label: 'Destinataire / Importateur',
      status,
      rows: [{
        label: 'Identité destinataire',
        values: consignees,
        status,
        message: status === 'ok' ? 'Concordant' : 'Vérifier les noms — légères différences détectées',
      }],
    })
  }

  return checks
}
