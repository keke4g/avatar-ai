# Towers México valuation ingestion

This worker discovers and preserves official valuation datasets without adding
binary files to Git. Downloads are stored in `.valuation-cache` and, when a
server-only `SUPABASE_SERVICE_ROLE_KEY` is configured, are copied to the private
`valuation-raw` bucket using a content-addressed path.

```powershell
npx tsx scripts/valuation/ingest-official-sources.ts
npx tsx scripts/valuation/ingest-official-sources.ts --source=shf-home-price-index
```

Rules:

- Official domains only.
- Immutable source files identified by SHA-256.
- API/direct download before browser automation.
- The service-role key is never exposed as a `NEXT_PUBLIC_*` variable.
- INEGI geographic archives and cadastral documents require a reviewed direct
  asset URL because their legacy download pages generate selections dynamically.

## Internal asking-price comparables

The separate Python worker in `scrapers/market` uses Scrapling to normalize
minimal observations from Mercado Libre Inmuebles, Inmuebles24 and
Propiedades.com. It respects robots rules, stores no contact details, complete
descriptions or photos, and never exposes source URLs through public views.
Propiedades.com is collected only when its current `robots.txt` can be read and
permits the requested path; temporary unavailability fails closed.

```powershell
.\.venv-market-scraper\Scripts\python -m scrapers.market.batch_cli --max-pages 1 --upload
npm run valuation:recalculate-market
```
