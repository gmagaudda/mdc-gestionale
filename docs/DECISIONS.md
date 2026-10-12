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
