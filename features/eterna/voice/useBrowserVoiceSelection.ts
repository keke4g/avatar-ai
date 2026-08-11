import { useEffect } from 'react';

import { selectPremiumVoiceWithReason } from '@/features/eterna/voice/browserSpeech';

type RefCell<T> = { current: T };

export function useBrowserVoiceSelection(
  selectedVoiceRef: RefCell<SpeechSynthesisVoice | null>,
): void {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const initVoice = () => {
      if (selectedVoiceRef.current) return;
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) return;

      const spanishVoices = voices.filter(voice => voice.lang.toLowerCase().startsWith('es'));
      console.log('[VOICES ES]');
      spanishVoices.forEach((voice) => {
        console.log(`Nombre: ${voice.name}\nIdioma: ${voice.lang}`);
      });
      console.log(`Total voces españolas encontradas: ${spanishVoices.length}`);

      const { voice, reason } = selectPremiumVoiceWithReason();
      if (!voice) return;

      selectedVoiceRef.current = voice;

      if (voice.name === 'Google español de Estados Unidos' || voice.lang === 'es-US' || voice.lang === 'es_US') {
        console.log('[Eterna Voice] Forzada: Google español de Estados Unidos (es-US)');
      } else if (voice.name === 'Google español' || voice.lang === 'es-ES' || voice.lang === 'es-ES') {
        console.log('[Eterna Voice] Seleccionada: Google español (es-ES)');
      } else if (voice.name === 'Microsoft Sabina - Spanish (Mexico)' || voice.name.toLowerCase().includes('sabina')) {
        console.log('[Eterna Voice] Forzada: Microsoft Sabina - Spanish (Mexico)');
      } else {
        console.log(`[Eterna Voice] Seleccionada: ${voice.name} - ${voice.lang}`);
      }

      const femaleVoiceTokens = [
        'female', 'femenino', 'zira', 'dalia', 'elena', 'sabina',
        'pilar', 'clara', 'helena', 'google', 'monica', 'luz',
      ];
      if (!femaleVoiceTokens.some(token => voice.name.toLowerCase().includes(token))) {
        console.log(`[Eterna Voice] Aviso: La voz seleccionada parece ser de tono masculino o género no especificado. Motivo de selección: ${reason}`);
      }
    };

    initVoice();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = initVoice;
    }
  }, [selectedVoiceRef]);
}
