# Architettura

## Calendario, feed e job

Gli eventi usano sessione/RLS per CRUD, archivio e drag. L’abbonamento iCal usa una credenziale bearer casuale conservata soltanto come SHA-256; le azioni con sessione possono ruotare/revocare solo il token del proprio profilo attivo. La route pubblica e il cron sono gli unici accessi di questo modulo via service_role: chiamano RPC ristrette con select esplicite. `read_ical_feed` rivaluta profilo, ruolo, associazione al brand attivo, condivisione e archivio; non restituisce riferimenti a clienti/assegnatari. RLS e grant impediscono agli utenti di invocare letture arbitrarie del feed o il job. Risposte no-store, nessuna credenziale nei log applicativi.

Il cron Workers riusa il fetch OpenNext e invoca la route con CRON_SECRET. Claim e completamento hanno audit nella stessa transazione SQL; vincolo unico evento/assegnatario/data, lease di 10 minuti e chiave Resend stabile. `logged` identifica la sola simulazione locale; `sent` richiede successo del provider. La consegna esterna non è una transazione database: idempotenza provider e lease riducono i duplicati, senza promettere consegna esattamente una volta. Le esecuzioni con errori/limite ritornano 503 e sono ripetibili.

## Documenti e Storage

Le route usano esclusivamente il client con sessione. `documents` ha RLS e audit; `ready` rende visibili soltanto upload finalizzati. Il trigger verifica brand/ordine/cliente e identità immutabile; la finalizzazione controlla size/mimetype dell’oggetto nel bucket privato. Le policy Storage autorizzano percorsi esatti, senza overwrite, usando il record metadata associato. Le scritture business e audit sono atomiche; il trasferimento Storage richiede compensazione e può lasciare un pending non visibile in caso di errore della pulizia.

Download autorizzato a ogni emissione, redirect no-store a URL firmato valido 120 secondi. Condivisione e archivio vengono rivalutati per nuove emissioni; URL già emessi restano validi fino alla scadenza. Nessun dato autenticato viene inserito in cache applicativa. Limite file 10 MiB, involucro multipart massimo 64 KiB aggiuntivi; il proxy Next consente 12 MB per evitare troncamento preliminare.

## Reporting

Tutte le viste economiche sono security_invoker e leggono tabelle protette da RLS. dashboard_report usa sessione, richiede ruolo interno e restituisce un payload validato con Zod: somme SQL in centesimi testuali, conteggi e serie limitate con dimensione totale dichiarata. Le tabelle visibili mantengono valori BigInt esatti; conversione numerica dei soli punti sicuri per la visualizzazione. Nessuna aggregazione economica nel frontend.

Il fatturato legge invoices emesse/inviate/pagate. La tabella è predisposta con vincoli importi e policy di sola lettura interna; scritture, snapshot e provider verranno aggiunti in M7. Il portale non può usare la RPC interna; avrà un payload dedicato con whitelist. Il confronto budget legge l'intero periodo inclusivo e lo scope della singola combinazione, indipendentemente dal periodo più stretto dei KPI.

## Provvigioni ed export

v_commissions security_invoker combina orders e le percentuali private, imponendo app.is_internal. commissions_report filtra e aggrega in una snapshot SQL, serializza centesimi come stringhe e pagina gli ordini. La route export usa sessione/ruolo interno/Zod e lo stesso payload con whitelist, rifiuta oltre 10.000 ordini o 500 brand e genera XLSX in memoria con ExcelJS writeBuffer. Risposte private/no-store/nosniff, nessun URL pubblico, filesystem o service role.

## Portale

Il layout richiede ruolo brand attivo. Il contesto usa solo sessione/RLS, valida i filtri con Zod e verifica accesso brand prima di inviare la shell con la Suspense dati. portal_dashboard_report impone ruolo brand e accesso allo scope, produce una whitelist di venduto/conteggi/budget, senza fatturato, provvigioni, note o contatti. Customer name è derivato con D1 da un ordine autorizzato, non da una lettura diretta di customers. Revoca associazione e profilo inattivo sono rivalutati a ogni lettura.

Ordini e vendite del portale usano RPC invoker con whitelist esplicite, limiti/paginazione, centesimi testuali per gli aggregati e Zod sui payload. I dettagli passano da portal_orders e righe snapshot protette da RLS; non interrogano order_private o storico interno. L'export CSV usa un'unica snapshot e rifiuta oltre 10.000 ordini; scope estraneo restituisce 404. PDF e line sheet riusano le route autorizzate esistenti.

portal_documents e portal_events sono viste security_invoker con sole colonne pubblicabili. `/api/portal/calendar` restituisce solo metadati condivisi, senza cliente o assegnatario. Il vecchio endpoint calendario applica la stessa whitelist per ruolo brand. L'UI disabilita ogni modifica anche quando riceve per errore un flag editable. Liste con Suspense dopo le guardie di ruolo/scope, errori inline e stati vuoti. Download nativi, niente prefetch dei file né cache di risposte autenticate.

La suite `016_brand_isolation_matrix.sql` enumera tutte le relazioni pubbliche e fallisce se l'inventario non coincide con le fixture. Due identità brand distinte provano letture proprie/estranee e INSERT/UPDATE/DELETE contro record reali, incluse tabelle private, audit, viste aggregate e bucket/oggetti Storage. I probe usano subtransazioni con rollback forzato anche per una scrittura erroneamente consentita. Gli errori accettati sono limitati a privilegi RLS, viste non aggiornabili e controllo referenze budget estranee; colonne inesistenti o altri errori fanno fallire i test. Le preferenze iCal personali rimangono un'eccezione esplicita alla sola lettura business.

## Fondamenta fatturazione

InvoicingProvider separa emissione, stato, annullamento e parsing webhook. Input Zod strict in centesimi interi, controllo somme snapshot BigInt e data scadenza. Mock con store iniettato, fingerprint SHA-256 e transizioni esplicite; factory runtime con SupabaseMockInvoiceStore e sessione/RLS. Webhook mock firma HMAC-SHA256 sui byte e timestamp, rifiuta replay temporali oltre 5 minuti e payload oltre 16 KiB. Eventi deduplicati e stato persistente in SQL.

Migrazione 018 estende invoices senza ricrearla: snapshot fiscali e commerciali immutabili, chiave idempotente e identificativo provider unico. payments è append-only, leggibile solo internamente e priva di grant di scrittura per utenti autenticati; l'inserimento ha audit atomico. La FK created_by permette solo l'anonimizzazione tecnica quando Auth elimina un profilo. Fatture e pagamenti non si cancellano fisicamente.

La prenotazione blocca l'ordine consegnato e assegna numero e snapshot in una transazione con audit. Una fattura applicativa per ordine; retry con dati diversi viene rifiutato. Claim con lease di dieci minuti separa la chiamata esterna dalla finalizzazione SQL atomica di fattura/ordine/audit. La sessione dell'utente esegue tutte le scritture interattive. I callback verificati usano soltanto apply_invoice_webhook con grant service_role, senza impersonare un utente; deduplicazione provider/evento e controllo delle transizioni evitano regressioni di stato.

v_invoice_balances security_invoker calcola pagato, saldo e scadenza in SQL. Incassi immutabili con chiave idempotente, lock della fattura e limite al saldo; una cancellazione pendente blocca nuovi incassi. Un provider che segnala paid non inventa un movimento contabile: la pagina chiede di registrare l'incasso effettivo. Annullamento conserva fattura/snapshot/storico e non riporta indietro l'ordine. Rettifiche fiscali, note di credito e fatture sostitutive richiedono un flusso ulteriore, oltre questa implementazione.

## Fatture in Cloud e creazioni incerte

La factory abilita FIC solo con INVOICING_PROVIDER=fic, anche per riferimenti già presenti. FIC_COMPANIES_JSON associa esplicitamente i brand a companyId, P.IVA verificata dall'operatore, sezionale e ID IVA. Token in ambiente server; helper OAuth restituisce access/refresh ruotati, senza refresh automatico che perderebbe lo stato tra isolate. Numero locale immutabile e numero esterno separati. Prezzi effettivi mantengono quantità e sconti già arrotondati; API totals e risposta devono coincidere al centesimo con lo snapshot. Il polling controlla anche eventuali modifiche esterne agli importi.

Journal nei campi invoices, non una seconda sorgente dei dati fiscali: fingerprint/azienda preparati con lock, uncertain prima del POST, identità collegata prima della finalizzazione. Una risposta incerta impone recupero per subject; una ricerca vuota non autorizza un nuovo POST. Retry automatici soltanto per letture/calcolo totali, limiti e codici di errore stabili. Annullamento verso cestino recuperabile soltanto prima di invio elettronico/lock/incassi, senza cancellare storico locale.

Callback FIC: verifica firma ES256 con chiave pubblica ufficiale, issuer/audience/application ID/time/subject/event ID, corpo limitato. SQL enqueuer service_role conserva solo eventi di fatture localmente collegate, digest e stato di elaborazione, mai JWT/corpo originale. after avvia il job senza bloccare la risposta 202; cron ogni cinque minuti recupera una coda interrotta, dieci eventi per claim/tre letture concorrenti, lease dieci minuti. Stato riletto dall'API autenticata, aggiornamento fattura/audit/completamento atomico. Cron giornaliero email resta distinto. Dettagli operativi e gate per account reale in [INVOICING](INVOICING.md).

## PWA, cache e connettività

Manifest `/manifest.webmanifest`, scope e start URL `/`, modalità standalone, lingua italiana; icone 192/512, maskable 512 e Apple 180. Colori browser generati dai token, senza dipendere da window al primo render. `/offline` è statica, non legge cookies e non contiene dati di utenti.

`public/sw.js` installa soltanto shell offline, icone e risorse `/_next/static/`. Fetch senza credenziali per asset pubblici, whitelist di origine/percorso senza query, controllo di no-store/private/Set-Cookie. Navigazioni autenticabili sempre network-first senza memorizzare la risposta. Nessuna cache di mutazioni, API, Supabase, RSC, PDF o download firmati. Cambiare CACHE_VERSION a ogni rilascio; il worker in attesa viene attivato con un gesto confermato. Header non-cache e Service-Worker-Allowed presenti sia nella configurazione Next sia negli asset Workers.

PwaProvider usa snapshot server deterministici e ascolta online/offline. WriteButton e blocco submit in capture impediscono scritture offline; drag/resize calendario richiedono connessione. Gli input restano compilabili e la bozza in memoria sopravvive a riconnessione. Browser online non garantisce che il backend sia raggiungibile: errori di rete continuano a produrre feedback inline. Nessuna sincronizzazione differita implicita. Logout pulisce storage e cache private, revoca il consenso push prima di chiudere la sessione e disiscrive il browser corrente.

## Notifiche push

Migrazioni 021/022: `push_subscriptions` personali e `push_deliveries` accessibile solo dal job. Tabelle RLS; SELECT autenticato soltanto di ID/metadati della propria sottoscrizione. Scritture tramite RPC sessione, identità ricavata da auth.uid; massimo dieci dispositivi, contesa serializzata sul profilo. Audit della preferenza senza endpoint, auth o p256dh. Jobs con grant service_role esplicito, mai esposti al client.

Il cron promemoria giornaliero invia email e, se VAPID completo, push. Finestra Europe/Rome, profilo attivo e ruolo interno rivalutati al claim. Unicità evento/dispositivo/starts_at, lease/backoff 15 minuti, tre tentativi massimi; completamento deve possedere la lease. Cinque chiamate concorrenti con timeout/redirect:error e allowlist HTTPS dei servizi push browser. Sottoscrizioni scadute eliminate atomicamente. Nessun dettaglio privato dell’appuntamento nel payload. Notification click ignora URL arbitrari e apre soltanto `/calendar` sull’origine dell’app.

### Verifiche manuali PWA ancora aperte

- [ ] Installazione e avvio effettivi su Android, icona/nome, aggiornamento dopo un nuovo rilascio.
- [ ] Installazione da Safari su iOS/iPadOS, safe area, ritorno dal background.
- [ ] Consenso esplicito, arrivo della notifica di prova, clic sul calendario e revoca sul dispositivo reale.
- [ ] Lettura VoiceOver/NVDA dei form, degli annunci e dei numeri animati.

Le simulazioni Chromium e i test workerd non attestano queste verifiche. Per iPhone serve un’origine HTTPS attendibile raggiungibile dal telefono; localhost del computer non è l’origine del telefono.

## Importazione operativa

Migrazioni 026–035: configurazioni revisionate, matching con pg_trgm, staging con conteggi completi, commit/rollback e report. RPC commerciali con sessione utente, ruolo e proprietà del lotto verificati nel database. `app.import_changes` contiene prima/dopo ed è priva di grant client; la RLS di `import_*` limita accounting ai budget. Audit e dati business sono nella medesima transazione. I report finali conservano i totali in `stats`, con viste invoker e RPC di lettura protette. SQL numeric e testi interi preservano aggregati oltre i limiti di number.

Il parser browser usa solo risultati di formule salvati. I blocchi di righe grezze sono rivalidati dal server e limitati in byte. Una revisione impedisce mescolamenti fra finestre e mappature. Il job retention è l’unica nuova operazione con service role: rimuove Storage, poi registra la rimozione tramite una RPC con grant service_role. Nessuna scrittura commerciale passa dal client privilegiato.

## Hardening e checklist M9

`app.current_role()` restituisce NULL per admin con JWT non `aal2`; `app.mfa_satisfied()` impone lo stesso requisito come policy restrittiva su tutte le tabelle business e Storage. Le policy originali stabiliscono comunque il ruolo/perimetro. Il profilo personale resta leggibile per configurare/verificare TOTP. API e azioni ripetono la verifica dell’utente Supabase e del livello di autenticazione, anche per operazioni che usano un client amministrativo ristretto. La cancellazione di un upload documenti pending usa un controllo ownership ristretto security definer per evitare il ciclo fra policy documenti e Storage.

`consume_rate_limit` è una RPC service-role-only: atomicità `ON CONFLICT`, soglie fisse SQL, finestre e pulizia limitata. Identità HMAC con chiave privata, nessuna email/IP in chiaro e nessun grant diretto alla tabella `app.rate_limits`. Accetta IP soltanto dal contesto Cloudflare, ignorando `X-Forwarded-For`; il contenitore locale condiviso limita le prove sullo stesso processo. Un errore infrastrutturale blocca la richiesta.

| Controllo                                                   | Stato / evidenza                                                                              |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Input server Zod, centesimi interi, transazioni con audit   | Implementato; suite dominio/import SQL e unit                                                 |
| MFA obbligatoria admin su server, RPC, RLS, Storage         | Migrazione 037, unit auth, 033_admin_mfa.sql, e2e MFA su cinque viewport                      |
| Nessun bypass tramite membership/policy personale           | Policy restrittive e matrice inventario/isolamento; profilo personale eccezione esplicita     |
| Rate limiting persistente, 429 e Retry-After                | 032_rate_limits.sql ed e2e/security.spec.ts                                                   |
| CSP di base e header framing/nosniff/referrer/permissions   | next.config.ts, unit security headers; inline consentito, eval solo in sviluppo               |
| Chiavi private escluse dal client                           | server-only, lint contro import amministrativi UI, scanner degli asset con valori configurati |
| Accessi runtime con sessione e RLS                          | Matrice obbligatoria per ogni relazione pubblica; service role limitato a job/API autorizzate |
| File privati, download temporanei, originali con scadenza   | Storage RLS, URL firmati e retention via API                                                  |
| Telemetria priva di email/token/payload                     | Schema chiuso contatori in lib/observability, test della rimozione campi extra                |
| Backup database e file verificato in isolamento             | Script restore locale, checksum SHA-256; procedura README                                     |
| HTTPS, progetti UE, dominio, segreti hosted, review deploy  | Da configurare e verificare al rilascio; nessun deploy autorizzato/eseguito                   |
| Recupero MFA operatore, restore hosted, consegna Resend/FIC | Procedure documentate; prove reali ancora aperte                                              |

CSP di base non equivale a una CSP stretta con nonce. Lo scanner verifica solo i segreti configurati negli asset della build corrente, non dimostra l’assenza di qualsiasi credenziale mai esistita. I log operativi hanno una whitelist di contatori; audit e snapshot business possono contenere dati personali e hanno accesso database protetto. Backup hosted e chiavi di cifratura richiedono una procedura distinta dal clone dello stesso runtime PostgreSQL.
