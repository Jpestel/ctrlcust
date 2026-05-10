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

  function moveUp(i) {
    if (i === 0) return
    setPhrases(prev => {
      const next = [...prev]
      ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
      setChecked(c => c.map(x => x === i ? i - 1 : x === i - 1 ? i : x))
      return next
    })
  }

  function moveDown(i) {
    if (i === phrases.length - 1) return
    setPhrases(prev => {
      const next = [...prev]
      ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
      setChecked(c => c.map(x => x === i ? i + 1 : x === i + 1 ? i : x))
      return next
    })
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
                <input type="checkbox" checked={checked.includes(i)} onChange={() => toggleCheck(i)} />
                <span className="phrase-check-text" onClick={() => toggleCheck(i)}>{resolve(phrase)}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', flexShrink: 0 }}>
                  <button type="button" onClick={() => moveUp(i)} disabled={i === 0}
                    style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? '#cbd5e1' : '#64748b', fontSize: '0.7rem', padding: '0', lineHeight: 1 }}>▲</button>
                  <button type="button" onClick={() => moveDown(i)} disabled={i === phrases.length - 1}
                    style={{ background: 'none', border: 'none', cursor: i === phrases.length - 1 ? 'default' : 'pointer', color: i === phrases.length - 1 ? '#cbd5e1' : '#64748b', fontSize: '0.7rem', padding: '0', lineHeight: 1 }}>▼</button>
                </div>
                <button type="button" className="phrase-check-del" onClick={() => remove(i)}>✕</button>
              </li>
            ))}
          </ul>

          {checked.length > 0 && (
            <button type="button" className="btn btn-sm btn-primary" style={{ margin: '0.5rem 0.75rem' }} onClick={insertChecked}>
              ✓ Insérer {checked.length} phrase{checked.length > 1 ? 's' : ''}
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
