# Verifiche di interfaccia

## M0-T6 e M1-T1: accesso e tema

Ambito: login, recupero password, impostazione password, navigazione autenticata iniziale, design-check. Componenti Arc gratuiti: button, input, password-field, password-strength, alert, segmented-control, theme-switch, avatar.

| Dominio       | Verifica                                                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accessibilità | Label native, errori inline, focus al primo campo invalido, Tab sul campo email; axe chiaro/scuro senza violazioni AA dopo le correzioni. Screen reader manuale non verificato. |
| Layout        | Cinque viewport 360/390/768/1024/1440, nessun overflow; screenshot mobile ispezionati. Corretto box-sizing globale.                                                             |
| Testi         | Italiano tramite next-intl; errori indicano come recuperare; messaggio reset non enumera gli utenti.                                                                            |
| Tipografia    | Geist/Inter, token di dimensione/peso, input 16 px su touch; titoli senza overline.                                                                                             |
| Colori        | Bordo e testo muted originali insufficienti; corretti tramite token semantici. Axe light/dark verde.                                                                            |
| UI            | Sorgenti Arc immutati; target estesi tramite wrapper, feedback in pagina, tema senza transizioni tramite next-themes.                                                           |

Checklist Arc applicata al codice di composizione. Tema persistente verificato prima dell’arrivo del contenuto, anche dopo reload. Accenti alternativi, zoom 200% e lettura con screen reader da completare nella revisione trasversale M8.

I dashboard attuali sono punti d’ingresso, non espongono ancora riepiloghi di business. Test con soli account sintetici locali. Nessuna verifica implicita delle schermate ancora da implementare.

## M2-T1: creare e archiviare un brand

Ambito della revisione better-interface: lista brand → creazione → modifica → referente → archiviazione; lettura staff. Stack e convenzioni: AGENTS.md, DESIGN-GUIDELINES.md, token Arc, next-intl, cinque viewport. Escluse le schermate di catalogo/ordini e la shell definitiva di M2-T3.

| Dominio       | Evidenza                                                                            | Esito                                                                  |
| ------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Accessibilità | e2e/brands.spec.ts, axe sul form, label native/errori inline, conferma esplicita    | Nessuna violazione AA automatica; screen reader manuale non verificato |
| Layout        | Flusso completo su cinque viewport, controllo scrollWidth, form-grid e card mobile  | Nessun overflow rilevato                                               |
| Testi         | messages/it.json, errori con percorso di recupero, conferme con nome del record     | Italiano, conseguenze dell’archiviazione esplicite                     |
| Tipografia    | Input/textarea Arc, form e dettagli con token                                       | Nessuna dimensione o peso fuori scala                                  |
| Colori        | Controllo token, tema chiaro e componenti Arc immutati                              | Nessun colore fisso; contrasto del form verificato con axe             |
| UI            | Pending/disabilitazione, conferma inline, skeleton/error/empty e successo in pagina | Stato percepibile senza affidarsi alla motion                          |

Verifiche passate: `E2E_BASE_URL=http://localhost:3100 pnpm e2e e2e/brands.spec.ts` (10 test), lint/typecheck/test/check:tokens. Non verificati qui: zoom 200%, screen reader manuale e contrasto di questa specifica schermata in scuro (previsti in M8). Nessun problema di interfaccia bloccante rilevato nel perimetro verificato. Verdict: Approve, limitato alle verifiche indicate.

## M1-T3 e M1-T4: amministrare utenti e consultare modifiche

Ambito: invito staff → cambio ruolo/disattivazione → registro; accesso negato a staff. Stesse convenzioni e skill della revisione M2-T1. Il radio si aziona dal testo della label o con tastiera; nessuna modifica ai sorgenti Arc. Nomi delle risorse e delle operazioni nel registro localizzati; autore mostrato per nome/email quando disponibile.

Copertura: accessibilità con axe sul form e radio da tastiera; layout nei cinque viewport senza overflow, screenshot mobile del registro ispezionato; testi italiani tramite next-intl; tipografia/colori con token e UI Arc originali; pending/error/successo in pagina. Verifica: `E2E_BASE_URL=http://localhost:3100 pnpm e2e e2e/users.spec.ts`, 10 test passati. Non verificati: screen reader manuale, zoom 200% e tema scuro di questi form. Nessun problema bloccante rilevato nel flusso verificato. Verdict: Approve, entro questo perimetro.

## M2-T2: gestire un cliente

Ambito: inserimento con errore P.IVA → correzione → modifica → referente → archiviazione; lettura amministrazione. Form e liste composti con gli stessi componenti e token Arc verificati sopra. Dieci e2e nei cinque viewport: nessun overflow, etichette distinte tramite fieldset degli indirizzi, focus sul campo invalido, axe AA sul form senza violazioni. Testi/errori in italiano, pending e successo in pagina, archiviazione con conferma. Lint, typecheck, test unit e 9 test RLS passati. Non verificati: zoom 200%, screen reader manuale e tema scuro della pagina. Verdict better-interface: Approve nel perimetro verificato.

# Revisione M2-T3: navigazione e conferma archiviazione

## Revisione M3-T1: catalogo

Ambito: creazione stagione, validazione intervalli, creazione/modifica prodotto, prezzi, varianti e archiviazione. Stessi documenti/convenzioni Arc; tutte le skill di dominio lette. Non include matrice ordine o portale futuro.

| Dominio       | Evidenza                                                                                                                                  | Esito                                                |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Accessibilità | SelectField, ProductForm/SeasonForm, focus errore data; axe AA nei cinque viewport chiaro/scuro; copia SKU rende raggiungibile la tabella | Clear dopo correzione scorrimento tastiera su tablet |
| Layout        | card mostrano tutti i campi, SKU a capo con pulsante copia separato; overflow confrontato con viewport configurato                        | Clear dopo correzione SKU lungo mobile               |
| Scrittura     | catalog in it.json; conferme di archiviazione spiegano conservazione storica                                                              | Clear                                                |
| Tipografia    | token e font Arc; screenshot form mobile/desktop; importi formato italiano                                                                | Clear                                                |
| Colore        | nessun colore custom; axe e check:tokens                                                                                                  | Clear                                                |
| UI            | stato varianti, feedback salvataggio, skeleton/errori condivisi, preferenze tema                                                          | Clear                                                |

Nessun problema azionabile residuo nell'ambito. `pnpm e2e e2e/catalog.spec.ts` su localhost:3100: 5 passati; `pnpm build`, lint/typecheck, test e check:tokens verdi. Screenshot del form ispezionati. Screen reader reale/zoom 200% non verificati. Verdict: Approve nell'ambito indicato.

Ambito: flusso login → lista brand → ricerca/paginazione → dettaglio → conferma/annullamento → preferenze tema. Next.js, Arc e token semantici; convenzioni lette in AGENTS.md, DESIGN-GUIDELINES.md e DECISIONS.md. Esclusi i moduli futuri.

| Dominio       | Evidenza                                                                                                                     | Esito |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----- |
| Accessibilità | ResponsiveDialog, ConfirmAction, AppNavigation; focus Annulla, Escape/ritorno focus, axe AA chiaro/scuro nei cinque viewport | Clear |
| Layout        | SessionShell, globals.css; screenshot 360 e 1440 px, test overflow nei cinque viewport                                       | Clear |
| Scrittura     | messages/it.json, titoli/descrizioni/azioni in italiano                                                                      | Clear |
| Tipografia    | foundation e token; nomi lunghi visibili su mobile, screenshot                                                               | Clear |
| Colore        | token semantici, tema scuro, axe contrasto; check:tokens                                                                     | Clear |
| UI            | caricamento/errore/vuoto condivisi, stato attivo della navigazione, conferma esplicita; nessuna animazione custom            | Clear |

Nessun problema di interfaccia azionabile nell'ambito verificato. Verifica: `E2E_BASE_URL=http://localhost:3100 pnpm e2e e2e/navigation.spec.ts`: 5 test passati; suite anagrafiche/utenti: 30 passati. Screenshot dark mobile/desktop ispezionati. Non verificati con screen reader reale o zoom browser 200%. Verdict: Approve nell'ambito indicato.

## M3-T3: editor ordine

Ambito: creare/modificare una bozza con tre prodotti, ricerca cliente, quantità, prezzo/sconto e salvataggio. Convenzioni AGENTS.md, DESIGN-GUIDELINES e DECISIONS; skill better-interface e sei domini lette. Esclusi lista/dettaglio e portale dei task successivi.

| Dominio       | Evidenza                                                                                                                        | Esito                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Accessibilità | Input/SelectField/MoneyInput, focus al campo invalido, tabella con intestazioni; e2e/orders-editor.spec.ts, axe AA chiaro/scuro | Clear nei controlli automatici |
| Layout        | Cinque viewport 360–1440, scroll interno; nove scenari break, nomi lunghi osservati e corretti                                  | Clear dopo correzione          |
| Scrittura     | orders/common in messages/it.json, errore con correzione e distinzione anteprima/totali salvati                                 | Clear                          |
| Tipografia    | Font/token Arc, tabular-nums, bdi per nomi misti, testi lunghi a capo                                                           | Clear nel perimetro            |
| Colore        | Token semantici; check:tokens e axe nei due temi                                                                                | Clear                          |
| UI            | Controlli Arc originali; salvataggio pending, errore, conferma in pagina                                                        | Clear                          |

Finding risolto: HIGH, app/globals.css (size-color-matrix), colonna colore senza limite occupava tutto il contenitore di 320 px; table-layout fixed e colonne da 6/10 rem con overflow-wrap anywhere rendono raggiungibili le quantità. Proprietari better-layout/better-typography, screenshot browser della correzione ispezionato. Nessuna finding residua nel perimetro. Verifiche: cinque e2e con quattro righe persistite/totali e reload, 37 unit test, lint/typecheck/check:tokens e build Next. Zoom browser 200% e screen reader reale non verificati, restano nella revisione M8. Verdict: Approve per le verifiche indicate.

## M3-T4: elenco, dettaglio e cambio stato

Ambito: elenco filtrato → dettaglio → annullamento interrotto → conferma/produzione/spedizione/consegna → duplicazione/archiviazione → fatturazione con ruolo amministrazione. Stack, convenzioni e sei skill di dominio della revisione precedente. Esclusi PDF e portale futuri.

| Dominio       | Evidenza                                                                                                                               | Esito                                                            |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Accessibilità | OrderFilters/OrderActions, dialog focus/Escape, copia SKU; axe AA nei cinque viewport chiaro/scuro                                     | Clear dopo correzione scroller tablet                            |
| Layout        | ListView filtri conservati, DataTable card con tutti i campi; screenshot 360/1440 px e overflow                                        | Clear                                                            |
| Scrittura     | Stati, verbi delle transizioni, conseguenze annullamento, nota duplicazione, percentuale di default distinta dal suggerimento del form | Clear                                                            |
| Tipografia    | Token Arc, importi/date italiane, SKU e nomi lunghi a capo                                                                             | Clear                                                            |
| Colore        | Badge Arc semantico, testo stato sempre visibile; axe/check:tokens                                                                     | Clear dopo rimozione interpolazione transitoria nel cambio stato |
| UI            | Pending/feedback in pagina, storico nativo, dialog annullamento, snapshot protetti                                                     | Clear                                                            |

Finding risolti: WCAG 2.1.1, scroller tabella senza controlli su tablet, aggiunta copia SKU; testo badge in transizione con contrasto temporaneamente insufficiente, stato reso senza interpolazione tramite composizione/key. Nessuna finding azionabile residua nell’ambito. Verifiche: `E2E_BASE_URL=http://localhost:3100 pnpm e2e e2e/orders-flow.spec.ts` (5 passati), 89 test DB, 40 unit test, lint/typecheck/check:tokens e build Next. Screen reader reale e zoom browser 200% non verificati (M8). Verdict: Approve nelle verifiche indicate.

## M3-T5 e numeri live: download e lettura dei documenti

Ambito: dettaglio ordine/stagione → link PDF → documento stampabile, più totali live dell’editor. Stack/convenzioni e sei skill better-* delle revisioni precedenti. PDF chiaro indipendente dal tema dell’app; confine: nessun viewer o portale completo.

| Dominio       | Evidenza                                                                                                   | Esito                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Accessibilità | Link nativi nominati; axe AA nei cinque viewport; Number Flow con respectMotionPreference                  | Clear nei controlli eseguiti; PDF non certificato PDF/UA |
| Layout        | Overflow browser 360–1440; render Poppler PDF A4 e 100 righe/7 pagine                                      | Clear dopo ampliamento colonna Quantità                  |
| Scrittura     | messages/pdf, stato Bozza stampato, errore font con percorso di recupero                                   | Clear                                                    |
| Tipografia    | Inter OFL incorporato, testi a capo, importi italiani; rifiuto dei glifi mancanti                          | Clear entro copertura Inter                              |
| Colore        | Stampa neutra chiara; link/token Arc; axe e check:tokens                                                   | Clear                                                    |
| UI            | Nessun prefetch dei download; animazione Number Flow con timing Arc, cifre tabulari, importi BigInt esatti | Clear                                                    |

Nessuna finding azionabile residua nell’ambito. Verifiche: cinque e2e PDF su Workers, cinque editor dopo Number Flow, 42 unit test, lint/typecheck e build:cf. PDF interno/brand confrontati via pypdf: nome cliente solo interno, note interne assenti, totale esatto. Pagine iniziali/intermedie/finali ispezionate tramite Poppler. Screen reader reale, zoom browser 200% e struttura PDF/UA non verificati. Verdict: Approve entro il perimetro indicato.

## M4-T1: creare, spostare e archiviare un evento

Ambito: calendario interno → finestra evento → errore condivisione → creazione → apertura da tastiera → modifica date → drag desktop → filtri → tutto il giorno → archivio. Stack Next/FullCalendar 7 con controlli/token Arc, convenzioni AGENTS/DECISIONS/DESIGN-GUIDELINES e sei skill di dominio. Esclusi feed, reminder e portale futuri.

| Dominio       | Evidenza                                                                                                      | Esito                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Accessibilità | e2e/calendar.spec.ts: nomi/focus campi invalidi, Enter evento, dialog e conferma Annulla, axe AA chiaro/scuro | Clear dopo correzione ARIA FullCalendar               |
| Layout        | Cinque viewport 360–1440; screenshot lista mobile e mese desktop; overflow controllato                        | Clear; titolo completo raggiungibile aprendo l’evento |
| Scrittura     | calendar in it.json, date/ora showroom esplicite, conferma archivio e condivisione descritta                  | Clear                                                 |
| Tipografia    | Input e testi Arc, data/ora controllati, titoli lunghi leggibili in finestra                                  | Clear nell’ambito                                     |
| Colore        | Palette FullCalendar mappata a token Arc, axe in entrambi i temi                                              | Clear                                                 |
| UI            | Lista mobile, toolbar Arc, pending/error/empty/success, rollback drag se salvataggio fallisce; reduced motion | Clear                                                 |

Finding risolte: HIGH accessibilità, FullCalendar esponeva button come figli diretti di list; adattatore cambia i contenitori interessati a group mantenendo focus/azioni. Avvisi React di aggiornamento durante render/prima del montaggio risolti accodando le notifiche iniziali fino al commit. Test all-day copre cancellazione/ripristino del campo data senza crash. Nessuna finding azionabile residua nell’ambito verificato. Cinque e2e finali con console pulita, 103 test DB, 44 unit test, lint/typecheck/check:tokens, DB lint e build OpenNext; flusso desktop completo anche su Workers con console pulita. Screen reader reale e zoom browser 200% non verificati, nella revisione M8. Verdict: Approve entro il perimetro indicato.

## M4-T2: abbonamento iCal

Scope: generare, copiare, rigenerare e revocare il link personale in /calendar. Next/React, componenti Arc esistenti (Input, Button, Alert, ConfirmAction), messaggi italiani; AGENTS e DESIGN-GUIDELINES come convenzioni. Revisione secondo better-interface e i sei domini già caricati.

| Dominio       | Evidenza                                                                                                                                                | Esito    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Accessibilità | CalendarFeedSettings, ConfirmAction, e2e/calendar-feed.spec.ts: annullamento inizialmente a fuoco, campo selezionabile, focus dopo revoca, axe due temi | Chiaro   |
| Layout        | Screenshot 360/1440 e assenza overflow nei cinque viewport; controlli a capo; sezione usa stack invece della griglia dei form                           | Corretto |
| Scrittura     | messages/it.json calendarFeed: copiare subito, conseguenze distinte di rotazione/revoca, recupero copia manuale/errori                                  | Chiaro   |
| Tipografia    | h2, copy e Input Arc; URL intero selezionabile/copibile; nessun testo essenziale troncato senza accesso                                                 | Chiaro   |
| Colori        | Alert stato e superfici Arc, axe chiaro/scuro, check:tokens                                                                                             | Chiaro   |
| UI            | Un solo primario resta Nuovo evento; azioni abbonamento secondarie, conferme esplicite, stato successo in pagina; nessuna nuova animazione              | Chiaro   |

Nessun finding aperto nel flusso verificato. Corrette prima della chiusura la label di conferma ereditata “Conferma archiviazione”, il focus dopo la rimozione del trigger revoca e la lettura a due colonne sul desktop. Test browser del flusso completo e screenshots ispezionati; le prove con screen reader reale e zoom 200% rimangono nella verifica M8.

Verdetto: Approve entro il perimetro verificato.

## M4-T3: caricare, condividere, scaricare e archiviare un documento

Ambito: lista → form con errore → upload → dettaglio → condivisione → download → conferma archivio. Next/React, componenti gratuiti Arc Input/Select/Checkbox/Button/Alert e compositi condivisi. Convenzioni AGENTS, DESIGN-GUIDELINES e DECISIONS; better-interface e sei skill di dominio già lette. Escluso portale M6.

| Dominio       | Evidenza                                                                                                              | Esito                                                     |
| ------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Accessibilità | e2e/documents.spec.ts, label native/file, errore aria-invalid e focus dopo pending, conferma iniziale Annulla, axe AA | Clear dopo correzione focus durante fieldset disabilitato |
| Layout        | Cinque viewport 360–1440, overflow, dettaglio mobile/desktop ispezionato                                              | Clear                                                     |
| Scrittura     | documents in it.json, formati/limite, conseguenze condivisione, durata URL e archivio                                 | Clear                                                     |
| Tipografia    | Componenti/token Arc, nomi lunghi a capo e KiB italiani                                                               | Clear                                                     |
| Colore        | Axe sui messaggi a fine animazione e dettaglio chiaro/scuro, check:tokens                                             | Clear nei controlli eseguiti                              |
| UI            | Loading shell condivisa, pending/upload, empty/error/success in pagina, file nativo; movimento ridotto Arc            | Clear                                                     |

Nessuna finding azionabile residua nell’ambito. Verifiche: `pnpm exec playwright test e2e/documents.spec.ts` (5 passati), desktop Workers anche al limite 10 MiB (1 passato), 134 test DB, 57 unit test, lint/typecheck/tokens/build OpenNext e DB lint. Il controllo statico del contrasto aspetta opacità finale 1 dei messaggi. Screen reader reale, zoom browser 200% e accento alternativo non verificati, nella revisione M8. Verdict: Approve entro il perimetro indicato.

## M5-T1: definire e archiviare un budget

Ambito: lista/form → errori campi/date → creazione → conflitto sovrapposizione → modifica importo → dettaglio → sola lettura staff → archivio. Stack e convenzioni del progetto; componenti Arc gratuiti, SearchSelect condiviso e Input nativo per date/importi, messaggi italiani. Revisione better-interface con le sei skill di dominio già lette; esclusi grafici e portale futuri.

| Dominio       | Evidenza                                                                                                | Esito                          |
| ------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Accessibilità | e2e/budgets.spec.ts, focus primo campo e data finale, errore inline, conferma Annulla; axe chiaro/scuro | Clear nei controlli eseguiti   |
| Layout        | Overflow 360–1440, form mobile e dettaglio Workers desktop ispezionati, composizione form-grid          | Clear per geometria verificata |
| Scrittura     | Scope dei NULL/periodi e euro spiegati prima dei campi, errore overlap con recupero, conferma archivio  | Clear                          |
| Tipografia    | Scala/token Arc, importi italiani/tabulari, nomi lunghi raggiungibili nei dettagli/ricerca              | Clear                          |
| Colore        | Axe dopo assestamento delle animazioni, due temi, check:tokens                                          | Clear per coppie misurate      |
| UI            | Form nativo decimal/date, pending/empty/error/success, nessuna modifica Arc, note multilinea            | Clear                          |

Nessuna finding azionabile residua nell’ambito verificato. `pnpm exec playwright test e2e/budgets.spec.ts` (5 passati), desktop workerd (1 passato), 157 test DB, 66 unit test, lint/typecheck/tokens/build OpenNext e DB lint. Uno screenshot completo mostra il skip link fuori dalla posizione attesa: misurazione DOM sul runtime Workers conferma transform -92,78 px e bottom -38,39 px, quindi nascosto fuori viewport senza focus; nessuna modifica basata sul solo raster. Screen reader reale, zoom 200%, RTL e accento alternativo non verificati (M8). Verdict: Approve entro il perimetro indicato.

## M5-T2: filtrare e leggere i report economici

Ambito: dashboard → filtri brand/stagione/date → KPI → confronti/andamento/clienti → filtro mese → indietro → vuoto → errore date. Next/React, Arc Input/Select/Button/Alert/EmptyState/Skeleton/LineChart, tabelle condivise e Recharts per barre raggruppate. AGENTS, DESIGN-GUIDELINES e DECISIONS; revisione better-interface con le sei skill di dominio già lette.

| Dominio       | Evidenza                                                                                                                     | Esito                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Accessibilità | Axe nei due temi/cinque viewport; scroller readonly tablet nominato, focus e ArrowRight; valori Number Flow correnti sr-only | Clear dopo correzioni wrapper |
| Layout        | Overflow 360–1440, screenshot tablet/Workers desktop, barre con larghezza massima; un contenitore                            | Clear                         |
| Scrittura     | Periodi budget completi distinti dai KPI, scostamento definito, zero percentuale, copertura/limiti e recupero filtri         | Clear                         |
| Tipografia    | Date/importi italiani, cifre tabulari, scope lungo a capo, token                                                             | Clear                         |
| Colore        | Token semantici, legenda testuale e tabella equivalente; axe due temi                                                        | Clear nei controlli indicati  |
| UI            | Skeleton finale, empty/error/risultati in pagina; filtri sync dopo indietro, Number Flow reduced motion, Arc immutabile      | Clear                         |

Finding risolti: scorrimento readonly non raggiungibile da tastiera; Number Flow fallback SSR non aggiornato; filtri non sincronizzati con browser indietro. Grafici aria-hidden con tabella equivalente italiana; line-chart inert per non esporre controlli con istruzioni inglesi. La linea appare quando entra in viewport, secondo il comportamento Arc: screenshot full-page prima dello scroll può mostrarla ancora non disegnata. Test dedicato verifica percorso SVG e clip dopo lo scroll. Cinque e2e dashboard e desktop Workers passati; verifica editor per il wrapper condiviso. 179 test DB, 68 unit test, lint/typecheck/tokens/build OpenNext, DB lint. Screen reader reale, zoom 200%, RTL e accento alternativo rimangono nella verifica M8. Verdict: Approve entro il perimetro indicato.

## M5-T3: leggere provvigioni e scaricare Excel

Ambito: report → brand/periodo/stagione → origine percentuale → export → successo in pagina → restringere periodo → vuoto/errore. Next/React, Arc Input/Select/Button/Alert/Skeleton e tabelle condivise, Number Flow per i totali. AGENTS/DECISIONS/DESIGN-GUIDELINES e sei skill better-* già consultate. Esclusi portale e import futuri.

| Dominio       | Evidenza                                                                                                                     | Esito                            |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Accessibilità | Axe chiaro/scuro nei cinque viewport, link ordine nominati, stato download, campi native date                                | Clear                            |
| Layout        | Overflow 360–1440, card mobile e tabelle dentro scroller; screenshot mobile/Workers desktop                                  | Clear nella geometria verificata |
| Scrittura     | Percentuale brand/ordine, effetto modifica default, arrotondamento e limiti espliciti, errore recuperabile                   | Clear                            |
| Tipografia    | Cifre tabulari, date/euro italiani, nomi lunghi raggiungibili, token Arc                                                     | Clear                            |
| Colore        | Token e controllo axe nei due temi, nessuna distinzione solo cromatica                                                       | Clear                            |
| UI            | Un primario export, skeleton/empty/error/success in pagina, download senza abbandonare il report, reduced motion Number Flow | Clear                            |

Nessuna finding azionabile aperta nel flusso. Cinque e2e report e cinque dashboard, file riaperto con valori esatti e stringa pericolosa protetta, desktop Workers; 201 test DB, 77 unit test, lint/typecheck/tokens/build e DB lint. Screenshot raster mostra a volte skip-link/sidebar in posizione diversa dal DOM, già verificato in M5-T1; overflow reale controllato. Screen reader reale, zoom 200% e accento alternativo restano in M8. Verdict: Approve entro il perimetro indicato.

## M6-T1: dashboard del brand

Ambito: login brand → filtri autorizzati → riepilogo/confronto → tema → restringere periodo → brand estraneo 404 → vuoto. Componenti/token Arc e shell esistenti, Select/SearchSelect, Number Flow, grafico condiviso con testi portale. AGENTS/DECISIONS/DESIGN-GUIDELINES, better-interface e sei domini già letti.

| Dominio       | Evidenza                                                                                                   | Esito                          |
| ------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Accessibilità | Axe due temi/cinque viewport, readonly esplicito, campi nativi, regione tabella nominata, 404 dedicato     | Clear                          |
| Layout        | Overflow 360–1440 e screenshot mobile/desktop, verifica DOM pulsanti sotto fieldset                        | Clear per geometria verificata |
| Scrittura     | Solo propri brand, Cliente riservato, nessuna associazione con recupero, limiti budget e filtri            | Clear                          |
| Tipografia    | Importi/date italiani, dati tabulari, nomi completi nelle tabelle/card, token                              | Clear                          |
| Colore        | Axe chiaro/scuro, tabella equivalente alla legenda; token semantici                                        | Clear                          |
| UI            | Navigazione dedicata, skeleton dopo autorizzazione, vuoto/errore/risultati in pagina, zero azioni business | Clear                          |

215 test DB, 78 unit test, cinque e2e portale e desktop Workers (incluso HTTP 404 e console pulita), lint/typecheck/tokens/build/DB lint. Rilevato warning di next-themes solo nel dev attraversando 404; funzionamento tema dopo il 404 verificato, nessun warning Workers. Corretto un difetto reale mobile: i filtri ereditavano position:sticky dalle azioni dei form e coprivano i campi. Classe report-actions statica nei filtri dashboard/portale e nel download provvigioni; test misura il pulsante dopo tutto il fieldset. Screen reader reale, zoom 200% e accento alternativo restano in M8. Verdict: Approve entro il perimetro verificato.

## M6-T2: leggere ordini, vendite, documenti e calendario

Ambito: liste/filtri → dettaglio ordine → download CSV/PDF/line sheet → vendite → file condiviso → evento readonly e abbonamento. Next/React, Arc gratuito e compositi condivisi, FullCalendar, Number Flow. Catalogo/documentazione Arc e sei skill better-* già consultati; revisione better-interface sull'intero flusso.

| Dominio       | Evidenza                                                                                                           | Esito |
| ------------- | ------------------------------------------------------------------------------------------------------------------ | ----- |
| Accessibilità | Axe nei due temi/cinque viewport su quattro route, link nominati, dialog readonly con focus, download reali        | Clear |
| Layout        | Overflow 360–1440, azioni report statiche, tabelle/card adattive, screenshot Workers ordini/calendario ispezionati | Clear |
| Scrittura     | Cliente riservato, assenza modifiche, limiti e stati vuoti con istruzioni, nessun testo tecnico nei flussi         | Clear |
| Tipografia    | Token Arc, date/euro italiani, dati tabulari, dettaglio completo per titoli evento troncati                        | Clear |
| Colore        | Token semantici e axe chiaro/scuro; stati con label                                                                | Clear |
| UI            | Skeleton dopo guardie, empty/error, controlli readonly, download nativi; nessuna modifica Arc o animazione nuova   | Clear |

Cinque e2e portale e cinque regressioni calendario passati; desktop Workers, regressione dashboard e PDF estratto verificati. 227 test DB, 79 unit test, lint/typecheck/tokens/build/DB lint. Nessun finding azionabile residuo nel flusso verificato. Screen reader reale, zoom 200% e accento alternativo restano in M8. Verdict: Approve entro il perimetro indicato.

## M7-T2: emettere una fattura e registrare incassi

Ambito: ordine consegnato → date/validazione → snapshot fattura → scadenzario → aggiornamento provider → incassi parziali/completi → annullamento separato → lettura staff e protezione portale. Next/React, componenti gratuiti Arc e compositi condivisi, Number Flow. AGENTS, DESIGN-GUIDELINES, DECISIONS e sei skill better-* consultati; revisione better-interface sul flusso completo, esclusa integrazione reale T3.

| Dominio       | Evidenza                                                                                                                      | Esito |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----- |
| Accessibilità | Axe chiaro/scuro, focus errore date/importo, conferma con focus Annulla, successo in pagina, controlli nominati               | Clear |
| Layout        | Overflow 360–1440, screenshot mobile e Workers desktop, pulsanti inline statici, stato vuoto tabelle visibile su mobile       | Clear |
| Scrittura     | Simulazione esplicita, snapshot e saldo, stato esterno pagato distinto da incasso, errori recuperabili, annullamento spiegato | Clear |
| Tipografia    | Euro/date italiani, tabular-nums, nomi lunghi completi, token Arc                                                             | Clear |
| Colore        | Axe due temi, token semantici, badge con testo                                                                                | Clear |
| UI            | Un primario per superficie, azioni secondarie raggruppate, skeleton/vuoto/errore/successo, movimento ridotto Number Flow      | Clear |

Nessun finding azionabile residuo nel flusso ispezionato. Verifiche: pnpm e2e e2e/invoices.spec.ts (cinque viewport), pnpm e2e e2e/orders-flow.spec.ts (cinque viewport), portal-flow desktop; invoices desktop su Workers con callback reale locale firmato. Lint/typecheck/test/check:tokens/build:cf/supabase:test e DB lint verdi: 902 controlli DB, 99 unit test. Screen reader reale, zoom 200% e accento alternativo non verificati in questo task, previsti in M8. Verdict: Approve entro il perimetro e le verifiche indicati.
