import { useState } from 'react'
import { uid } from '../utils'

const LIEUX = [
  { label: 'TDF — Terminal De France - Aire de visite PELICAN', value: 'TDF' },
  { label: 'MTL', value: 'MTL' },
  { label: 'Autre (saisie libre)', value: 'libre' },
]

// Résout la valeur stockée en libellé complet pour le compte rendu
export function resolveLieu(value) {
  const found = LIEUX.find(l => l.value === value)
  return found && value !== 'libre' ? found.label : value
}

export default function Step1Init({ data, update, isTerminal }) {
  const [newNum, setNewNum] = useState('')

  function addConteneur() {
    const trimmed = newNum.trim().toUpperCase()
    if (!trimmed) return
    update({ conteneurs: [...data.conteneurs, { id: uid(), numero: trimmed }] })
    setNewNum('')
  }

  function removeConteneur(id) {
    update({ conteneurs: data.conteneurs.filter(c => c.id !== id) })
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') addConteneur()
  }

  return (
    <>
      <div className="card">
        <div className="card-title">Flux douanier</div>
        <div className="flux-selector">
          <button
            className={`flux-btn ${data.flux === 'import' ? 'active-import' : ''}`}
            onClick={() => update({ flux: 'import' })}
          >
            <span className="flux-icon">↓</span>
            IMPORT
          </button>
          <button
            className={`flux-btn ${data.flux === 'export' ? 'active-export' : ''}`}
            onClick={() => update({ flux: 'export' })}
          >
            <span className="flux-icon">↑</span>
            EXPORT
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Informations générales</div>

        <div className="form-row">
          <div className="form-group">
            <label>Nom de l'agent</label>
            <input
              type="text"
              placeholder="Prénom NOM"
              value={data.nomAgent}
              onChange={e => update({ nomAgent: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Numéro de déclaration</label>
            <input
              type="text"
              placeholder="ex. 24FR076000XXXXXXX0"
              value={data.numeroDeclaration}
              onChange={e => update({ numeroDeclaration: e.target.value.toUpperCase() })}
              style={{ fontFamily: 'monospace' }}
            />
          </div>
        </div>

        {/* VISITE 1 */}
        <div className="visite-block">
          <div className="visite-block-label">
            {isTerminal ? 'Visite 1 — Terminal' : 'Visite — Magasin (dépotage)'}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Date du contrôle</label>
              <input
                type="date"
                value={data.dateControle}
                onChange={e => update({ dateControle: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Heure du contrôle</label>
              <input
                type="time"
                value={data.heureControle}
                onChange={e => update({ heureControle: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Lieu du contrôle</label>
            <select
              value={data.lieuControle}
              onChange={e => update({ lieuControle: e.target.value })}
            >
              {LIEUX.map(l => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>

          {data.lieuControle === 'libre' && (
            <div className="form-group">
              <label>Précisez le lieu</label>
              <input
                type="text"
                placeholder="Nom du magasin ou entrepôt"
                value={data.lieuControleLibre}
                onChange={e => update({ lieuControleLibre: e.target.value })}
              />
            </div>
          )}
        </div>

        {/* TOGGLE SECONDE VISITE — uniquement si terminal */}
        {isTerminal && (
          <>
            <hr className="divider" />
            <div className="toggle-row">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={data.hasVisiteDepot}
                  onChange={e => update({ hasVisiteDepot: e.target.checked })}
                />
                <span className="toggle-slider" />
              </label>
              <span className="toggle-label">Ce contrôle sera suivi d'une seconde visite en magasin (dépotage)</span>
            </div>

            {data.hasVisiteDepot && (
              <div className="visite-block visite-block-depot">
                <div className="visite-block-label depot">Visite 2 — Magasin (dépotage)</div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Date de la visite magasin</label>
                    <input
                      type="date"
                      value={data.dateControleDepot}
                      onChange={e => update({ dateControleDepot: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Heure de la visite magasin</label>
                    <input
                      type="time"
                      value={data.heureControleDepot}
                      onChange={e => update({ heureControleDepot: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Lieu (magasin / entrepôt)</label>
                  <input
                    type="text"
                    placeholder="ex. Entrepôt Durand, ZI de Fontaine-la-Mallet"
                    value={data.lieuControleDepot}
                    onChange={e => update({ lieuControleDepot: e.target.value })}
                  />
                </div>
                <p className="helper">
                  Les mêmes conteneurs seront référencés. Aucune vérification de plomb ne sera effectuée pour cette visite.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="card">
        <div className="card-title">
          {isTerminal ? 'Conteneurs à contrôler' : 'Conteneurs d\'origine — Dépotage'}
        </div>

        <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
          {isTerminal
            ? 'Saisissez le ou les numéros de conteneurs. Les numéros de plombs seront renseignés à l\'étape suivante.'
            : 'La marchandise a été dépotée. Indiquez le ou les conteneurs d\'origine depuis lesquels elle a été extraite. Aucune vérification de plomb ne sera effectuée.'}
        </div>

        <div className="conteneur-add">
          <input
            type="text"
            placeholder="Numéro de conteneur (ex. TCKU1234567)"
            value={newNum}
            onChange={e => setNewNum(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            style={{ fontFamily: 'monospace' }}
          />
          <button className="btn btn-success btn-sm" onClick={addConteneur}>+ Ajouter</button>
        </div>

        {data.conteneurs.length === 0 ? (
          <div className="empty-state">Aucun conteneur ajouté — veuillez en ajouter au moins un.</div>
        ) : (
          <ul className="conteneur-list">
            {data.conteneurs.map((c, i) => (
              <li key={c.id} className="conteneur-item">
                <span className="idx">#{i + 1}</span>
                <span className="num">{c.numero}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => removeConteneur(c.id)} title="Supprimer">✕</button>
              </li>
            ))}
          </ul>
        )}

        <p className="helper" style={{ marginTop: '0.5rem' }}>
          {data.conteneurs.length} conteneur{data.conteneurs.length > 1 ? 's' : ''} sélectionné{data.conteneurs.length > 1 ? 's' : ''}
        </p>
      </div>
    </>
  )
}
