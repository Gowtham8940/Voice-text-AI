import { useState, useRef, useEffect } from 'react'

function Recorder({ onAudioRecorded, isLoading }) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [devices, setDevices] = useState([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerIntervalRef = useRef(null)
  const canvasRef = useRef(null)
  const animationFrameRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    getDevices()
    navigator.mediaDevices.addEventListener('devicechange', getDevices)
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', getDevices)
    }
  }, [])

  const getSupportedMimeType = () => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/aac'
    ]
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type
      }
    }
    return '' // Let browser use default
  }

  const getDevices = async () => {
    try {
      const devs = await navigator.mediaDevices.enumerateDevices()
      const audioInputs = devs.filter(d => d.kind === 'audioinput')
      setDevices(audioInputs)

      if (audioInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(audioInputs[0].deviceId)
      }
    } catch (err) {
      console.error("Error fetching devices:", err)
    }
  }

  const startRecording = async () => {
    try {
      const constraints = {
        audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      getDevices()

      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      audioContextRef.current = audioContext
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      // Start Visualizer
      drawVisualizer()

      const mimeType = getSupportedMimeType()
      console.log(`[RECORDER] Using MIME type: ${mimeType}`)

      const options = mimeType ? { mimeType } : {}
      const mediaRecorder = new MediaRecorder(stream, options)

      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: mimeType })

        if (blob.size < 3000) {
          console.warn(`[RECORDER] File too small (${blob.size} bytes). Possibly no audio captured.`)
          alert("Recording failed or was too short. Please check your microphone selection and speak louder.")
          // Stop cleanup but don't send file
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
          }
          if (audioContextRef.current) {
            audioContextRef.current.close()
          }
          cancelAnimationFrame(animationFrameRef.current)
          setIsRecording(false)
          return
        }

        // Ensure extension matches or server handles it. We'll send as .webm but server detects by mime or content.
        // Actually best to keep filename generic or extension aligned, but server relies on multer validation which we have.
        // Let's stick to .webm but sending the correct blob type is crucial.
        const file = new File([blob], 'recording.webm', { type: mimeType })
        console.log(`[RECORDER] Recorded ${blob.size} bytes with mime: ${mimeType}`)
        onAudioRecorded(file)

        // Cleanup
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
        }
        if (audioContextRef.current) {
          audioContextRef.current.close()
        }
        cancelAnimationFrame(animationFrameRef.current)
      }

      // Request data every 1 second to ensure we capture chunks
      mediaRecorder.start(1000)
      setIsRecording(true)
      setRecordingTime(0)
      console.log('[RECORDER] Started recording')

      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)

    } catch (err) {
      console.error('[ERROR] Microphone access error:', err)
      alert('Microphone access denied. Please allow microphone access.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      clearInterval(timerIntervalRef.current)
      console.log('[RECORDER] Stopped recording')
    }
  }

  const drawVisualizer = () => {
    if (!analyserRef.current || !canvasRef.current) return

    const bufferLength = analyserRef.current.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    const canvas = canvasRef.current
    const canvasCtx = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw)
      analyserRef.current.getByteFrequencyData(dataArray)

      canvasCtx.fillStyle = 'rgb(240, 240, 240)'
      canvasCtx.fillRect(0, 0, width, height)

      const barWidth = (width / bufferLength) * 2.5
      let barHeight
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2
        canvasCtx.fillStyle = `rgb(${barHeight + 100}, 50, 50)`
        canvasCtx.fillRect(x, height - barHeight, barWidth, barHeight)
        x += barWidth + 1
      }
    }

    draw()
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="input-group">
      <label>Record audio:</label>

      <div className="device-selection" style={{ marginBottom: '10px' }}>
        <select
          value={selectedDeviceId}
          onChange={(e) => setSelectedDeviceId(e.target.value)}
          disabled={isRecording}
          style={{ padding: '5px', borderRadius: '4px', width: '100%' }}
        >
          {devices.length === 0 && <option value="">Default Microphone</option>}
          {devices.map(device => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}
            </option>
          ))}
        </select>
      </div>

      <div className="button-group">
        <button
          className="btn-submit"
          onClick={startRecording}
          disabled={isRecording || isLoading}
        >
          Start Recording
        </button>
        <button
          className="btn-stop"
          onClick={stopRecording}
          disabled={!isRecording || isLoading}
        >
          Stop Recording
        </button>
      </div>
      {isRecording && (
        <div className="status loading" style={{ flexDirection: 'column', alignItems: 'center' }}>
          <canvas
            ref={canvasRef}
            width="200"
            height="60"
            style={{ marginBottom: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="recording-indicator"></span>
            Recording... <span className="timer">{formatTime(recordingTime)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default Recorder
