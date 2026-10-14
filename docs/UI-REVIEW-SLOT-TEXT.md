# Review better-interface: contatori delle tabelle con Slot Text

## Scope and coverage

Flusso dei riepiloghi Clienti/Prodotti e dell'analisi storica stagionale. Next 16.3.8, React 19, CSS con token semantici, Arc gratuito. Consultati AGENTS.md, le convenzioni PLAN.md, DESIGN-GUIDELINES.md, DECISIONS.md, guida Next use-client, API SlotText e le sei skill better-*. Il componente condiviso MoneyMetric applica la scelta a tutte le card sopra le tabelle; le altre route non sono state percorse singolarmente.

| Domain        | Evidence inspected                                                                                                                                                                                                                              | Result                      |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Accessibility | SlotText espone il testo completo, nasconde i rulli e rispetta reduced motion. Annuncio stabile del confronto esistente, periodi da tastiera/focus, axe AA nei due temi in table-metrics.spec.ts.                                               | Clear nel flusso verificato |
| Layout        | Card applicative e container query esistenti in globals.css; screenshot a 390/768/1024/1440, importo lungo e 320 px/testo 200% con fallback completo a capo.                                                                                    | Clear                       |
| Writing       | messages/it.json/tableMetrics, labels/periodi/confronti e missing stagionale; nessuna nuova stringa. Zero reale distinto da importo mancante.                                                                                                   | Clear                       |
| Typography    | MoneyMetric passa la stringa italiana da BigInt a SlotText, senza perdita di centesimi. Tabular-nums e dimensioni/pesi ereditati; media grande 3.333.333.334,00 e stress ingrandimento verificati.                                              | Clear                       |
| Colors        | Superficie, foreground e testo secondario semantici invariati; axe incluso contrasto renderizzato in chiaro/scuro. Nessun nuovo colore applicativo o stato affidato al colore.                                                                  | Clear nel flusso verificato |
| UI polish     | Registry Arc installato senza alterazioni; props documentate, align=end, spins=0, durata smooth e stagger char. Primo render senza ingresso, chiavi interne stabili, aggiornamento ridotto istantaneo. Screenshot Prodotti e analisi sintetica. | Clear                       |

## Findings

No actionable interface findings nel flusso verificato.

## Verification

- `pnpm typecheck`, `pnpm lint`, `pnpm check:tokens`, `git diff --check`: verdi.
- `pnpm build:cf`: build production verde, Worker locale aggiornato su 3100. `pnpm check:client-secrets`: 207 asset client, nessun segreto server configurato.
- `E2E_PWA_PRODUCTION=1 pnpm exec playwright test e2e/table-metrics.spec.ts --project=mobile --project=tablet --project=laptop --project=desktop`: 12/12 verdi. Periodi indipendenti, confronto annuo, filtri/paginazione/vuoto, due temi, axe, tastiera, importi grandi e stress 320 px/testo 200%.
- `E2E_PWA_PRODUCTION=1 pnpm exec playwright test e2e/import-performance.spec.ts --grep 'historical preview' --project=mobile --project=desktop`: 2/2 verdi. Storico sintetico, importi, selezione stagione, filtri, duplicati e rollback. Nessuna importazione del workbook dell'operatore.
- Browser locale dell'app: Prodotti, caricamento, scelta 7 giorni e ritorno al default 30; card leggibili e valori 53, 13,77 euro, 51. Screenshot `/tmp/mdc-slot-text-counters.png` conservato fuori repository. Screenshot dei test ispezionati per i layout stretti.
- **Not verified:** screen reader manuale, Safari/device fisici, RTL/pseudo-localizzazione, forced-colors e animazione rallentata negli strumenti. Nessuna nuova esecuzione dell'intera suite unit/SQL o di tutte le route: schema/query/RLS e logica di aggregazione invariati.

## Verdict

**Approve**, limitatamente al flusso e alle verifiche descritte.
