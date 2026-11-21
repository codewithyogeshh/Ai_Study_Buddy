import { useCallback, useEffect, useRef, useState } from 'react'

import type { Language } from '../types'

type RecognitionResult = {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>
}
type Recognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: ((event: RecognitionResult) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
}
type RecognitionConstructor = new () => Recognition

const LANG_TAG: Record<Language, string> = {
  english: 'en-IN',
  marathi: 'mr-IN',
  hindi: 'hi-IN',
}

function recognitionCtor(): RecognitionConstructor | null {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor
    webkitSpeechRecognition?: RecognitionConstructor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** Browser dictation with graceful degradation when the API is unavailable. */
export function useSpeechToText(language: Language, onTranscript: (text: string) => void) {
  const supported = typeof window !== 'undefined' && Boolean(recognitionCtor())
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<Recognition | null>(null)
  const callbackRef = useRef(onTranscript)
  callbackRef.current = onTranscript

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  const start = useCallback(() => {
    const Ctor = recognitionCtor()
    if (!Ctor) return
    try {
      const recognition = new Ctor()
      recognition.lang = LANG_TAG[language]
      recognition.interimResults = false
      recognition.continuous = false
      recognition.onresult = (event) => {
        const results = event.results
        let transcript = ''
        for (let i = 0; i < results.length; i++) transcript += results[i][0]?.transcript ?? ''
        if (transcript.trim()) callbackRef.current(transcript.trim())
      }
      recognition.onerror = () => setListening(false)
      recognition.onend = () => setListening(false)
      recognitionRef.current = recognition
      recognition.start()
      setListening(true)
    } catch {
      setListening(false)
    }
  }, [language])

  useEffect(() => () => recognitionRef.current?.stop(), [])

  return { supported, listening, start, stop }
}

export function useTextToSpeech() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [speaking, setSpeaking] = useState(false)

  const stop = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [supported])

  const speak = useCallback(
    (text: string, language: Language) => {
      if (!supported) return
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text.slice(0, 6000))
      utterance.lang = LANG_TAG[language]
      utterance.rate = 1
      utterance.onend = () => setSpeaking(false)
      utterance.onerror = () => setSpeaking(false)
      setSpeaking(true)
      window.speechSynthesis.speak(utterance)
    },
    [supported],
  )

  useEffect(() => () => {
    if (supported) window.speechSynthesis.cancel()
  }, [supported])

  return { supported, speaking, speak, stop }
}
