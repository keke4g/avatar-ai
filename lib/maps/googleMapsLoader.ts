"use client";

let googleMapsPromise: Promise<any> | null = null;

async function waitForGoogleMaps(timeoutMs = 12_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const google = (window as any).google;
    if (google?.maps?.importLibrary) return google;
    await new Promise((resolve) => window.setTimeout(resolve, 25));
  }
  throw new Error('Google Maps tardó demasiado en responder.');
}

async function ensureLibraries(candidate?: any) {
  const google = candidate?.maps?.importLibrary ? candidate : await waitForGoogleMaps();
  if (google?.maps?.importLibrary) {
    await Promise.all([
      google.maps.importLibrary('maps'),
      google.maps.importLibrary('places'),
      google.maps.importLibrary('marker'),
    ]);
  }
  return google;
}

export async function loadGoogleMaps(): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('Google Maps solo puede cargarse en el navegador.');
  }

  const existingGoogle = (window as any).google;
  if (existingGoogle?.maps?.importLibrary) return ensureLibraries(existingGoogle);
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = (async () => {
    const configResponse = await fetch('/api/maps/config', { cache: 'no-store' });
    if (!configResponse.ok) throw new Error('La integración de Google Maps no está configurada.');

    const { apiKey } = await configResponse.json() as { apiKey?: string };
    if (!apiKey) throw new Error('Falta configurar la clave de Google Maps.');

    const existingScript = document.getElementById('auraswap-google-maps') as HTMLScriptElement | null;
    if (existingScript) {
      await new Promise<void>((resolve, reject) => {
        if ((window as any).google?.maps) return resolve();
        existingScript.addEventListener('load', () => resolve(), { once: true });
        existingScript.addEventListener('error', () => reject(new Error('No se pudo cargar Google Maps.')), { once: true });
      });
      return ensureLibraries();
    }

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.id = 'auraswap-google-maps';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&libraries=places&language=es&region=MX`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('No se pudo cargar Google Maps.'));
      document.head.appendChild(script);
    });

    const google = await ensureLibraries();
    if (!google?.maps) throw new Error('Google Maps no respondió correctamente.');
    return google;
  })().catch((error) => {
    googleMapsPromise = null;
    throw error;
  });

  return googleMapsPromise;
}
