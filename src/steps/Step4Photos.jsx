import { useState, useRef } from 'react'
import imageCompression from 'browser-image-compression'
import { uid, formatSize, blobToBase64 } from '../utils'

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.5,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
}

export default function Step4Photos({ data, update }) {
  const [baseName, setBaseName] = useState('')
  const [selectedFiles, setSelectedFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [compressing, setCompressing] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef()

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
