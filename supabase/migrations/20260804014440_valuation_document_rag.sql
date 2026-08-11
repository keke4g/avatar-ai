-- Private hybrid RAG index for official valuation documents. Browser roles
-- never receive the corpus; only the service-role ingestion/search functions
-- can access it, keeping large PDFs and spreadsheets out of Eterna prompts.

create extension if not exists vector with schema extensions;

create table if not exists valuation.official_document_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references valuation.sources(id) on delete restrict,
  source_file_id uuid not null references valuation.source_files(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null check (length(trim(content)) > 0),
  locator text,
  token_estimate integer not null default 0 check (token_estimate >= 0),
  embedding extensions.vector(768),
  search_vector tsvector generated always as (
    to_tsvector('spanish', coalesce(content, ''))
  ) stored,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source_file_id, chunk_index)
);

create index if not exists official_document_chunks_search_idx
  on valuation.official_document_chunks using gin (search_vector);

create index if not exists official_document_chunks_embedding_idx
  on valuation.official_document_chunks
  using hnsw (embedding extensions.vector_cosine_ops)
  where embedding is not null;

alter table valuation.official_document_chunks enable row level security;
revoke all on valuation.official_document_chunks from public, anon, authenticated;

create or replace function public.ingest_valuation_document(p_document jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  source_payload jsonb := coalesce(p_document -> 'source', '{}'::jsonb);
  file_payload jsonb := coalesce(p_document -> 'file', '{}'::jsonb);
  chunks_payload jsonb := coalesce(p_document -> 'chunks', '[]'::jsonb);
  inserted_source_id uuid;
  inserted_file_id uuid;
  chunk_payload jsonb;
  inserted_chunks integer := 0;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'Service role required';
  end if;

  if nullif(source_payload ->> 'id', '') is null
    or nullif(source_payload ->> 'name', '') is null
    or nullif(file_payload ->> 'sha256', '') is null
    or nullif(file_payload ->> 'storagePath', '') is null then
    raise exception 'Incomplete valuation document payload';
  end if;

  insert into valuation.sources (
    source_code,
    organization,
    name,
    official_url,
    source_kind,
    geographic_scope,
    update_frequency,
    metadata
  ) values (
    source_payload ->> 'id',
    coalesce(nullif(source_payload ->> 'organization', ''), 'Fuente oficial'),
    source_payload ->> 'name',
    coalesce(nullif(source_payload ->> 'officialUrl', ''), file_payload ->> 'assetUrl'),
    'OTHER',
    source_payload ->> 'geographicScope',
    source_payload ->> 'cadence',
    jsonb_strip_nulls(jsonb_build_object(
      'priority', source_payload ->> 'priority',
      'purpose', source_payload ->> 'purpose',
      'attribution', source_payload ->> 'attribution'
    ))
  )
  on conflict (source_code) do update set
    organization = excluded.organization,
    name = excluded.name,
    official_url = excluded.official_url,
    geographic_scope = excluded.geographic_scope,
    update_frequency = excluded.update_frequency,
    metadata = excluded.metadata,
    is_active = true,
    updated_at = now()
  returning id into inserted_source_id;

  insert into valuation.source_files (
    source_id,
    source_url,
    storage_bucket,
    storage_path,
    sha256,
    mime_type,
    file_size_bytes,
    downloaded_at,
    parser_version,
    row_count,
    ingestion_status,
    metadata
  ) values (
    inserted_source_id,
    file_payload ->> 'assetUrl',
    'valuation-raw',
    file_payload ->> 'storagePath',
    file_payload ->> 'sha256',
    file_payload ->> 'contentType',
    nullif(file_payload ->> 'bytes', '')::bigint,
    coalesce(nullif(file_payload ->> 'downloadedAt', '')::timestamptz, now()),
    coalesce(nullif(file_payload ->> 'parserVersion', ''), 'valuation-doc-parser-v1'),
    jsonb_array_length(chunks_payload),
    'PROCESSED',
    jsonb_strip_nulls(jsonb_build_object(
      'localPath', file_payload ->> 'localPath',
      'assetUrl', file_payload ->> 'assetUrl'
    ))
  )
  on conflict (source_id, sha256) do update set
    source_url = excluded.source_url,
    storage_path = excluded.storage_path,
    mime_type = excluded.mime_type,
    file_size_bytes = excluded.file_size_bytes,
    downloaded_at = excluded.downloaded_at,
    parser_version = excluded.parser_version,
    row_count = excluded.row_count,
    ingestion_status = 'PROCESSED',
    error_message = null,
    metadata = excluded.metadata
  returning id into inserted_file_id;

  delete from valuation.official_document_chunks
  where source_file_id = inserted_file_id;

  for chunk_payload in select value from jsonb_array_elements(chunks_payload)
  loop
    if length(trim(coalesce(chunk_payload ->> 'content', ''))) = 0 then
      continue;
    end if;

    insert into valuation.official_document_chunks (
      source_id,
      source_file_id,
      chunk_index,
      content,
      locator,
      token_estimate,
      embedding,
      metadata
    ) values (
      inserted_source_id,
      inserted_file_id,
      coalesce((chunk_payload ->> 'index')::integer, inserted_chunks),
      chunk_payload ->> 'content',
      chunk_payload ->> 'locator',
      greatest(0, coalesce((chunk_payload ->> 'tokenEstimate')::integer, 0)),
      case
        when jsonb_typeof(chunk_payload -> 'embedding') = 'array'
          then (chunk_payload -> 'embedding')::text::extensions.vector
        else null
      end,
      coalesce(chunk_payload -> 'metadata', '{}'::jsonb)
    );
    inserted_chunks := inserted_chunks + 1;
  end loop;

  return jsonb_build_object(
    'sourceId', inserted_source_id,
    'sourceFileId', inserted_file_id,
    'chunks', inserted_chunks
  );
end;
$$;

revoke all on function public.ingest_valuation_document(jsonb) from public, anon, authenticated;
grant execute on function public.ingest_valuation_document(jsonb) to service_role;

create or replace function public.search_valuation_documents(
  p_query_text text,
  p_query_embedding jsonb default null,
  p_match_count integer default 6
)
returns table (
  source_code text,
  source_name text,
  source_url text,
  locator text,
  content text,
  score double precision
)
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'Service role required';
  end if;

  return query
  with scored as (
    select
      source.source_code,
      source.name as source_name,
      file.source_url,
      chunk.locator,
      chunk.content,
      (
        case
          when length(trim(coalesce(p_query_text, ''))) > 0
            then ts_rank_cd(
              chunk.search_vector,
              websearch_to_tsquery('spanish', p_query_text),
              32
            )
          else 0
        end * 0.35
        + case
          when p_query_embedding is not null and chunk.embedding is not null
            then (1 - (chunk.embedding <=> p_query_embedding::text::extensions.vector)) * 0.65
          else 0
        end
      )::double precision as score
    from valuation.official_document_chunks chunk
    join valuation.sources source on source.id = chunk.source_id
    join valuation.source_files file on file.id = chunk.source_file_id
    where source.is_active = true
      and (
        length(trim(coalesce(p_query_text, ''))) = 0
        or chunk.search_vector @@ websearch_to_tsquery('spanish', p_query_text)
        or p_query_embedding is not null
      )
  )
  select
    scored.source_code,
    scored.source_name,
    scored.source_url,
    scored.locator,
    scored.content,
    scored.score
  from scored
  where scored.score > 0
  order by scored.score desc
  limit greatest(1, least(coalesce(p_match_count, 6), 12));
end;
$$;

revoke all on function public.search_valuation_documents(text, jsonb, integer)
  from public, anon, authenticated;
grant execute on function public.search_valuation_documents(text, jsonb, integer)
  to service_role;

comment on table valuation.official_document_chunks is
  'Private chunk index for official valuation PDFs/spreadsheets. Hybrid retrieval prevents sending complete documents to Eterna.';
