# Gestionale showroom moda

Applicazione per anagrafiche, catalogo, ordini, calendario, budget e portale brand. Il progetto è in costruzione secondo [PLAN.md](PLAN.md).

## Requisiti

- Node.js 24 LTS e pnpm 11
- Un runtime compatibile Docker per Supabase locale, oppure macOS Apple Silicon per il runtime nativo sperimentale

## Avvio locale

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Avvia Supabase e genera i tipi prima di lavorare sul database:

```bash
pnpm exec supabase start
pnpm exec supabase db reset
pnpm types
```

Su Apple Silicon, `supabase/config.toml` abilita il runtime nativo in assenza di Docker. Apri <http://localhost:3000>. Le variabili Supabase sono necessarie quando si attivano le funzioni di autenticazione e database.

## Verifiche

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm e2e
pnpm supabase:test
```

Le ultime due verifiche richiedono rispettivamente i browser Playwright e Supabase locale. Non inserire segreti nei file tracciati.

## Accesso ai dati

I client Supabase in `lib/supabase` usano la sessione utente e la chiave pubblica. La chiave service role è riservata a `lib/supabase/admin.ts` e ai processi server autorizzati. Le route interne e `/portal` sono protette da `proxy.ts`; le future azioni e letture devono verificare di nuovo ruolo e permessi lato server.
