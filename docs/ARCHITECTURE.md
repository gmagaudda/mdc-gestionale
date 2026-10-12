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
