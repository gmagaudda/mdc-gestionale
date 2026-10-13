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

## 2026-10-12: reporting e dashboard (M5-T2)

Le somme restano SQL e sono serializzate in centesimi testuali: un aggregato può superare la precisione intera JavaScript anche se ogni ordine rispetta il limite. Il grafico viene omesso oltre tale precisione; la tabella mantiene l'importo BigInt esatto. KPI e andamento seguono i filtri; il confronto budget usa il periodo completo di ciascun budget che interseca i filtri. Budget generali/specifici non vengono sommati in un obiettivo ambiguo. Limiti espliciti: 120 mesi, 10 combinazioni cliente/brand, 50 budget nell'RPC e primi 10 nel grafico, con conteggi/copertura visibili.

Viste security_invoker, RPC dashboard interna e sessione Supabase. D1 nelle viste clienti; fatturato del budget NULL per il brand senza permesso fatture, invece di uno zero fuorviante. Tabella invoices creata ora come base di lettura per il fatturato, senza policy di scrittura autenticata: flusso provider/pagamenti in M7.

Consultati Arc bar-chart, line-chart, metric-card, card e slope-chart. Il confronto raggruppato budget/venduto non è coperto dal bar-chart gratuito; adottato [Recharts Bar](https://recharts.github.io/en-US/api/Bar/) 3.10.1, statico, token semantici e tabella equivalente, verificato su Workers. Line-chart Arc immutabile per l'andamento; wrapper aria-hidden/inert e tabella italiana perché il componente contiene istruzioni SR inglesi senza prop di traduzione. Metric-card ha un contatore proprio e formattazione limitata; Card corrente non compila per render prop Radix. Riepilogo semantico dl con Number Flow richiesto dall'umano, senza modifica agli interni Arc.

Number Flow conserva il testo di fallback SSR iniziale mentre aggiorna cifre nel suo shadow DOM. Il wrapper condiviso espone una copia sr-only del valore corrente ed esclude le sole cifre animate dalla lettura. DataTable aggiunge una regione nominata/focusabile allo scroller quando serve scorrere e non ci sono già controlli focusabili. Modifiche solo nei compositi condivisi, non nei sorgenti Arc.

## 2026-10-12: provvigioni ed export XLSX (M5-T3)

Provvigione sul netto dell'ordine confermato o successivo, arrotondata in SQL al centesimo (mezzo centesimo verso l'alto). Somma delle provvigioni già arrotondate per ordine, non arrotondamento unico del venduto aggregato. L'override ordine prevale anche se zero; in sua assenza vale la percentuale attuale del brand. D3 non prevede snapshot della percentuale del brand: una successiva modifica del default cambia il report dei suoi ordini senza override, come spiegato nell'interfaccia.

La vista richiede esplicitamente ruolo interno oltre alle RLS delle tabelle private. La RPC restituisce centesimi testuali, totali indipendenti dalla pagina, massimo 500 riepiloghi brand con copertura dichiarata. L'export legge fino a 10.000 ordini in un'unica chiamata/snapshot e rifiuta un report più grande o oltre 500 brand, evitando troncamenti e discrepanze fra pagine durante scritture concorrenti.

[ExcelJS](https://github.com/exceljs/exceljs#writing-xlsx) 4.4.0, Workbook document con writeBuffer (nessun fs/stream di file), generazione reale e rilettura su workerd locale riuscite. Fogli Filtri, Riepilogo per brand, Ordini e Totale del periodo. Euro e centesimi come stringhe esatte: Excel non conserva tutti gli interi oltre 15 cifre. Nessuna formula di calcolo o campo privato. Testi pericolosi con apostrofo; stringhe sempre celle testo, mai oggetti formula. Limiti espliciti e feedback di download in pagina.

Filtri Arc riusati tramite composizione del form esistente, tabelle Arc attraverso DataTable/ListView; filter-toolbar consultato ma non adatto a date native e ricerca remota di molte opzioni. Niente modifica agli interni Arc.

## 2026-10-12: dashboard portale (M6-T1)

RPC portal_dashboard_report dedicata al ruolo brand, security invoker, con select/JSON espliciti. Nessun riuso della risposta interna contenente fatturato o nomi non autorizzati. D1 per il cliente di un budget deriva solo da un ordine accessibile dello stesso brand/cliente; in assenza di un ordine autorizzato si mostra Cliente riservato. Confronto budget e totali economici rimangono SQL, in centesimi testuali.

Guardie di brand/stagione prima della Suspense dei dati: il brand estraneo risponde HTTP 404 anche su Workers, senza scaricare il report. Skeleton soltanto dentro la regione già autorizzata. Scelte massimo 500 senza troncamento; Select Arc per elenchi corti, SearchSelect per quelli lunghi. Shell riusata con navigazione nominata Portale brand; nessuna azione di modifica.

Next dev/next-themes emette un warning React sul rimontaggio dello script quando si naviga a un documento 404 completo; il tema continua a funzionare. La console dei flussi normali è controllata senza eccezioni; l'errore HTTP 404 richiesto è distinto dagli errori inattesi. Sul runtime Workers di produzione anche la console attraverso il 404 è pulita. Nessuna modifica al provider per aggirare il warning dev.

Le azioni dei report sono statiche: la regola sticky dei form di scrittura copriva campi filtro su mobile. report-actions nei filtri interni/portale ed export provvigioni, con geometria DOM verificata.

## M6-T2: read model del portale

Vista e RPC dedicate espongono solo i campi necessari ai brand. Le aggregazioni vendite si calcolano in SQL e il nome cliente passa da D1, senza accesso diretto all'anagrafica. Ordini bozza/annullati rimangono consultabili, ma non contribuiscono al venduto. Il calendario riusa FullCalendar e l'abbonamento personale con controlli readonly; cliente e assegnatario restano interni. Documenti e relativi contenuti sono pubblicabili solo dopo condivisione esplicita; non si promette anonimizzazione del file originale. Le guardie precedono Suspense per mantenere HTTP 404 sugli scope non autorizzati.

## M7-T1: provider simulato e storico fiscale

MockInvoicingProvider richiede uno store esplicito; l'implementazione memory è solo per test/spike. Il flusso applicativo userà un adapter SQL persistente per condividere stato/idempotenza tra richieste e isolate Workers. Non simulare consegna o pagamenti reali: i sei stati sono scenari controllati. Una chiave idempotente riusata con input diverso viene rifiutata. Snapshot fiscali, righe, date, importi e condizioni sono immutabili dalla creazione, anche durante la bozza; stati provider restano aggiornabili solo tramite RPC autorizzate nel T2. Le righe legacy del read model M5 mantengono snapshot null, senza ricostruire dati storici dalle anagrafiche attuali.

## Conferme dell’umano: provider e identità

Confermato Fatture in Cloud come provider definitivo per M7-T3. Preparare integrazione/contract test con HTTP simulato; accessi reali da configurare nell'ambiente, senza attivazione o emissione reale in questa fase locale. Nome definitivo “MDC Gestionale”, accento neutro attuale, per manifest/icone e identità in M8. Nessun deploy autorizzato in questa fase.

## M7-T3: Fatture in Cloud (12 ottobre 2026)

Confermato dall'umano. Adapter fetch senza SDK Node, attivazione esplicita e configurazione per brand: un unico FIC_COMPANY_ID globale rischierebbe di scegliere l'emittente sbagliato. Numerazione fiscale assegnata dal provider, distinta dal riferimento interno. Nessun invio SdI automatico e nessuna anagrafica esterna nuova; gestione elettronica/rettifiche nel provider.

La API non documenta una chiave HTTP idempotente per creazione: journal SQL prima del POST e correlazione subject con fingerprint. Dopo timeout/5xx, recupero autenticato; se manca una corrispondenza non si ritenta la scrittura alla cieca. Totali esterni devono coincidere esattamente. I token OAuth ruotati vanno conservati dall'operatore in ambiente sicuro; niente refresh runtime in memoria che li perderebbe fra isolate.

Webhook FIC usa JWT ES256, non l'HMAC del mock. Coda sulla tabella eventi già protetta, metadati minimi e lettura stato via API. after più cron di recupero rispettano la raccomandazione ufficiale di risposta rapida; nessun pagamento creato da un callback. Fonti, configurazione ed eventuali limitazioni fiscali sono documentate in INVOICING.md. Le prove di contratto sono sintetiche; OAuth/account/sezionali/webhook HTTPS reali richiedono ancora la configurazione umana.

## M8: PWA locale e controlli accessibili

Identità confermata dall’umano: MDC Gestionale, accento neutro. Icone originali geometriche generate da `pnpm icons`; colori del manifest derivati dalla foundation Arc, senza palette parallela nelle componenti. Icona maskable con contenuto nella zona centrale sicura; favicon e apple-touch-icon coerenti.

L’audit su telefono ha riprodotto un menu Select con un identificativo lungo fuori dall’area cliccabile. Il catalogo Arc indirizza le liste cercabili a Combobox, ma i controlli di cancellazione/lista della versione gratuita hanno stringhe inglesi senza API documentata di traduzione. SearchSelect compone quindi Input Arc e select nativa etichettata, con ricerca limitata e valore completo leggibile sotto al controllo. Le liste brevi continuano a usare Select Arc. Nessun interno vendor modificato. Il testo accessibile dei numeri Number Flow è ora contenuto in uno span relativo: prima i suoi span assoluti estendevano lo scroll della pagina quando erano dentro una tabella.

Service worker manuale e piccolo: solo asset pubblici e pagina offline priva di sessione. Nessuna persistenza di HTML autenticato, API, RSC, PDF, link firmati o dati business. Il GET di navigazione usa sempre la rete; se manca, mostra la pagina offline. Le bozze già aperte restano soltanto nella memoria del tab. Le scritture sono bloccate offline anche tramite Enter/requestSubmit; nessuna coda di sincronizzazione. Logout elimina lo storage del tab e le cache non pubbliche.

Installazione su gesto esplicito; Safari iOS mostra istruzioni. Aggiornamento del worker soltanto dopo conferma che informa della perdita delle modifiche non salvate. Nessun reload automatico degli altri tab. Registrazione soltanto nella build production e in secure context: lo sviluppo Next resta senza service worker. Header SW in Next e nel file `_headers`, perché Cloudflare applica quest’ultimo alle risposte degli asset statici ([documentazione](https://developers.cloudflare.com/workers/static-assets/headers/)).

## M8-T5: spike Web Push positivo

`@block65/webcrypto-web-push` 2.0.0 usa Web Crypto e aes128gcm (RFC 8291), con VAPID ES256 (RFC 8292). Spike eseguito in workerd locale: payload di 4096 byte decifrato indipendentemente, firma e audience verificate. Nessun invio a servizi esterni nello spike. Scelta della versione 2 per il formato supportato da Apple; [documentazione primaria](https://github.com/block65/webcrypto-web-push).

Consenso esplicito nelle preferenze dei ruoli interni, revoca sul dispositivo o su tutti. Le sottoscrizioni sono preferenze personali, con RLS e RPC sessione ristrette; chiavi/endpoint non compaiono nell’audit. Endpoint HTTPS di servizi browser consentiti esplicitamente, redirect vietati e timeout 10 secondi. VAPID privato solo sul server, pubblico nel client; contatto operatore richiesto. Le chiavi locali di prova sono ignorate da Git e scritte con permessi 0600.

Promemoria per appuntamenti di domani in Europe/Rome, assegnatario interno attivo. Testo generico sulla schermata di blocco, link soltanto al calendario dell’app. Ledger SQL, claim atomico, lease/backoff di 15 minuti, massimo tre tentativi, cinque HTTP concorrenti. 404/410 rimuovono il dispositivo nella stessa transazione del completamento. Il servizio esterno resta fuori dalla transazione: un timeout può produrre una consegna incerta; tag stabile riduce notifiche duplicate. Successo HTTP significa accettazione del servizio, non prova di ricezione sul dispositivo. Il pulsante di prova ha cooldown SQL di un minuto e richiede sottoscrizione/chiavi proprie; test automatici usano esclusivamente trasporti e browser sintetici. Ricezione reale su Android/iOS installato ancora da verificare.

## 2026-10-12: parser e dati storici per stagione (M10)

ExcelJS 4.4.0 browser in worker separato, con Papa Parse 5.7.0 per CSV. Asset copiati da dipendenze bloccate e serviti dallo stesso host. Il worker restituisce solo valori salvati delle formule; non ricalcola formule né esegue macro. Preflight delle directory ZIP e decompressione effettiva con limite prima della lettura del workbook. Limiti: 10 MiB, 20.000 righe non vuote complessive, 20 fogli, 128 colonne, 100 MiB decompressi totali, 30 MiB per entry. Benchmark sintetico e metriche di heap in PROGRESS; il consumo misurato è quello trattenuto, non il picco del processo.

Il file fornito contiene importi aggregati per stagione, senza riferimenti o date dei singoli ordini. L'umano ha scelto dati storici per riepiloghi e confermato che la colonna identifica la stagione. Gli importi ORDINE e BDG restano nello staging di un lotto performance; non si creano date, ordini di riepilogo o periodi operativi. La pivot seleziona otto brand contro diciotto nel dettaglio: la selezione è letta dal file, mentre tutte le righe vengono conservate. I 72 record senza nome negozio contribuiscono ai totali ma non al conteggio delle denominazioni. Celle vuote restano null; zero resta zero.

Somme in centesimi interi, SQL numeric e BigInt per aggregati. Raggruppamenti sulle etichette normalizzate per spazi, senza accorpare autonomamente nomi diversi. Le percentuali si ricalcolano dai totali. Commit e cambio di stato auditati nella stessa transazione; blocco del lotto, staging idempotente, vincolo univoco sul contenuto attivo. Un lotto incompleto dello stesso autore può riprendere dopo un nuovo caricamento dello stesso file; un lotto completato genera un avviso. Rollback storico esclude il lotto dalle query, conserva file e tracciabilità. Un lotto annullato può essere importato nuovamente.

Accesso runtime con sessione Supabase e RLS; amministrazione completa dei dati storici, accounting limitato ai lotti budget. Originale nel bucket privato, download con URL firmato di 60 secondi ottenuto dopo verifica della sessione. Esportazione amministrativa di tutti i gruppi dei filtri in una query SQL (limite 5.000); somme come testi esatti in euro, celle testo protette dall'iniezione di formule. Nessun servizio esterno riceve il workbook.

## 2026-10-12: importazione operativa e conservazione (M10-T2…T8)

Profili distinti per foglio, formati italiani o inglesi e percentuali punti/rapporti espliciti. Ambiguità nelle intestazioni e nei candidati richiedono una scelta salvata. Normalizzazione su server e revisioni CAS del lotto. P.IVA e codice fiscale: checksum e forma, senza verificare assegnazione, usando il DM 23/12/1976 [articolo 7](https://def.finanze.it/DocTribFrontend/executePrintArticolo.do?articolo=Articolo+7&codiceOrdinamento=200000700000000&id=%7B8D93A450-E5FE-47FC-A6F0-F938769051BF%7D) e [articolo 9](https://def.finanze.it/DocTribFrontend/executePrintArticolo.do?articolo=Articolo+9&codiceOrdinamento=200000900000000&id=%7B8D93A450-E5FE-47FC-A6F0-F938769051BF%7D).

Totali ordine operativi richiedono data, descrizione e IVA esplicite e sconti zero, con riga sintetica quantità 1. Il file RECAP senza date resta storico. Aggiornamenti ordine ammessi solo in bozza; snapshot dei valori delle righe ripristinati anche se il catalogo è cambiato. I report finali sono snapshot, mentre le viste dei budget operativi restano letture correnti. Venduto precedente significa intera stagione confermata; ordinato del lotto è limitato al periodo del budget.

Una transazione serializza lotti e normali modifiche commerciali. Rollback rifiutato per modifiche successive, fatture o nuovi riferimenti esterni; archivia le creazioni, ripristina gli aggiornamenti. Originali privati con scadenza predefinita 90 giorni, download firmato 60 secondi, pulizia via Storage API e rimozione celle raw. Normalizzati, audit e snapshot conservati per tracciabilità. Cron massimo 100 originali, tentativi successivi su errore o lavoro residuo.

## 2026-10-13: hardening, osservabilità e rilascio locale (M9)

TOTP obbligatorio per admin, basato sulle API [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa/totp), disponibile senza introdurre un provider esterno. La guardia server è accompagnata dalle policy restrittive SQL: un client che chiama direttamente Supabase non può usare dati business a `aal1`. Il profilo personale resta accessibile per enrollment; niente bypass di recupero nell’app. Una funzione ristretta per cancellare documenti pending evita la ricorsione delle policy Storage/documenti. Test SQL ora indipendenti dalla presenza dei dati demo.

Rate limiting centralizzato PostgreSQL anziché memoria del Worker, con HMAC privato delle identità e IP validato solo in contesto Cloudflare. In locale il contenitore IP è condiviso; il limite email/account resta indipendente. Soglie e finestre sono definite solo in SQL. `app.import_key`, funzione immutabile usata nell’indice clienti, deve essere eseguibile anche da service role; il grant non autorizza RPC business e non legge dati.

CSP di base compatibile con Next/next-themes, Arc e parser worker: inline ammesso, eval soltanto in sviluppo, connessioni limitate a origine dell’app e Supabase, framing/object disabilitati. Una CSP con nonce richiederebbe una revisione del rendering e del comportamento offline e non è dichiarata implementata.

Log JSON con whitelist, senza email/link/token. Gli inviti in modalità log non espongono più il link; gli account demo/recupero Mailpit coprono lo sviluppo locale. Resend reale configurabile per inviti e promemoria; nessuna consegna reale nei test. Sentry rimane opzionale e disattivato.

Prova di ripristino separa archivio PostgreSQL e byte Storage, poiché i [backup database Supabase](https://supabase.com/docs/guides/platform/backups) non includono i file. Clone dello stesso runtime nativo verificato; migrazione hosted fra piattaforme/versioni resta distinta, con chiavi/configurazione da preservare esternamente. Nessun reset del database principale.

Ambienti Wrangler con binding asset ripetuti secondo le [regole Cloudflare](https://developers.cloudflare.com/workers/wrangler/environments/). Rilascio GitHub disattivato fino a DEPLOY_ENABLED, staging automatico dopo CI, produzione manuale con gate dell’ambiente. Migrazioni senza seed. Il checkout non ha remote e l’umano ha scelto di provare localmente: credenziali, dominio e prova della pipeline hosted rimangono gate esterni.

## 2026-10-13: UI ERP e Better Icons

Richiesta umana successiva a M9: prendere ispirazione dai tre esempi ERP Dribbble, con sidebar a icone e sottomenu, accento verdino e Better Icons. Questa decisione aggiorna l’accento neutro precedente per l’interfaccia del gestionale. Palette verde salvia in token semantici dedicati al prodotto, senza modificare la foundation Arc; superfici neutre, selezione chiara e testo con contrasto verificato. Nome MDC Gestionale confermato.

Menu organizzato per attività e ruolo, disclosure native espandibili, contesto della pagina nell’intestazione, identità in fondo al menu. I blocchi sidebar Arc sono Pro: la composizione usa la navigazione nativa e i componenti gratuiti già disponibili, più breadcrumb gratuito dal registry. Nessuna ricostruzione di sorgenti Pro. Better Icons usato tramite la CLI della skill, versione pubblicata 1.0.4; solo SVG Tabler outline locali, con generatore e licenza. Le icone PWA neutre esistenti conservano la loro identità.

## 2026-10-13: riepilogo PDF brand e CSV delle liste

Completato il riepilogo vendite PDF previsto in M6: una snapshot SQL con sessione/RLS, brand obbligatorio, stagione e date ordine facoltative. Esclude bozze e annullati; i nomi/città nel portale seguono la stessa mascheratura delle vendite. Nessuna nota, provvigione o identificativo cliente nel modello. Limite esplicito di 1.000 gruppi, risposta 413 senza troncamento. Importi aggregati testuali e BigInt, inclusi valori oltre la precisione degli interi JavaScript. Quattro colonne A4 (stagione, cliente, ordini, netto), con IVA/lordo nei totali iniziali e intestazioni ripetute. Le prove visive includono prima, terza e quinta pagina di 100 gruppi sintetici.

Le liste brand/clienti/stagioni/prodotti/budget/documenti/fatture hanno CSV filtrati e ordinati, fino a 10.000 righe complete. La RPC usa una whitelist di query/colonne, parametri SQL, sort validati e sessione/RLS. Il portale vende soltanto dati autorizzati e mascherati; le provvigioni aggiungono CSV all’Excel esistente. UTF-8 BOM, punto e virgola, importi italiani esatti e protezione da formule. Percorsi Storage, URL firmati e campi privati esclusi. Superare il limite richiede filtri più stretti, senza export parziale.

Button/Select gratuiti Arc cercati e documentati via MCP. Download client con Button secondary/lg, caricamento, esito inline e Alert recuperabile; URL Blob revocati. SearchSelect esistente compone Input Arc e select nativa per contatti lunghi/cercabili, senza modificare gli interni vendor. Niente nuove dipendenze.

## 2026-10-13: conferma ordine manuale (sezione 7.6, M4-T2)

Decisione umana: pulsante «Invia conferma» nel dettaglio, anziché invio automatico al cambio di stato. Admin/staff scelgono un contatto attivo con email valida dello stesso cliente; bozza, annullato e anagrafiche archiviate sono esclusi. Massimo 500 righe commerciali e 500 contatti caricati, con errore esplicito oltre i limiti. Template React Email HTML/testo: descrizioni, quantità, prezzi, sconti, IVA, date, pagamento e totali esatti; nessuna nota privata/provvigione. La UI conserva lo storico degli ultimi 20 invii e distingue `logged` da `sent`.

Ledger privato in schema app con RLS abilitata e nessun accesso diretto per anon/authenticated/service_role. Le RPC di sessione verificano ruolo, MFA admin, destinatario e stato; claim/completamento e audit redatto sono transazionali. Il registro conserva snapshot/indirizzo privatamente; l’audit contiene solo ID, tentativo ed esito. Lock ordine/job, lease di 10 minuti, massimo tre tentativi e chiave Resend stabile per job. La deduplicazione riguarda gli stessi dati commerciali e contatto, senza creare un nuovo invio per il solo cambio di stato. Log locale e Resend hanno impronte separate: una simulazione non impedisce un successivo invio reale esplicito.

Il servizio esterno resta fuori dalla transazione SQL: un esito provider seguito da mancato completamento viene mostrato come incerto, senza marcarlo falsamente come fallito. Un retry usa la stessa chiave provider. Non si promette consegna assoluta senza duplicati dopo timeout o oltre la finestra di idempotenza del provider. Nessuna email reale inviata nelle verifiche; mittente/credenziali Resend restano da configurare e verificare nell’ambiente gestito. Le variabili correnti sono `EMAIL_MODE=log|resend`, come per i promemoria già implementati.

## 2026-10-13: filtri per colonna e selezione CSV (7.1, M2-T3)

Filtri nominati `cf_<campo>` nella query string, validati con Zod contro una whitelist per entità e applicati alle query Supabase della sessione. Testo con ricerca letterale non sensibile alle maiuscole, importi in euro normalizzati in centesimi testuali, date e dimensioni con uguaglianza esatta. Ricerca, paginazione, ordinamento e filtri di dominio conservano i parametri. Valori non validi mostrano un errore recuperabile e impediscono di presentare risultati o export non filtrati.

Selezione locale in memoria, limitata alla pagina corrente; cambio pagina/filtri/ordinamento la azzera. L’export passa UUID espliciti (massimo 500), interseca ricerca e filtri e mantiene RLS/sessione. Non legge record aggiuntivi per ricostruire dati nascosti e non salva la selezione nel service worker. La RPC `export_business_list` è security invoker; ordini riusano le query di sessione esistenti. Il CSV completo conserva il limite precedente di 10.000 righe.

Catalogo e documentazione gratuiti Arc consultati per sortable-data-table, filter-toolbar e checkbox. La selezione integrata e il filter-toolbar espongono annunci/controlli inglesi non configurabili. Per rispettare l’italiano senza modificare vendor, la selezione compone Checkbox Arc tramite il render documentato delle colonne; i filtri compongono Input/Button Arc dentro una disclosure e un form GET nativi. Niente ricostruzione di internals o nuove dipendenze. Le liste aggregate e i registri restano senza selezione quando non hanno un’azione sulle righe.
