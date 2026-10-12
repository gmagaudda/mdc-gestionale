# Gestionale showroom moda

Avanzamento e verifiche ancora aperte: [docs/PROGRESS.md](docs/PROGRESS.md).

Preview di questa sessione: `http://localhost:3100/login` (`pnpm dev --port 3100`). Credenziali locali in `.env.local`, escluso da Git.

Recupero locale: Mailpit su `http://127.0.0.1:54324`, link PKCE da aprire nello stesso browser. Su Supabase gestito configurare il template recovery in `supabase/templates/recovery.html` e autorizzare il redirect `APP_URL/auth/confirm`. Impostare almeno 10 caratteri nella configurazione Auth gestita.

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

Per provare l'app con dati sintetici, dopo aver configurato `.env.local` esegui `pnpm seed:demo`. Lo script accetta soltanto Supabase locale e crea quattro account: `admin@showroom.test`, `staff@showroom.test`, `accounting@showroom.test`, `brand@showroom.test`. La password iniziale è `Local-demo-only-42` (personalizzabile con `SEED_DEMO_PASSWORD`). Aggiunge un brand e un cliente demo; rieseguendolo conserva dati e password già presenti. Non usarlo per ambienti ospitati.

## Verifiche

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm e2e
pnpm supabase:test
pnpm test:orders:concurrency
```

Le ultime due verifiche richiedono rispettivamente i browser Playwright e Supabase locale. Non inserire segreti nei file tracciati.

`test:orders:concurrency` usa soltanto Supabase locale: crea 20 ordini simultanei con sessione staff, verifica numeri consecutivi senza duplicati e rimuove le proprie fixture. Richiede `.env.local` con le chiavi locali. Il contatore dell'anno sintetico 2099 conserva i progressivi usati dal test.

## Accesso ai dati

I client Supabase in `lib/supabase` usano la sessione utente e la chiave pubblica. La chiave service role è riservata a `lib/supabase/admin.ts` e ai processi server autorizzati. Le route interne e `/portal` sono protette da `proxy.ts`; le future azioni e letture devono verificare di nuovo ruolo e permessi lato server.

## Cloudflare Workers

```bash
pnpm build:cf
pnpm preview:cf
pnpm exec wrangler deploy --dry-run
```

Il progetto usa OpenNext e Wrangler con Smart Placement. Imposta le variabili e i segreti come binding Workers prima del deploy. Il Proxy Node.js di Next 16 è ancora sperimentale nell'adapter: la build e i redirect sono verificati nell'anteprima Workers, mentre login e letture RLS richiedono il flusso di autenticazione della milestone M1.

## CI

La pipeline `.github/workflows/ci.yml` esegue i controlli TypeScript, lint, test unitari e RLS, build Next e build Workers su push e pull request. La verifica della pipeline remota richiede un repository GitHub collegato; al momento questo checkout non ha un remote.

### Gestione utenti e dati

Gli admin gestiscono utenti da `/settings/users`, brand da `/brands` e modifiche da `/settings/audit`. Staff e amministrazione leggono i brand; gli utenti brand ricevono solo dati dei brand associati. I dati privati dei brand hanno una tabella RLS separata. Per creare il primo admin locale, crea un utente in Supabase Auth/Studio e assegna `role = 'admin'` al suo profilo tramite Studio (la creazione iniziale è fuori dal flusso degli inviti).

Stagioni in `/seasons` e prodotti in `/products`: admin/staff creano e modificano il catalogo; amministrazione legge. Prima crea una stagione del brand, poi un prodotto con taglie e colori separati da virgole. Il salvataggio genera tutte le combinazioni in una transazione e conserva le varianti archiviate per lo storico. Prezzi in EUR e centesimi interi; SKU variante copiabile dal dettaglio.

Con `EMAIL_MODE=log`, i link di invito compaiono nel terminale locale e non viene inviata alcuna email. Questa modalità è per sviluppo; configurare e verificare Resend prima dell’uso reale. Le fixture e2e usano soltanto Supabase locale e account sintetici, poi rimuovono gli account creati.

### PDF e numeri live

Dal dettaglio ordine si scarica la conferma PDF, dal dettaglio stagione il catalogo. Il generatore pdf-lib funziona anche su Workers locale; Inter e la licenza sono inclusi negli asset. I download verificano la sessione/RLS, rispettano il cliente riservato per i brand e non includono note interne o provvigioni. Non sono memorizzati in cache. Caratteri non supportati dal font producono un messaggio di correzione; i cataloghi oltre 5.000 prodotti non vengono troncati.

Number Flow anima i totali live dell’editor, rispetta il movimento ridotto e mantiene i calcoli in centesimi/BigInt.

Verifica PDF nel runtime Workers: avvia `pnpm preview:cf`, poi `E2E_BASE_URL=http://localhost:8787 pnpm e2e e2e/pdf.spec.ts` (adatta la porta alla preview). I test creano e rimuovono solo fixture nel database locale. I documenti di prova sono salvati in `output/pdf/`, esclusi dal versionamento.

### Calendario

Apri `/calendar`: admin/staff creano e modificano eventi da finestra; amministrazione legge. Lista predefinita su mobile/touch, mese su desktop. Il trascinamento è disponibile solo su desktop; le date si modificano anche da tastiera nel form. Gli orari sono sempre Europe/Rome e vengono salvati in UTC. I brand leggono solo i propri eventi esplicitamente condivisi; titolo, descrizione e luogo sono inclusi nella condivisione. Il seed locale aggiunge un appuntamento dimostrativo. `pnpm e2e e2e/calendar.spec.ts` verifica i cinque viewport.
