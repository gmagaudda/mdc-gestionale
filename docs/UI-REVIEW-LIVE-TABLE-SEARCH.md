# Review: ricerca automatica nelle tabelle

## Scope and coverage

Flusso condiviso ListToolbar: apertura, testo, cancellazione, ricerca server su tutte le pagine, chiusura e ripristino filtri, azioni e rimozione delle note sotto le metriche. Verifica runtime su Clienti e Fatture; sorgente della variante Analisi con parametro search e delle metriche stagionali. Next 16.3.8, React, next-intl, Arc gratuito e token del prodotto. Consultati AGENTS.md, docs Next locali useRouter/Link, DESIGN-GUIDELINES.md, USER-GUIDE.md, API Arc Input/SearchField/ExpandingSearch e tutti i sei skill better-*. Review better-interface del flusso completato.

| Domain        | Evidence inspected                                                                                                                                                                                          | Result                      |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Accessibility | ListToolbar: label collegata, descrizione, search landmark, focus mantenuto durante aggiornamento, Escape con ritorno al pulsante, aria-expanded/aria-busy; suite selezione con axe nei due temi e tastiera | Clear nel flusso verificato |
| Layout        | CSS applicativo, input e icona di pari altezza e coordinata verticale nei quattro viewport; Fatture nel browser: 50 px e stesso bordo superiore; nessuna nota residua                                       | Clear                       |
| Writing       | messages/it.json, hint aggiornato per la ricerca automatica; guida coerente con apertura/chiusura; eliminati i paragrafi sotto le card temporali e stagionali                                               | Clear                       |
| Typography    | Font ereditato, scala semantica, 16 px su pointer coarse; suite esistente 320 px/testo 200%, nessuna label visibile che aumenti l’altezza                                                                   | Clear                       |
| Colors        | Token --surface/--foreground/--text-muted/--border-strong, axe chiaro/scuro; coppie Lab neutre lette nel browser chiaro: testo su fondo 19,67:1, placeholder 7,13:1                                         | Clear nei temi verificati   |
| UI            | API Arc consultate: label obbligatoria visibile, nessuna prop per nasconderla; fallback input nativo con token applicativi, Arc immutato; spring smooth/reduced motion mantenuti solo per apertura          | Clear                       |

## Findings

No actionable interface findings nel flusso ispezionato. I limiti preesistenti dei piccoli target interni Arc FilterToolbar restano registrati nella relativa review; non sono modificati da questo intervento.

## Verification

- Typecheck, lint, token, Prettier e diff: verdi. Build OpenNext completata, scanner client 213 asset senza segreti server configurati. App workerd aggiornata su localhost:3100.
- `E2E_BASE_URL=http://localhost:3100 pnpm exec playwright test e2e/list-exports.spec.ts --grep 'live table search' --project=mobile --project=tablet --project=laptop --project=desktop`: 4/4 verdi sulla versione finale. Ricerca senza Invio, stato vuoto e cancellazione, conservazione filtri/ordinamento, pagina azzerata, CSV coerente, focus e chiusura/riapertura, cronologia senza una voce per ogni testo, Clienti e Fatture. Misurate altezza e posizione input/icona. Nella prima esecuzione il test cercava «0 elementi» mentre lo stato vuoto usa «Nessun elemento»: corretta l’aspettativa.
- Suite esistente `--grep 'column filters and page selection' --project=mobile --project=desktop`: 2/2 verdi; due temi, axe, tastiera, selezione/CSV/paginazione e stress 320 px/testo 200%. Eseguita prima dell’ultimo rafforzamento della conservazione della bozza durante richieste pendenti; i quattro casi automatici sono stati ripetuti dopo tale modifica.
- Browser Fatture: input e pulsante alti 50 px e allineati; nessun overflow a 1440 px, label accessibile e focus con bordo visibile. Screenshot finale `/tmp/mdc-live-table-search.png`, fuori repository. Scheda temporanea chiusa e viewport ripristinato.

Not verified: screen reader manuale, Safari/dispositivi fisici, RTL/pseudo-localizzazione, forced colors, animazioni rallentate, composizione IME reale, rete lenta/errore indotti, flusso Analisi completo e suite di tutte le route. Nessuna migrazione o verifica SQL necessaria per questo intervento UI; query di ricerca e calcoli restano quelli esistenti.

## Verdict

Approve nei sei domini e nel flusso ispezionati. Nessun HIGH residuo introdotto; limiti preesistenti Arc invariati.
