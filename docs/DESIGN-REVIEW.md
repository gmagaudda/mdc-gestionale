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
