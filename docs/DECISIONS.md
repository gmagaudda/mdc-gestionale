# Decisioni

## Accesso e accessibilità (M1-T1)

Supabase locale nativo non serve template email personalizzati: recupero locale con PKCE (stesso browser), ambiente gestito con template token_hash in `supabase/templates/recovery.html` (configurare nella dashboard). Entrambi verificano il link sul server. Password da 10 a 128 caratteri, conferma esplicita, logout globale dopo il cambio. Il messaggio di recupero non rivela se un account esiste.

Misurato il bordo originale dei campi: 1,74:1, inferiore al requisito 3:1. Axe ha rilevato 3,87:1 sulle etichette inattive del controllo tema in chiaro. Override semantici in entrambi i temi: `--text-muted` usa `--text-secondary`, `--border-strong` usa il testo secondario. Nessuna modifica ai sorgenti Arc. Area dei pulsanti di rivelazione estesa tramite wrapper.

Build Workers verificata con login, logout, lettura profilo soggetta a RLS e blocco account inattivi. L’umano ha scelto Workers Free. Con `minify: true`, il bundle dopo autenticazione/i18n scende da 3127,03 a 2763,25 KiB gzip (2,70 MiB), sotto il limite di 3 MiB. La misura verrà ripetuta dopo ogni milestone.

## Design system (M0-T6)

Arc installato dal registry gratuito; `ArcProvider` arriva come dipendenza di `avatar` (non esiste un item autonomo `arc-provider`). Componenti originali conservati senza modifiche. Font caricati con next/font; tema con next-themes, senza script duplicati.

Le skill di jakubkrehel sono copiate in `.agents/skills` e tracciate da `skills-lock.json`; letti tutti i nove SKILL.md. Il fallback ufficiale llms.txt/markdown è usato perché questa sessione non espone gli strumenti Arc, pur con autenticazione completata. L’accettazione della ricerca MCP resta da verificare.

Il theme-switch gratuito ha icona da 38 px: un wrapper estende solo l’area cliccabile a 44 px, senza cambiare il componente. Il segmented-control espone Sistema/Chiaro/Scuro in italiano. Su puntatore touch `--text-sm` eredita `--text-base`, per evitare zoom iOS. Le nuove dipendenze sono bloccate a versione esatta. Gli script opzionali di watcher/SWC restano disabilitati perché non usati dal runtime.

| Data       | Scelta                                                                         | Motivo                                                                                                                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-12 | App Next.js 16 con App Router, TypeScript strict e Tailwind 4                  | Sono le versioni stabili disponibili all'avvio; il piano richiede versioni fissate nel lockfile.                                                                                                                                              |
| 2026-10-12 | Nome tecnico `mdc-gestionale`; nome visibile provvisorio “Gestionale showroom” | Il nome definitivo dell'app è un input umano richiesto prima del manifest PWA.                                                                                                                                                                |
| 2026-10-12 | Supabase CLI native runtime per lo sviluppo locale su Apple Silicon            | Docker non è disponibile sulla macchina; la CLI 2.120 supporta `stack = true` sperimentale. La CI userà il runtime Docker standard.                                                                                                           |
| 2026-10-12 | I nuovi utenti ricevono inizialmente il ruolo `brand`                          | È il privilegio minimo; un admin abilita esplicitamente gli utenti interni.                                                                                                                                                                   |
| 2026-10-12 | Uso di `proxy.ts` per il refresh della sessione                                | Next.js 16 ha rinominato il middleware in Proxy; la sessione è verificata con `getClaims()`, non con il cookie non validato.                                                                                                                  |
| 2026-10-12 | Cloudflare Workers usa OpenNext 1.20.10 con Next.js 16.3.8                     | Il piano indica OpenNext. Cloudflare ora raccomanda vinext per nuovi progetti, ma il cambio richiede una decisione dell'umano. Next 16.4.0 causa HTTP 500 in Workers per `preview-props.json`; la correzione OpenNext è ancora una PR aperta. |
| 2026-10-12 | Cache Components e Partial Prefetching disattivati                             | La configurazione generata dal template causava richieste bloccate nel runtime Workers; non servono alle funzioni previste.                                                                                                                   |
| 2026-10-12 | `compatibility_date` Cloudflare 2026-10-11                                     | È la data più recente supportata dal runtime locale al 12 ottobre nel fuso Europe/Rome.                                                                                                                                                       |
| 2026-10-12 | Bundle OpenNext 2.282 MiB gzip allo spike iniziale                             | Misurato con `wrangler deploy --dry-run`; rientra nel limite Free attuale di 3 MiB, ma la misura va ripetuta dopo le funzioni applicative.                                                                                                    |

## Anagrafiche e audit (M2-T1, M1-T4)

Dati leggibili dai brand in `brands`; provvigioni, indirizzi fiscali e note in `brand_private`, referenti in `brand_contacts`. La separazione impedisce fughe di colonne con SELECT dirette: RLS protegge righe, non singoli campi. Il salvataggio pubblico/privato è una funzione SQL con la sessione dell’utente, in un’unica transazione con audit. Nessuna service role nelle azioni di business.

La tabella Arc gratuita viene composta con ordinamento e paginazione GET esterni: i controlli incorporati non espongono tutte le stringhe in italiano né l’ordinamento server richiesto. I sorgenti Arc restano originali. Vista card sotto 768 px, tabella sopra. Le conferme di archiviazione sono al momento inline; la composizione dialog/bottom-sheet rimane in M2-T3.

Import nominati di Zod riducono il bundle Workers delle anagrafiche/utenti da 3097,69 a 2827,14 KiB gzip (2,76 MiB). Evitare l’import del namespace completo nelle nuove funzioni. Piano Free conservato; nessun rilascio remoto effettuato.

## Inviti utenti (M1-T3)

Solo il route handler `/api/users/invite` accede alla service role per generare il link Supabase; verifica prima identità admin, origine, schema e brand. Ruolo e associazioni sono salvati con la sessione admin in una transazione SQL con audit. Le email in modalità `log` sono stampate sul terminale di sviluppo, come richiesto dal piano; nessun messaggio reale inviato nei test. L’invio Resend in ambiente gestito richiede configurazione e verifica in M9. Errori durante l’invito eliminano l’account appena generato; un’email già presente viene rifiutata. I token di invito non vengono restituiti al browser né salvati nell’audit.

## Priorità ai test locali (indicazione umana)

L’umano ha chiesto di non considerare per il momento il limite del bundle: testerà l’app in locale. Le nuove funzioni proseguono su Next.js e Supabase locali; limiti e rilascio Workers verranno ripresi quando serve un ambiente ospitato.

## Clienti (M2-T2)

Gli indirizzi JSON usano `street`, `postal_code`, `city`, `province`, `country`. Città/paese in testata vengono derivati dall’indirizzo di fatturazione. I dati fiscali possono essere ancora vuoti: se compilati, P.IVA di 11 cifre, SDI di 7 caratteri alfanumerici maiuscoli e PEC valida. I controlli di completezza per emettere una fattura appartengono a M7; il controllo della cifra P.IVA per l’import appartiene a M10. Le regole RLS negano agli utenti brand anche l’accesso diretto ai referenti dei clienti.

I test RLS conteggiano le proprie fixture, così restano eseguibili anche con dati demo e test browser concorrenti. La verifica dell’ultimo admin isola gli amministratori nella transazione del test, poi esegue rollback.

## Componenti condivisi (M2-T3)

Il registry gratuito Arc `dialog` usa il prop `render` su Radix Overlay/Content, assente nella dipendenza Radix 1.2.0, e non espone la traduzione dell'etichetta di chiusura. Dopo la prova di installazione e il fallimento TypeScript, il componente vendor inutilizzabile è stato rimosso. `ResponsiveDialog` compone il primitive Radix della stessa dipendenza con pulsanti e token Arc, senza modificare sorgenti vendor: bottom sheet su mobile, dialog centrato da 768 px. Nessuna animazione; focus trap, Escape e ritorno del focus gestiti da Radix; azione iniziale Annulla per archiviazione. Dipendenza aggiuntiva esplicita `@radix-ui/react-dialog` 1.2.0. Rivalutare il componente Arc quando il registry sarà corretto.

Preferenze tema nel menu utente nativo `details`, con le tre modalità tradotte; menu mobile in dialog e sidebar desktop con pagina corrente accessibile. I componenti base condividono i controlli Arc già installati. Seed dimostrativo Node esclusivamente per CLI locale, mai importato nel runtime applicativo.

## Catalogo (M3-T1)

Stagioni archiviate tramite soft delete; codici unici per brand attivo. SKU base unico fra prodotti attivi, SKU variante globalmente unico. Lo SKU variante è `base:tagliaUTF8hex:coloreUTF8hex`: delimitatori nei nomi non possono creare collisioni. Le varianti mantengono il proprio UUID durante le modifiche e vengono archiviate se rimosse, così gli ordini storici potranno conservarne il riferimento. Prodotto e variante hanno foreign key composite che impediscono associazioni fra brand diversi.

Taglie e colori si inseriscono come elenchi separati da virgole: il tag-input Arc contiene annunci inglesi non traducibili nei props. Arc Select gratuito per brand/stagione, con wrapper di validazione sul trigger; MoneyInput Arc con EUR fisso, locale italiano e senza chip/limiti incorporati con annunci inglesi. Validazione monetaria server su interi fino a 1.000.000.000.000 centesimi; helper di parsing/formattazione in lib/money anticipati da M3-T2 perché necessari ai prezzi. Target TypeScript ES2020 per BigInt. Le card mobili mostrano tutti i campi; copia SKU nella tabella delle varianti rende utile e raggiungibile da tastiera la regione scorrevole. Nessuna modifica ai sorgenti Arc.

## Ordini: dominio e privacy (M3-T2)

`order_private` separa note interne e provvigione dai dati leggibili dai brand. Lo storico con note è riservato agli interni; il portale usa una vista security_invoker e un helper definer che verifica l'accesso all'ordine prima di esporre soltanto ragione sociale/città (oppure Cliente riservato). Nessuna SELECT brand sulle anagrafiche clienti.

Arrotondamento half-up: per ciascuna riga si applicano insieme sconto riga e ordine, si arrotonda il netto al centesimo, poi l'IVA della riga; i totali sono la somma delle righe. SQL numeric e helper BigInt usano la stessa regola. Prezzo e IVA/descrizione/SKU/taglia/colore hanno snapshot nella riga; cambiare il catalogo non altera ordini esistenti. Le quantità/prezzi sono modificabili soltanto in bozza; dati finanziari congelati dopo conferma. Una bozza vuota è salvabile, ma non confermabile. Brand/stagione e anno del numero sono immutabili dopo creazione; duplicazione creerà una nuova bozza. Archiviazione solo per bozze o ordini cancellati. Limite prudenziale dei totali: 1.000.000.000.000 centesimi, coerente con i prezzi/UI.

Il contatore usa UPSERT con lock di riga per anno: il numero è assegnato dal trigger e rollback della transazione annulla anche l'incremento. Test HTTP su 20 richieste concorrenti tramite sessione staff, con fixture locali poi rimosse. I progressivi dell'anno sintetico 2099 restano consumati nel contatore di test; non sono dati commerciali.

## Editor ordini (M3-T3)

SearchSelect compone Input e Select Arc gratuiti, con ricerca clienti server e massimo 50 risultati per ricerca. I valori scelti restano visibili. NumberField Arc non adatto a griglie grandi e contiene etichette inglesi non configurabili: quantità con Input numerico nativo dentro tabella semantica, scroll interno con indicazione e Tab. Larghezza delle colonne definita e testi a capo impediscono al colore lungo di nascondere le quantità. Le varianti archiviate già presenti sono mantenute, le nuove varianti di prodotti archiviati escluse.

Lo stato della matrice è controllato nel client; Zod condiviso valida prima dell’invio e nel server. L’anteprima mantiene gli snapshot IVA esistenti e usa BigInt; il database ricalcola in transazione e i totali salvati sono mostrati separatamente. Il test verifica 184,88 € netto + 40,68 € IVA = 225,56 €, con sconti diversi di riga/ordine. La pagina temporanea /matrix-check è esclusa localmente da Git e risponde 404 in produzione.

## Elenco, stati e duplicazione (M3-T4)

Filtri e ordinamento validati: stato, brand, cliente, stagione e intervallo date. Filtri mantenuti nei link di ordinamento/paginazione. CSV UTF-8 con BOM, separatore punto e virgola e importi decimali italiani; Papa Parse 5.7.0 con escapeFormulae secondo la [documentazione ufficiale](https://www.papaparse.com/docs). Export di tutte le pagine filtrate fino a 10.000 ordini; oltre la soglia si richiede di restringere i filtri, senza troncare il file. Endpoint riservato agli interni; nessuna nota/provvigione nel file.

Duplicazione con lock della testata e chiamata a save_order in una sola transazione. Conserva quantità, prezzi, sconti e note private; data corrente, consegna da ricompilare, nuovo numero/stato bozza. Gli snapshot descrittivi e IVA si prendono dal catalogo corrente. Catalogo o anagrafiche archiviate bloccano la copia senza lasciare dati parziali. Le API di business consentono la cancellazione fisica delle righe soltanto in bozza; il ruolo database postgres può rimuovere esplicitamente fixture storiche locali, senza disattivare RLS/trigger.

Badge Arc gratuito installato: testo statico composto come nodo React e key sullo stato evitano interpolazioni di colore/testo durante il cambio di fase. Lo storico usa un elenco nativo con date italiane: Timeline Arc contiene annunci relativi/conteggi inglesi non configurabili. Copia SKU nella tabella rende lo scroller raggiungibile da tastiera. I sorgenti Arc restano immutati.

## 2026-10-12: PDF su Workers (M3-T5)

Provato per primo `@react-pdf/renderer` 4.9.0 in Workers locale: errore `No such module "#standard-fonts/Helvetica"` anche registrando Inter. Adottato il secondo candidato del piano: [pdf-lib](https://pdf-lib.js.org/) 1.17.1 con fontkit 1.1.1, senza processi, filesystem o browser sul server. La route genera i byte dopo letture con sessione/RLS. Inter 4.1 incorporato da asset locale, licenza OFL inclusa in public/fonts; binding ASSETS su Workers, URL APP_URL nel dev Next. Conferma e catalogo A4 chiari, intestazioni ripetute e numeri pagina. Download con link nativo per evitare prefetch; risposte private/no-store e autorizzazione per ogni richiesta.

Il modello brand usa portal_orders per il cliente riservato; quello interno legge ragione sociale/città con le proprie RLS. Nessuna nota interna o provvigione nei PDF. Catalogo letto a blocchi per evitare il limite REST di 1.000 record; limite esplicito di 5.000 prodotti per richiesta, senza esportazioni parziali. Simboli non presenti in Inter rifiutati con errore italiano recuperabile: non vengono stampati quadrati o glifi vuoti. Storage opzionale rinviato al modulo documenti. Il tipo brand-summary sarà aggiunto con il report del portale (M6).

Verifiche: build OpenNext + `wrangler dev --port 8790`, cinque e2e PDF su runtime workerd; PDF parseable, 401 senza sessione, 404 per altro brand, privacy cliente e note controllate mediante pypdf, render Poppler ispezionati. Unit test su parole lunghe, glifi mancanti, A4 e 100 righe su sette pagine. Nessun deploy e nessuna ottimizzazione del bundle, secondo indicazione dell’umano.

## 2026-10-12: FullCalendar 7 e fuso showroom (M4-T1)

Adottata la stabile corrente FullCalendar React 7.1.1: daygrid/timegrid/list/interaction e il tema sono ora entry point dello stesso pacchetto, anziché pacchetti distinti. Seguite [integrazione React](https://fullcalendar.io/docs/react), [named time zones](https://fullcalendar.io/docs/timeZone) e [accessibilità](https://fullcalendar.io/docs/accessibility). Palette classic interamente mappata a token Arc, toolbar esterna con Button e Select Arc; nessun componente premium.

Temporal polyfill 1.0.5 è una peer dependency del calendario e gestisce anche conversioni Europe/Rome ↔ UTC. Gli orari inesistenti/ambigui al cambio DST sono rifiutati esplicitamente; non si applica il fuso del browser. Non serve una seconda libreria per queste conversioni. Eventi tutto il giorno: intervallo finale esclusivo in DB/FullCalendar; il form mostra l’ultimo giorno incluso. Durata massima 366 giorni, richieste calendario massimo 93 giorni/500 eventi con errore esplicito se occorre restringere.

Viste iniziali lista settimanale su touch/sotto 1024, mese con puntatore fine da 1024; spostamento/ridimensionamento solo desktop admin/staff. Le date si modificano anche da form con tastiera/mobile. Aggiornamenti protetti da updated_at per evitare di sovrascrivere modifiche concorrenti. Archivio conserva audit e nasconde eventi ai brand. Una directory RPC limitata a persone interne attive permette l’assegnazione senza aprire le RLS dei profili.

FullCalendar 7.1.1 assegna role=button agli eventi direttamente dentro role=list: axe segnala figli ARIA non validi. L’adattatore normalizza quelle liste a gruppi, preserva le azioni/focus e traduce la label; nessuna modifica ai sorgenti della libreria. Inoltre le callback iniziali possono arrivare durante il render: vengono accodate fino al montaggio e notificate dopo il render, evitando gli avvisi React e aggiornamenti prima del commit. Test browser include controllo errori della console.

La verifica Workers del calendario ha rilevato un errore precedente anche in /login: lo script serializzato di next-themes conteneva il helper `__name` di esbuild, minificato come `e`, assente nel browser. Impostato `keep_names: false` in Wrangler secondo la [correzione ufficiale OpenNext](https://opennext.js.org/cloudflare/howtos/keep_names). Nessuna modifica ai componenti Arc o al provider tema.

## 2026-10-12: iCal e promemoria (M4-T2)

Un token casuale Web Crypto da 32 byte, restituito una volta, autorizza solo la lettura. Il database conserva SHA-256, metadati e revoca; le azioni con sessione modificano soltanto il proprio token in una transazione con audit. Nessun hash è leggibile dal client. La route pubblica usa una RPC service_role stretta, che rivaluta profilo attivo/ruolo, appartenenze e flag visible_to_brand a ogni richiesta, selezionando esclusivamente titolo, descrizione, luogo e date. Nessun ID di cliente/assegnatario nei feed. Cache privata/no-store; token revocati, ruotati e account disattivati producono 404. Un link già copiato da terzi resta una credenziale fino alla revoca.

RFC 5545 generato con date UTC per eventi orari e VALUE=DATE per all-day, con termine esclusivo nel fuso Roma. Escape testo, CRLF e folding UTF-8 a 75 ottetti, validati con [ical.js](https://github.com/kewisch/ical.js/wiki/Parsing-iCalendar) 2.2.1. Limite esplicito 5.000 eventi con 413, senza troncamento; non serve registrare un database di fusi nel client.

Scelto il [custom Worker OpenNext](https://opennext.js.org/cloudflare/howtos/custom-worker) con [Cron Trigger](https://developers.cloudflare.com/workers/configuration/cron-triggers/) alle 06:00 UTC. Riusa direttamente il fetch handler generato e una route POST protetta, senza rete verso l’origin e senza dipendenze pg_cron nel runtime Supabase locale. Le finestre domani/inizio successivo sono calcolate in Europe/Rome, incluse giornate DST di 23/25 ore.

Claim atomico SQL, vincolo evento/persona/data, lease e stato finale impediscono elaborazioni parallele duplicate. Failed è ritentabile; lease processing scade dopo 10 minuti; sent e logged restano distinti. Job e token hanno audit transazionale. Trasporto Resend 6.32.1 con chiave idempotente stable; log locale senza indirizzi/contenuto. Rendering con [React Email](https://react.email/docs/utilities/render) 6.11.1: la [migrazione corrente](https://react.email/docs/getting-started/updating-react-email) ha consolidato componenti/render nel pacchetto react-email, quindi non si usano i pacchetti componenti dismessi. Rendering reale verificato nel workerd locale; invio a un mittente reale resta da verificare nella configurazione hosted.

Nota strumenti locali: il dispatch Local Explorer per nome può selezionare il runtime omonimo inizializzato dal dev Next, con binding caricati prima dell’aggiunta di CRON_SECRET. La prova del trigger usa `/__scheduled` sul runtime Wrangler con --test-scheduled; l’esecuzione e i log del job sono verificati lì.

## 2026-10-12: documenti privati (M4-T3)

Formati iniziali PDF, PNG e JPEG, massimo 10 MiB per file. Valori reversibili scelti per cataloghi/lookbook/listini; estensione e MIME devono corrispondere alla firma iniziale. Nessuna promessa di validazione integrale o antivirus. Identità del file/brand immutabile, aggiornabili nome, tipo, riferimenti e condivisione. Metadati con audit SQL transazionale, validazione relazioni e concorrenza updated_at. Archivio logico, conservazione del file per audit.

Storage e metadata non condividono una transazione: prima record pending associato al percorso UUID, poi upload con sessione/RLS, infine pubblicazione solo se size/mimetype corrispondono all’oggetto. Errori compensano oggetto/record; se la pulizia fallisce il record resta non pubblicato. Policy Storage qualificano esplicitamente storage.objects.name, evitando collisioni con documents.name. Nessun overwrite e nessun oggetto senza metadata autorizzato. Nessuna service role nelle route upload/download.

Next proxy bufferizza il corpo a 10 MB e tronca senza rifiutare. Impostato experimental.proxyClientMaxBodySize a 12 MB seguendo la guida della versione installata, lasciando spazio al multipart; la route limita lo stream a 10 MiB + 64 KiB e il file a 10 MiB. Verificato su Workers il limite incluso e l’errore 413 oltre limite. URL firmati per 120 secondi: revoca blocca nuove emissioni, non annulla un URL già emesso. Risposte private/no-store.

L’audit axe degli errori attende la fine delle animazioni Arc: i frame intermedi a opacità parziale non rappresentano il colore finale. Nessun token o interno Arc modificato; contrasto finale verificato. MCP Arc finalmente disponibile nella sessione: skill/catalogo/documentazione input consultati direttamente.

## 2026-10-12: budget e periodi (M5-T1)

Vincolo di esclusione [GiST sui daterange](https://www.postgresql.org/docs/current/rangetypes.html#RANGETYPES-CONSTRAINT) con [btree_gist](https://www.postgresql.org/docs/current/btree-gist.html). Primo e ultimo giorno inclusi; periodi consecutivi sono ammessi dal giorno successivo. Stagione e cliente NULL identificano una combinazione generale distinta, non un wildcard che blocca ogni budget specifico. Nel vincolo, coalesce e flag NULL separati evitano collisioni anche con l’UUID zero. Non si sommano automaticamente budget generali e specifici come un unico obiettivo: il confronto successivo deve indicarne il perimetro.

Note riservate in budget_private con RLS, come le note ordine; il portale legge importi/periodi senza note interne o dati fiscali del cliente. save_budget aggiorna budget, note e audit in una transazione; updated_at evita sovrascritture. Identità e brand immutabili. UI amministrazione e admin, staff in sola lettura.

Consultati componenti gratuiti Arc money-input, input, textarea e date-picker. Usato Input con inputMode decimal e parsing esatto in centesimi: money-input corrente contiene messaggi/annunci dei limiti in inglese senza prop di traduzione, e non si modificano gli interni Arc. Date native nell’Input per immissione diretta/tastiera italiana, come negli altri form. Nessuna animazione superflua durante la digitazione; Number Flow resta per valori live mostrati fuori dai campi.
