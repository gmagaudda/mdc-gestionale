# Review del flusso filtri Arc

## Scope and coverage

Flusso completo: aggiungere campo/valore, cercare valori oltre le prime 50 opzioni, rimuovere un chip, azzerare i filtri, recuperare un errore e tornare alla ricerca generale. Liste interne, ordini, fatture, provvigioni, liste del portale e analisi storica ricevono la composizione condivisa. Esclusi dashboard, editor e filtri dei rami di errore senza tabella.

Next 16.3.8, React, next-intl, CSS/token semantici, componenti Arc gratuiti. Consultati AGENTS.md, PLAN.md, DESIGN-GUIDELINES.md, documentazione Next locale, catalogo/API Arc e i sei skill better-*; applicato better-interface. Review del flusso implementato, non una review di un intervallo Git.

| Domain        | Evidence inspected                                                                                                                                    | Result                                |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Accessibility | FilterToolbar e wrapper: menu, radio, annunci italiani, dialog, focus dopo rimozione/Escape, errore/retry; axe nei due temi; stress 320 px/testo 200% | Una limitazione nei target nativi Arc |
| Layout        | ListToolbar, globals.css, azioni, chip lunghi, menu aperto/chiuso e quattro viewport; screenshot nel browser locale                                   | Clear                                 |
| Writing       | messages/it.json, microcopy del registry localizzata al confine applicativo, hint completi, stato vuoto, retry e guida                                | Clear                                 |
| Typography    | Token Arc, nomi lunghi e valori monetari italiani; chip abbreviati con hint/title/nomi accessibili completi e riepilogo leggibile sotto stress        | Clear                                 |
| Colors        | Token esistenti e stati selezionati Arc, contrasto axe chiaro/scuro; nessun colore locale aggiunto                                                    | Clear                                 |
| UI            | Sorgenti Arc immutate, props documentate, chiavi stabili e ramo reduced-motion del registry; menu, caricamento Skeleton, Alert recuperabile           | Clear                                 |

## Findings

| Severity | Domain        | Location                                                   | Before                                                    | After                                                                                          | Why                                                                                                                                                                           |
| -------- | ------------- | ---------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MEDIUM   | Accessibility | components/arc/filter-toolbar/filter-toolbar.module.css:15 | Rimozione chip 24 px, ritorno ai campi 28 px nel registry | Richiede API upstream per dimensionare questi target senza modificare/restilizzare gli interni | Rispettano il minimo AA di 24 px, ma non il target progettuale di 44 px. Aggiungi filtro/ricerca/creazione/export usano 44 px. Verifica di tutti i target a 44 px incompleta. |

Durante l'implementazione corretti menu chiuso che estendeva lo scroll orizzontale, valori lunghi che coprivano il pulsante di rimozione e perdita del focus durante la navigazione in attesa. Correzioni applicative: clip del solo contenitore chiuso, props chip abbreviate con valori completi raggiungibili, identità stabile della lista dei chip. Nessuna modifica CSS o sorgente interna Arc.

## Verification

- `pnpm typecheck`, `pnpm lint`, `pnpm check:tokens`, `git diff --check`: verdi.
- `pnpm build:cf`: build OpenNext production completata. `pnpm check:client-secrets`: 209 asset, nessun segreto server configurato trovato.
- `E2E_PWA_PRODUCTION=1 pnpm exec playwright test e2e/list-exports.spec.ts --grep 'column filters|Arc filter' --project=desktop`: tre casi verdi nella verifica finale. Valori oltre 50, filtro monetario, CSV, query/sort conservati, selezione pagina, focus, error/retry, dark/light e stress 320 px/testo 200%.
- Le stesse tre prove su mobile/tablet/laptop sono verdi nell'esecuzione precedente (nove casi). Il precedente fallimento desktop nello stress misurava tutti i controlli contemporaneamente in una barra più alta del viewport; verifica finale misura ciascun controllo dopo averlo portato a fuoco, senza rimuovere i controlli di visibilità/hit testing.
- `E2E_PWA_PRODUCTION=1 pnpm exec playwright test e2e/orders-flow.spec.ts e2e/import-performance.spec.ts e2e/portal-flow.spec.ts e2e/commissions.spec.ts --grep 'lists filters transitions|historical preview|brand reads|filters commissions' --project=mobile --project=desktop`: sei casi ordini/storico/portale verdi. Provvigioni: altri due casi verdi, ripetuti separatamente mobile/desktop dopo aggiornamento del selettore ambiguo fra card e tabella e delle attese delle etichette complete; filtro stagione/rimozione e file Excel/CSV verificati.
- Browser locale: Prodotti filtrato per prezzo 39,90 €, risultato Camicia dimostrativa; chip, ricerca, Nuovo prodotto ed Esporta CSV nella stessa riga. Screenshot fuori repository, scheda temporanea chiusa.

Not verified: screen reader manuale, Safari/device fisici, forced colors, RTL/pseudo-localizzazione, motion rallentata; suite completa SQL/unit e walkthrough di ogni route non ripetuti per questo intervento UI. Reduced motion verificato nel sorgente Arc. Il limite dei piccoli target nativi è dichiarato sopra.

## Verdict

Approve per il flusso e i sei domini ispezionati: nessun HIGH residuo. Resta il MEDIUM dei target nativi Arc, che richiede supporto upstream compatibile con la regola di non modificare gli interni.

## Correzione altezza e sidebar (14 ottobre 2026)

Scope: altezza della composizione condivisa dei filtri e sidebar su Fatture, con controllo notifiche nel menu utente. Review better-interface applicata al flusso dopo le correzioni; sorgenti Arc immutati. Rimossi il sottotitolo del logo e il feedback persistente di attivazione notifiche. Icona e `aria-checked` conservano lo stato; errori recuperabili e conferma di revoca rimangono.

| Domain        | Evidence inspected                                                                                                                            | Result                                                                                                                   |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Accessibility | Controlli interni 44 px, stato menuitemcheckbox e prove push sintetiche mobile/desktop con errore/retry/attivazione/revoca e axe nei due temi | Nessuna nuova criticità; limite nativo X/back già registrato                                                             |
| Layout        | Misure DOM su Fatture a 390/768/1024/1440, filtro vuoto e Stato: Emessa; screenshot                                                           | Barra 50 px come ricerca/export su una riga; 104 px quando Arc dispone due righe a 390 px. Nessun overflow del documento |
| Writing       | app-navigation.tsx e account-menu.tsx, stringhe esistenti messages/it.json                                                                    | Solo MDC visibile; nessun messaggio di attivazione persistente; feedback di errore/revoca conservati                     |
| Typography    | Token delle altezze/spazi, logo e chip renderizzati                                                                                           | Nessun nuovo formato o dimensione del testo                                                                              |
| Colors        | Solo token esistenti; axe chiaro/scuro nel flusso push                                                                                        | Nessun colore aggiunto o cambiato                                                                                        |
| UI            | Padding calcolato dai token delle altezze meno i due bordi; variante compatta con stessa altezza; screenshot locale                           | Allineamento verificato, crescita naturale a capo, nessuna modifica agli interni Arc                                     |

Verification: `pnpm typecheck`, `pnpm lint`, `pnpm check:tokens`, Prettier, `git diff --check`, build OpenNext e scanner client 209 asset verdi. `E2E_PWA_PRODUCTION=1 pnpm exec playwright test e2e/push.spec.ts --grep 'device revocation' --project=mobile --project=desktop`: 2/2 verdi, con aspettativa aggiornata sull'assenza del messaggio di attivazione. Attivazione soltanto sintetica, nessun consenso/push reale richiesto. Screenshot `/tmp/mdc-filter-height.png` fuori repository.

Not verified in questa correzione: walkthrough di tutte le liste, screen reader manuale, Safari/device fisici, RTL/forced-colors, nuovo stress 320 px/testo 200%, suite SQL/unit e regressione completa. Gli stati non legati alle dimensioni mantengono la copertura della review precedente. Verdict: Approve entro questo scope, nessun nuovo finding; limite MEDIUM dei target nativi invariato.
