export type MicrophonePermissionState = 'granted' | 'prompt' | 'denied' | 'unsupported';
export type MicrophoneIssue = 'denied' | 'not-found' | 'busy' | 'unsupported' | 'unknown';

export interface MobileBrowserGuide {
  deviceLabel: string;
  browserLabel: string;
  steps: string[];
}

export function getMobileBrowserGuide(language: 'es' | 'en'): MobileBrowserGuide {
  if (typeof navigator === 'undefined') {
    return {
      deviceLabel: language === 'es' ? 'Tu dispositivo' : 'Your device',
      browserLabel: language === 'es' ? 'Navegador móvil' : 'Mobile browser',
      steps: language === 'es'
        ? ['Abre los permisos del sitio.', 'Selecciona Micrófono.', 'Elige Permitir y vuelve a Towers México.']
        : ['Open the site permissions.', 'Select Microphone.', 'Choose Allow and return to Towers México.'],
    };
  }

  const userAgent = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(userAgent);
  const isCriOS = /CriOS/i.test(userAgent);
  const isFirefox = /FxiOS|Firefox/i.test(userAgent);
  const isSamsung = /SamsungBrowser/i.test(userAgent);
  const isSafari = isIOS && !isCriOS && !isFirefox;

  if (isIOS && isSafari) {
    return {
      deviceLabel: 'iPhone / iPad',
      browserLabel: 'Safari',
      steps: language === 'es'
        ? [
            'Toca el botón de página junto a la dirección.',
            'Abre “Más” y después “Configuración del sitio web”.',
            'En “Micrófono”, selecciona “Permitir” y vuelve aquí.',
          ]
        : [
            'Tap the Page Menu button next to the address.',
            'Open “More”, then “Website Settings”.',
            'Set “Microphone” to “Allow” and return here.',
          ],
    };
  }

  if (isIOS) {
    return {
      deviceLabel: 'iPhone / iPad',
      browserLabel: isCriOS ? 'Chrome' : (isFirefox ? 'Firefox' : 'Navegador'),
      steps: language === 'es'
        ? [
            'Abre Ajustes del iPhone y busca este navegador.',
            'Entra a “Micrófono” y activa el permiso.',
            'Regresa a Towers México y toca “Comprobar permiso”.',
          ]
        : [
            'Open iPhone Settings and find this browser.',
            'Open “Microphone” and enable access.',
            'Return to Towers México and tap “Check permission”.',
          ],
    };
  }

  if (isAndroid) {
    return {
      deviceLabel: 'Android',
      browserLabel: isSamsung ? 'Samsung Internet' : (isFirefox ? 'Firefox' : 'Chrome'),
      steps: language === 'es'
        ? [
            'Toca el icono de controles o candado junto a la dirección.',
            'Abre “Permisos” y selecciona “Micrófono”.',
            'Elige “Permitir”, vuelve aquí y comprueba el permiso.',
          ]
        : [
            'Tap the controls or lock icon next to the address.',
            'Open “Permissions” and select “Microphone”.',
            'Choose “Allow”, return here, and check the permission.',
          ],
    };
  }

  return {
    deviceLabel: language === 'es' ? 'Computadora' : 'Computer',
    browserLabel: language === 'es' ? 'Navegador' : 'Browser',
    steps: language === 'es'
      ? [
          'Haz clic en el icono de controles o candado junto a la dirección.',
          'Abre “Permisos del sitio” y permite el micrófono.',
          'Vuelve aquí y comprueba el permiso.',
        ]
      : [
          'Click the controls or lock icon next to the address.',
          'Open “Site permissions” and allow the microphone.',
          'Return here and check the permission.',
        ],
  };
}

export function classifyMicrophoneError(error: unknown): MicrophoneIssue {
  if (!(error instanceof DOMException)) return 'unknown';
  if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return 'denied';
  if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') return 'not-found';
  if (error.name === 'NotReadableError' || error.name === 'TrackStartError') return 'busy';
  return 'unknown';
}
