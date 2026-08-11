# Towers México

Plataforma inmobiliaria en Next.js para publicar, buscar y comparar propiedades, con Eterna como asistente conversacional y Supabase como capa de datos.

## Desarrollo local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). Las variables requeridas están documentadas en `.env.example`.

## Comandos principales

```bash
npm test
npm run lint
npm run build
```

## Organización

- `app/`: rutas, layouts y endpoints de Next.js.
- `features/`: experiencias completas del producto, como Eterna y publicación de propiedades.
- `components/`: componentes visuales compartidos por varias funciones.
- `lib/`: dominio, servicios, adaptadores y utilidades sin dependencia de la interfaz.
- `supabase/migrations/`: única fuente oficial para cambios de esquema.
- `scrapers/`: adquisición y normalización de comparables de mercado.
- `tests/`: pruebas unitarias y de integración, separadas por alcance.

Consulta [docs/architecture.md](docs/architecture.md) antes de agregar una función nueva o mover responsabilidades entre capas.

## Base de datos

Cada cambio debe agregarse como una migración nueva y fechada dentro de `supabase/migrations/`. Los scripts en `scripts/sql/legacy/` se conservan sólo como referencia histórica y no deben ejecutarse automáticamente.

## Despliegue

El despliegue es una operación separada de la refactorización local. Ejecuta primero pruebas, lint y build, y después usa el flujo de release del proyecto.
