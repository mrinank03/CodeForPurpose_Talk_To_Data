// Wraps react-speech-recognition into a clean hook for the chat input.
// Returns whether we are currently listening, the live transcript,
// and functions to start and stop listening.

import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

interface VoiceInputHook {
  isListening: boolean;
  transcript: string;
  isSupported: boolean;
  isMicAvailable: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export function useVoiceInput(): VoiceInputHook {
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable,
  } = useSpeechRecognition();

  const startListening = () => {
    resetTranscript();
    // en-GB is used because this is a NatWest (UK bank) product
    SpeechRecognition.startListening({ continuous: false, language: 'en-GB' });
  };

  const stopListening = () => {
    SpeechRecognition.stopListening();
  };

  return {
    isListening: listening,
    transcript,
    isSupported: browserSupportsSpeechRecognition,
    isMicAvailable: isMicrophoneAvailable,
    startListening,
    stopListening,
    resetTranscript,
  };
}
