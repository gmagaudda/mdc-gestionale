# Review better-interface: periodo, menu diretto e accento

## Scope and coverage

Flusso completo dei periodi nelle card Clienti/Prodotti e preferenze dall’avatar, nella sidebar estesa/compatta e nella navigazione mobile. Next 16.3.8, React 19, CSS semantico, componenti Arc gratuiti, Radix e NumberFlow. Consultati AGENTS.md, PLAN.md, DESIGN-GUIDELINES.md, DECISIONS.md e tutte le sei skill owning better-*. Documentazione/API Arc di SplitButton, IconMorph, UserMenu, Popover, RadioGroup e ColorPicker consultata prima delle decisioni. Review di questo flusso, non dell’intera applicazione o di un diff generico.

| Domain        | Evidence inspected                                                                                                                                                                                                                                                                                                                                                                                 | Result                      |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Accessibility | components/shared/account-menu.tsx:59, components/shared/metric-period.tsx:35, components/pwa/use-push-toggle.ts, e2e/theme.spec.ts, push.spec.ts, table-metrics.spec.ts. Checkbox di menu, focus restituito alle voci e all’avatar, scelta con radio/frecce, Escape, nome italiano, consenso esplicito e revoca, errore/retry, offline, target touch, focus visibile nativo, axe AA nei due temi. | Clear nel flusso verificato |
| Layout        | app/globals.css:881 e :1014; card senza colonna di selettori esterna, Popover ancorato all’avatar e dimensionato entro viewport, 390/768/1024/1440 e stress 320 px/testo 200%. Sidebar compatta verificata nel browser locale.                                                                                                                                                                     | Clear                       |
| Writing       | messages/it.json, USER-GUIDE.md; etichette Aspetto/Notifiche/Accento, scelte giorni, stato sul dispositivo, errore con recupero tramite stessa voce. Nessuna scelta Sistema nel menu o pannello per le due azioni dirette.                                                                                                                                                                         | Clear                       |
| Typography    | money-metric.tsx, AnimatedNumber/AnimatedMoney; formato italiano esatto, numeri tabulari, font/pesi del sistema, importi grandi interamente raggiungibili e testo ingrandito.                                                                                                                                                                                                                      | Clear                       |
| Colors        | lib/theme/sage.css, palette nel menu e otto coppie tema/accento in theme.spec.ts. Canvas composita le tinte trasparenti sopra la superficie effettiva. Testi accentati, navigazione attiva, pulsante primario e controllo selezionato misurati: tutte le coppie >=4,5:1. Calcolo dei 28 valori OKLCH distinti del prodotto: nessuno fuori sRGB. Etichetta e checked oltre al colore.               | Clear                       |
| UI polish     | Sorgenti Arc installati immutati, props documentate. IconMorph tema/campanella a stato stabile, NumberFlow e ramo movimento ridotto; popup e gruppi compatti. Nessuna animazione applicativa nuova.                                                                                                                                                                                                | Clear                       |

## Findings

No actionable interface findings nel flusso verificato. Correzioni applicate durante la verifica:

- Escape del menu mobile conserva la navigazione e ritorna all’avatar. Escape della palette è controllato dal wrapper, per i contesti DismissableLayer distinti delle versioni Radix installate.
- Palette con focus contenuto, ritorno all’avatar e larghezza che prevale sul minimo del registry tramite className documentata. A 320 px/testo 200% tutte le scelte rimangono entro il viewport.
- La sidebar compatta non mostra il messaggio ridondante di stato inattivo che spostava l’avatar verso l’alto. Conferme/errori/disponibilità restano inline e la voce conserva checked/descrizione accessibile.
- Forte blu ridotto in cromia per mantenere i token dentro sRGB. Misura del neutro trasparente corretta compositando il fondo, senza cambiare colori per un falso contrasto.
- Gli audit aspettano l’effettiva rimozione dal DOM del menu Arc in uscita, anche quando è già aria-hidden; non misurano il contrasto a metà dissolvenza.

## Verification

- `pnpm test`: 279 test in 53 file, verdi. `pnpm typecheck`, `pnpm lint`, `pnpm check:tokens`, `git diff --check`: verdi.
- `pnpm build:cf`: build production Workers locale verde. `pnpm check:client-secrets`: 203 asset controllati, nessun segreto server configurato nel client.
- `E2E_PWA_PRODUCTION=1 pnpm exec playwright test e2e/table-metrics.spec.ts e2e/theme.spec.ts e2e/push.spec.ts --project=mobile --project=tablet --project=laptop --project=desktop`: 32 casi verdi per metriche/menu/tema/notifiche; quattro casi palette hanno individuato il minimo CSS a testo 200%. Dopo la correzione di sola larghezza e nuova build, `e2e/theme.spec.ts --grep 'accent palette'` negli stessi quattro progetti: **4/4 verdi**, includendo gli otto accenti/temi, axe, persistenza al primo contenuto, storage invalido, focus/Escape e stress. Complessivamente 36 casi pertinenti verificati, non un’affermazione che la prima esecuzione fosse tutta verde.
- `E2E_PWA_PRODUCTION=1 pnpm exec playwright test e2e/pwa.spec.ts e2e/import-performance.spec.ts --grep 'install entry|historical preview' --project=mobile --project=desktop`: **4/4 verdi** sulla build conclusiva. Installazione iOS/prompt differito e storico sintetico con persistenza, filtri, metriche stagionali, duplicati e rollback. Totale 40 casi pertinenti verificati almeno una volta.
- Browser locale dell’app: periodo dentro le tre card, tema diretto e icona/stato, menu utente e palette vicina all’avatar. Nessun consenso reale alle notifiche o invio push; test con browser/endpoint sintetici e fixture locali rimosse.
- **Not verified:** screen reader manuale, Safari/dispositivi fisici, RTL/pseudo-localizzazione, forced-colors e motion rallentata negli strumenti. Non ripetuta tutta la suite di ogni route o la suite SQL; nessuna migrazione/query/RLS modificata.

## Verdict

**Approve**, limitatamente al flusso e alle verifiche descritte nei sei domini. I gate esterni del piano già registrati restano aperti.
