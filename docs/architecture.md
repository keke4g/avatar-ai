# Arquitectura del proyecto

## Objetivo

La estructura separa rutas, funciones del producto, interfaz compartida, dominio y adaptadores externos. Una carpeta debe indicar quién es responsable del código, no solamente qué tipo de archivo contiene.

## Mapa de carpetas

```text
app/                         Rutas, layouts y Route Handlers de Next.js
  _components/                Shell y composición privada de toda la aplicación
  <ruta>/_components/        Implementación privada de una ruta
features/                    Funciones completas orientadas al usuario
  eterna/                    Interfaz y orquestación de voz de Eterna
    audio/                    Reproducción y streaming de audio en cliente
    voice/                    Adaptadores del reconocimiento de voz del navegador
    lib/                      Reglas puras específicas de la experiencia
  properties/                Creación y edición de propiedades
    property-wizard/          Pasos, tipos y componentes del publicador
    property-details/         Derivación y presentación del detalle
components/                  Interfaz reutilizada por varias funciones
hooks/                       Hooks realmente compartidos
lib/                         Dominio, servicios, adaptadores y utilidades
  context/swap/              Contrato y persistencia local del contexto de intercambios
  eterna/                    Reglas e intenciones de dominio de Eterna
  services/                  Contratos y servicios de aplicación
  services/supabase/         Implementaciones de servicios por dominio
  shared/                    Utilidades puras sin React ni Next.js
  valuation/                 Modelo y reglas de valuación
supabase/
  migrations/                Historial oficial e inmutable del esquema
scrapers/                    Proveedores, normalización e ingestión de mercado
scripts/                     Operaciones manuales, diagnósticos y herramientas
  analyze-codebase.mjs       Inventario reproducible de líneas y módulos grandes
tests/
  unit/                      Pruebas rápidas de una unidad aislada
  integration/               Pruebas que conectan varios módulos
backend-local/               Servicio local de avatar/RAG en Python
```

## Dirección de dependencias

```text
app -> features -> components compartidos
                  -> lib
app ------------> lib
lib ------------> lib/shared
```

- `lib/` no debe importar desde `components/`, `features/` ni `app/`.
- `components/` no debe importar desde `features/` ni `app/`; `features/` no debe importar desde `app/`.
- Estas fronteras se validan automáticamente con ESLint; no dependen sólo de revisión humana.
- Una función puede consumir componentes compartidos, pero éstos no deben conocer la función consumidora.
- Los adaptadores de Supabase implementan contratos de `lib/services/types.ts`; la interfaz no accede a tablas de forma improvisada.
- Las rutas mantienen archivos `page.tsx` y `route.ts` pequeños. La implementación privada vive junto a la ruta en carpetas `_components`, `_lib` o `_actions`.
- Usa el alias `@/` para dependencias que cruzan dominios o carpetas de primer nivel. Conserva rutas relativas para archivos vecinos.

## Convenciones por función

Una función nueva puede crecer con esta forma:

```text
features/<funcion>/
  components/
  hooks/
  services/
  types.ts
  index.ts
```

No es obligatorio crear todas las carpetas. Se agregan cuando existe código real. Si una pieza termina siendo usada por dos o más funciones, se mueve a `components/`, `hooks/` o `lib/shared/`, según su responsabilidad.

## Datos y migraciones

`supabase/migrations/` es la única fuente ejecutable del esquema de producción. Nunca se modifica una migración que ya fue aplicada: se crea otra con marca de tiempo. Los archivos en `scripts/sql/legacy/` son evidencia histórica o diagnósticos manuales; no forman parte del pipeline.

## Pruebas

- `tests/unit/`: lógica pura, parsers y reglas pequeñas.
- `tests/integration/`: contratos que atraviesan varios módulos.
- Las pruebas reflejan el dominio en su subcarpeta.
- `npm test` compila y ejecuta todas las pruebas TypeScript.

## Comandos de calidad

- `npm run analyze:code`: cuenta código mantenido, pruebas y SQL histórico con exclusiones estables.
- `npm run typecheck`: valida contratos TypeScript sin emitir archivos.
- `npm run lint`: valida estilo, hooks y límites de importación.
- `npm test`: ejecuta las pruebas automatizadas.
- `npm run quality`: ejecuta typecheck, lint y pruebas en ese orden.
- `npm run build`: valida la compilación de producción de Next.js.

## Convenciones de rendimiento

- Los modales y asistentes grandes se cargan con `next/dynamic` cuando no forman parte de la vista inicial.
- Las transformaciones puras viven en `lib/shared/` o en el `lib/` de su función para poder probarlas sin React.
- El streaming PCM de Eterna tiene una sola implementación y administra fuentes activas con `Set`.
- Las búsquedas repetidas usan índices `Map` o `Set`, y los valores derivados costosos se memorizan cerca de su consumidor.
- Los listeners globales conservan una referencia estable y no fuerzan reinstalaciones por cada render.

## Criterio para dividir archivos

Divide un archivo cuando reúne más de una responsabilidad estable, cuando sus cambios pertenecen a equipos o dominios distintos, o cuando una sección puede probarse de forma aislada. Evita dividir solamente para alcanzar una cantidad arbitraria de líneas.

Como señal de revisión, un módulo ejecutable que supera aproximadamente 1,500 líneas debe justificar por qué no puede separarse. Catálogos, traducciones y migraciones históricas pueden ser excepciones porque su volumen no implica necesariamente acoplamiento.

El contador de código excluye dependencias, compilaciones, cachés, entornos virtuales y archivos generados. Reporta por separado pruebas y SQL histórico para que el crecimiento del producto no se confunda con artefactos o evidencia de migraciones.
