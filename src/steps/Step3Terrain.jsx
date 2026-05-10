import { useState, useEffect } from 'react'
import { uid } from '../utils'
import PhrasesRapides from '../components/PhrasesRapides'

const DEFAULT_PHRASES_MARCHANDISE = [
  "Cette référence est bien reprise sur la facture jointe à la déclaration.",
  "Cette référence n'est pas présente sur la facture jointe à la déclaration.",
  "Cette marchandise ne semble pas avoir été déclarée.",
  "Les marquages obligatoires sont bien repris sur les emballages.",
  "Les marquages obligatoires sont absents ou non conformes.",
  "L'origine indiquée sur l'emballage est conforme à la déclaration.",
  "Pas de prélèvement d'échantillon.",
  "Il n'y a pas d'autres références accessibles aux portes du conteneur.",
]

function PhrasesRapidesUnite({ value, onChange, crn, articleNum }) {
  const key = 'ctrlcust-phrases-marchandise'
  const [phrases, setPhrases] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : DEFAULT_PHRASES_MARCHANDISE } catch { return DEFAULT_PHRASES_MARCHANDISE }
  })
  const [open, setOpen] = useState(false)
  const [checked, setChecked] = useState([])
  const [newPhrase, setNewPhrase] = useState('')

  useEffect(() => { localStorage.setItem(key, JSON.stringify(phrases)) }, [phrases])

  function resolve(p) {
    return p.replace(/\{CRN\}/g, crn || '').replace(/\{ARTICLE\}/g, articleNum || '')
  }
  function toggle(i) { setChecked(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]) }
  function insert() {
    const sel = checked.map(i => resolve(phrases[i])).join(' ')
    if (!sel) return
    const sep = !value.trim() ? '' : ' '
    onChange(value + sep + sel)
    setChecked([]); setOpen(false)
  }
  function addNew() {
    const t = newPhrase.trim(); if (!t || phrases.includes(t)) return
    setPhrases(p => [...p, t]); setNewPhrase('')
  }
  function save() {
    const t = value.trim(); if (!t || phrases.includes(t)) return
    setPhrases(p => [...p, t])
  }

  return (
    <div className="phrases-rapides">
      <button type="button" className="phrases-toggle" onClick={() => setOpen(o => !o)}>
        Phrases rapides {open ? '▲' : '▼'}
      </button>
      {open && (
        <div className="phrases-panel">
          <ul style={{ listStyle: 'none', margin: 0, padding: '0.25rem 0' }}>
            {phrases.map((phrase, i) => (
              <li key={i} className="phrase-item-check">
                <input type="checkbox" checked={checked.includes(i)} onChange={() => toggle(i)} />
                <span className="phrase-check-text" onClick={() => toggle(i)}>{resolve(phrase)}</span>
                <button className="phrase-check-del" onClick={() => setPhrases(p => p.filter((_, idx) => idx !== i))}>✕</button>
              </li>
            ))}
          </ul>
          {checked.length > 0 && (
            <button type="button" className="btn btn-sm btn-primary" style={{ margin: '0.5rem 0.75rem' }} onClick={insert}>
              ✓ Insérer {checked.length} phrase{checked.length > 1 ? 's' : ''}
            </button>
          )}
          <div className="phrases-footer">
            <button type="button" className="btn btn-sm btn-secondary" onClick={save} disabled={!value.trim()}>+ Sauvegarder le texte actuel</button>
            <div className="phrases-new-row">
              <input type="text" placeholder="Nouvelle phrase..." value={newPhrase} onChange={e => setNewPhrase(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addNew() }} />
              <button type="button" className="btn btn-sm btn-success" onClick={addNew}>+ Ajouter</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const TYPES_CONDITIONNEMENT = [
  { value: 'carton', label: 'Carton' },
  { value: 'palette', label: 'Palette' },
  { value: 'sac', label: 'Sac' },
  { value: 'caisse', label: 'Caisse / Colis bois' },
  { value: 'vrac', label: 'Vrac (directement dans le conteneur)' },
  { value: 'article', label: 'Article isolé (pneu, pièce, équipement…)' },
  { value: 'unite', label: 'Unité isolée' },
  { value: 'autre', label: 'Autre' },
]

function UniteCard({ unite, index, onUpdate, onRemove, dateControle, crn, articleNum }) {
  const dateStr = dateControle
    ? new Date(dateControle).toLocaleDateString('fr-FR')
    : '__/__/____'

  const typeLabel = TYPES_CONDITIONNEMENT.find(t => t.value === unite.type)?.label || 'Unité'
  const isVrac = unite.type === 'vrac'
  const isArticle = unite.type === 'article'

  return (
    <div className="carton-card">
      <div className="carton-header">
        <span className="carton-num">Unité n°{index + 1}</span>
        <button className="btn btn-ghost btn-sm" onClick={onRemove}>✕ Supprimer</button>
      </div>

      <div className="form-group">
        <label>Type de conditionnement</label>
        <select value={unite.type} onChange={e => onUpdate({ type: e.target.value })}>
          {TYPES_CONDITIONNEMENT.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {!isVrac && (
        <div className="form-group">
          <label>Référence / identification</label>
          <input
            type="text"
            placeholder="ex. REF-2023-001"
            value={unite.reference}
            onChange={e => onUpdate({ reference: e.target.value })}
            style={{ fontFamily: 'monospace' }}
          />
        </div>
      )}

      <div className="form-group">
        <label>
          {isVrac
            ? 'Description de la marchandise en vrac'
            : isArticle
              ? 'Description / identification de l\'article'
              : `Description des mentions sur le ${typeLabel.toLowerCase()}`}
        </label>
        <PhrasesRapidesUnite
          value={unite.descriptionMentions}
          onChange={v => onUpdate({ descriptionMentions: v })}
          crn={crn}
          articleNum={articleNum}
        />
        <textarea
          placeholder={isVrac
            ? "Décrivez la nature, le volume, l'état apparent de la marchandise en vrac..."
            : isArticle
              ? 'ex. Pneu neuf référence TX2R1507, dimensions 185/65R15, marquages conformes...'
              : 'Décrivez les inscriptions, marquages, étiquettes...'}
          value={unite.descriptionMentions}
          onChange={e => onUpdate({ descriptionMentions: e.target.value })}
        />
      </div>

      {!isVrac && !isArticle && (
        <div className="form-group">
          <label>Statut à la fermeture</label>
          <div className="radio-group">
            <label className="radio-option">
              <input type="radio" name={`fermeture-${unite.id}`} value="aucun"
                checked={!unite.mentionFermeture || unite.mentionFermeture === 'aucun'}
                onChange={() => onUpdate({ mentionFermeture: 'aucun' })} />
              Non renseigné
            </label>
            <label className="radio-option">
              <input type="radio" name={`fermeture-${unite.id}`} value="complet"
                checked={unite.mentionFermeture === 'complet'}
                onChange={() => onUpdate({ mentionFermeture: 'complet' })} />
              Complet
            </label>
            <label className="radio-option">
              <input type="radio" name={`fermeture-${unite.id}`} value="libre"
                checked={unite.mentionFermeture === 'libre'}
                onChange={() => onUpdate({ mentionFermeture: 'libre' })} />
              Mention personnalisée
            </label>
          </div>

          {unite.mentionFermeture === 'complet' && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              Mention apposée : "Visite douane — {dateStr} — Complet"
            </div>
          )}
          {unite.mentionFermeture === 'libre' && (
            <input type="text" style={{ marginTop: '0.5rem' }}
              placeholder={`ex. "Visite douane — ${dateStr} — Vu conforme"`}
              value={unite.mentionLibre || ''}
              onChange={e => onUpdate({ mentionLibre: e.target.value })} />
          )}
        </div>
      )}

      {/* Prélèvement pour examen à mon bureau — distinct du labo */}
      {!isVrac && (
        <div className="form-group">
          <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', fontWeight: 500, justifyContent: 'flex-start' }}>
            <input type="checkbox"
              checked={unite.prelevementExamen || false}
              onChange={e => onUpdate({ prelevementExamen: e.target.checked })}
              style={{ marginTop: '0.2rem', flexShrink: 0 }} />
            <span>Prélèvement d'unités pour examen à mon/notre bureau</span>
          </label>
          {unite.prelevementExamen && (
            <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <input type="text"
                placeholder="Quantité et description (ex. 2 unités prélevées pour examen)"
                value={unite.detailPrelevementExamen || ''}
                onChange={e => onUpdate({ detailPrelevementExamen: e.target.value })} />
              <p className="helper">Ces articles seront restitués au RDE après examen à votre bureau.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PrelevementCard({ prelev, index, onUpdate, onRemove, lieu }) {
  const isSachets = (prelev.modePrelev || 'sachets') === 'sachets'

  // Label du lieu pour les options de destination
  const lieuLabel = lieu === 'TDF' ? 'Laissé à TDF'
    : lieu ? `Laissé à ${lieu}`
    : 'Laissé en entrepôt'

  return (
    <div className="prelev-card">
      <div className="prelev-header">
        <span className="prelev-num">Prélèvement n°{index + 1}</span>
        <button className="btn btn-ghost btn-sm" onClick={onRemove}>✕ Supprimer</button>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Référence</label>
          <input
            type="text"
            placeholder="Référence de l'article"
            value={prelev.reference}
            onChange={e => onUpdate({ reference: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label>Quantité prélevée</label>
          <input
            type="text"
            placeholder="ex. 3 unités"
            value={prelev.quantite}
            onChange={e => onUpdate({ quantite: e.target.value })}
          />
        </div>
      </div>

      <div className="form-group">
        <label>Mode de prélèvement</label>
        <div className="radio-group">
          <label className="radio-option">
            <input type="radio" name={`mode-${prelev.id}`} value="sachets"
              checked={isSachets}
              onChange={() => onUpdate({ modePrelev: 'sachets' })} />
            Sachets à sceller
          </label>
          <label className="radio-option">
            <input type="radio" name={`mode-${prelev.id}`} value="pince"
              checked={prelev.modePrelev === 'pince'}
              onChange={() => onUpdate({ modePrelev: 'pince' })} />
            Pince à sceller et ficelle résistante
          </label>
        </div>
      </div>

      {isSachets ? (
        <div className="form-group">
          <label>Sachets — numéro de scellé et destination</label>
          <div className="sachets-grid">
            <div className="sachet-row">
              <span className="sachet-label">Sachet 1 (douane)</span>
              <input type="text" placeholder="N° scellé" value={prelev.scelleS1 || ''}
                onChange={e => onUpdate({ scelleS1: e.target.value.toUpperCase() })}
                style={{ fontFamily: 'monospace', width: '130px' }} />
              <select value={prelev.sachet1} onChange={e => onUpdate({ sachet1: e.target.value })}>
                <option value="emporte">Emporté par l'agent</option>
                <option value="entrepot">{lieuLabel}</option>
              </select>
            </div>
            <div className="sachet-row">
              <span className="sachet-label">Sachet 2 (douane)</span>
              <input type="text" placeholder="N° scellé" value={prelev.scelleS2 || ''}
                onChange={e => onUpdate({ scelleS2: e.target.value.toUpperCase() })}
                style={{ fontFamily: 'monospace', width: '130px' }} />
              <select value={prelev.sachet2} onChange={e => onUpdate({ sachet2: e.target.value })}>
                <option value="entrepot">{lieuLabel}</option>
                <option value="emporte">Emporté par l'agent</option>
              </select>
            </div>
            <div className="sachet-row">
              <span className="sachet-label">Sachet 3 (douane)</span>
              <input type="text" placeholder="N° scellé" value={prelev.scelleS3 || ''}
                onChange={e => onUpdate({ scelleS3: e.target.value.toUpperCase() })}
                style={{ fontFamily: 'monospace', width: '130px' }} />
              <select value={prelev.sachet3} onChange={e => onUpdate({ sachet3: e.target.value })}>
                <option value="entrepot">{lieuLabel}</option>
                <option value="emporte">Emporté par l'agent</option>
              </select>
            </div>
            <div className="sachet-row">
              <span className="sachet-label">Sachet 4 (RDE)</span>
              <input type="text" placeholder="N° scellé" value={prelev.scelleS4 || ''}
                onChange={e => onUpdate({ scelleS4: e.target.value.toUpperCase() })}
                style={{ fontFamily: 'monospace', width: '130px' }} />
              <select value={prelev.sachet4 || 'emporte'} onChange={e => onUpdate({ sachet4: e.target.value })}>
                <option value="emporte">Emporté par le commis/coursier</option>
                <option value="laisse">{lieuLabel} — remis au commis/coursier</option>
              </select>
            </div>
          </div>
        </div>
      ) : (
        <div className="form-group">
          <label>N° de scellé de la pince</label>
          <input
            type="text"
            placeholder="Numéro du scellé de la pince"
            value={prelev.numeroScelle || ''}
            onChange={e => onUpdate({ numeroScelle: e.target.value.toUpperCase() })}
            style={{ fontFamily: 'monospace' }}
          />
        </div>
      )}
    </div>
  )
}

function ConteneurControle({ ctrl, conteneur, plombBL, dateControle, onUpdate, isTerminal, onUpdatePlombBL, crn, lieu }) {
  function updateCommis(field, value) {
    onUpdate({ commis: { ...ctrl.commis, [field]: value } })
  }

  function addUnite() {
    onUpdate({
      cartons: [...ctrl.cartons, {
        id: uid(),
        type: 'carton',
        reference: '',
        descriptionMentions: '',
        mentionFermeture: 'complet',
        detailPrelevementExamen: '',
      }]
    })
  }

  function updateUnite(uniteId, updates) {
    onUpdate({
      cartons: ctrl.cartons.map(c => c.id === uniteId ? { ...c, ...updates } : c)
    })
  }

  function removeUnite(uniteId) {
    onUpdate({ cartons: ctrl.cartons.filter(c => c.id !== uniteId) })
  }

  function addPrelev() {
    onUpdate({
      prelevementsLabo: [...ctrl.prelevementsLabo, {
        id: uid(),
        reference: '',
        quantite: '',
        numeroScelle: '',
        sachet1: 'emporte',
        sachet2: 'entrepot',
        sachet3: 'entrepot',
      }]
    })
  }

  function updatePrelev(prelevId, updates) {
    onUpdate({
      prelevementsLabo: ctrl.prelevementsLabo.map(p => p.id === prelevId ? { ...p, ...updates } : p)
    })
  }

  function removePrelev(prelevId) {
    onUpdate({ prelevementsLabo: ctrl.prelevementsLabo.filter(p => p.id !== prelevId) })
  }

  const plombReel = ctrl.plombReel.trim().toUpperCase()
  const plombBLTrimmed = (plombBL || '').trim().toUpperCase()
  const plombsComparables = plombReel && plombBLTrimmed
  const plombsConcordants = plombsComparables && plombReel === plombBLTrimmed

  return (
    <>
      {/* COMMIS / COURSIER */}
      <div className="section">
        <div className="section-title">Personne présente</div>
        <div className="form-row">
          <div className="form-group" style={{ maxWidth: '100px' }}>
            <label>Civilité</label>
            <select value={ctrl.commis.civilite || 'M.'} onChange={e => updateCommis('civilite', e.target.value)}>
              <option value="M.">M.</option>
              <option value="Mme">Mme</option>
            </select>
          </div>
          <div className="form-group">
            <label>Prénom</label>
            <input type="text" placeholder="Prénom" value={ctrl.commis.prenom}
              onChange={e => updateCommis('prenom', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Nom</label>
            <input type="text" placeholder="NOM" value={ctrl.commis.nom}
              onChange={e => updateCommis('nom', e.target.value.toUpperCase())} />
          </div>
        </div>
        <div className="form-group">
          <label>Qualité</label>
          <div className="radio-group">
            <label className="radio-option">
              <input
                type="radio"
                name={`qualite-${conteneur.id}`}
                value="commis"
                checked={ctrl.commis.qualite === 'commis'}
                onChange={() => updateCommis('qualite', 'commis')}
              />
              Commis (employé du RDE)
            </label>
            <label className="radio-option">
              <input
                type="radio"
                name={`qualite-${conteneur.id}`}
                value="coursier"
                checked={ctrl.commis.qualite === 'coursier'}
                onChange={() => updateCommis('qualite', 'coursier')}
              />
              Coursier (mandaté par le RDE)
            </label>
          </div>
        </div>
      </div>

      {isTerminal && (
        <>
          <hr className="divider" />
          <div className="section">
            <div className="section-title">Vérification du plomb</div>
            <div className="form-row">
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Plomb BL
                  {plombBL && (
                    <span style={{ fontSize: '0.72rem', background: '#dcfce7', color: '#166534', borderRadius: '0.3rem', padding: '0.1rem 0.35rem', fontWeight: 600 }}>
                      extrait BL — modifiable
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  placeholder="Numéro de plomb du BL"
                  value={plombBL || ''}
                  onChange={e => onUpdatePlombBL && onUpdatePlombBL(e.target.value)}
                  style={{ fontFamily: 'monospace' }}
                />
              </div>
              <div className="form-group">
                <label>Plomb réel constaté sur le conteneur</label>
                <input
                  type="text"
                  placeholder="Numéro constaté physiquement"
                  value={ctrl.plombReel}
                  onChange={e => onUpdate({ plombReel: e.target.value.toUpperCase() })}
                  style={{ fontFamily: 'monospace' }}
                />
              </div>
            </div>
            {plombsComparables && (
              <div className={`plomb-result ${plombsConcordants ? 'ok' : 'ko'}`}>
                {plombsConcordants
                  ? '✓ Plombs concordants'
                  : '✗ DISCORDANCE — les numéros de plombs ne correspondent pas'}
              </div>
            )}
          </div>
        </>
      )}

      <hr className="divider" />

      {/* DESCRIPTION CHARGEMENT */}
      <div className="section">
        <div className="section-title">Description du chargement</div>
        <p className="helper" style={{ marginBottom: '0.6rem' }}>
          Après rupture du plomb, ouverture et aération du conteneur, décrivez ce que vous constatez.
        </p>
        <div className="form-group">
          <textarea
            rows={4}
            placeholder="ex. Je constate un chargement remplissant le conteneur jusqu'aux portes du conteneur."
            value={ctrl.descriptionChargement}
            onChange={e => onUpdate({ descriptionChargement: e.target.value })}
          />
        </div>
        <PhrasesRapides
          value={ctrl.descriptionChargement}
          onChange={val => onUpdate({ descriptionChargement: val })}
          storageKey="chargement"
        />
      </div>

      <hr className="divider" />

      {/* UNITÉS CONTRÔLÉES */}
      <div className="section">
        <div className="section-title">Vérification des marchandises</div>

        {ctrl.cartons.map((unite, i) => (
          <UniteCard
            key={unite.id}
            unite={unite}
            index={i}
            dateControle={dateControle}
            crn={crn}
            articleNum={i + 1}
            onUpdate={updates => updateUnite(unite.id, updates)}
            onRemove={() => removeUnite(unite.id)}
          />
        ))}

        <button className="btn btn-secondary btn-sm" onClick={addUnite}>
          + Ajouter une unité contrôlée
        </button>
      </div>

      <hr className="divider" />

      {/* PRÉLÈVEMENTS LABO */}
      <div className="section">
        <div className="toggle-row">
          <label className="toggle">
            <input
              type="checkbox"
              checked={ctrl.hasPrelevementsLabo}
              onChange={e => onUpdate({ hasPrelevementsLabo: e.target.checked })}
            />
            <span className="toggle-slider" />
          </label>
          <span className="toggle-label">Prélèvements en vue d'analyse laboratoire</span>
        </div>

        {ctrl.hasPrelevementsLabo && (
          <>
            <div className="alert alert-warning">
              4 sachets identiques par prélèvement — Sachets 1, 2, 3 pour la douane — Sachet 4 pour le RDE.
            </div>
            {ctrl.prelevementsLabo.map((p, i) => (
              <PrelevementCard
                key={p.id}
                prelev={p}
                index={i}
                lieu={lieu}
                onUpdate={updates => updatePrelev(p.id, updates)}
                onRemove={() => removePrelev(p.id)}
              />
            ))}
            <button className="btn btn-secondary btn-sm" onClick={addPrelev}>
              + Ajouter un prélèvement
            </button>
          </>
        )}
      </div>

      <hr className="divider" />

      {isTerminal && (
        <div className="section">
          <div className="section-title">Nouveau plomb</div>
          <div className="form-group">
            <label>Numéro du nouveau plomb apposé à la fermeture</label>
            <input
              type="text"
              placeholder="Numéro du nouveau scellé"
              value={ctrl.nouveauPlomb}
              onChange={e => onUpdate({ nouveauPlomb: e.target.value.toUpperCase() })}
              style={{ fontFamily: 'monospace' }}
            />
          </div>
        </div>
      )}
    </>
  )
}

function VisitePanel({ conteneurs, controles, plombsBL, dateControle, isTerminal, onUpdateControle, onUpdatePlombBL, crn, lieu }) {
  const [activeId, setActiveId] = useState(conteneurs[0]?.id ?? null)
  const activeCtrl = controles.find(c => c.conteneurId === activeId)
  const activeConteneur = conteneurs.find(c => c.id === activeId)

  function handleTabChange(id) {
    // Si on bascule vers un conteneur dont le commis est vide,
    // on pré-remplit avec les infos du premier conteneur
    const targetCtrl = controles.find(c => c.conteneurId === id)
    const firstCtrl = controles[0]
    if (
      targetCtrl &&
      firstCtrl &&
      targetCtrl.conteneurId !== firstCtrl.conteneurId &&
      !targetCtrl.commis?.prenom &&
      !targetCtrl.commis?.nom &&
      (firstCtrl.commis?.prenom || firstCtrl.commis?.nom)
    ) {
      onUpdateControle(id, {
        commis: { ...targetCtrl.commis, ...firstCtrl.commis }
      })
    }
    setActiveId(id)
  }

  return (
    <>
      {conteneurs.length > 1 && (
        <div className="container-tabs">
          {conteneurs.map(c => (
            <button
              key={c.id}
              className={`container-tab ${c.id === activeId ? 'active' : ''}`}
              onClick={() => handleTabChange(c.id)}
            >
              {c.numero}
            </button>
          ))}
        </div>
      )}
      {activeCtrl && activeConteneur && (
        <ConteneurControle
          ctrl={activeCtrl}
          conteneur={activeConteneur}
          plombBL={plombsBL?.[activeId]}
          dateControle={dateControle}
          isTerminal={isTerminal}
          crn={crn}
          lieu={lieu}
          onUpdate={updates => onUpdateControle(activeId, updates)}
          onUpdatePlombBL={val => onUpdatePlombBL(activeId, val)}
        />
      )}
    </>
  )
}

export default function Step3Terrain({ data, update, isTerminal }) {
  const [visitePhase, setVisitePhase] = useState('terminal')
  const showDeuxVisites = isTerminal && data.hasVisiteDepot

  function updateControle(conteneurId, updates) {
    update({
      controles: data.controles.map(c =>
        c.conteneurId === conteneurId ? { ...c, ...updates } : c
      )
    })
  }

  function updateControleDepot(conteneurId, updates) {
    update({
      controlesDepot: data.controlesDepot.map(c =>
        c.conteneurId === conteneurId ? { ...c, ...updates } : c
      )
    })
  }

  function updatePlombBL(conteneurId, value) {
    update({
      plombsBL: { ...data.plombsBL, [conteneurId]: value.toUpperCase() }
    })
  }

  const lieuTerminal = data.lieuControle
  const lieuDepot = data.lieuControleDepot || 'Magasin'

  return (
    <div className="card">
      <div className="card-title">Contrôle terrain</div>

      {showDeuxVisites && (
        <div className="visite-phase-tabs">
          <button
            className={`visite-phase-tab ${visitePhase === 'terminal' ? 'active' : ''}`}
            onClick={() => setVisitePhase('terminal')}
          >
            Visite 1 — {lieuTerminal}
            <span className="visite-date">{data.dateControle ? new Date(data.dateControle).toLocaleDateString('fr-FR') : ''} {data.heureControle}</span>
          </button>
          <button
            className={`visite-phase-tab ${visitePhase === 'depot' ? 'active depot' : 'depot-inactive'}`}
            onClick={() => setVisitePhase('depot')}
          >
            Visite 2 — {lieuDepot}
            <span className="visite-date">{data.dateControleDepot ? new Date(data.dateControleDepot).toLocaleDateString('fr-FR') : ''} {data.heureControleDepot}</span>
          </button>
        </div>
      )}

      {(!showDeuxVisites || visitePhase === 'terminal') && (
        <VisitePanel
          conteneurs={data.conteneurs}
          controles={data.controles}
          plombsBL={data.plombsBL}
          dateControle={data.dateControle}
          isTerminal={isTerminal}
          crn={data.docDeclaration?.data?.crn || data.numeroDeclaration || ''}
          lieu={data.lieuControle}
          onUpdateControle={updateControle}
          onUpdatePlombBL={updatePlombBL}
        />
      )}

      {showDeuxVisites && visitePhase === 'depot' && (
        <VisitePanel
          conteneurs={data.conteneurs}
          controles={data.controlesDepot}
          plombsBL={{}}
          dateControle={data.dateControleDepot}
          isTerminal={false}
          crn={data.docDeclaration?.data?.crn || data.numeroDeclaration || ''}
          lieu={data.lieuControleDepot || 'entrepôt'}
          onUpdateControle={updateControleDepot}
          onUpdatePlombBL={() => {}}
        />
      )}

      {/* Heure de fin du contrôle */}
      <div style={{
        marginTop: '1.5rem',
        borderTop: '1px solid var(--color-border)',
        paddingTop: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        flexWrap: 'wrap',
      }}>
        <label style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
          🕐 Heure de fin du contrôle
        </label>
        <input
          type="time"
          value={data.heureFinControle || ''}
          onChange={e => update({ heureFinControle: e.target.value })}
          style={{ fontFamily: 'monospace', fontSize: '1rem', padding: '0.3rem 0.6rem', borderRadius: '0.4rem', border: '1px solid var(--color-border)' }}
        />
        {data.heureControle && data.heureFinControle && (
          <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
            Durée : {(() => {
              const [dh, dm] = data.heureControle.split(':').map(Number)
              const [fh, fm] = data.heureFinControle.split(':').map(Number)
              const diff = (fh * 60 + fm) - (dh * 60 + dm)
              if (diff <= 0) return '—'
              return `${Math.floor(diff / 60)}h${String(diff % 60).padStart(2, '0')}`
            })()}
          </span>
        )}
      </div>
    </div>
  )
}
