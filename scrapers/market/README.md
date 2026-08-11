# Towers México — referencias de mercado autorizadas y de investigación

Este worker conserva únicamente los campos mínimos necesarios para una
referencia de precios anunciados: precio, moneda, operación, tipo, colonia,
municipio, estado, coordenadas cuando el proveedor las entrega, superficies,
recámaras, baños, estacionamientos, URL/ID, fecha de publicación y última
verificación. Nunca persiste teléfonos, correos, descripciones completas ni
fotografías.

## Modos de acceso

La ingestión privada distingue dos categorías:

- inventario propio de Towers México;
- agencias que autoricen su inventario mediante EasyBroker u otro feed;
- una API o feed contratado que autorice expresamente el uso estadístico/AVM.
- `RESEARCH_ONLY`: anuncios públicos capturados con Scrapling para comparación
  puntual de precios solicitados. Nunca se republica una base del portal ni se
  guardan contactos, texto completo o medios.

El collector público usa `Fetcher` o `DynamicFetcher` estándar, respeta una
prohibición explícita de `robots.txt`, limita páginas y aplica pausas. No usa
`StealthyFetcher`, proxies, cuentas, resolución de CAPTCHA ni evasión de retos.
Una redirección a autenticación/CAPTCHA se registra como fallo y produce cero
filas. Los datos `RESEARCH_ONLY` pueden contribuir al agregado solo si superan
la misma compuerta estadística estricta.

## Instalación

```powershell
python -m venv .venv-market-scraper
.\.venv-market-scraper\Scripts\python -m pip install -r scrapers\market\requirements.txt
```

## EasyBroker (inventario de una agencia que consintió)

Configura en un entorno privado:

```text
EASYBROKER_API_KEY=...
EASYBROKER_AUTHORIZATION_REFERENCE=consentimiento-o-contrato-...
EASYBROKER_AVM_USE_AUTHORIZED=true
```

Después:

```powershell
.\.venv-market-scraper\Scripts\python -m scrapers.market.authorized_cli `
  --provider easybroker `
  --max-pages 8 `
  --upload
```

## Mercado Libre API

No se usa navegador ni scraper. Además del token OAuth, Towers requiere una
referencia de la autorización contractual para utilizar resultados en un AVM:

```text
MERCADOLIBRE_ACCESS_TOKEN=...
MERCADOLIBRE_AVM_CONTRACT_ID=...
MERCADOLIBRE_AVM_USE_AUTHORIZED=true
MERCADOLIBRE_SEARCH_BBOX=24.70,24.90,-107.50,-107.30
MERCADOLIBRE_CATEGORY_IDS=...
MERCADOLIBRE_SEARCH_CITY=Culiacán Rosales
MERCADOLIBRE_SEARCH_STATE=Sinaloa
```

```powershell
.\.venv-market-scraper\Scripts\python -m scrapers.market.authorized_cli `
  --provider mercadolibre-api `
  --max-pages 8 `
  --upload
```

## Investigación pública mínima con Scrapling

Ejemplo acotado a Montebello:

```powershell
.\.venv-market-scraper\Scripts\python -m scrapers.market.cli `
  --portal inmuebles24 `
  --seed https://www.inmuebles24.com/casas-en-venta-en-fraccionamiento-montebello-ciudad-de-culiacan.html `
  --city "Culiacán Rosales" `
  --state Sinaloa `
  --neighborhood Montebello `
  --max-pages 4 `
  --delay 3 `
  --render-js `
  --include-details `
  --allow-unavailable-robots `
  --upload
```

Para recorrer el inventario público completo usa el manifiesto versionado. El
manifiesto cubre 12 propiedades en 11 micromercados, conserva venta/renta y
casa/departamento por separado y excluye referencias conocidas del propio
inmueble:

```powershell
.\.venv-market-scraper\Scripts\python -m scrapers.market.batch_cli `
  --manifest scrapers\market\research_markets.json `
  --max-pages 1 `
  --delay 3 `
  --upload
```

La salida informa cuántos objetivos obtuvieron al menos una observación y
enumera los que siguen sin cobertura. Que exista una observación no implica que
exista una estimación: el motor vuelve a validar superficie, ubicación,
micromercado, vigencia, duplicados, diversidad de fuentes y dispersión.

`--allow-unavailable-robots` permite continuar únicamente cuando el archivo no
responde; nunca anula un `Disallow`. Las semillas personalizadas exigen ciudad
y estado para impedir que una ficha de Puebla sea etiquetada como Culiacán.

## Compuerta pública

El modelo v4 no publica un número salvo que la operación tenga, después de
deduplicar:

- 8 comparables vigentes y únicos;
- 2 fuentes independientes con al menos 3 referencias por fuente;
- tamaño efectivo de muestra de 5 o más;
- ninguna fuente con más de 60% del peso;
- al menos 60% de coordenadas verificables;
- completitud crítica media de 80% o más;
- dispersión y sensibilidad dentro de límites;
- confianza final de 65/100 o superior.

Una corrida insuficiente invalida inmediatamente cualquier cálculo anterior.
SHF, SNIIV, INEGI y catastro sirven como contexto y controles; no cuentan como
comparables individuales ni generan por sí solos un precio de vivienda.

Si el portal no publica la fecha original, `published_at` permanece nulo. La
fecha de captura se conserva como `observation_date` y la actividad actual como
`last_verified_at`; nunca se presenta la captura como fecha de publicación.

La ejecución programada está en
`.github/workflows/market-comparable-ingestion.yml`. Los conectores de API se
usan cuando están autorizados y la investigación pública se ejecuta en lotes
pequeños. Cualquier corrida insuficiente conserva el mensaje “No hay
referencias suficientes” y oculta números anteriores.
