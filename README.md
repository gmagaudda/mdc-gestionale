# Gestionale showroom moda

Applicazione per anagrafiche, catalogo, ordini, calendario, budget e portale brand. Il progetto è in costruzione secondo [PLAN.md](PLAN.md).

## Requisiti

- Node.js 24 LTS e pnpm 11
- Un runtime compatibile Docker per Supabase locale

## Avvio locale

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Apri <http://localhost:3000>. Le variabili Supabase sono necessarie quando si attivano le funzioni di autenticazione e database.

## Verifiche

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm e2e
pnpm supabase:test
```

Le ultime due verifiche richiedono rispettivamente i browser Playwright e Supabase locale. Non inserire segreti nei file tracciati.
