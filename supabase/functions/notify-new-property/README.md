# Notificaciones de nuevas propiedades

Esta Edge Function recibe el webhook de `public.properties` y publica una sola
notificación al tema FCM `new-properties` cuando la propiedad cambia de no
publicada a publicada.

## Configuración requerida

1. En Firebase, registra una app Android con el package
   `com.towersmexico.app` y coloca `google-services.json` en `android/app/`.
2. En Firebase > Configuración del proyecto > Cuentas de servicio, genera una
   clave privada. Guarda el JSON completo como el secreto de Edge Functions
   `FIREBASE_SERVICE_ACCOUNT_JSON`. Nunca agregues ese archivo al repositorio.
3. Despliega `notify-new-property` con verificación JWT activada.
4. En Supabase > Database Webhooks crea un webhook para
   `public.properties`, eventos `Insert` y `Update`, dirigido a esta Edge
   Function. Agrega el encabezado de autorización con la service key.

La función ignora borradores, propiedades demo, ediciones posteriores y
cualquier registro cuyo `folder_status` no sea `PUBLISHED`.

## Prueba segura

Publica una propiedad de prueba que antes tenga `is_published = false`. La
notificación debe abrir `/property/{id}` al tocarla. Editar después esa misma
propiedad no debe generar otra alerta.
