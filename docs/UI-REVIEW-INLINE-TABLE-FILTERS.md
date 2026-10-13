# Review better-interface: filtri inline e ricerca delle tabelle

## Perimetro e copertura

Flusso completo delle barre Clienti e Ordini: apertura/selezione/azzeramento dei filtri, ricerca, ordinamento, paginazione, selezione e CSV. Verifiche aggiuntive del riuso in anagrafiche, fatture, provvigioni, analisi storica e portale. Perimetro della revisione: i controlli sopra le tabelle e la coerenza dei loro risultati; non tutte le route del gestionale.

Stack Next 16.3.8/React, next-intl, Arc gratuito, Radix Popover, motion e token semantici esistenti. Documenti esaminati: AGENTS.md, PLAN.md, DESIGN-GUIDELINES.md, DECISIONS.md e le sei skill better-*. Accessibility precede Arc. La richiesta umana sostituisce la scelta precedente delle disclosure dei filtri e della ricerca limitata a una colonna. Arc Popover/Combobox/Input/Button sono composti con le props documentate; i componenti Arc esistenti restano immutati.

| Dominio       | Evidenze esaminate                                                                                                                                                                                                               | Risultato                                       |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Accessibility | `list-toolbar.tsx`, `table-filter.tsx`, `search-select.tsx`; nomi italiani, trigger/popup/combobox, selezione da tastiera, focus dopo Escape e selezione, axe nei due temi, feedback del caricamento delle scelte e degli export | Clear nel perimetro ispezionato e automatizzato |
| Layout        | `globals.css`, `list-view.tsx`, composizione dei filtri di dominio; barra default e ricerca espansa, screenshot e controlli DOM a 390/768/1024/1440; stress 320 px/testo 200% nel flusso Clienti                                 | Clear                                           |
| Writing       | `messages/it.json`; etichette iniziali dei campi, anteprima della selezione, «Tutti», Cerca nella tabella, hint Enter/Escape, errori recuperabili nelle scelte remote e negli export                                             | Clear                                           |
| Typography    | Font e scale esistenti, pesi 400/500; larghezza intrinseca delle etichette brevi, ritorno a capo dei valori lunghi entro il contenitore, numeri tabulari e formattazione monetaria esatta                                        | Clear                                           |
| Colors        | Token semantici e tema salvia esistenti; axe e controlli del contrasto nei due temi, stato espresso con testo/icone, focus della foundation                                                                                      | Clear                                           |
| UI            | Sorgente del wrapper e vendor gratuito, icone Tabler, spring.smooth per l’apertura della ricerca con ramo reduced motion; stato di ricerca indicato anche con aria-expanded e presenza del campo                                 | Clear                                           |

## Risultati

Nessun rilievo di interfaccia azionabile residuo nel perimetro verificato.

Correzioni durante la verifica: la barra dell’analisi conserva la propria identità tra due modifiche rapide, la URL in preparazione conserva le selezioni successive e il popup mantiene il focus. Le etichette lunghe vengono limitate attraverso lo span applicativo e un contenitore CSS, senza intervenire negli slot Arc. Aggiunto un controllo dei limiti del testo e della chevron entro il pulsante, oltre al controllo dello scroll della pagina.

La ricerca avviene sul server prima di conteggi e paginazione, comprese le pagine successive. Importi e valori aggregati sono ricercabili. Gli export riportano gli stessi risultati. Dati privati e nomi reali mascherati nel portale non influenzano la ricerca. I filtri restano accessibili anche nello stato vuoto.

## Verifica

### Superata

- `pnpm lint`, `pnpm typecheck`, `pnpm check:tokens`, `git diff --check`: verdi.
- `pnpm test`: 276 test in 52 file verdi.
- `pnpm supabase:test`: 1.501 controlli in 35 file verdi, incluse autorizzazioni, ricerca fra colonne, importi, mascheratura, conteggi e scelte remote. Migrazioni 045 e 046 applicate in locale senza reset.
- `pnpm build:cf`: build OpenNext locale verde. `pnpm check:client-secrets`: 187 asset client controllati, nessun segreto server configurato.
- `E2E_BASE_URL=http://localhost:3100 pnpm exec playwright test e2e/list-exports.spec.ts e2e/orders-flow.spec.ts e2e/commissions.spec.ts e2e/portal-flow.spec.ts e2e/import-performance.spec.ts --project=desktop --project=mobile`: 16 passati, due esclusioni intenzionali del workbook reale opzionale.
- `E2E_BASE_URL=http://localhost:3100 pnpm exec playwright test e2e/list-exports.spec.ts e2e/orders-flow.spec.ts --grep 'column filters and page selection|lists filters transitions' --project=tablet --project=laptop`: quattro passati. Filtri, tastiera/focus, ricerca, valori lunghi, selezione e CSV.
- Pagina locale Ordini ispezionata nel browser dell’app: trigger Stato/Brand/Stagione/Cliente sulla riga con Cerca/Nuovo ordine/Esporta CSV; Cerca apre il campo verso sinistra e nasconde i filtri; Escape li ripristina con il focus sull’icona.
- Screenshot di Ordini, Clienti e Analisi nei test, nei due temi. Screenshot del browser locale e artefatti di test conservati fuori dal repository.

### Non verificata

Screen reader manuale, Safari/dispositivi fisici, RTL e pseudo-localizzazione, accento alternativo e motion rallentata al 10% negli strumenti del browser. Il ramo reduced motion e le proprietà logiche sono stati ispezionati nel codice. Non ripetuta la suite browser completa di tutte le route; nessun deploy o collegamento a provider reali per questa richiesta.

## Checklist Arc

- [x] Componenti gratuiti e props documentate; nessun interno Arc esistente modificato.
- [x] Un contenitore di pagina; barra allineata alla tabella e ritorno a capo quando lo spazio manca.
- [x] Etichette italiane, una sola azione primaria autorizzata, azioni secondarie esplicite.
- [x] Token semantici, font/pesi/scale esistenti, icone currentColor, numeri esatti.
- [x] Valori lunghi leggibili, cue della chevron, popup raggiungibile da tastiera, focus della foundation.
- [x] Caricamento/vuoto/errore/successo conservati nelle regioni dati, scelte remote ed export.
- [x] Primo render server-safe, identità stabile della barra, movimento ridotto e stato non affidato alla sola animazione.
- [x] Controlli a 390/768/1024/1440, stress 320 px/testo 200%, target touch almeno 44 px nel perimetro verificato.
- [x] Tema chiaro e scuro salvia.
- [ ] Verifiche manuali e ambienti aggiuntivi elencati sopra.

## Esito

Approve per i sei domini nel perimetro e nelle verifiche dichiarati. Le verifiche manuali elencate restano aperte.
