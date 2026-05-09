import { useState, useRef, useMemo, useEffect } from 'react'
import imageCompression from 'browser-image-compression'
import { uid, formatSize, blobToBase64 } from '../utils'

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.5,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
}

const DEFAULT_BADGES = [
  'Conteneur',
  'Ancien plomb',
  'Nouveau plomb',
  'Plombage',
  'Portes conteneur',
  'Chargement',
  'Marquages',
  'Étiquettes',
  'Prélèvement',
]

const BADGES_KEY = 'ctrlcust-photo-badges'

function BadgesPanel({ baseName, setBaseName, referencesControle }) {
  const [badges, setBadges] = useState(() => {
    try {
      const saved = localStorage.getItem(BADGES_KEY)
      return saved ? JSON.parse(saved) : DEFAULT_BADGES
    } catch { return DEFAULT_BADGES }
  })
  const [newBadge, setNewBadge] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  useEffect(() => {
    localStorage.setItem(BADGES_KEY, JSON.stringify(badges))
  }, [badges])

  function addBadge() {
    const t = newBadge.trim()
    if (!t || badges.includes(t)) return
    setBadges(p => [...p, t])
    setNewBadge('')
  }

  function removeBadge(i) {
    setBadges(p => p.filter((_, idx) => idx !== i))
  }

  return (
    <div style={{ marginTop: '0.6rem' }}>
      {/* Références depuis les contrôles */}
      {referencesControle.length > 0 && (
        <>
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
            Références contrôlées :
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.6rem' }}>
            {referencesControle.map((ref, i) => (
              <button key={i} type="button" onClick={() => setBaseName(ref)}
                style={{
                  background: baseName === ref ? '#1e40af' : 'var(--color-bg-subtle, #eef2ff)',
                  color: baseName === ref ? '#fff' : 'var(--color-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '0.35rem', padding: '0.2rem 0.6rem',
                  fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: 600, cursor: 'pointer',
                }}>
                {ref}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Badges prédéfinis + personnalisés */}
      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
        Noms rapides :
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
        {badges.map((badge, i) => (
          <div key={i} style={{ position: 'relative', display: 'inline-flex' }}>
            <button type="button" onClick={() => setBaseName(badge)}
              style={{
                background: baseName === badge ? '#1e40af' : '#f0f4ff',
                color: baseName === badge ? '#fff' : '#374151',
                border: '1px solid #c7d2fe',
                borderRadius: '0.35rem', padding: '0.2rem 0.6rem',
                fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer',
                paddingRight: showCustom ? '1.4rem' : '0.6rem',
              }}>
              {badge}
            </button>
            {showCustom && (
              <button type="button" onClick={() => removeBadge(i)}
                style={{
                  position: 'absolute', right: '0.15rem', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: baseName === badge ? '#fff' : '#9ca3af', fontSize: '0.7rem', padding: 0,
                }}>✕</button>
            )}
          </div>
        ))}
        <button type="button" onClick={() => setShowCustom(o => !o)}
          style={{
            background: 'none', border: '1px dashed #c7d2fe', borderRadius: '0.35rem',
            padding: '0.2rem 0.6rem', fontSize: '0.8rem', color: '#6b7280', cursor: 'pointer',
          }}>
          {showCustom ? '✓ Terminer' : '+ Personnaliser'}
        </button>
      </div>

      {showCustom && (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
          <input type="text" placeholder="Nouveau badge..." value={newBadge}
            onChange={e => setNewBadge(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addBadge() }}
            style={{ flex: 1, fontSize: '0.82rem', padding: '0.25rem 0.5rem', borderRadius: '0.35rem', border: '1px solid var(--color-border)' }}
          />
          <button type="button" className="btn btn-sm btn-success" onClick={addBadge}>+ Ajouter</button>
        </div>
      )}
    </div>
  )
}

export default function Step4Photos({ data, update }) {
  const [baseName, setBaseName] = useState('')
  const [selectedFiles, setSelectedFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [compressing, setCompressing] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef()

  // Construire la liste chronologique des références depuis les contrôles
  const referencesControle = useMemo(() => {
    const refs = []
    const allControles = [
      ...(data.controles || []),
      ...(data.controlesDepot || []),
    ]
    allControles.forEach(ctrl => {
      if (!ctrl?.cartons) return
      ctrl.cartons.forEach(unite => {
        if (unite.reference?.trim()) {
          const label = unite.reference.trim()
          if (!refs.includes(label)) refs.push(label)
        }
      })
    })
    return refs
  }, [data.controles, data.controlesDepot])

  function handleFileSelect(files) {
    const arr = Array.from(files)
    setSelectedFiles(arr)
    const urls = arr.map(f => URL.createObjectURL(f))
    setPreviews(urls)
  }

  async function handleConfirm() {
    if (!selectedFiles.length) {
      alert('Veuillez sélectionner au moins une photo.')
      return
    }
    if (!baseName.trim()) {
      alert('Veuillez saisir un nom de base.')
      return
    }

    setCompressing(true)
    try {
      const newPhotos = []
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i]
        const ext = file.name.split('.').pop().toLowerCase()
        const name = selectedFiles.length === 1
          ? baseName.trim()
          : `${baseName.trim()}-${i + 1}`

        const compressed = await imageCompression(file, COMPRESSION_OPTIONS)
        const url = URL.createObjectURL(compressed)
        const base64 = await blobToBase64(compressed)

        newPhotos.push({
          id: uid(),
          name,
          extension: ext,
          blob: compressed,
          url,
          base64,
          size: compressed.size,
          originalSize: file.size,
        })
      }
      update({ photos: [...data.photos, ...newPhotos] })
      setSelectedFiles([])
      setPreviews([])
      setBaseName('')
    } catch (err) {
      alert('Erreur lors de la compression : ' + err.message)
    }
    setCompressing(false)
  }

  function removePhoto(id) {
    update({ photos: data.photos.filter(p => p.id !== id) })
  }

  function downloadPhoto(photo) {
    const a = document.createElement('a')
    a.href = photo.url
    a.download = `${photo.name}.${photo.extension}`
    a.click()
  }

  return (
    <>
      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Agrandissement" />
        </div>
      )}

      <div className="card">
        <div className="card-title">Ajouter des photos</div>

        <div
          className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files) }}
        >
          <div className="upload-form">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Nom de base pour ces photos</label>
              <input
                type="text"
                placeholder='ex. "ref3432" → donnera ref3432-1, ref3432-2...'
                value={baseName}
                onChange={e => setBaseName(e.target.value)}
              />
              <p className="helper">Pour une seule photo : le nom tel quel. Pour plusieurs : le nom suivi de -1, -2, -3...</p>

              <BadgesPanel
                baseName={baseName}
                setBaseName={setBaseName}
                referencesControle={referencesControle}
              />
            </div>

            <div className="upload-row">
              <div className="form-group">
                <label>Sélectionner les photos</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={e => handleFileSelect(e.target.files)}
                />
              </div>
              <button
                className="btn btn-primary"
                onClick={handleConfirm}
                disabled={compressing || !selectedFiles.length}
                style={{ marginBottom: '1.1rem' }}
              >
                {compressing ? 'Compression...' : '✓ Confirmer et compresser'}
              </button>
            </div>

            {previews.length > 0 && (
              <div className="file-previews">
                {previews.map((url, i) => (
                  <img key={i} className="file-preview-thumb" src={url} alt={`aperçu ${i + 1}`} />
                ))}
                <p className="helper" style={{ alignSelf: 'center' }}>
                  {previews.length} photo{previews.length > 1 ? 's' : ''} sélectionnée{previews.length > 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {data.photos.length > 0 && (
        <div className="card">
          <div className="card-title">
            Photos ajoutées ({data.photos.length})
          </div>

          <div className="photo-grid">
            {data.photos.map(photo => (
              <div key={photo.id} className="photo-item">
                <img
                  src={photo.url}
                  alt={photo.name}
                  onClick={() => setLightbox(photo.url)}
                />
                <div className="photo-info">
                  <div className="photo-name">{photo.name}.{photo.extension}</div>
                  <div className="photo-size">
                    {formatSize(photo.originalSize)} → {formatSize(photo.size)}
                  </div>
                </div>
                <div className="photo-actions">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => downloadPhoto(photo)}
                    title="Télécharger"
                    style={{ color: 'var(--primary)' }}
                  >
                    ↓
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => removePhoto(photo.id)}
                    title="Supprimer"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
