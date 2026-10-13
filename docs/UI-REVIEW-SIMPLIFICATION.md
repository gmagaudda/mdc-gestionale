# Revisione better-interface: flusso Budget

## Ambito e copertura

Flusso completo **Crea budget → suggerimento → eccezioni → ricalcolo → accettazione → rettifica motivata → salvataggio → provenienza nel dettaglio**. Vuoto, caricamento, errore, anteprima superata e successo inclusi. La review di interfaccia riguarda questo flusso; liste, anagrafiche, PDF e importazione hanno verifiche di regressione separate. Non è una review completa dell'intero gestionale.

Stack e convenzioni: Next 16.3.8, React 19.3, Arc gratuito, CSS semantico, next-intl, Number Flow. Letti AGENTS.md, docs/DESIGN-GUIDELINES.md, le sei skill better-* e il formato better-interface. La semplificazione preserva componenti, props, markup, testi, token e comportamento visibile.

| Dominio       | Evidenza ispezionata                                                                                                                                                                      | Esito                          |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Accessibilità | BudgetForm, BudgetRecommendationPanel, RecommendationSummary; test Enter sul calcolo, focus dell'errore, annunci alert/status, axe nei due temi, movimento ridotto e target ≥44 px        | Clear nel perimetro verificato |
| Layout        | Screenshot mobile e desktop; test 360/390/768/1024/1440, stress 320 px/testo 200% e hit test del ricalcolo; CSS esistente dei campi data e contenitori                                    | Clear nel perimetro verificato |
| Scrittura     | messages/it.json, etichette di conferma/ricalcolo, motivazioni e messaggi di anteprima superata; nessuna stringa cambiata                                                                 | Clear                          |
| Tipografia    | Screenshot del report, numeri tabulari, valuta italiana, font/token condivisi e fallback BigInt; nessuna nuova regola tipografica                                                         | Clear nel perimetro verificato |
| Colori        | Audit axe chiaro/scuro sul flusso Budget e liste; token salvia e stati Arc accompagnati da testo, senza modifiche alla palette                                                            | Clear nel perimetro verificato |
| UI            | Uso diretto degli stessi Input/EmptyState Arc; stato stale/ready/accepted confrontato con le precedenti combinazioni raggiungibili; loading conserva la snapshot e success resta in-place | Clear                          |

## Risultati

No actionable interface findings nel flusso Budget verificato.

Nella suite PDF separata, il primo audit tablet ha intercettato la dissolvenza dell'etichetta del download (3,7:1 durante la transizione). La ripetizione senza modifiche è passata. Il test ora attende le animazioni effettive del pulsante attraverso getAnimations/finished prima dell'audit dello stato concluso, mantenendo gli stessi controlli axe. Nessuna modifica al prodotto o al vendor.

## Verifiche

- `E2E_BASE_URL=http://localhost:3100 E2E_PWA_PRODUCTION=1 pnpm exec playwright test e2e/budget-recommendation.spec.ts e2e/list-exports.spec.ts e2e/pdf.spec.ts e2e/import-performance.spec.ts e2e/brands.spec.ts e2e/customers.spec.ts e2e/theme.spec.ts`: prima esecuzione, 59 passati, 5 skip del workbook opzionale e un audit PDF tablet da stabilizzare. Tutti i cinque casi Budget verdi.
- Screenshot Budget/Clienti mobile e desktop ispezionati dalla prima esecuzione. Report/card, disclosure, ragioni, pulsanti e testi conservati.
- `E2E_BASE_URL=http://localhost:3100 E2E_PWA_PRODUCTION=1 pnpm exec playwright test e2e/pdf.spec.ts --grep "brand summary download"`: 5/5 verdi nei cinque viewport dopo la stabilizzazione, 26,9 secondi. Il caso tablet era passato anche nella ripetizione preliminare senza modifiche. Complessivamente tutti i 60 casi applicabili verificati, con i 5 skip opzionali descritti sopra.
- Typecheck, lint, token e build Workers verdi; output PDF multipagina confrontato prima/dopo normalizzando le sole date tecniche, identico.
- **Not verified:** screen reader manuale, dispositivi fisici, RTL/pseudo-localizzazione, prova con accento neutro alternativo. Nessuna nuova attestazione WCAG completa.

## Verdetto

**Approve** per il flusso Budget e i domini coperti sopra. I controlli manuali elencati restano non verificati; la review non estende il verdetto agli altri flussi.
