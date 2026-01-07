import { useState, useRef } from 'react'
import Recorder from './components/Recorder'
import { transcribeAudio } from './services/api'

function App() {
  const [transcribedText, setTranscribedText] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    await processAudio(file)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const processAudio = async (audioFile) => {
    setLoading(true)
    setError('')
    setTranscribedText(null)

    // Validate file
    if (audioFile.size > 25 * 1024 * 1024) {
      setError('File size exceeds 25MB limit')
      setLoading(false)
      return
    }

    const validFormats = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm', 'audio/x-m4a', 'audio/aac', 'audio/flac', 'audio/x-wav', 'audio/x-m4b']
    const validExtensions = ['.mp3', '.wav', '.ogg', '.mp4', '.webm', '.m4a', '.aac', '.flac', '.wma', '.m4b']
    
    const fileExtension = audioFile.name.substring(audioFile.name.lastIndexOf('.')).toLowerCase()
    const isValidFormat = validFormats.includes(audioFile.type) || validExtensions.includes(fileExtension)
    
    if (!isValidFormat) {
      setError('Unsupported audio format. Use MP3, WAV, OGG, M4A, AAC, FLAC, or WebM')
      setLoading(false)
      return
    }

    try {
      const text = await transcribeAudio(audioFile)
      setTranscribedText(text)
    } catch (err) {
      setError(err.message || 'Transcription failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <h1>Voice to Text</h1>

      <Recorder onAudioRecorded={processAudio} isLoading={loading} />

      <div className="input-group">
        <label htmlFor="audio-file">Or upload an audio file:</label>
        <input
          id="audio-file"
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileUpload}
          disabled={loading}
        />
      </div>

      {loading && (
        <div className="status loading">Processing audio...</div>
      )}

      {error && (
        <div className="status error">Error: {error}</div>
      )}

      {transcribedText !== '' && !loading && !error && (
        <div className="output-section">
          <label className="output-label">Transcription:</label>
          <div className="output-text">
            {transcribedText || <em style={{ color: '#888' }}>No speech detected in the audio</em>}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
