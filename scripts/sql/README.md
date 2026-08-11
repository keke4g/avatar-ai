# SQL manual e histórico

La única fuente oficial y ejecutable del esquema es `supabase/migrations/`.

`legacy/` conserva scripts anteriores, semillas y diagnósticos para consulta. Ningún archivo de esa carpeta debe ejecutarse automáticamente ni asumirse compatible con el esquema actual. Si una corrección histórica todavía es necesaria, conviértela en una migración nueva, fechada e idempotente cuando aplique.
