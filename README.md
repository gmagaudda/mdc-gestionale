# MDC Gestionale

Avanzamento e verifiche ancora aperte: [docs/PROGRESS.md](docs/PROGRESS.md).
Guida per ruolo: [docs/USER-GUIDE.md](docs/USER-GUIDE.md). Importazione e analisi Excel: [docs/IMPORT.md](docs/IMPORT.md).

Preview di questa sessione: `http://localhost:3100/login` (`pnpm dev --port 3100`). Credenziali locali in `.env.local`, escluso da Git.

Recupero locale: Mailpit su `http://127.0.0.1:54324`, link PKCE da aprire nello stesso browser. Su Supabase gestito configurare il template recovery in `supabase/templates/recovery.html` e autorizzare il redirect `APP_URL/auth/confirm`. Impostare almeno 10 caratteri nella configurazione Auth gestita.

Applicazione per anagrafiche, catalogo, ordini, calendario, budget e portale brand. Il progetto è in costruzione secondo [PLAN.md](PLAN.md).

## Requisiti

- Node.js 24 LTS e pnpm 11
- Un runtime compatibile Docker per Supabase locale, oppure macOS Apple Silicon per il runtime nativo sperimentale

## Avvio locale

```bash
pnpm install
pnpm exec supabase start
pnpm exec supabase migration up --local
cp .env.example .env.local
chmod 600 .env.local
```

Compila `.env.local` con URL, chiave anon e service role del Supabase **locale** (`supabase status` li mostra all’operatore). Imposta `APP_URL=http://localhost:3100`, `EMAIL_MODE=log`, `INVOICING_PROVIDER=mock` e segreti casuali distinti di almeno 32 caratteri per `CRON_SECRET`, `RATE_LIMIT_SECRET`, `INVOICING_WEBHOOK_SECRET`. Mantieni questi valori privati. Poi:

```bash
pnpm types
pnpm exec playwright install chromium
pnpm seed:demo
pnpm dev --port 3100
```

Su Apple Silicon, `supabase/config.toml` abilita il runtime nativo in assenza di Docker. Apri <http://localhost:3100/login>. `migration up` conserva i dati esistenti; `db reset` li elimina e va usato solo su istanze di prova da ricreare. Per Workers locale copia le stesse variabili in `.dev.vars` (ignorato, permessi 0600). Le chiavi push si generano con `pnpm push:keys`, come descritto sotto.

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

Gli e2e richiedono Chromium Playwright, `.env.local` configurato e Supabase locale. I test DB richiedono Supabase. Non inserire segreti nei file tracciati. Dopo `pnpm build:cf`, esegui anche `pnpm check:client-secrets`.

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

Con `EMAIL_MODE=log` viene registrato soltanto il conteggio, senza destinatario o link di invito; nessuna email è inviata. Per entrare in locale usa gli account demo o il recupero tramite Mailpit. Con `EMAIL_MODE=resend`, `RESEND_API_KEY` ed `EMAIL_FROM` configurati, inviti e promemoria usano Resend. La consegna reale richiede un dominio verificato e una prova dell’operatore. Le fixture e2e usano soltanto Supabase locale e account sintetici, poi rimuovono gli account creati.

### PDF e numeri live

Dal dettaglio ordine si scarica la conferma PDF, dal dettaglio stagione il catalogo. Il generatore pdf-lib funziona anche su Workers locale; Inter e la licenza sono inclusi negli asset. I download verificano la sessione/RLS, rispettano il cliente riservato per i brand e non includono note interne o provvigioni. Non sono memorizzati in cache. Caratteri non supportati dal font producono un messaggio di correzione; i cataloghi oltre 5.000 prodotti non vengono troncati.

Number Flow anima i totali live dell’editor, rispetta il movimento ridotto e mantiene i calcoli in centesimi/BigInt.

Verifica PDF nel runtime Workers: avvia `pnpm preview:cf`, poi `E2E_BASE_URL=http://localhost:8787 pnpm e2e e2e/pdf.spec.ts` (adatta la porta alla preview). I test creano e rimuovono solo fixture nel database locale. I documenti di prova sono salvati in `output/pdf/`, esclusi dal versionamento.

### Calendario

Apri `/calendar`: admin/staff creano e modificano eventi da finestra; amministrazione legge. Lista predefinita su mobile/touch, mese su desktop. Il trascinamento è disponibile solo su desktop; le date si modificano anche da tastiera nel form. Gli orari sono sempre Europe/Rome e vengono salvati in UTC. I brand leggono solo i propri eventi esplicitamente condivisi; titolo, descrizione e luogo sono inclusi nella condivisione. Il seed locale aggiunge un appuntamento dimostrativo. `pnpm e2e e2e/calendar.spec.ts` verifica i cinque viewport.

### Abbonamento iCal e promemoria

Nella pagina calendario genera un link iCal e aggiungilo alla tua app con “Abbonati al calendario da URL”. Copialo subito: al rientro si mostra solo lo stato dell’abbonamento. Rigenerare invalida il link precedente; revocare blocca le letture successive, ma non cancella eventi già scaricati dal client. Il feed include tutti gli eventi non archiviati consentiti al proprietario, anche quelli futuri; ai brand arrivano soltanto gli eventi condivisi dei brand ancora associati. Oltre 5.000 eventi risponde 413, senza un calendario parziale. Il portale brand riutilizzerà questa impostazione nella milestone M6.

Il job `POST /api/cron/reminders` richiede `Authorization: Bearer <CRON_SECRET>` (segreto casuale di almeno 32 caratteri). Cloudflare Cron in `custom-worker.mjs` lo invoca ogni giorno alle 06:00 UTC, cioè 07:00/08:00 a Roma. Seleziona gli appuntamenti che iniziano domani a Roma e invia un promemoria alla persona interna assegnata e attiva. Nessun destinatario esterno; gli eventi non assegnati non generano email.

Per il test locale imposta lo stesso `CRON_SECRET` in `.env.local` e `.dev.vars`, `APP_URL` all’URL locale del rispettivo server ed `EMAIL_MODE=log`. Il template HTML/testo viene generato; il database registra `logged`, senza inviare email. I log riportano solo metadati tecnici. Per l’invio reale dei promemoria servono `EMAIL_MODE=resend`, `RESEND_API_KEY` e `EMAIL_FROM` con mittente verificato, da configurare come segreti Workers. Inviti email reali e configurazione hosted saranno completati con M9.

Le elaborazioni completate non vengono ripetute. Gli errori sono ritentabili; una lavorazione interrotta può essere ripresa dopo 10 minuti. Resend riceve una chiave idempotente stabile. Un cambiamento di data/persona assegnata genera un nuovo promemoria; i messaggi già consegnati non possono essere ritirati. Un’esecuzione elabora fino a 5.000 promemoria e risponde 503 se restano errori o si raggiunge il limite: ripetere il POST protetto, che salta quelli completati. Non assumere consegna dopo un errore.

Verifica locale: `pnpm e2e e2e/calendar-feed.spec.ts`. Per la prova Workers: `pnpm build:cf`, `pnpm exec wrangler dev --port 8790 --test-scheduled`, poi `E2E_BASE_URL=http://localhost:8790 pnpm e2e e2e/calendar-feed.spec.ts --project=desktop`. Il trigger si prova con `curl 'http://localhost:8790/__scheduled?cron=0+6+*+*+*'`; non pubblica né distribuisce il Worker.

### Documenti privati

Apri `/documents`: admin/staff caricano PDF, PNG o JPEG fino a 10 MiB, modificano i metadati, condividono con il brand o archiviano. Amministrazione legge. Cliente e ordine sono facoltativi; un ordine deve appartenere al brand selezionato e, se specificato, al cliente. Il file originale non si sostituisce. La condivisione rende visibile anche il contenuto: controllalo prima di abilitarla.

Il bucket `documents` è privato. Il download verifica la sessione e genera un URL valido 120 secondi; un URL già firmato resta valido fino alla scadenza anche dopo revoca/archivio. L’upload controlla estensione, MIME, firma iniziale e dimensione; non esegue una scansione antivirus. I record non finalizzati sono nascosti dalle liste. Test: `pnpm e2e e2e/documents.spec.ts`; su Wrangler locale, `E2E_BASE_URL=http://localhost:8790 pnpm e2e e2e/documents.spec.ts --project=desktop`.

### Budget

Apri `/budgets`: admin/amministrazione creano, modificano e archiviano; staff legge. L’importo netto si inserisce in euro, con virgola o punto e massimo due decimali, senza separatori delle migliaia. Il database conserva centesimi interi. Seleziona brand, eventuale stagione/cliente e periodo inclusivo. Due periodi della stessa combinazione non possono sovrapporsi; senza stagione/cliente il budget generale è separato da quelli specifici. Le note sono interne. L’archivio conserva audit e dati, escludendoli dai confronti.

Test: `pnpm e2e e2e/budgets.spec.ts`; i test DB verificano isolamento, vincolo dei periodi e rollback budget/note. Il confronto economico è disponibile nella dashboard.

### Dashboard

Apri `/dashboard`: filtra per brand, stagione e periodo. Venduto netto include ordini confermati e successivi, escludendo bozze/annullati; fatturato netto include fatture emesse/inviate/pagate. Il modulo di emissione è descritto nella sezione Fatture. Il confronto budget considera l'intero periodo di ogni budget che interseca i filtri; scostamento = venduto meno budget, percentuale non disponibile per budget zero.

Ogni grafico ha una tabella con valori esatti. Per dataset ampi la pagina indica quanti confronti/mesi mostra: restringi i filtri o apri la lista budget. Test: `pnpm e2e e2e/dashboard.spec.ts`; test DB con risultati economici calcolati a mano e isolamento RLS. Prova Workers locale: `E2E_BASE_URL=http://localhost:8790 pnpm e2e e2e/dashboard.spec.ts --project=desktop`.

### Provvigioni

Apri `/commissions`: tutti i ruoli interni leggono il report per brand, stagione e periodo. Si applica la percentuale specifica dell'ordine, se presente, altrimenti quella attuale del brand; ogni ordine viene arrotondato al centesimo prima della somma. Una modifica della percentuale del brand aggiorna anche i risultati degli ordini senza percentuale specifica.

“Esporta Excel” scarica filtri, riepilogo per brand, singoli ordini e totale del periodo (massimo 10.000 ordini/500 brand). Euro e centesimi sono celle di testo esatte, senza formule. Per calcoli successivi in Excel usa le colonne in centesimi controllando la precisione dei valori. Nessuna nota interna nel file. Test: `pnpm e2e e2e/commissions.spec.ts`; export verificato anche nella preview Workers locale.

### Portale brand

Un utente brand accede a `/portal/dashboard`: consulta soltanto venduto e budget dei brand associati, con filtri per brand, stagione e date. Nessuna modifica o provvigione/fatturato. Se la visibilità clienti è disattivata, il perimetro del budget mostra “Cliente riservato”. Un brand non associato restituisce 404. Senza associazioni, chiedi all'amministratore di configurare l'account.

Test: `pnpm e2e e2e/portal-dashboard.spec.ts`; isolamento e revoca sono verificati anche nei test SQL.

Nel portale sono disponibili anche `/portal/orders` (dettaglio, conferma PDF, line sheet e CSV), `/portal/sales` (vendite aggregate per cliente/stagione), `/portal/documents` (file esplicitamente condivisi) e `/portal/calendar` (eventi condivisi e abbonamento iCal personale). Tutte le funzioni business sono in sola lettura. Con visibilità clienti disabilitata, UI e file generati mostrano “Cliente riservato”. Il contenuto di un documento caricato viene condiviso integralmente: il personale deve controllarlo prima della condivisione. Test: `pnpm e2e e2e/portal-flow.spec.ts`; lo stesso flusso è verificato su Workers locale.

`pnpm supabase:test` include una matrice obbligatoria di isolamento per ogni tabella/vista pubblica e per lo Storage. Quando si aggiunge una relazione, aggiungere anche la fixture e i probe in `supabase/tests/016_brand_isolation_matrix.sql`; il controllo inventario impedisce di saltare nuove tabelle. Ogni prova è transazionale e non modifica i dati demo.

### Fatture

Da un ordine consegnato admin/amministrazione possono generare una fattura: dati fiscali e righe sono copiati in uno snapshot immutabile. In locale INVOICING_PROVIDER=mock simula l'emissione, senza inviare documenti fiscali. Configura lo stesso INVOICING_WEBHOOK_SECRET casuale (almeno 32 caratteri) nei file locali ignorati .env.local e .dev.vars. Il callback mock richiede HMAC-SHA256 e timestamp; non inviare payload non firmati.

Apri /invoices per scadenzario, saldo e dettaglio. Registra incassi effettivi parziali o completi; una chiave stabile evita duplicati nelle ripetizioni della stessa richiesta. Aggiorna stato consulta il provider. Un annullamento richiede conferma, conserva lo storico ed è possibile solo senza incassi e senza stato esterno pagato. Il provider paid non registra automaticamente denaro ricevuto. Staff legge; brand non accede. Dopo un errore riprova sulla fattura già prenotata, senza crearne una seconda.

Test: pnpm e2e e2e/invoices.spec.ts. Il flusso ordine → fattura → due pagamenti → saldo, callback firmato e annullamento è verificato anche su Workers locale. Fatture in Cloud è il provider reale scelto, con integrazione nel task M7-T3 e accessi da configurare nell'ambiente.

Configurazione Fatture in Cloud, OAuth, mapping delle aziende, retry e callback: [docs/INVOICING.md](docs/INVOICING.md). Solo INVOICING_PROVIDER=fic abilita l'adapter reale. Il default locale resta mock; nessun account reale è stato usato dai test.

### PWA e notifiche

La build Workers locale consente di provare manifest, installazione nel browser desktop, modalità offline e aggiornamento:

```sh
pnpm icons
pnpm build:cf
pnpm exec wrangler dev --port 8790 --test-scheduled
```

Apri `http://localhost:8790`. In `next dev` il service worker è disattivato. Preferenze utente include installazione e notifiche; offline si può compilare una bozza già aperta, ma i salvataggi richiedono connessione. Le bozze non vengono conservate alla chiusura del tab. Prima di aggiornare l’app, salva le modifiche. Il logout revoca il consenso push su tutti i dispositivi dell’account.

Per le chiavi di prova, `pnpm push:keys` crea `.vapid.local` (ignorato, 0600, rifiuta di sovrascrivere). Copia le sue tre variabili in `.env.local` e `.dev.vars`, poi ricostruisci e riavvia la preview. Non inserire la chiave privata nel codice o nei log. Per un ambiente reale, imposta `VAPID_SUBJECT` con il contatto HTTPS/mailto dell’operatore e conserva le chiavi nei segreti di quell’ambiente. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` è pubblica e deve essere disponibile anche durante la build.

Per una prova reale: installa l’app, accedi come utente interno, apri Preferenze utente, premi Attiva le notifiche e accetta il permesso del browser. Premi Invia notifica di prova (massimo una al minuto), verifica la ricezione e il clic sul calendario. Revoca le notifiche e verifica che non arrivino nuovi promemoria. Un 201 del servizio non dimostra la ricezione: i test automatici verificano consenso/revoca con un browser sintetico, senza inviare notifiche esterne. Su iPhone serve un’origine HTTPS attendibile raggiungibile dal dispositivo e l’installazione da Safari.

Test della build production locale:

```sh
E2E_BASE_URL=http://localhost:8790 E2E_PWA_PRODUCTION=1 pnpm e2e e2e/pwa.spec.ts e2e/push.spec.ts --project=mobile --project=desktop
```

Usa solo il database Supabase locale. Il test di aggiornamento modifica temporaneamente l’asset generato `.open-next/assets/sw.js` e lo ripristina; non eseguire questa prova contro ambienti remoti.

## Sicurezza e amministrazione MFA

Gli admin richiedono TOTP (`aal2`) sia nelle route/azioni server sia nelle RLS del database e dello Storage. A `aal1` è leggibile soltanto il profilo necessario alla configurazione; le funzioni business sono negate. Staff, amministrazione e brand conservano il proprio perimetro. Abilita TOTP anche nel progetto Supabase ospitato prima di applicare la migrazione 037.

Il recupero MFA è una procedura dell’operatore: verifica l’identità tramite un canale indipendente, usa gli strumenti Auth amministrativi Supabase per rimuovere il fattore perso, revoca le sessioni, registra l’intervento in un registro protetto e fai configurare subito il nuovo fattore. Non modificare le policy per aggirare MFA; tieni almeno due amministratori operativi. La password recuperata non revoca automaticamente i fattori.

Rate limit persistenti: login 10 tentativi/email in 15 minuti e 500/IP; recupero 3/email/ora e 100/IP; MFA 10 operazioni/account/minuto; iCal 60/token e 100/IP/minuto; webhook 300/IP/minuto. Le identità sono HMAC, mai email/IP in chiaro. L’IP è affidabile soltanto dal contesto Cloudflare; in locale si usa un contenitore condiviso. Le API restituiscono 429 con `Retry-After`; in caso di indisponibilità del limite falliscono chiuse. Nessun contatore in memoria del singolo Worker.

CSP di base, protezione framing, nosniff, referrer e permissions policy sono attive. HTTPS abilita HSTS e upgrade delle richieste. La CSP consente ancora script/stili inline necessari al rendering corrente: non è una CSP stretta con nonce. Le chiavi private sono server-only; `pnpm check:client-secrets` controlla gli asset generati con i valori configurati, senza stamparli.

## Log e backup

I processi registrano JSON con evento, timestamp, esito, durata e contatori ammessi. Non registrano destinatari, link di invito, token, file o payload fiscali. Errori del provider restano messaggi applicativi generici; audit business e journal delle integrazioni rimangono nel database protetto. Workers Observability è abilitato; definisci retention e accessi nell’account prima del rilascio. Sentry è opzionale e non è configurato.

### Backup ospitato

Definisci RPO/RTO e verifica disponibilità/retention dei backup nel piano Supabase scelto. Conserva esportazioni cifrate, fuori dall’account principale e con accesso ristretto. I [backup Supabase](https://supabase.com/docs/guides/platform/backups) contengono il database e i metadati Storage, **non i byte dei file**. Esegui quindi una copia separata dei bucket privati tramite API Storage autorizzate, conservando percorso, dimensione e checksum. Rispetta la retention degli originali di importazione anche nelle copie.

Per una migrazione/ripristino ospitato usa la [procedura CLI ufficiale](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), con dump separati di ruoli, schema e dati secondo le istruzioni della versione in uso. Un dump integrale locale non va importato alla cieca tra versioni/piattaforme: include schemi interni e ownership, come spiegato nella [guida di ripristino Supabase](https://supabase.com/docs/guides/self-hosting/restore-from-platform). Prima della prova conserva separatamente configurazione Auth (redirect/template/MFA), segreti e chiavi necessarie a Vault/TOTP, provider, crons e dominio. Il repository non è un backup dei segreti.

Ripristina prima in un progetto UE isolato: schema/dati/ruoli, poi file privati tramite API, poi segreti/configurazione. Controlla checksum, conteggi e somme in centesimi, accesso Auth/MFA, isolamento dei brand, download privati e un flusso completo. Attiva email/fatturazione solo dopo aver verificato i dati. Non cancellare il progetto originale finché la verifica non è conclusa. La prova hosted e la consegna reale sono gate dell’operatore ancora aperti.

### Prova locale riproducibile

`scripts/verify-local-restore.mjs` accetta esclusivamente un secondo stack nativo, `project_id=mdc-migration-check-*`, con porte diverse da quelle del progetto. Prepara una directory temporanea con copia di `supabase/`, cambia porte e inspector e avviala salvando l’output JSON **privatamente** (0600). Il file deve contenere l’oggetto `env` prodotto dal runtime nativo. Poi:

```sh
node scripts/verify-local-restore.mjs \
  --workdir /percorso/temporaneo/mdc-migration-check-prova \
  --pg-bin /percorso/runtime/postgres/bin \
  --credentials-json /percorso/privato/start.json
```

Lo script crea solo fixture proprie, salva un archivio `pg_dump -Fc`, ripristina in un database temporaneo dello stesso cluster/runtime con i ruoli esistenti, verifica snapshot, profili e RLS. Copia e ripristina separatamente un file privato e ne confronta SHA-256. Elimina clone, backup temporanei e fixture, lasciando intatto il database principale. Prova eseguita il 12 ottobre 2026 con PostgreSQL 17.11 e tutte le migrazioni applicate. Non verifica i servizi HTTP Auth/Storage puntati al clone né la portabilità hosted: questi richiedono una prova dedicata.

## Ambienti e rilascio futuro

`wrangler.jsonc` definisce `staging` e `production` con binding asset espliciti. Staging usa mock e log email, produzione Fatture in Cloud e Resend. Il test locale usa la configurazione root e `.dev.vars`. Nessun rilascio è stato eseguito e non è presente un remote GitHub.

Quando si decide di pubblicare:

1. Crea due progetti Supabase distinti in UE; configura Auth/redirect/MFA, bucket, email e backup. Il dominio va scelto e configurato su Cloudflare con HTTPS prima della build.
2. Crea gli ambienti GitHub `staging`/`production`; su produzione imposta approvazione manuale, branch protetto e accesso ai segreti limitato. Configura per ambiente le variabili `APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` e i segreti `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `SUPABASE_DB_URL`, `WORKER_SECRETS_JSON`.
3. `WORKER_SECRETS_JSON` è un oggetto privato con `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `RATE_LIMIT_SECRET`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` e, in produzione, `RESEND_API_KEY`, `EMAIL_FROM`, `FIC_ACCESS_TOKEN`, `FIC_COMPANIES_JSON`, `FIC_APPLICATION_ID` (eventuali OAuth server-only). La pipeline aggiunge i valori pubblici anche ai binding runtime, li scrive temporaneamente in un file 0600 e usa `wrangler secret bulk`. Non inserire override di provider/modalità email nei segreti. Il token Cloudflare deve avere il solo perimetro necessario al Worker.
4. Abilita la variabile repository `DEPLOY_ENABLED=true` **solo dopo** la configurazione e i gate manuali. `release.yml` verifica CI, applica migrazioni senza seed, quindi pubblica staging sui merge in `master`. La produzione richiede `workflow_dispatch` con target `production`, più approvazione dell’ambiente. Ricostruisce la revisione selezionata con i valori pubblici dell’ambiente; verifica il commit da promuovere.
5. I seed automatici di rilascio sono disabilitati. `seed:demo` rifiuta ambienti ospitati; eventuali fixture di staging vanno caricate dall’operatore soltanto sul progetto staging. Non eseguire seed/reset in produzione. Se cambia lo schema, prevedi migrazioni compatibili: tornare al Worker precedente non annulla i dati/migrazioni.

I binding/vars Wrangler degli ambienti non sono ereditati automaticamente: [documentazione Cloudflare](https://developers.cloudflare.com/workers/wrangler/environments/). La pipeline e i segreti hosted non sono stati eseguiti/verificati; dominio, account e gate di promozione restano da configurare al momento del rilascio.
