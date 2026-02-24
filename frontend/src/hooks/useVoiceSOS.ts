/**
 * Voice activation for emergency SOS.
 * Uses Web Speech API on web. On native, returns supported: false.
 */
import { useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';

const TRIGGER_WORDS = ['sos', 'emergency', 'help', 'help me'];
const isWeb = Platform.OS === 'web';

function getSpeechRecognition(): any {
  if (!isWeb || typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export function useVoiceSOS(onTrigger: () => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const supported = isWeb && !!getSpeechRecognition();

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setListening(false);
    setError(null);
  }, []);

  const startListening = useCallback(() => {
    if (!supported) {
      setError('Voice activation is available on web. Use hold to send on mobile.');
      return;
    }
    const SpeechRecognitionAPI = getSpeechRecognition();
    if (!SpeechRecognitionAPI) return;

    setError(null);
    setListening(true);
    const recognition = new SpeechRecognitionAPI();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const transcript = (event.results?.[event.resultIndex]?.[0]?.transcript || '').toLowerCase();
      const matched = TRIGGER_WORDS.some((w) => transcript.includes(w));
      if (matched) {
        recognitionRef.current = null;
        setListening(false);
        onTrigger();
      }
    };

    recognition.onerror = (e: any) => {
      if (e.error !== 'aborted') {
        setError(e.error === 'not-allowed' ? 'Microphone access denied' : 'Listening error');
      }
      recognitionRef.current = null;
      setListening(false);
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };

    try {
      recognition.start();
    } catch (e) {
      recognitionRef.current = null;
      setListening(false);
      setError('Could not start listening');
    }
  }, [supported, onTrigger]);

  return { listening, error, supported, startListening, stopListening };
}
