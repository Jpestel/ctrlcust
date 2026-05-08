import { useState } from 'react'
import { uid } from '../utils'
import PhrasesRapides from '../components/PhrasesRapides'

function CartonCard({ carton, index, onUpdate, onRemove, dateControle }) {
  const dateStr = dateControle
    ? new Date(dateControle).toLocaleDateString('fr-FR')
    : '__/__/____'

  return (
    <div className="carton-card">
      <div className="carton-header">
        <span className="carton-num">Carton n°{index + 1}</span>
        <button className="btn btn-ghost btn-sm" onClick={onRemove}>✕ Supprimer</button>
      </div>

      <div className="form-group">
        <label>Référence du carton</label>
        <input
          type="text"
          placeholder="ex. REF-2023-001"
          value={carton.reference}
          onChange={e => onUpdate({ reference: e.target.value })}
          style={{ fontFamily: 'monospace' }}
        />
      </div>

      <div className="form-group">
        <label>Description des mentions sur le carton</label>
        <textarea
          placeholder="Décrivez les inscriptions, marquages, étiquettes..."
          value={carton.descriptionMentions}
          onChange={e => onUpdate({ descriptionMentions: e.target.value })}
        />
      </div>

      <div className="form-group">
        <label>Statut à la fermeture</label>
        <div className="radio-group">
          <label className="radio-option">
            <input
              type="radio"
              name={`fermeture-${carton.id}`}
              value="complet"
              checked={carton.mentionFermeture === 'complet'}
              onChange={() => onUpdate({ mentionFermeture: 'complet' })}
            />
            Complet — <em style={{ fontWeight: 400 }}>mention "Visite douane — {dateStr} — Complet"</em>
          </label>
          <label className="radio-option">
            <input
              type="radio"
              name={`fermeture-${carton.id}`}
              value="prelevement_examen"
              checked={carton.mentionFermeture === 'prelevement_examen'}
              onChange={() => onUpdate({ mentionFermeture: 'prelevement_examen' })}
            />
            Prélèvement pour examen
          </label>
        </div>
      </div>

      {carton.mentionFermeture === 'prelevement_examen' && (
        <div className="form-group">
          <label>Détail du prélèvement pour examen</label>
          <textarea
            placeholder="Précisez les articles prélevés et leur quantité..."
            value={carton.detailPrelevementExamen}
            onChange={e => onUpdate({ detailPrelevementExamen: e.target.value })}
          />
          <p className="helper">Ces articles seront rendus au RDE après examen.</p>
        </div>
      )}
    </div>
  )
}

function PrelevementCard({ prelev, index, onUpdate, onRemove }) {
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
        <label>N° de scellé douanier</label>
        <input
          type="text"
          placeholder="Numéro du scellé apposé"
          value={prelev.numeroScelle}
          onChange={e => onUpdate({ numeroScelle: e.target.value.toUpperCase() })}
          style={{ fontFamily: 'monospace' }}
        />
      </div>

      <div className="form-group">
        <label>Destination des sachets</label>
        <div className="sachets-grid">
          <div className="sachet-row">
            <span className="sachet-label">Sachet 1 (douane)</span>
            <select
              value={prelev.sachet1}
              onChange={e => onUpdate({ sachet1: e.target.value })}
            >
              <option value="emporte">Emporté par l'agent</option>
              <option value="entrepot">Laissé en entrepôt</option>
            </select>
          </div>
          <div className="sachet-row">
            <span className="sachet-label">Sachet 2 (douane)</span>
            <select
              value={prelev.sachet2}
              onChange={e => onUpdate({ sachet2: e.target.value })}
            >
              <option value="entrepot">Laissé en entrepôt</option>
              <option value="emporte">Emporté par l'agent</option>
            </select>
          </div>
          <div className="sachet-row">
            <span className="sachet-label">Sachet 3 (douane)</span>
            <select
              value={prelev.sachet3}
              onChange={e => onUpdate({ sachet3: e.target.value })}
            >
              <option value="entrepot">Laissé en entrepôt</option>
              <option value="emporte">Emporté par l'agent</option>
            </select>
          </div>
          <div className="sachet-row">
            <span className="sachet-label">Sachet 4 (RDE)</span>
            <span className="sachet-fixed">Remis au commis/coursier pour le RDE</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ConteneurControle({ ctrl, conteneur, plombBL, dateControle, onUpdate, isTerminal }) {
  function updateCommis(field, value) {
    onUpdate({ commis: { ...ctrl.commis, [field]: value } })
  }

  function addCarton() {
    onUpdate({
      cartons: [...ctrl.cartons, {
        id: uid(),
        reference: '',
        descriptionMentions: '',
        mentionFermeture: 'complet',
        detailPrelevementExamen: '',
      }]
    })
  }

  function updateCarton(cartonId, updates) {
    onUpdate({
      cartons: ctrl.cartons.map(c => c.id === cartonId ? { ...c, ...updates } : c)
    })
  }

  function removeCarton(cartonId) {
    onUpdate({ cartons: ctrl.cartons.filter(c => c.id !== cartonId) })
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
          <div className="form-group">
            <label>Prénom</label>
            <input
              type="text"
              placeholder="Prénom"
              value={ctrl.commis.prenom}
              onChange={e => updateCommis('prenom', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Nom</label>
            <input
              type="text"
              placeholder="NOM"
              value={ctrl.commis.nom}
              onChange={e => updateCommis('nom', e.target.value.toUpperCase())}
            />
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
                <label>Plomb BL (relevé à l'étape précédente)</label>
                <input
                  type="text"
                  value={plombBL || 'Non renseigné'}
                  readOnly
                  style={{ fontFamily: 'monospace', background: '#f5f7fa', color: '#7f8c8d' }}
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

      {/* CARTONS */}
      <div className="section">
        <div className="section-title">Vérification des marchandises (cartons)</div>

        {ctrl.cartons.map((carton, i) => (
          <CartonCard
            key={carton.id}
            carton={carton}
            index={i}
            dateControle={dateControle}
            onUpdate={updates => updateCarton(carton.id, updates)}
            onRemove={() => removeCarton(carton.id)}
          />
        ))}

        <button className="btn btn-secondary btn-sm" onClick={addCarton}>
          + Ajouter un carton
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

function VisitePanel({ conteneurs, controles, plombsBL, dateControle, isTerminal, onUpdateControle }) {
  const [activeId, setActiveId] = useState(conteneurs[0]?.id ?? null)
  const activeCtrl = controles.find(c => c.conteneurId === activeId)
  const activeConteneur = conteneurs.find(c => c.id === activeId)

  return (
    <>
      {conteneurs.length > 1 && (
        <div className="container-tabs">
          {conteneurs.map(c => (
            <button
              key={c.id}
              className={`container-tab ${c.id === activeId ? 'active' : ''}`}
              onClick={() => setActiveId(c.id)}
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
          onUpdate={updates => onUpdateControle(activeId, updates)}
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
          onUpdateControle={updateControle}
        />
      )}

      {showDeuxVisites && visitePhase === 'depot' && (
        <VisitePanel
          conteneurs={data.conteneurs}
          controles={data.controlesDepot}
          plombsBL={{}}
          dateControle={data.dateControleDepot}
          isTerminal={false}
          onUpdateControle={updateControleDepot}
        />
      )}
    </div>
  )
}
