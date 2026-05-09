import { useState, useRef, useMemo, useEffect } from 'react'
import { uid } from '../utils'
import { extractTextFromPDF, extractDeclarationData, extractBLData } from '../utils/extraction'
import { buildStep0Concordance } from '../utils/concordance'
import ConcordancePanel from '../components/ConcordancePanel'

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'CNY', 'JPY', 'CAD']

export default function Step0Documentaire({ data, update, goNext }) {
  const [decDoc, setDecDoc] = useState(data.docDeclaration || null)
  const [blDoc, setBlDoc] = useState(data.docBL || null)
  const [loading, setLoading] = useState(false)
  const [loadingBL, setLoadingBL] = useState(false)
  const [error, setError] = useState(null)
  const [errorBL, setErrorBL] = useState(null)
  const fileInputRef = useRef()
  const blInputRef = useRef()

  // Articles éditables (copie locale pour permettre correction SH + colis)
  const [articles, setArticles] = useState(data.docDeclaration?.data?.articles || [])

  // Saisie manuelle (documents commerciaux)
  const [totalFactures, setTotalFactures] = useState(data.saisieStep0?.totalFactures || '')
  const [monnaie, setMonnaie] = useState(data.saisieStep0?.monnaie || 'EUR')
  const [tauxConversion, setTauxConversion] = useState(data.saisieStep0?.tauxConversion || '')
  const [tauxFromDec, setTauxFromDec] = useState(data.saisieStep0?.tauxFromDec ?? false)
  const [poidsBrut, setPoidsBrut] = useState(data.saisieStep0?.poidsBrut || '')
  const [nombreColis, setNombreColis] = useState(data.saisieStep0?.nombreColis || '')

  // Parties éditables
  const [importateur, setImportateur] = useState(data.importateur || '')
  const [exportateur, setExportateur] = useState(data.exportateur || '')
  const [representant, setRepresentant] = useState(data.representant || '')
  const [declarant, setDeclarant] = useState(data.declarant || '')

  // Labels NC et conseils indexés par code SH
  const [hsLabels, setHsLabels] = useState({})
  const [conseils, setConseils] = useState({})

  // Sync articles depuis decDoc quand il change
  useEffect(() => {
    if (decDoc?.data?.articles) {
      setArticles(decDoc.data.articles.map(a => ({ ...a })))
    }
  }, [decDoc])

  // Charger label NC + conseils pour chaque article
  useEffect(() => {
    articles.forEach(art => {
      if (!art.code) return
      if (hsLabels[art.code] === undefined) {
        loadHsLabel(art.code, art.designation)
      }
    })
  }, [articles])

  async function loadHsLabel(code, designation) {
    try {
      const res = await fetch(`/api/hs-lookup?code=${code}`)
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const json = await res.json()
      const label = json.label || '—'
      setHsLabels(prev => ({ ...prev, [code]: label }))
      if (label && label !== '—') fetchConseils(code, label, designation)
    } catch {
      setHsLabels(prev => ({ ...prev, [code]: '—' }))
    }
  }

  async function fetchConseils(code, labelNC, designationCommerciale) {
    if (conseils[code] !== undefined) return
    setConseils(prev => ({ ...prev, [code]: 'loading' }))
    try {
      const res = await fetch('/api/controle-conseils', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, labelNC, designationCommerciale }),
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const json = await res.json()
      setConseils(prev => ({ ...prev, [code]: json.conseils || [] }))
    } catch {
      setConseils(prev => ({ ...prev, [code]: [] }))
    }
  }

  function updateArticle(idx, field, value) {
    setArticles(prev => {
      const next = prev.map((a, i) => i === idx ? { ...a, [field]: value } : a)
      // Si le code SH change, on efface le label et les conseils pour forcer un rechargement
      if (field === 'code' && value.length === 10) {
        const newCode = value.trim()
        setHsLabels(h => { const n = { ...h }; delete n[newCode]; return n })
        setConseils(c => { const n = { ...c }; delete n[newCode]; return n })
      }
      return next
    })
  }

  // Mise à jour total colis quand articles changent
  useEffect(() => {
    const total = articles.reduce((s, a) => s + (Number(a.nombreColis) || 0), 0)
    if (total > 0) setNombreColis(String(total))
  }, [articles])

  // Conteneurs
  const [conteneurs, setConteneurs] = useState(data.extractedConteneurs || [])

  async function handleBLFile(file) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErrorBL('Seuls les fichiers PDF sont acceptés.')
      return
    }
    setLoadingBL(true)
    setErrorBL(null)
    try {
      const text = await extractTextFromPDF(file)
      const blData = extractBLData(text)
      const newBL = { name: file.name, data: blData }
      setBlDoc(newBL)
      update({ docBL: newBL })

      // Pré-remplir les plombs dans plombsBL si conteneurs déjà connus
      if (Object.keys(blData.sealMap).length > 0 && conteneurs.length > 0) {
        const newPlombs = { ...data.plombsBL }
        conteneurs.forEach(c => {
          const num = c.numero.toUpperCase()
          if (blData.sealMap[num] && !newPlombs[c.id]) {
            newPlombs[c.id] = blData.sealMap[num]
          }
        })
        update({ plombsBL: newPlombs })
      }
    } catch (err) {
      setErrorBL(`Erreur d'extraction BL : ${err.message}`)
    } finally {
      setLoadingBL(false)
    }
  }

  // Concordance calculée en live
  const concordanceChecks = useMemo(() => {
    if (!decDoc?.data) return []
    if (!totalFactures && !poidsBrut && !nombreColis) return []
    const decDataWithArticles = { ...decDoc.data, articles, nombreColis: articles.reduce((s, a) => s + (Number(a.nombreColis) || 0), 0) }
    return buildStep0Concordance(decDataWithArticles, { totalFactures, monnaie, tauxConversion, poidsBrut, nombreColis })
  }, [decDoc, articles, totalFactures, monnaie, tauxConversion, poidsBrut, nombreColis])

  async function handleFile(file) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Seuls les fichiers PDF sont acceptés.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const text = await extractTextFromPDF(file)
      const extracted = extractDeclarationData(text)
      const newDoc = { name: file.name, data: extracted }
      setDecDoc(newDoc)

      // Conteneurs extraits de la DEC
      const newConteneurs = extracted.containers.map(num => ({
        id: uid(), numero: num, selected: true,
      }))
      setConteneurs(newConteneurs)

      // Pré-remplir devise + taux de change depuis la DEC
      if (extracted.deviseFacture) {
        setMonnaie(extracted.deviseFacture)
      }
      if (extracted.tauxChange) {
        setTauxConversion(String(extracted.tauxChange))
        setTauxFromDec(true)
      }

      // Pré-remplir nombre de colis depuis la somme des articles
      const totalColisArticles = extracted.articles
        .reduce((sum, art) => sum + (art.nombreColis || 0), 0)
      if (totalColisArticles > 0) {
        setNombreColis(String(totalColisArticles))
      } else if (extracted.nombreColis) {
        setNombreColis(String(extracted.nombreColis))
      }

      // Pré-remplir importateur, exportateur et représentant depuis la DEC
      // Si non détecté → "Case vide", sinon uniquement le nom extrait
      setImportateur(extracted.importateur || 'Case vide')
      setExportateur(extracted.exportateur || 'Case vide')
      setRepresentant(extracted.representant || 'Case vide')
      setDeclarant(extracted.declarant || 'Case vide')

      update({
        docDeclaration: newDoc,
        extractedConteneurs: newConteneurs,
        importateur: extracted.importateur || 'Case vide',
        exportateur: extracted.exportateur || 'Case vide',
        representant: extracted.representant || 'Case vide',
        declarant: extracted.declarant || 'Case vide',
      })
    } catch (err) {
      setError(`Erreur d'extraction : ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  function updateContainerNum(id, value) {
    setConteneurs(prev => prev.map(c => c.id === id ? { ...c, numero: value.toUpperCase() } : c))
  }

  function toggleContainer(id) {
    setConteneurs(prev => prev.map(c => c.id === id ? { ...c, selected: !c.selected } : c))
  }

  function addContainerManual() {
    setConteneurs(prev => [...prev, { id: uid(), numero: '', selected: true }])
  }

  function removeContainer(id) {
    setConteneurs(prev => prev.filter(c => c.id !== id))
  }

  function applyToControl() {
    const selected = conteneurs.filter(c => c.selected && c.numero.trim())
    if (selected.length === 0) {
      alert('Sélectionnez au moins un conteneur avant de continuer.')
      return
    }

    const saisieStep0 = { totalFactures, monnaie, tauxConversion, tauxFromDec, poidsBrut, nombreColis }
    const updates = {
      conteneurs: selected.map(c => ({ id: c.id, numero: c.numero.trim() })),
      extractedConteneurs: conteneurs,
      docDeclaration: decDoc,
      saisieStep0,
      importateur: importateur.trim(),
      exportateur: exportateur.trim(),
      representant: representant.trim(),
      declarant: declarant.trim(),
    }

    // Pré-remplir le MRN dans l'étape 1 si non encore saisi
    if (decDoc?.data?.mrn && !data.numeroDeclaration) {
      updates.numeroDeclaration = decDoc.data.mrn
    }

    update(updates)
    goNext()
  }

  const selectedCount = conteneurs.filter(c => c.selected && c.numero.trim()).length

  // Numérotation dynamique des sections selon ce qui est affiché
  let _n = 0
  const sn = () => ++_n

  return (
    <div className="step-content">
      <h2 className="step-title">Contrôle Documentaire</h2>
      <p className="step-description">
        Importez la déclaration en douane pour identifier les articles déclarés,
        puis saisissez les valeurs issues de vos documents commerciaux pour vérifier la concordance.
      </p>

      {/* 1. Import DEC + BL */}
      <section className="card">
        <h3 className="card-title">{sn()}. Documents</h3>

        {/* DEC */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Déclaration en douane
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary"
              onClick={() => fileInputRef.current?.click()} disabled={loading}>
              {loading ? 'Extraction en cours…' : decDoc ? '↺ Remplacer la DEC' : '+ Importer la déclaration (PDF)'}
            </button>
            <input ref={fileInputRef} type="file" accept=".pdf" hidden
              onChange={e => { if (e.target.files[0]) { handleFile(e.target.files[0]); e.target.value = '' } }} />
            {decDoc && <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>📄 {decDoc.name}</span>}
          </div>
          {error && <div className="alert alert-error" style={{ marginTop: '0.5rem' }}>{error}</div>}
          {decDoc?.data?.mrn && (
            <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              {decDoc.data.crn && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="form-label" style={{ marginBottom: 0 }}>N° CRN :</span>
                  <code className="mrn-code">{decDoc.data.crn}</code>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="form-label" style={{ marginBottom: 0 }}>N° MRN :</span>
                <code className="mrn-code">{decDoc.data.mrn}</code>
              </div>
            </div>
          )}
        </div>

        {/* BL */}
        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1rem', marginBottom: '0.5rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Bill of Lading
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary"
              onClick={() => blInputRef.current?.click()} disabled={loadingBL}>
              {loadingBL ? 'Extraction en cours…' : blDoc ? '↺ Remplacer le BL' : '+ Importer le Bill of Lading (PDF)'}
            </button>
            <input ref={blInputRef} type="file" accept=".pdf" hidden
              onChange={e => { if (e.target.files[0]) { handleBLFile(e.target.files[0]); e.target.value = '' } }} />
            {blDoc && <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>📄 {blDoc.name}</span>}
          </div>
          {errorBL && <div className="alert alert-error" style={{ marginTop: '0.5rem' }}>{errorBL}</div>}

          {/* Résumé extraction BL */}
          {blDoc?.data && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {blDoc.data.containers.length > 0 && (
                <div>
                  🚢 <strong>{blDoc.data.containers.length}</strong> conteneur(s) détecté(s) :
                  <span style={{ fontFamily: 'monospace', marginLeft: '0.4rem', color: 'var(--color-primary)' }}>
                    {blDoc.data.containers.join(' / ')}
                  </span>
                </div>
              )}
              {Object.keys(blDoc.data.sealMap).length > 0 && (
                <div>
                  🔒 <strong>{Object.keys(blDoc.data.sealMap).length}</strong> plomb(s) détecté(s) :
                  <span style={{ fontFamily: 'monospace', marginLeft: '0.4rem', color: 'var(--color-primary)' }}>
                    {Object.entries(blDoc.data.sealMap).map(([c, p]) => `${c} → ${p}`).join(' / ')}
                  </span>
                </div>
              )}
              {Object.keys(blDoc.data.sealMap).length === 0 && (
                <div style={{ color: 'var(--color-text-muted)' }}>⚠️ Aucun plomb détecté automatiquement — à saisir manuellement en étape 2</div>
              )}
            </div>
          )}
        </div>

        {/* Intervenants */}
        {decDoc && (
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Exportateur <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', fontWeight: 400 }}>(case 2)</span></label>
              <input type="text" className="form-control" value={exportateur}
                onChange={e => { setExportateur(e.target.value); update({ exportateur: e.target.value }) }}
                placeholder="Non détecté" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Importateur <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', fontWeight: 400 }}>(case 8 — destinataire)</span></label>
              <input type="text" className="form-control" value={importateur}
                onChange={e => { setImportateur(e.target.value); update({ importateur: e.target.value }) }}
                placeholder="Non détecté" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Représentant en douane <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', fontWeight: 400 }}>(case 14)</span></label>
              <input type="text" className="form-control" value={representant}
                onChange={e => { setRepresentant(e.target.value); update({ representant: e.target.value }) }}
                placeholder="Non détecté" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Déclarant</label>
              <input type="text" className="form-control" value={declarant}
                onChange={e => { setDeclarant(e.target.value); update({ declarant: e.target.value }) }}
                placeholder="Non détecté" />
            </div>
          </div>
        )}
      </section>

      {/* 2. Articles déclarés (conditionnel) */}
      {articles.length > 0 && (
        <section className="card">
          <h3 className="card-title">{sn()}. Articles déclarés</h3>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
            {articles.length} article{articles.length > 1 ? 's' : ''} identifié{articles.length > 1 ? 's' : ''} dans la déclaration
          </p>
          <div className="articles-table">
            {articles.map((art, idx) => (
              <div key={idx} className="article-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.35rem' }}>

                {/* Ligne colis + type */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <input
                    type="number"
                    min="0"
                    value={art.nombreColis ?? ''}
                    onChange={e => updateArticle(idx, 'nombreColis', parseInt(e.target.value) || 0)}
                    style={{
                      width: '80px', fontWeight: 600, fontSize: '0.85rem',
                      background: '#1e40af', color: '#fff',
                      border: 'none', borderRadius: '0.35rem',
                      padding: '0.15rem 0.4rem', textAlign: 'center',
                    }}
                    title="Nombre de colis — cliquez pour modifier"
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>colis</span>
                  {art.typeColis && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{art.typeColis}</span>}
                </div>

                {/* Ligne code SH + désignation */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', flexWrap: 'wrap' }}>
                  <span className="article-position">#{art.position}</span>
                  <input
                    type="text"
                    value={art.code}
                    maxLength={10}
                    onChange={e => updateArticle(idx, 'code', e.target.value.replace(/\D/g, ''))}
                    style={{
                      fontFamily: 'monospace', fontWeight: 700, fontSize: '0.9rem',
                      background: 'var(--color-bg-subtle, #eef2ff)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '0.35rem', padding: '0.15rem 0.5rem',
                      width: '120px',
                    }}
                    title="Code SH — cliquez pour modifier"
                  />
                  <span className="article-designation">
                    {art.designation || <em style={{ color: 'var(--color-text-muted)' }}>désignation non extraite</em>}
                  </span>
                </div>

                {/* Label NC */}
                <div style={{ paddingLeft: '2.5rem', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                  {hsLabels[art.code] === undefined
                    ? <span>⏳ Chargement nomenclature…</span>
                    : hsLabels[art.code] === '—'
                      ? <span>Nomenclature non trouvée</span>
                      : <>🏷 <span style={{ color: 'var(--color-primary)', fontStyle: 'normal' }}>{hsLabels[art.code]}</span></>
                  }
                </div>

                {/* Conseils de contrôle */}
                {hsLabels[art.code] && hsLabels[art.code] !== '—' && (
                  <div style={{ paddingLeft: '2.5rem', marginTop: '0.25rem', width: '100%' }}>
                    {conseils[art.code] === undefined || conseils[art.code] === 'loading' ? (
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>⏳ Génération des points de contrôle…</div>
                    ) : conseils[art.code].length === 0 ? null : (
                      <div style={{
                        background: 'var(--color-bg-subtle, #f0f4ff)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '0.5rem',
                        padding: '0.75rem 1rem',
                      }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-primary)', marginBottom: '0.4rem' }}>
                          🔍 Points de contrôle physique
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          {conseils[art.code].map((c, i) => (
                            <li key={i} style={{ fontSize: '0.82rem', color: 'var(--color-text)', lineHeight: 1.45 }}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Total colis */}
          {(() => {
            const total = articles.reduce((sum, art) => sum + (Number(art.nombreColis) || 0), 0)
            if (total === 0) return null
            return (
              <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.6rem' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>Total colis déclarés :</span>
                <span style={{ background: '#1e40af', color: '#fff', borderRadius: '0.35rem', padding: '0.15rem 0.6rem', fontSize: '0.85rem', fontWeight: 700 }}>
                  📦 {total.toLocaleString('fr-FR')} colis
                </span>
              </div>
            )
          })()}
        </section>
      )}

      {/* 3. Conteneurs */}
      <section className="card">
        <h3 className="card-title">{sn()}. Conteneurs à contrôler</h3>
        <p className="step-description" style={{ marginBottom: '0.75rem' }}>
          {conteneurs.length > 0
            ? 'Numéros extraits de la déclaration. Cochez ceux à contrôler, corrigez si besoin.'
            : 'Importez la déclaration ou ajoutez manuellement.'}
        </p>

        {conteneurs.length === 0 ? (
          <p className="empty-state">Aucun conteneur trouvé.</p>
        ) : (
          <ul className="extracted-list">
            {conteneurs.map(c => (
              <li key={c.id} className="extracted-item">
                <input type="checkbox" checked={c.selected} onChange={() => toggleContainer(c.id)} className="extracted-check" />
                <input type="text" className="form-control extracted-input" value={c.numero}
                  onChange={e => updateContainerNum(c.id, e.target.value)}
                  placeholder="Ex: MSCU1234567" maxLength={11} />
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => removeContainer(c.id)} title="Supprimer">✕</button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="btn btn-ghost" onClick={addContainerManual} style={{ marginTop: '0.5rem' }}>
          + Ajouter manuellement
        </button>
      </section>

      {/* 4. Saisie manuelle */}
      <section className="card">
        <h3 className="card-title">{sn()}. Données documents commerciaux</h3>

        {/* Liquidation totale extraite de la DEC */}
        {decDoc?.data?.liquidationTotale && (() => {
          const liq = decDoc.data.liquidationTotale
          const rows = [
            { label: 'Montant total facturé', val: liq.montantFacture },
            { label: 'Montant total à couvrir', val: liq.montantACouvrir },
            { label: 'Montant total à payer', val: liq.montantAPayer },
            { label: 'Taux de change', val: liq.tauxChange },
            { label: 'Mode de paiement', val: liq.modePaiement },
            { label: 'Montant non cautionné', val: liq.montantNonCautionné },
            { label: 'Montant cautionné', val: liq.montantCautionné },
          ].filter(r => r.val)

          if (rows.length === 0) return null
          return (
            <div style={{
              background: 'var(--color-bg-subtle, #f8f9ff)',
              border: '1px solid var(--color-border)',
              borderRadius: '0.5rem',
              padding: '0.75rem 1rem',
              marginBottom: '1.25rem',
            }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-primary)', marginBottom: '0.5rem' }}>
                📋 Liquidation totale (extrait DEC)
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <tbody>
                  {rows.map(({ label, val }) => (
                    <tr key={label} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '0.3rem 0.5rem 0.3rem 0', color: 'var(--color-text-muted)', width: '55%' }}>{label}</td>
                      <td style={{ padding: '0.3rem 0', fontWeight: 500, color: 'var(--color-text)' }}>{val}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })()}

        <p className="step-description" style={{ marginBottom: '1rem' }}>
          Saisissez les valeurs issues de vos factures, BL et packing list.
          {decDoc?.data && (
            <span style={{ color: 'var(--color-primary)', fontWeight: 500 }}>
              {' '}Les écarts avec la déclaration seront calculés automatiquement.
            </span>
          )}
        </p>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Total facture(s)</label>
            <input type="text" className="form-control" value={totalFactures}
              onChange={e => setTotalFactures(e.target.value)}
              placeholder="Ex: 55281.96" />
          </div>
          <div className="form-group">
            <label className="form-label">Monnaie</label>
            <select className="form-control" value={monnaie} onChange={e => setMonnaie(e.target.value)}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {monnaie !== 'EUR' && (
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                Taux de conversion en vigueur
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', fontWeight: 400, marginLeft: '0.4rem' }}>
                  (1 EUR = ? {monnaie})
                </span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="text" className="form-control" value={tauxConversion}
                  onChange={e => { setTauxConversion(e.target.value); setTauxFromDec(false) }}
                  placeholder="Ex: 1.0831" style={{ maxWidth: '160px' }} />
                {tauxFromDec && (
                  <span className="badge-dec">extrait DEC</span>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">
              Poids brut
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', fontWeight: 400, marginLeft: '0.4rem' }}>(kg)</span>
            </label>
            <input type="text" className="form-control" value={poidsBrut}
              onChange={e => setPoidsBrut(e.target.value)}
              placeholder="Ex: 31550" />
          </div>
          <div className="form-group">
            <label className="form-label">Nombre de colis</label>
            <input type="text" className="form-control" value={nombreColis}
              onChange={e => setNombreColis(e.target.value)}
              placeholder="Ex: 1312" />
          </div>
        </div>
      </section>

      {/* 5. Concordance (conditionnel) */}
      {concordanceChecks.length > 0 && (
        <ConcordancePanel
          checks={concordanceChecks}
          title={`${sn()}. Analyse de concordance`}
        />
      )}

      {/* Barre d'action */}
      <div className="apply-bar">
        <div className="apply-info">
          {selectedCount > 0
            ? `${selectedCount} conteneur(s) sélectionné(s) → étape suivante`
            : 'Aucun conteneur sélectionné'}
        </div>
        <button type="button" className="btn btn-primary" onClick={applyToControl} disabled={selectedCount === 0}>
          Appliquer et continuer →
        </button>
      </div>
    </div>
  )
}
