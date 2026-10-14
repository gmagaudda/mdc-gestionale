# Review better-interface: card dell'anteprima Slot Text Arc

## Scope and coverage

Riepiloghi Clienti/Prodotti e Analisi stagioni. Next 16.3.8, React 19, token semantici e componenti Arc gratuiti. Consultati AGENTS.md, PLAN.md, convenzioni/design/decisioni del progetto, guida Next use-client, sei skill better-* e API SlotText/SegmentedControl. Anteprima originale letta nel browser, inclusa la composizione CSS pubblica del demo. Le altre liste ricevono la superficie condivisa; non sono state percorse tutte singolarmente.

| Domain        | Evidence inspected                                                                                                                                                                                                                                         | Result                      |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Accessibility | MetricPeriod, SegmentedControl Arc, MoneyMetric e confronti role=status. Periodi esclusivi aria-pressed, frecce/Home/End, focus e target 44 px, reduced motion, axe nei due temi.                                                                          | Clear nel flusso verificato |
| Layout        | globals.css, screenshot desktop e storico mobile; card allineate, periodi in basso, display 52 px. ResizeObserver mostra l'importo intero a capo quando non entra; 320 px/testo 200% e track scrollabile con bordi segnalati e selezione portata in vista. | Clear                       |
| Writing       | tableMetrics in messages/it.json e guida aggiornata. Selezione giorni/stagioni senza dropdown, zero distinto da assenza, confronto e valore precedente conservati.                                                                                         | Clear                       |
| Typography    | Geist display peso 400 e numeri tabulari, formato italiano BigInt esatto. Media grande 3.333.333.334,00 e ritorno a capo sotto stress.                                                                                                                     | Clear                       |
| Colors        | Token semantici invariati, punto neutro, variazione reale in accent sulla superficie. Axe chiaro/scuro; stessa coppia accent/surface già misurata nella review DIRECT-CONTROLS. Nessun nuovo colore.                                                       | Clear nel flusso verificato |
| UI polish     | Composizione dell'anteprima, SlotText con un giro, SegmentedControl con pill e movimento ridotto; nessuna modifica vendor. Rimossi dropdown, ramo touch e relativi stili.                                                                                  | Clear                       |

## Findings

No actionable interface findings nel flusso verificato.

## Verification

- Typecheck/lint/token/build OpenNext: verdi. Scanner client 205 asset senza segreti server configurati. `git diff --check` ripetuto dopo formattazione delle note.
- `E2E_PWA_PRODUCTION=1 pnpm exec playwright test e2e/table-metrics.spec.ts --project=mobile --project=tablet --project=laptop --project=desktop`: esecuzione finale **12/12 verdi**. Periodi indipendenti e senza menu, confronto, filtri/pagine/vuoto, tastiera/focus, due temi/axe, importi grandi e stress 320 px/testo 200%. Prima esecuzione: 8 verdi e quattro controlli troppo anticipati sul track in movimento; il controllo ora seleziona da tastiera e aspetta che Arc porti il segmento in vista prima di misurarne i limiti. Nessun fallimento lasciato aperto.
- `E2E_PWA_PRODUCTION=1 pnpm exec playwright test e2e/import-performance.spec.ts --grep 'historical preview' --project=mobile --project=desktop`: **2/2 verdi**, storico sintetico con selezione stagionale, filtri, persistenza, duplicati e rollback.
- Browser locale: card Prodotti confrontate con l'anteprima Arc, valori 53 / 13,77 euro / 51, periodi segmentati visibili. Screenshot `/tmp/mdc-arc-metric-cards.png`; screenshot test desktop con variazioni e storico mobile ispezionati.
- **Not verified:** screen reader manuale, Safari/device fisici, RTL/pseudo-localizzazione, forced-colors, motion rallentata, errore metriche indotto. Nessuna nuova esecuzione completa unit/SQL o di tutte le route; schema/query/RLS invariati.

## Verdict

**Approve**, limitatamente al flusso verificato nei sei domini.
