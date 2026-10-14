# Review: sidebar, colonna ordinata e notifiche

## Scope and coverage

Flusso Ordini con sidebar ridotta e colonna ordinata, tabella condivisa e menu utente dopo un errore push sintetico. Next 16.3.8, React, next-intl, Arc gratuito e token del prodotto. Consultati AGENTS.md, guida locale use-client, DESIGN-GUIDELINES.md, API Arc SortableDataTable e i sei skill better-* già caricati nella conversazione. Review better-interface limitata a questi controlli; nessuna nuova funzione business.

| Domain        | Evidence inspected                                                                                                                                                       | Result                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| Accessibility | Pulsanti sidebar nativi con nomi e 44×44 px; aria-sort/freccia conservati; notifiche con aria-checked e retry, consenso non scritto in caso di errore; axe nei due temi  | Clear nel flusso verificato |
| Layout        | Icone ricerca/toggle con stessa coordinata orizzontale e posizioni verticali consecutive a 768/1024/1440; nessun overflow; tabelle a 390/1440 e stress 320 px/testo 200% | Clear                       |
| Writing       | Rimosso il messaggio richiesto anche da tooltip e descrizione del menu; stato attivo/inattivo corretto, conferma revoca mantenuta                                        | Clear                       |
| Typography    | Nessuna nuova tipografia; etichette delle colonne, dati e stato accessibile invariati; stress nella suite esistente                                                      | Clear                       |
| Colors        | Token --surface-muted mappato a --accent-subtle solo nel wrapper data-table; sfondo della colonna Ordini uguale al token dell’accento nel browser, axe chiaro/scuro      | Clear nei temi verificati   |
| UI            | Colonna evidenziata mediante token applicativo già consumato da Arc; sidebar in colonna solo quando ridotta, nessun cambiamento a vendor o animazioni                    | Clear                       |

## Findings

No actionable interface findings nel flusso ispezionato. L’assenza del messaggio di errore push è richiesta dall’umano: lo stato non dichiara un’attivazione riuscita quando la scrittura fallisce, e la voce Notifiche conserva il percorso per riprovare. I limiti dei piccoli target interni Arc già documentati restano invariati.

## Verification

- Typecheck, lint, token e diff verdi. Build OpenNext completata; scanner client 213 asset senza segreti server configurati. App workerd aggiornata su localhost:3100.
- `E2E_BASE_URL=http://localhost:3100 E2E_PWA_PRODUCTION=1 pnpm exec playwright test e2e/push.spec.ts --grep 'device revocation' --project=mobile --project=desktop`: 2/2 verdi. Errore di scrittura forzato: nessun alert o feedback errore, stato inattivo e nessun consenso nel database; retry, attivazione, reload e revoca funzionanti. Solo fixture sintetiche, nessuna notifica reale.
- Suite esistente `e2e/list-exports.spec.ts --grep 'column filters and page selection' --project=mobile --project=desktop`: 2/2 verdi, sorting, selezione, CSV, paginazione, temi/axe e stress 320 px/testo 200%.
- Browser Ordini, 768/1024/1440: toggle e ricerca 44×44 px, stessa x e distanza verticale 44 px, nessun overflow. Colonna Data ordine con fondo --accent-subtle; screenshot `/tmp/mdc-sidebar-accent-column.png`, fuori repository. Scheda temporanea chiusa e viewport ripristinato.

Not verified: screen reader manuale, Safari/device fisici, RTL/pseudo-localizzazione, forced colors, animazioni rallentate, ogni palette alternativa e tutte le route. Nessuna migrazione, modifica SQL o scrittura business reale.

## Verdict

Approve nei sei domini e nel flusso ispezionati. Nessun HIGH residuo introdotto.

## Revisione: tinta più tenue (15 ottobre 2026)

Scope: solo intensità dello sfondo della colonna ordinata nel wrapper condiviso. Tinta miscelata in OKLab: 35% --accent-subtle e 65% --surface. Vendor, interazioni, geometria e stringhe invariati.

| Domain        | Evidence inspected                                                                                       | Result                    |
| ------------- | -------------------------------------------------------------------------------------------------------- | ------------------------- |
| Accessibility | Freccia/aria-sort conservati; axe nei due temi nel test esistente                                        | Clear                     |
| Layout        | Solo token colore modificato; browser Ordini a 1440 px senza overflow, stress 320 px/testo 200% nel test | Clear                     |
| Writing       | Nessuna nuova stringa, convenzioni aggiornate                                                            | Clear                     |
| Typography    | Stili di testo invariati, test di ingrandimento esistente                                                | Clear                     |
| Colors        | Color-mix con token semantici; sfondo Brand verificato nel browser, axe chiaro/scuro                     | Clear nei temi verificati |
| UI            | Tinta più tenue osservata, interni Arc immutati                                                          | Clear                     |

No actionable interface findings. Token/Prettier/diff/build OpenNext/scanner client verdi; suite esistente liste/selezione/CSV desktop 1/1 verde nei due temi, axe, tastiera e stress. Nessun nuovo test per questa modifica cromatica. Screenshot `/tmp/mdc-soft-column-accent.png`, scheda temporanea chiusa e viewport ripristinato. Altri viewport, tutte le palette, screen reader manuale, Safari/device fisici, RTL/forced colors non ripetuti. Approve nel flusso verificato.
