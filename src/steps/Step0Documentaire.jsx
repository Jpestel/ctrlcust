import { useState, useRef, useMemo, useEffect } from 'react'
import { uid } from '../utils'
import { extractTextFromPDF, extractDeclarationData } from '../utils/extraction'
import { buildStep0Concordance } from '../utils/concordance'
import ConcordancePanel from '../components/ConcordancePanel'

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'CNY', 'JPY', 'CAD']

export default function Step0Documentaire({ data, update, goNext }) {
  const [decDoc, setDecDoc] = useState(data.docDeclaration || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef()

  // Saisie manuelle (documents commerciaux)
  const [totalFactures, setTotalFactures] = useState(data.saisieStep0?.totalFactures || '')
  const [monnaie, setMonnaie] = useState(data.saisieStep0?.monnaie || 'EUR')
  const [tauxConversion, setTauxConversion] = useState(data.saisieStep0?.tauxConversion || '')
  const [tauxFromDec, setTauxFromDec] = useState(data.saisieStep0?.tauxFromDec ?? false)
  const [poidsBrut, setPoidsBrut] = useState(data.saisieStep0?.poidsBrut || '')
  const [nombreColis, setNombreColis] = useState(data.saisieStep0?.nombreColis || '')

  // Parties (importateur + exportateur + représentant), éditables
  const [importateur, setImportateur] = useState(data.importateur || '')
  const [exportateur, setExportateur] = useState(data.exportateur || '')
  const [representant, setRepresentant] = useState(data.representant || '')
  const [declarant, setDeclarant] = useState(data.declarant || '')

  // Labels NC officiels récupérés depuis tarifdouanier.eu pour chaque code SH
  const [hsLabels, setHsLabels] = useState({})

  useEffect(() => {
    const articles = decDoc?.data?.articles
    if (!articles?.length) return
    articles.forEach(async art => {
      if (hsLabels[art.code]) return
      try {
        const code8 = art.code.slice(0, 8)
        // Proxy CORS pour contourner la restriction de tarifdouanier.eu
        const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(`https://www.tarifdouanier.eu/api/v1/cnSuggest?term=${code8}&lang=fr&year=2026`)}`
        const res = await fetch(proxyUrl)
        if (!res.ok) throw new Error('HTTP ' + res.status)
        const json = await res.json()
        const match = Array.isArray(json) && json.find(item =>
          item.id && item.id.replace(/\s/g, '').startsWith(code8.slice(0, 6))
        )
        if (match?.label) {
          setHsLabels(prev => ({ ...prev, [art.code]: match.label }))
        } else {
          setHsLabels(prev => ({ ...prev, [art.code]: '—' }))
        }
      } catch {
        setHsLabels(prev => ({ ...prev, [art.code]: '—' }))
      }
    })
  }, [decDoc])

  // Conteneurs (extraits de la DEC, éditables)
  const [conteneurs, setConteneurs] = useState(data.extractedConteneurs || [])

  // Concordance calculée en live
  const concordanceChecks = useMemo(() => {
    if (!decDoc?.data) return []
    if (!totalFactures && !poidsBrut && !nombreColis) return []
    return buildStep0Concordance(decDoc.data, { totalFactures, monnaie, tauxConversion, poidsBrut, nombreColis })
  }, [decDoc, totalFactures, monnaie, tauxConversion, poidsBrut, nombreColis])

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
  const hasArticles = decDoc?.data?.articles?.length > 0

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

      {/* 1. Import DEC */}
      <section className="card">
        <h3 className="card-title">{sn()}. Déclaration en douane</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary"
            onClick={() => fileInputRef.current?.click()} disabled={loading}>
            {loading ? 'Extraction en cours…' : decDoc ? '↺ Remplacer la déclaration' : '+ Importer la déclaration (PDF)'}
          </button>
          <input ref={fileInputRef} type="file" accept=".pdf" hidden
            onChange={e => { if (e.target.files[0]) { handleFile(e.target.files[0]); e.target.value = '' } }} />
          {decDoc && (
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>📄 {decDoc.name}</span>
          )}
        </div>

        {error && <div className="alert alert-error" style={{ marginTop: '0.5rem' }}>{error}</div>}

        {decDoc?.data?.mrn && (
          <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="form-label" style={{ marginBottom: 0 }}>N° MRN :</span>
            <code className="mrn-code">{decDoc.data.mrn}</code>
          </div>
        )}

        {decDoc && !decDoc.data.mrn && (
          <p className="empty-state" style={{ marginTop: '0.5rem' }}>
            MRN non détecté — vérifiez que le document est bien la déclaration en douane.
          </p>
        )}

        {/* Importateur + Exportateur + Représentant */}
        {decDoc && (
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                Exportateur
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', fontWeight: 400, marginLeft: '0.4rem' }}>(case 2)</span>
              </label>
              <input
                type="text"
                className="form-control"
                value={exportateur}
                onChange={e => { setExportateur(e.target.value); update({ exportateur: e.target.value }) }}
                placeholder="Non détecté"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                Importateur
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', fontWeight: 400, marginLeft: '0.4rem' }}>(case 8 — destinataire)</span>
              </label>
              <input
                type="text"
                className="form-control"
                value={importateur}
                onChange={e => { setImportateur(e.target.value); update({ importateur: e.target.value }) }}
                placeholder="Non détecté"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                Représentant en douane
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', fontWeight: 400, marginLeft: '0.4rem' }}>(case 14 — déclarant)</span>
              </label>
              <input
                type="text"
                className="form-control"
                value={representant}
                onChange={e => { setRepresentant(e.target.value); update({ representant: e.target.value }) }}
                placeholder="Non détecté"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                Déclarant
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', fontWeight: 400, marginLeft: '0.4rem' }}>(déclarant en douane)</span>
              </label>
              <input
                type="text"
                className="form-control"
                value={declarant}
                onChange={e => { setDeclarant(e.target.value); update({ declarant: e.target.value }) }}
                placeholder="Non détecté"
              />
            </div>
          </div>
        )}
      </section>

      {/* 2. Articles déclarés (conditionnel) */}
      {hasArticles && (
        <section className="card">
          <h3 className="card-title">{sn()}. Articles déclarés</h3>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
            {decDoc.data.articles.length} article{decDoc.data.articles.length > 1 ? 's' : ''} identifié{decDoc.data.articles.length > 1 ? 's' : ''} dans la déclaration
          </p>
          <div className="articles-table">
            {decDoc.data.articles.map(art => (
              <div key={art.code} className="article-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
                  <span className="article-position">#{art.position}</span>
                  <span className="article-code">{art.code}</span>
                  <span className="article-designation">
                    {art.designation
                      ? art.designation
                      : <em style={{ color: 'var(--color-text-muted)' }}>désignation non extraite</em>}
                  </span>
                </div>
                {/* Label NC officiel depuis tarifdouanier.eu */}
                <div style={{ paddingLeft: '2.5rem', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                  {hsLabels[art.code] === undefined
                    ? <span>⏳ Chargement nomenclature…</span>
                    : hsLabels[art.code] === '—'
                      ? <span>Nomenclature non trouvée</span>
                      : <>🏷 <span style={{ color: 'var(--color-primary)', fontStyle: 'normal' }}>{hsLabels[art.code]}</span></>
                  }
                </div>
              </div>
            ))}
          </div>
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
