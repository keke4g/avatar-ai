# Towers México para Android

## Estado actual

El repositorio ya contiene una primera integración Android con Capacitor. La
APK de prueba abre la aplicación publicada en `https://towersmexico.com`, añade
una pantalla inicial nativa y solicita el permiso Android
`RECORD_AUDIO` antes de entrar al sitio.

La introducción es código Android, por lo que no se muestra en la versión web
móvil. Desde la versión `0.1.4` es un carrusel nativo minimalista de cuatro
pantallas, con fondo azul, bastante espacio libre y el contenido concentrado en
la parte inferior. El flujo:

1. presenta a Eterna en una sola frase;
2. ofrece la búsqueda manual de propiedades;
3. solicita el micrófono únicamente por una acción explícita;
4. solicita notificaciones para avisar de propiedades recién publicadas.

Los permisos Android nunca aparecen al abrir la pantalla: solo se solicitan
después de tocar `Permitir micrófono` o `Activar notificaciones`.

El carrusel se guarda por versión. Quienes ya completaron la pantalla de la
`0.1.3` ven esta nueva introducción una vez; las aperturas posteriores entran
directamente a la aplicación. Un enlace de recuperación, autenticación o
propiedad nunca queda detenido por el tutorial.

## Modelo de actualización

En esta primera entrega hay una sola base funcional en Next.js:

- Cambios de páginas, estilos, contenido y APIs: se publican normalmente en
  Vercel y aparecen en la APK sin recompilarla.
- Cambios nativos (pantalla inicial, permisos, icono, nombre, deep links o
  plugins Capacitor): requieren sincronizar Android, generar una nueva versión
  y distribuir otra APK/AAB.

Comandos principales:

```powershell
npm run build
npm run android:apk:debug
```

`android:apk:debug` sincroniza Capacitor y detecta automáticamente el JDK de
Android Studio, incluso si el `JAVA_HOME` global está desactualizado.

La APK generada queda en
`android/app/build/outputs/apk/debug/app-debug.apk`.

## Notificaciones de propiedades

La app Android se suscribe, con autorización del usuario, al tema FCM
`new-properties`. La Edge Function `notify-new-property` está desplegada en
Supabase con verificación JWT y filtra el evento para enviar una alerta solo
cuando `is_published` cambia de `false` a `true`, el expediente está en
`PUBLISHED` y no es una propiedad demo. Tocar la alerta abre directamente la
ficha correspondiente.

Para activar el envío real aún se necesitan las credenciales propias del
proyecto Firebase y crear el Database Webhook. Las instrucciones están en
`supabase/functions/notify-new-property/README.md`. Ninguna clave privada debe
entrar al APK ni al repositorio.

## Validación de esta entrega

La versión `0.1.4` se compiló con `minSdk 24` y `targetSdk 36`, se instaló en
un emulador Android 15 y pasó estas verificaciones:

- carrusel por swipe y botones en sus cuatro páginas;
- diseño azul minimalista validado mediante captura real en `1080 × 2400`;
- permiso solicitado únicamente desde el CTA y concesión verificada;
- `Explorar propiedades` y `Ahora no` abren directamente `/explore`;
- permiso de notificaciones solicitado de forma contextual en Android 13+;
- canal nativo `new_properties`, suscripción al tema FCM y navegación segura
  hacia `/property/{id}`;
- Edge Function desplegada con JWT y acceso no autenticado rechazado;
- persistencia de `completed_onboarding_version=4`;
- enlaces profundos abren su destino de inmediato y dejan el onboarding
  pendiente para el siguiente inicio normal;
- `assembleDebug` y `lintDebug` completados correctamente;
- icono adaptativo corregido y validado en el launcher circular de Android 15;
- paquete `com.towersmexico.app`, `versionCode 5`, `versionName 0.1.4` y firma
  de depuración válida mediante APK Signature Scheme v2.

Se conservaron además las verificaciones funcionales de voz de la `0.1.1`:

- arranque nativo y apertura de la web publicada;
- solicitud y persistencia del permiso `RECORD_AUDIO`;
- captura desde el WebView mediante `getUserMedia`, con una pista de audio
  activa;
- disponibilidad de `webkitSpeechRecognition`, que es el fallback usado por
  el hook de voz actual;
- apertura en frío de `towersmexico://reset-password?type=recovery` dentro de
  la ruta web correspondiente;
- firma de depuración válida mediante APK Signature Scheme v2.

La protección introducida en la `0.1.1` contra la competencia de captura sigue
incluida en la `0.1.4`. En dispositivos
Android: el sondeo de permiso con `getUserMedia` ya se cierra antes de que el
servicio de reconocimiento abra su propio canal de audio. La APK también
inyecta esa protección al inicio del documento para que funcione con la
versión web que ya está publicada.

El APK instalable de esta entrega queda en
`output/android/Towers-Mexico-0.1.4-blue-onboarding-debug.apk`.

El emulador permite comprobar la integración y los permisos, pero la calidad
de captura y el reconocimiento de voz todavía deben probarse en al menos un
teléfono Android real antes de una publicación.

## Decisión de arquitectura

No conviene convertir todo el proyecto a una exportación estática. La
aplicación usa rutas dinámicas de Next.js y múltiples handlers bajo `app/api`
para voz, chat, mapas, archivos y valuación. Esas piezas necesitan seguir en
el servidor.

Tampoco es necesario reorganizar todo antes de probar la APK. Para una versión
de tienda sí conviene una segunda fase:

1. Mantener Next.js y las APIs en Vercel.
2. Crear un cliente móvil empaquetado que consuma esas APIs mediante una URL
   configurable, en vez de usar `server.url` como contenedor remoto.
3. Separar las diferencias de plataforma en adaptadores pequeños, por ejemplo
   `lib/platform/microphone` y `lib/platform/deep-links`.
4. Añadir pruebas en un teléfono Android real para grabación, reconocimiento,
   reproducción de voz, login y recuperación de contraseña.
5. Confirmar el identificador definitivo `com.towersmexico.app`, generar un
   keystore de producción bajo control del propietario y producir un AAB
   firmado para Google Play.
6. Completar política de privacidad, ficha de seguridad de datos, iconografía
   final y proceso de versiones.

`server.url` permite entregar y validar ahora la experiencia solicitada, pero
Capacitor lo orienta al desarrollo/live reload. Por eso esta APK se considera
una entrega de prueba instalable, no el artefacto final para Play Store.

## Permisos y enlaces

Android declara el micrófono como capacidad opcional y solicita
`RECORD_AUDIO` de forma contextual. En Android 13 o superior solicita también
`POST_NOTIFICATIONS` desde la última pantalla del carrusel. También admite enlaces de
`https://towersmexico.com` y el esquema `towersmexico://`; ambos se convierten
en navegación interna solo hacia el dominio confiable. Esto permite conservar
flujos como recuperación de contraseña dentro de la app.

## Variables y secretos

La app Android no debe contener claves privadas. Las claves de proveedores de
voz o IA siguen en los endpoints del servidor. `google-services.json` contiene
la configuración pública del cliente Firebase y se coloca en `android/app/`;
la cuenta de servicio privada de Firebase se guarda únicamente como el secreto
Supabase `FIREBASE_SERVICE_ACCOUNT_JSON`. Solo las variables públicas del
cliente, como la URL y la clave anónima de Supabase, pueden llegar al WebView.

Para apuntar una compilación de prueba a otro entorno:

```powershell
$env:CAPACITOR_SERVER_URL = "https://staging.example.com"
npm run android:sync
```

No se debe habilitar HTTP ni contenido mixto en compilaciones de producción.
