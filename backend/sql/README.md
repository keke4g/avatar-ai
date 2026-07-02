# AuraSwap Database Seed & Clean Instructions (Beta Launch)

Este directorio contiene los scripts SQL para preparar la base de datos Supabase de producción del proyecto AuraSwap para el lanzamiento de la Beta Privada.

## Contenido

1. **`reset_demo_properties.sql`**: Limpia todas las propiedades demo antiguas de la base de datos, eliminando en cascada sus dependencias de offerings, imágenes, leads, etc., únicamente para registros donde `is_demo = true`.
2. **`seed_demo_properties.sql`**: Configura las columnas adicionales e inserta las 9 propiedades del catálogo oficial de demostración con coordenadas desfasadas de Sinaloa, 5 imágenes premium y datos de intercambio.
3. **`verify_demo.sql`**: Realiza una auditoría rápida de conteos y listado detallado para validar el éxito de la migración.

---

## Instrucciones de Ejecución

Sigue estos pasos en el **Editor SQL** del panel de control de Supabase:

### Paso 1: Ejecutar la Limpieza
Copia y ejecuta el contenido completo del archivo:
* [reset_demo_properties.sql](file:///c:/Users/crist/Desktop/avatar-ai/backend/sql/reset_demo_properties.sql)

### Paso 2: Ejecutar la Inserción
Copia y ejecuta el contenido completo del archivo:
* [seed_demo_properties.sql](file:///c:/Users/crist/Desktop/avatar-ai/backend/sql/seed_demo_properties.sql)

> **Nota:** Este script busca de forma dinámica el primer perfil de usuario registrado en la tabla `profiles` para asociarlo como `host_id` de las propiedades. Si la base de datos está completamente vacía de usuarios, regístrate primero en la app antes de correr este script.

### Paso 3: Verificar los Resultados
Ejecuta el script:
* [verify_demo.sql](file:///c:/Users/crist/Desktop/avatar-ai/backend/sql/verify_demo.sql)

---

## Resultado Esperado

El resultado final en `verify_demo.sql` debe mostrar exactamente:
* **Cantidad de Propiedades**:
  * `SALE`: 3
  * `MONTHLY_RENT`: 3
  * `SWAP`: 3
* **Total Propiedades Demo**: `9`
* **Cantidad Imágenes**: `5` por cada una de las 9 propiedades.
* **Ubicaciones**: Desfasadas en coordenadas no solapadas de Culiacán, Mazatlán y Altata (Sinaloa).
* **Intercambio Deseado**: Poblado para las 3 propiedades de tipo `SWAP`.
