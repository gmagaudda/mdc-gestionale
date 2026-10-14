# Review: periodi delle metriche e bordo del filtro

## Scope and coverage

Flusso delle card condivise sopra le tabelle: Settimana, Mese, Anno, Totale, valori e confronto; pulsante Aggiungi filtro chiuso/aperto e focus da tastiera su Ordini. Next 16.3.8, React, next-intl, Arc gratuito e token applicativi. Consultati AGENTS.md, guida Next locale use-client, DESIGN-GUIDELINES.md, DECISIONS.md, API Arc FilterToolbar/SegmentedControl e i sei skill better-*. Review better-interface del flusso completato. Storico Excel escluso dai periodi temporali: conserva il confronto SS/FW accettato.

| Domain        | Evidence inspected                                                                                                                                                                                               | Result                                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Accessibility | SegmentedControl con quattro etichette, aria-pressed, frecce, focus e annunci; test nei quattro viewport, axe chiaro/scuro, stress 320 px/testo 200%; filtro aperto da ArrowDown e chiuso con Escape nel browser | Clear entro il flusso; limite nativo X/back già registrato nella review Filter Toolbar                     |
| Layout        | Card, selettori e importi grandi su 390/768/1024/1440 e stress; screenshot Ordini, controlli 44 px                                                                                                               | Clear, track Arc contiene lo scroll quando necessario                                                      |
| Writing       | messages/it.json, etichette, nota sui periodi e dettaglio totale; SQL/RPC per significato dei valori                                                                                                             | Clear: 7/30 giorni, 12 mesi di calendario, tutto lo storico filtrato; totale senza falso confronto annuale |
| Typography    | SlotText/BigInt/formatMoney esistenti, etichette corte; importi grandi e testo ingrandito nei test                                                                                                               | Clear, stringhe complete e centesimi conservati                                                            |
| Colors        | Token --border trasparente solo sul menu chiuso, colore originale quando aperto; axe nei due temi                                                                                                                | Clear, nessuna palette nuova                                                                               |
| UI            | Catalogo/API Arc consultati, sorgenti vendor immutati, token nel wrapper applicativo; focus nativo visibile e bordo aperto misurati nel browser                                                                  | Clear, bordo chiuso trasparente senza cambiare il focus                                                    |

## Findings

Nessun nuovo finding nel flusso ispezionato. Il limite preesistente dei target X/back Arc resta documentato in UI-REVIEW-ARC-FILTER-TOOLBAR.md; questo intervento non modifica quei controlli.

## Verification

- Migrazione locale `20261014004800_metric_periods.sql` applicata senza reset. `pnpm exec supabase test db supabase/tests/039_table_metrics.sql`: 54/54 verdi. Confini di settimana/anno, futuro escluso nei periodi limitati e incluso nel totale, aggregati interi, filtri, mascheramento clienti, RLS e permessi verificati.
- `pnpm exec vitest run lib/metrics/schema.test.ts`: 3/3 verdi, incluso confronto assente per total. Typecheck, lint, token, diff e build OpenNext production verdi; scanner client 209 asset senza segreti server configurati.
- `E2E_PWA_PRODUCTION=1 pnpm exec playwright test e2e/table-metrics.spec.ts --project=mobile --project=tablet --project=laptop --project=desktop`: 12/12 verdi. Dati oltre la pagina, selezioni indipendenti, anno/totale con conteggi diversi, assenza del confronto annuale nel totale, ricerca/paginazione, zero risultati, temi/axe, tastiera e importi grandi a testo 200%/320 px.
- Browser locale Ordini: totale 56 corrisponde al contatore lista, selettori Settimana/Mese/Anno/Totale, tutti alti 44 px a 1440. Pulsante chiuso con bordo trasparente; menu aperto col token di bordo originale, Escape ripristina focus-visible con outline solid. Screenshot `/tmp/mdc-week-month-year-total.png`, fuori repository.

Not verified: screen reader manuale, Safari/device fisici, forced-colors, RTL/pseudo-localizzazione, motion rallentata; fixture con data corrente al 29 febbraio non eseguita, pur usando intervalli di calendario. Suite SQL/unit e tutte le route non ripetute. Regola dello storico SS/FW verificata nel sorgente, senza nuovo workbook importato.

## Verdict

Approve nei sei domini e nel flusso ispezionati. Nessun nuovo HIGH residuo; limite preesistente dei piccoli target Arc invariato.
