import { useState, useEffect } from 'react'

const DEFAULT_PHRASES = [
  "Je constate un chargement aux portes du conteneur.",
  "Je constate un chargement remplissant le conteneur jusqu'aux portes du conteneur.",
  "Je constate un chargement palettisé occupant les deux tiers du conteneur.",
  "Je constate un chargement en vrac.",
  "Je constate un conteneur à moitié chargé.",
]

export default function PhrasesRapides({ value, onChange, storageKey }) {
  const key = `ctrlcust-phrases-${storageKey}`

  const [phrases, setPhrases] = useState(() => {
    try {
      const saved = localStorage.getItem(key)
      return saved ? JSON.parse(saved) : DEFAULT_PHRASES
    } catch {
      return DEFAULT_PHRASES
    }
  })
  const [open, setOpen] = useState(false)
  const [newPhrase, setNewPhrase] = useState('')

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(phrases))
  }, [phrases])

  function insert(phrase) {
    if (!value.trim()) {
      onChange(phrase)
    } else {
      const sep = value.endsWith(' ') || value.endsWith('\n') ? '' : ' '
      onChange(value + sep + phrase)
    }
    setOpen(false)
  }

  function saveCurrentAsPhrase() {
    const trimmed = value.trim()
    if (!trimmed || phrases.includes(trimmed)) return
    setPhrases(prev => [...prev, trimmed])
  }

  function addNew() {
    const trimmed = newPhrase.trim()
    if (!trimmed || phrases.includes(trimmed)) return
    setPhrases(prev => [...prev, trimmed])
    setNewPhrase('')
  }

  function remove(i) {
    setPhrases(prev => prev.filter((_, idx) => idx !== i))
  }

  const alreadySaved = phrases.includes(value.trim())

  return (
    <div className="phrases-rapides">
      <button type="button" className="phrases-toggle" onClick={() => setOpen(o => !o)}>
        Phrases rapides {open ? '▲' : '▼'} — {phrases.length} enregistrée{phrases.length > 1 ? 's' : ''}
      </button>

      {open && (
        <div className="phrases-panel">
          {phrases.length === 0 ? (
            <p className="empty-state" style={{ padding: '1rem' }}>Aucune phrase enregistrée.</p>
          ) : (
            <ul className="phrases-list">
              {phrases.map((phrase, i) => (
                <li key={i} className="phrase-item">
                  <span className="phrase-text">{phrase}</span>
                  <div className="phrase-actions">
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => insert(phrase)}>
                      Insérer
                    </button>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => remove(i)} title="Supprimer">
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="phrases-footer">
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={saveCurrentAsPhrase}
              disabled={!value.trim() || alreadySaved}
            >
              {alreadySaved ? '✓ Déjà enregistrée' : '+ Sauvegarder le texte actuel'}
            </button>

            <div className="phrases-new-row">
              <input
                type="text"
                placeholder="Nouvelle phrase à ajouter..."
                value={newPhrase}
                onChange={e => setNewPhrase(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addNew() }}
              />
              <button type="button" className="btn btn-sm btn-success" onClick={addNew}>
                + Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
