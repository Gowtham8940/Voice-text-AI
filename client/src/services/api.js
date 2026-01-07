const API_BASE_URL = 'http://localhost:5000/api'

export async function transcribeAudio(audioFile) {
  const formData = new FormData()
  formData.append('audio', audioFile)

  const response = await fetch(`${API_BASE_URL}/transcribe`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Transcription failed')
  }

  const data = await response.json()
  return data.text
}
