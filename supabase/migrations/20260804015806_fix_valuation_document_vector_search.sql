-- pgvector installs its distance operators in the extensions schema. Keep the
-- security-definer path explicit and limited to trusted schemas so the hybrid
-- search can resolve <=> without admitting user-controlled objects.
alter function public.search_valuation_documents(text, jsonb, integer)
  set search_path = pg_catalog, extensions;
