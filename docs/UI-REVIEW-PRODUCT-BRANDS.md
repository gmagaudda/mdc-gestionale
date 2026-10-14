# Review: navigazione dei brand nella lista Prodotti

## Scope and coverage

Flusso Prodotti: tutti i brand, selezione, ricerca, ordinamento, paginazione, contatori, export e recupero da filtro invalido. Next 16.3.8, React, next-intl, Arc gratuito, token applicativi. Consultati AGENTS.md, guida Next locale, DESIGN-GUIDELINES.md, DECISIONS.md, i sei skill better-* e API Arc Page Header/Tabs. Il block Page Header è statico e non espone props per dati reali; le sue istruzioni consigliano Tabs per sola navigazione. Review better-interface del flusso, senza estendere la valutazione alle altre route.

| Domain        | Evidence inspected                                                                                                                                                             | Result                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| Accessibility | Tabs Radix, ARIA, manual activation, frecce/Enter, focus, localizzazione scroll, caricamento/stato selezionato; axe nei due temi su quattro viewport, stress 320 px/testo 200% | Un limite MEDIUM sotto; nessun HIGH residuo  |
| Layout        | Wrapper applicativo con container query e label limitata allo spazio; track Arc, full label, card e tabella su 390/768/1024/1440 e stress                                      | Clear, nessun overflow del documento         |
| Writing       | messages/it.json: Tutti i brand, selezione, scorrimento, caricamento, filtro non disponibile con link di recupero                                                              | Clear                                        |
| Typography    | Etichette Inter, valori Geist esistenti, nome completo nel riepilogo, importi in centesimi                                                                                     | Clear                                        |
| Colors        | Selezione Arc con token, dati/etichette reali e aria-selected; axe nei temi chiaro/scuro                                                                                       | Clear                                        |
| UI            | Catalogo gratuito e props documentate; motion/reduced motion native, trigger 44 px tramite token applicativo; fix vendor asChild autorizzato dall'umano                        | Un limite MEDIUM condiviso con accessibility |

## Findings

| Severity | Domain        | Location                               | Before                                | After                                      | Why                                                                                                                                                                                                                                      |
| -------- | ------------- | -------------------------------------- | ------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MEDIUM   | Accessibility | components/arc/tabs/tabs.module.css:10 | Pulsanti laterali nativi larghi 33 px | Correzione upstream Arc verso target 44 px | Rispettano il minimo AA di 24 px ma non il requisito touch del progetto. Non modificati: l'eccezione autorizzata riguarda solo il bug render/asChild. Le linguette principali sono almeno 44 px e la navigazione da tastiera è completa. |

## Verification

- `pnpm typecheck`, `pnpm lint`, `pnpm check:tokens`, `git diff --check`, build OpenNext production verdi. Scanner di 213 asset client senza segreti server configurati.
- `pnpm exec supabase test db supabase/tests/035_list_exports.sql supabase/tests/039_table_metrics.sql supabase/tests/040_product_brand_navigation.sql`: 146/146 verdi. UUID, brand attivo/archiviato, ricerca e filtri combinati, centesimi, CSV e selezione fuori brand, sessione/RLS/ruoli. Corretta una vecchia aspettativa SQL non isolata dalle fixture già presenti, limitandola al proprio ID.
- Unit export/metriche: 4/4 verdi. Migrazione 20261014004900 applicata localmente senza reset, tipi rigenerati.
- `E2E_BASE_URL=http://localhost:3100 pnpm exec playwright test e2e/product-brand-navigation.spec.ts --project=mobile --project=tablet --project=laptop --project=desktop`: 4/4 verdi. Oltre una pagina di prodotti, brand vuoto/archiviato, metriche/CSV, URL/reload/search/sort/page, selezione da tastiera, axe nei due temi e stress 320 px/testo 200%. Il test attende la fine dell'uscita del pannello Arc prima di interrogare controlli duplicati transitori.
- Browser locale: Brand dimostrativo selezionato, tre prodotti, prezzo medio 76,57 €, un brand rappresentato, quattro colonne senza Brand, nessun overflow a 1440. Screenshot `/tmp/mdc-products-brand-navigation.png`, fuori repository.
- Pulizia locale: 20 brand attivi, 282 archiviati con audit, nessuna cancellazione di ordini o prodotti. Fixture browser rimosse dopo le prove.

Not verified: screen reader manuale, Safari/device fisici, RTL/forced colors, pseudo-localizzazione, errore di rete indotto, motion rallentata e suite completa di tutte le route. Loading/error/retry esistenti verificati nel sorgente. Eccezione di compilazione Arc autorizzata esplicitamente: una riga sostituisce render con asChild e figlio motion.div; gli altri interni restano originali.

## Verdict

Approve nei sei domini e nel flusso ispezionato. Nessun HIGH residuo. Requisito 44 px incompleto sui soli pulsanti di scorrimento nativi Arc, registrato sopra.

## Aggiornamento: barra brand come riga sopra la tabella

Richiesta umana successiva: spostare la navigazione sotto i filtri, immediatamente prima della tabella. La composizione server ListView avvolge ora soltanto la regione dati in ProductBrandTabs; contatori e toolbar precedono il tablist nel DOM. Ogni linguetta mantiene il pannello relativo alla tabella, senza spostamenti CSS o modifiche agli interni Arc.

Review better-interface del medesimo flusso nei sei domini: accessibility (tastiera/ARIA/axe), layout (ordine DOM e quattro viewport, stress 320 px/testo 200%), writing (etichette e recupero invariati), typography (nomi lunghi e nome completo), colors (axe nei due temi e token invariati), UI (composizione Arc e reduced motion). Nessun nuovo finding; limite delle frecce native già registrato sopra.

Typecheck/lint/token/diff/build production e scanner client 213 asset verdi. Suite browser esistente product-brand-navigation ripetuta sui quattro viewport: 4/4 verdi, CSV/filtri/paginazione/metriche/tastiera/temi e stress. Controllo visivo locale della sequenza toolbar → brand → tabella, screenshot `/tmp/mdc-product-brands-table-row.png`. Nessun nuovo test, migrazione o intervento sui dati. Non ripetute suite SQL/unit/tutte le route e verifiche manuali di screen reader/Safari/device/RTL/forced colors/motion rallentata/errori di rete. Approve entro il flusso verificato, con il limite nativo già documentato.

## Aggiornamento: riga senza bordo e senza riepilogo

Rimosso il paragrafo «Prodotti: …». Token applicativi sul solo wrapper della riga rendono trasparenti i bordi Arc, usano il fondo della pagina e disattivano l'ombra della selezione. Il pannello, tramite className documentata, ha margine iniziale zero; la riga è adiacente alla superficie della tabella. Sorgenti Arc immutati. La selezione conserva pill, testo accentato, aria-selected e focus da tastiera. Le etichette applicative mostrano il nome completo a capo quando selezionate o con focus-visible, senza reintrodurre il riepilogo.

Review better-interface del flusso nei sei domini: accessibility (nomi/ruoli/focus/axe e tastiera), layout (contenimento e adiacenza nei quattro viewport, stress 320 px/testo 200%), writing (eliminazione del riepilogo ridondante), typography (valori completi in linguetta), colors (token e due temi), UI (superficie senza bordo, focus e reduced motion Arc). Nessun nuovo finding. Limite 33 px delle frecce native invariato.

Typecheck/lint/token/diff/build production e scanner client verdi. Suite esistente brand-navigation 4/4 su 390/768/1024/1440, con aspettativa aggiornata sul nome completo della linguetta; eliminata una race del test attendendo il focus dopo ArrowRight prima di spostarlo e premere Enter. Verifica visiva della versione finale e screenshot `/tmp/mdc-product-brands-borderless.png`. Nessun nuovo test, schema o dato business. Verifiche escluse come nell'aggiornamento precedente. Approve entro il flusso ispezionato, con il limite nativo già registrato.

Misura finale dopo l'ultima correzione di precedenza CSS: bordo della riga `rgba(0, 0, 0, 0)`, nessun elemento product-brand-selection; distanza fra fine riga e inizio table pari a 1 px (il bordo della superficie della tabella) su 390/768/1024/1440, nessun overflow del documento. La sola correzione finale del margine è stata verificata nel browser nei quattro viewport dopo la build; la suite funzionale precedente aveva già verificato il flusso.
