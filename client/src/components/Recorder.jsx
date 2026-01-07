import { useState, useEffect, useRef } from 'react'

function Recorder({ onAudioRecorded, isLoading }) {
  const [isRecording, setIsRecording] = useState(false)
  const [volume, setVolume] = useState(0)
  const [devices, setDevices] = useState([])
  const [selectedDevice, setSelectedDevice] = useState('')

  const mediaRecorderRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyzerRef = useRef(null)
  const animationFrameRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])

  // Load available microphones
  useEffect(() => {
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true })
        const allDevices = await navigator.mediaDevices.enumerateDevices()
        const mics = allDevices.filter(d => d.kind === 'audioinput')
        setDevices(mics)
        if (mics.length > 0) {
          // Priority to Bluetooth or Headset
          const bestMic = mics.find(m => m.label.toLowerCase().includes('bluetooth') || m.label.toLowerCase().includes('headset')) || mics[0];
          setSelectedDevice(bestMic.deviceId)
        }
      } catch (err) {
        console.error("Device detection failed:", err)
      }
    }
    getDevices()

    return () => {
      cancelAnimationFrame(animationFrameRef.current)
      if (audioContextRef.current) audioContextRef.current.close()
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    }
  }, [])

  const startRecording = async () => {
    try {
      const constraints = {
        audio: selectedDevice ? { deviceId: { exact: selectedDevice } } : true
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      // Volume Meter Setup
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      analyzerRef.current = audioContextRef.current.createAnalyser()
      analyzerRef.current.fftSize = 256
      source.connect(analyzerRef.current)

      const updateVolume = () => {
        if (!analyzerRef.current) return
        const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount)
        analyzerRef.current.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((p, c) => p + c, 0) / dataArray.length
        setVolume(Math.min(100, (average / 128) * 100))
        animationFrameRef.current = requestAnimationFrame(updateVolume)
      }
      updateVolume()

      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })

        // Block empty recordings (less than 1KB is usually just header)
        if (blob.size < 500) {
          console.error("Recording too short or empty")
          alert("Capture failed: No audio data detected. Please speak louder or check your mic selection.")
          return
        }

        const file = new File([blob], 'recording.webm', { type: 'audio/webm' })
        onAudioRecorded(file)

        // Cleanup
        stream.getTracks().forEach(track => track.stop())
        cancelAnimationFrame(animationFrameRef.current)
        setVolume(0)
      }

      recorder.start(100) // Small timeslice to ensure data flows
      setIsRecording(true)
    } catch (err) {
      console.error("Mic Error:", err)
      alert("Microphone Error: " + err.message)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  return (
    <div className="recorder-container">
      <div className="mic-selector">
        <label>🎤 Preferred Mic:</label>
        <select
          value={selectedDevice}
          onChange={(e) => setSelectedDevice(e.target.value)}
          disabled={isRecording}
        >
          {devices.map(d => (
            <option key={d.deviceId} value={d.deviceId}>{d.label || `Unknown Mic (${d.deviceId.slice(0, 5)})`}</option>
          ))}
        </select>
      </div>

      <div className="button-group">
        {!isRecording ? (
          <button className="btn-start" onClick={startRecording} disabled={isLoading}>
            Start Capture
          </button>
        ) : (
          <button className="btn-stop" onClick={stopRecording}>
            Stop & Transcribe
          </button>
        )}
      </div>

      <div className="visualizer-panel">
        <div className={`status-dot ${isRecording ? 'recording' : ''}`}></div>
        <span className="status-text">{isRecording ? "Listening..." : "Ready"}</span>
        {isRecording && (
          <div className="vol-meter">
            <div className="vol-fill" style={{ width: `${volume}%` }}></div>
          </div>
        )}
      </div>

      <style>{`
        .recorder-container { background: #ffffff; padding: 24px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); margin-bottom: 24px; }
        .mic-selector { margin-bottom: 20px; }
        .mic-selector label { display: block; margin-bottom: 8px; font-weight: 600; color: #475569; }
        .mic-selector select { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; color: #1e293b; }
        .button-group { display: flex; justify-content: center; margin-bottom: 20px; }
        .btn-start { background: #4f46e5; color: white; border: none; padding: 12px 32px; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 14px 0 rgba(79, 70, 229, 0.39); }
        .btn-start:hover { background: #4338ca; transform: translateY(-1px); }
        .btn-stop { background: #ef4444; color: white; border: none; padding: 12px 32px; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 14px 0 rgba(239, 68, 68, 0.39); animation: pulse-red 1.5s infinite; }
        .visualizer-panel { display: flex; align-items: center; gap: 12px; padding: 12px; background: #f1f5f9; border-radius: 12px; }
        .status-dot { width: 10px; height: 10px; border-radius: 50%; background: #94a3b8; }
        .status-dot.recording { background: #ef4444; animation: blink 1s infinite; }
        .status-text { font-size: 14px; font-weight: 600; color: #475569; min-width: 80px; }
        .vol-meter { flex: 1; height: 8px; background: #cbd5e1; border-radius: 4px; overflow: hidden; }
        .vol-fill { height: 100%; background: #22c55e; transition: width 0.05s; }
        @keyframes pulse-red { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
        @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
      `}</style>
    </div>
  )
}

export default Recorder
