import { useState, useEffect, useRef } from 'react'
import { uid, base64ToBlob } from './utils'
import StepIndicator from './components/StepIndicator'
import Step0Documentaire from './steps/Step0Documentaire'
import Step1Init from './steps/Step1Init'
import Step2PlombsBL from './steps/Step2PlombsBL'
import Step3Terrain from './steps/Step3Terrain'
import Step4Photos from './steps/Step4Photos'
import Step5CompteRendu from './steps/Step5CompteRendu'

const STORAGE_KEY = 'douane-controle-v1'
const AGENT_KEY = 'douane-agent-name'

// Étapes selon le type de contrôle
const STEPS_TERMINAL = [
  { id: 0, label: 'Documentaire' },
  { id: 1, label: 'Initialisation' },
  { id: 2, label: 'Plombs BL' },
  { id: 3, label: 'Contrôle terrain' },
  { id: 4, label: 'Photos' },
  { id: 5, label: 'Compte rendu' },
]

const STEPS_DEPOT = [
  { id: 0, label: 'Documentaire' },
  { id: 1, label: 'Initialisation' },
  { id: 3, label: 'Contrôle terrain' },
  { id: 4, label: 'Photos' },
  { id: 5, label: 'Compte rendu' },
]

const INITIAL_DATA = {
  flux: 'import',
  nomAgent: '',
  civiliteAgent: 'M.',
  gradeAgent: 'controleur_2',
  gradeAgentLibre: '',
  hasSecondAgent: false,
  nomAgent2: '',
  civiliteAgent2: 'M.',
  gradeAgent2: 'controleur_2',
  gradeAgent2Libre: '',
  numeroDeclaration: '',
  dateControle: '',
  heureControle: '',
  heureFinControle: '',
  lieuControle: 'TDF',
  lieuControleLibre: '',
  conteneurs: [],
  plombsBL: {},
  controles: [],
  // Seconde visite (dépotage en magasin, après visite terminal)
  hasVisiteDepot: false,
  dateControleDepot: '',
  heureControleDepot: '',
  lieuControleDepot: '',
  controlesDepot: [],
  photos: [],
  // Étape 0 — contrôle documentaire
  docDeclaration: null,
  docBL: null,
  extractedConteneurs: [],
  saisieStep0: null,
  importateur: '',
  exportateur: '',
  representant: '',
  declarant: '',
}

function makeControle(conteneurId) {
  return {
    conteneurId,
    commis: { prenom: '', nom: '', qualite: 'commis' },
    plombReel: '',
    descriptionChargement: '',
    cartons: [],
    hasPrelevementsLabo: false,
    prelevementsLabo: [],
    nouveauPlomb: '',
  }
}

function serializeData(data) {
  return {
    ...data,
    photos: data.photos.map(({ blob, url, ...rest }) => rest),
  }
}

function restorePhotos(photos = []) {
  return photos.map(p => {
    if (!p.base64) return null
    try {
      const blob = base64ToBlob(p.base64)
      const url = URL.createObjectURL(blob)
      return { ...p, blob, url }
    } catch {
      return null
    }
  }).filter(Boolean)
}

export default function App() {
  const [step, setStep] = useState(0)
  const [data, setData] = useState(() => ({
    ...INITIAL_DATA,
    nomAgent: localStorage.getItem(AGENT_KEY) || '',
  }))
  const [savedAt, setSavedAt] = useState(null)
  const [importKey, setImportKey] = useState(0)
  const importRef = useRef()
  const isFirstRender = useRef(true)

  const isTerminal = data.lieuControle !== 'libre'
  const steps = isTerminal ? STEPS_TERMINAL : STEPS_DEPOT

  // Si le step courant n'existe pas dans le tableau actuel (ex: lieu changé), revenir à 0
  useEffect(() => {
    if (!steps.find(s => s.id === step)) setStep(0)
  }, [data.lieuControle])

  // Chargement initial depuis localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        const photos = restorePhotos(parsed.photos)
        setData({ ...INITIAL_DATA, ...parsed, photos })
        // Restaurer l'étape mémorisée si elle existe
        if (typeof parsed._lastStep === 'number') setStep(parsed._lastStep)
      } catch {
        // données corrompues, on repart de zéro
      }
    }
  }, [])

  // Mémorisation du nom de l'agent pour les contrôles suivants
  useEffect(() => {
    if (data.nomAgent) localStorage.setItem(AGENT_KEY, data.nomAgent)
  }, [data.nomAgent])

  // Sauvegarde automatique à chaque changement
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...serializeData(data), _lastStep: step }))
      setSavedAt(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
    } catch {
      // localStorage plein (trop de photos)
    }
  }, [data, step])

  function update(updates) {
    setData(prev => ({ ...prev, ...updates }))
  }

  function goNext() {
    if (step === 1) {
      if (data.conteneurs.length === 0) {
        alert('Veuillez ajouter au moins un conteneur avant de continuer.')
        return
      }
      const controles = data.conteneurs.map(c => {
        const existing = data.controles.find(ct => ct.conteneurId === c.id)
        return existing ?? makeControle(c.id)
      })
      const plombsBL = {}
      data.conteneurs.forEach(c => { plombsBL[c.id] = data.plombsBL[c.id] ?? '' })
      const controlesDepot = data.conteneurs.map(c => {
        const existing = data.controlesDepot.find(ct => ct.conteneurId === c.id)
        return existing ?? makeControle(c.id)
      })
      update({ controles, plombsBL, controlesDepot })
    }
    const idx = steps.findIndex(s => s.id === step)
    if (idx < steps.length - 1) setStep(steps[idx + 1].id)
  }

  function goPrev() {
    const idx = steps.findIndex(s => s.id === step)
    if (idx > 0) setStep(steps[idx - 1].id)
  }

  function nouveauControle() {
    if (!window.confirm('Démarrer un nouveau contrôle ? Les données actuelles seront effacées.')) return
    localStorage.removeItem(STORAGE_KEY)
    setData({ ...INITIAL_DATA, nomAgent: localStorage.getItem(AGENT_KEY) || '' })
    setStep(0)
    setSavedAt(null)
  }

  function exporterJSON() {
    const payload = {
      ...serializeData(data),
      _exportedAt: new Date().toISOString(),
      _version: 1,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const dateStr = data.dateControle || new Date().toISOString().slice(0, 10)
    a.download = `controle-${data.numeroDeclaration || 'douane'}-${dateStr}.json`
    a.href = url
    a.click()
    URL.revokeObjectURL(url)
  }

  function importerJSON(file) {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const parsed = JSON.parse(e.target.result)
        const photos = restorePhotos(parsed.photos)
        setData({ ...INITIAL_DATA, ...parsed, photos })
        setStep(0)
        // Forcer le remontage du composant d'étape (useState se réinitialise)
        setImportKey(k => k + 1)
      } catch (err) {
        alert('Fichier invalide : ' + err.message)
      }
    }
    reader.onerror = () => alert('Impossible de lire le fichier.')
    reader.readAsText(file)
  }

  const lieu = data.lieuControle === 'libre' ? data.lieuControleLibre : data.lieuControle
  const lastStepId = steps[steps.length - 1].id

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Outil de Contrôle Douanier</h1>
          <div className="subtitle">Port du Havre — {lieu || 'Lieu non renseigné'}</div>
        </div>
        <div className="header-right">
          <div className="toolbar">
            <button className="toolbar-btn" onClick={nouveauControle}>+ Nouveau</button>
            <label className="toolbar-btn">
              ↑ Charger
              <input
                ref={importRef}
                type="file"
                accept=".json"
                hidden
                onChange={e => { if (e.target.files[0]) { importerJSON(e.target.files[0]); e.target.value = '' } }}
              />
            </label>
            <button className="toolbar-btn" onClick={exporterJSON}>↓ Sauvegarder</button>
          </div>
          {savedAt && <div className="autosave-indicator">✓ Sauvegardé à {savedAt}</div>}
          <span className={`flux-badge flux-${data.flux}`}>
            {data.flux === 'import' ? '↓ IMPORT' : '↑ EXPORT'}
          </span>
        </div>
      </header>

      <StepIndicator steps={steps} currentStep={step} />

      <main className="app-main">
        {step === 0 && <Step0Documentaire key={`s0-${importKey}`} data={data} update={update} goNext={goNext} />}
        {step === 1 && <Step1Init key={`s1-${importKey}`} data={data} update={update} isTerminal={isTerminal} />}
        {step === 2 && <Step2PlombsBL key={`s2-${importKey}`} data={data} update={update} />}
        {step === 3 && <Step3Terrain key={`s3-${importKey}`} data={data} update={update} isTerminal={isTerminal} />}
        {step === 4 && <Step4Photos key={`s4-${importKey}`} data={data} update={update} />}
        {step === 5 && <Step5CompteRendu key={`s5-${importKey}`} data={data} isTerminal={isTerminal} />}
      </main>

      <footer className="app-footer">
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {step > 1 && (
            <button className="btn btn-secondary" onClick={goPrev}>← Précédent</button>
          )}
          {step > 0 && (
            <button
              className="btn btn-ghost"
              onClick={() => setStep(0)}
              title="Revenir au contrôle documentaire"
              style={{ fontSize: '0.82rem' }}
            >
              📋 Revoir documentaire
            </button>
          )}
        </div>
        <div>
          {step !== lastStepId && step !== 0 && (
            <button className="btn btn-primary" onClick={goNext}>
              {steps.findIndex(s => s.id === step) === steps.length - 2
                ? 'Générer le compte rendu →'
                : 'Suivant →'}
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}
