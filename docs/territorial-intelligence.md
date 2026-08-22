# Inteligencia territorial de Eterna

Eterna usa una capa territorial separada del catálogo y de las valuaciones. La capa conserva geografía, periodo, unidad, evidencia y fuente; nunca genera perfiles individuales.

## Cobertura activa

| Tema | Fuente activa | Cobertura | Corte |
| --- | --- | --- | --- |
| Población y grupos de edad | CONAPO | 32 entidades y 2,475 municipios | Proyecciones 2025, 2030, 2035 y 2040 |
| Empleo, salarios, formalidad e informalidad | INEGI ENOE mediante Data México | Nacional y estatal | Trimestre más reciente publicado |
| Sectores con población ocupada | INEGI ENOE mediante Data México | Nacional y estatal | Trimestre más reciente publicado |
| Unidades económicas por sector | Censos Económicos mediante Data México | Nacional, estatal y municipal | Línea base 2019 del cubo activo |
| Rezago habitacional | SNIIV, SEDATU / CONAVI | Estatal 2024 y municipal 2020 | Último archivo abierto por nivel |
| Financiamiento y vivienda registrada | SNIIV, SEDATU / CONAVI | Estatal y municipal | Consulta API 2024–2025 |

El catálogo de fuentes también registra DENUE, ENIGH, IMSS, CONEVAL y SHF como ampliaciones oficiales previstas. DENUE en vivo solo se habilita cuando existe `INEGI_DENUE_TOKEN` en el servidor.

## Cómo responde Eterna

1. Detecta si la pregunta requiere datos territoriales.
2. Resuelve nación, entidad o municipio usando claves oficiales.
3. Recupera únicamente agregados oficiales y añade cobertura estatal cuando una encuesta no es representativa a escala municipal.
4. Separa observaciones, proyecciones e inferencias calculadas.
5. Entrega a Gemini un contrato de servidor con hechos, citas, advertencias y reglas que no pueden ser reemplazadas por el texto del usuario.

No se utiliza un “puntaje mágico”. Crecimiento, necesidad habitacional, empleo, ingreso y actividad empresarial permanecen como señales independientes. La respuesta puede combinarlas para explicar una decisión, pero debe declarar que son proxies y no una garantía de plusvalía, demanda solvente o elegibilidad crediticia.

## Actualización y trazabilidad

Regenerar la fotografía oficial:

```powershell
npx tsx scripts/territory/build-official-snapshot.ts
```

El archivo resultante es `data/territory/official-territorial-snapshot.json`. Incluye fecha de recuperación, URL del activo, hash SHA-256 y las consultas ENOE exactas. La migración `20260822193000_add_territorial_intelligence.sql` crea el esquema privado `territory` para conservar publicaciones y observaciones versionadas sin exponer tablas al cliente.

## Límites obligatorios

- ENOE se presenta a escala nacional o estatal; un municipio hereda su contexto estatal con una advertencia visible.
- Un salario por grupo de edad describe un agregado y no permite inferir el ingreso de una persona por su edad.
- Rezago habitacional es necesidad social observada, no demanda comercial automática.
- Crecimiento de población es una proyección demográfica, no una promesa de plusvalía.
- Censos Económicos y DENUE no representan todo el comercio informal.
- Eterna no debe segmentar, excluir ni dirigir vivienda por edad u otro atributo protegido.

## Endpoints

- `POST /api/territory/insights`: devuelve el contrato estructurado y trazable para una consulta.
- `POST /api/avatar`: enriquece automáticamente las preguntas territoriales antes de llamar al modelo de Eterna.

Ejemplo:

```json
{
  "query": "¿Qué sectores económicos, salarios y necesidad de vivienda hay en Culiacán?",
  "propertyContext": {
    "city": "Culiacán",
    "state": "Sinaloa"
  }
}
```
