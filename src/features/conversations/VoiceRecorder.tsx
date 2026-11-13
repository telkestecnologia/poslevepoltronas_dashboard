import { useRef, useState } from 'react'
import { Mic, Send, Trash2 } from 'lucide-react'

// Formatos que o WhatsApp aceita, na ordem de preferência (AAC em MP4 é o do app). WebM não é aceito pelo WhatsApp.
const TYPES = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg']

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

type Recording = { recorder: MediaRecorder; stream: MediaStream; chunks: Blob[]; type: string; timer: number }

/**
 * Gravar áudio como no WhatsApp Web: clicar no microfone começa a gravar; a lixeira descarta e a seta envia.
 * Enquanto grava, a barra com o tempo ocupa o lugar do campo de texto.
 */
export function VoiceRecorder({ disabled, onRecorded, onError, onRecordingChange }: {
  disabled: boolean; onRecorded: (file: File) => void; onError: (message: string) => void; onRecordingChange: (recording: boolean) => void
}) {
  const [seconds, setSeconds] = useState(0)
  const [recording, setRecording] = useState(false)
  const current = useRef<Recording | null>(null)

  async function start() {
    const type = typeof MediaRecorder === 'undefined' ? undefined : TYPES.find(item => MediaRecorder.isTypeSupported(item))
    if (!type) {
      onError('Este navegador não grava áudio no formato do WhatsApp. Use o Chrome atualizado ou grave pelo app.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: type, audioBitsPerSecond: 64_000 })
      const chunks: Blob[] = []
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
      recorder.start()
      const startedAt = Date.now()
      setSeconds(0)
      const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 250)
      current.current = { recorder, stream, chunks, type, timer }
      setRecording(true)
      onRecordingChange(true)
    } catch {
      onError('Não foi possível usar o microfone. Libere o microfone para este site no navegador.')
    }
  }

  function stop(send: boolean) {
    const active = current.current
    if (!active) return
    current.current = null
    window.clearInterval(active.timer)
    active.recorder.onstop = () => {
      active.stream.getTracks().forEach(track => track.stop())
      if (!send) return
      const baseType = active.type.split(';')[0]
      const blob = new Blob(active.chunks, { type: baseType })
      if (blob.size === 0) return
      onRecorded(new File([blob], `audio-${Date.now()}.${baseType === 'audio/mp4' ? 'm4a' : 'ogg'}`, { type: baseType }))
    }
    active.recorder.stop()
    setRecording(false)
    onRecordingChange(false)
  }

  if (!recording) {
    return <button type="button" className="wa-mic" disabled={disabled} onClick={() => void start()}
      aria-label="Gravar áudio" title="Gravar áudio"><Mic size={18} /></button>
  }
  return <div className="wa-recording" role="group" aria-label="Gravando áudio">
    <button type="button" className="wa-recording-trash" onClick={() => stop(false)} aria-label="Descartar áudio" title="Descartar"><Trash2 size={18} /></button>
    <span className="wa-recording-dot" aria-hidden="true" />
    <span className="wa-recording-time">{clock(seconds)}</span>
    <span className="wa-recording-label">Gravando...</span>
    <button type="button" className="wa-recording-send" onClick={() => stop(true)} aria-label="Enviar áudio" title="Enviar áudio"><Send size={18} /></button>
  </div>
}
