import { useState, useEffect } from 'react'

const DEFAULT_PHRASES_CHARGEMENT = [
  "Je constate un chargement aux portes du conteneur.",
  "Je constate un chargement remplissant le conteneur jusqu'aux portes du conteneur.",
  "Je constate un chargement palettisé occupant les deux tiers du conteneur.",
  "Je constate un chargement en vrac.",
  "Je constate un conteneur à moitié chargé.",
]

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

function PhrasesCheckboxes({ value, onChange, storageKey, defaultPhrases, crn, articleNum }) {
  const key = `ctrlcust-phrases-${storageKey}`
  const [phrases, setPhrases] = useState(() => {
    try {
      const saved = localStorage.getItem(key)
      return saved ? JSON.parse(saved) : defaultPhrases
    } catch { return defaultPhrases }
  })
  const [open, setOpen] = useState(false)
  const [checked, setChecked] = useState([])
  const [newPhrase, setNewPhrase] = useState('')

  useEffect(() => { localStorage.setItem(key, JSON.stringify(phrases)) }, [phrases])

  // Résoudre les variables dans une phrase
  function resolve(phrase) {
    let p = phrase
    if (crn) p = p.replace(/\{CRN\}/g, crn)
    if (articleNum) p = p.replace(/\{ARTICLE\}/g, articleNum)
    return p
  }

  function toggleCheck(i) {
    setChecked(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])
  }

  function insertChecked() {
    const selected = checked.map(i => resolve(phrases[i])).join(' ')
    if (!selected) return
    const sep = !value.trim() ? '' : (value.endsWith(' ') || value.endsWith('\n') ? '' : ' ')
    onChange(value + sep + selected)
    setChecked([])
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
    setChecked(prev => prev.filter(x => x !== i).map(x => x > i ? x - 1 : x))
  }

  return (
    <div className="phrases-rapides">
      <button type="button" className="phrases-toggle" onClick={() => setOpen(o => !o)}>
        Phrases rapides {open ? '▲' : '▼'}
      </button>

      {open && (
        <div className="phrases-panel">
          <ul className="phrases-list">
            {phrases.map((phrase, i) => (
              <li key={i} className="phrase-item" style={{ gap: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flex: 1, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={checked.includes(i)}
                    onChange={() => toggleCheck(i)}
                    style={{ marginTop: '0.2rem', flexShrink: 0 }}
                  />
                  <span className="phrase-text" style={{ fontSize: '0.82rem' }}>{resolve(phrase)}</span>
                </label>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => remove(i)} title="Supprimer">✕</button>
              </li>
            ))}
          </ul>

          {checked.length > 0 && (
            <button type="button" className="btn btn-sm btn-primary" style={{ margin: '0.5rem 0.75rem' }} onClick={insertChecked}>
              ✓ Insérer {checked.length} phrase{checked.length > 1 ? 's' : ''} sélectionnée{checked.length > 1 ? 's' : ''}
            </button>
          )}

          <div className="phrases-footer">
            <button type="button" className="btn btn-sm btn-secondary"
              onClick={saveCurrentAsPhrase} disabled={!value.trim() || phrases.includes(value.trim())}>
              + Sauvegarder le texte actuel
            </button>
            <div className="phrases-new-row">
              <input type="text" placeholder="Nouvelle phrase..." value={newPhrase}
                onChange={e => setNewPhrase(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addNew() }} />
              <button type="button" className="btn btn-sm btn-success" onClick={addNew}>+ Ajouter</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Export des deux variantes
export default function PhrasesRapides({ value, onChange, storageKey }) {
  return (
    <PhrasesCheckboxes
      value={value} onChange={onChange}
      storageKey={storageKey}
      defaultPhrases={DEFAULT_PHRASES_CHARGEMENT}
    />
  )
}

export function PhrasesRapidesUnite({ value, onChange, crn, articleNum }) {
  return (
    <PhrasesCheckboxes
      value={value} onChange={onChange}
      storageKey="marchandise"
      defaultPhrases={DEFAULT_PHRASES_MARCHANDISE}
      crn={crn}
      articleNum={articleNum}
    />
  )
}
