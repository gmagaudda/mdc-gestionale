# Review: sidebar, metriche delle liste e paginatore

14 ottobre 2026. Review better-interface del flusso Clienti (ricerca, metriche, paginazione, menu utente), della presentazione monetaria in Prodotti e del confronto stagionale in Analisi. Stack Next.js 16.3.8, React, next-intl, Arc gratuito, CSS applicativo con token semantici. Convenzioni consultate: AGENTS.md, DESIGN-GUIDELINES.md, DECISIONS.md e i sei skill better-*.

Il perimetro riguarda le liste e i report principali. Le tabelle di righe nei dettagli, gli editor e le anteprime di importazione non hanno nuove metriche temporali. Il paginatore condiviso copre anche le anteprime paginate. La review non certifica tutte le route dell'app.

## Scope and coverage

| Domain        | Evidence inspected                                                                                                                                                                                          | Result                      |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Accessibility | AccountMenu, MobileNavigation, ResponsiveDialog, TableMetricCards, TablePagination; axe nei due temi, tastiera, focus, periodi aria-pressed, pagina aria-current, target di 44 px, stress 320 px/testo 200% | Clear nel flusso verificato |
| Layout        | Liste Clienti/Prodotti a 390, 768, 1024 e 1440 px; tre card, selettori indipendenti verticali, menu nel footer; importi molto grandi sotto stress                                                           | Clear                       |
| Writing       | messages/it.json, basi temporali, confronto precedente non disponibile, filtri su tutte le pagine, dati storici mancanti                                                                                    | Clear                       |
| Typography    | Importi italiani esatti, tabular-nums, valori completi a capo; fallback statico nei contenitori stretti                                                                                                     | Clear                       |
| Colors        | Accento salvia selezionato, confronto percentuale neutro, stato espresso anche da testo/ARIA; axe chiaro/scuro e test dei rapporti della palette nella navigazione                                          | Clear                       |
| UI            | Catalogo e props documentate MetricCard, Skeleton, UserMenu, Pagination; sorgenti Arc immutati; NumberFlow con ramo reduced motion esistente, screenshot dell'interfaccia locale                            | Clear                       |

## Findings

No actionable interface findings nel perimetro verificato dopo le correzioni.

Correzioni concluse durante la verifica:

- Menu Arc nel drawer mobile: il portale era sotto il livello del drawer. Navigazione non modale a livello inferiore al portale, pannelli delle preferenze ancora modali; verificati impostazioni, uscita fallita, focus e retry.
- Importi molto grandi: il contenuto animato non può andare a capo. Alternativa statica completa nei contenitori stretti; selettori sotto il contenuto, sempre verticali, sotto stress.
- Diff CSS: ripristinati gli stili condivisi di moduli, skip link, footer delle liste e valori a capo rimossi insieme agli stili dell'intestazione. Rimossi soltanto gli stili del vecchio header e dell'identità sostituita.

## Verification

- `pnpm test`: 279 test verdi in 53 file. Tre nuovi controlli per percentuali, baseline e precisione oltre Number.MAX_SAFE_INTEGER.
- `pnpm supabase:test`: 1.544 controlli verdi in 36 file, inclusi 43 nuovi controlli della RPC delle metriche: sessione/RLS/MFA, finestre temporali, anno precedente, importi, filtri, campi mascherati e oltre 10.000 record.
- `pnpm typecheck`, `pnpm lint`, `pnpm check:tokens`, `git diff --check`, `pnpm build:cf` e `pnpm check:client-secrets`: verdi. Build Workers locale; nessun deploy.
- `E2E_BASE_URL=http://localhost:3100 E2E_PWA_PRODUCTION=1 pnpm exec playwright test e2e/table-metrics.spec.ts --project=mobile --project=tablet --project=laptop --project=desktop`: verifica delle tre casistiche su quattro viewport. Conteggio dell'intero risultato, periodi indipendenti, variazione annua, filtri e paginazione, stato vuoto, due temi, importi grandi e stress testo. Esito conclusivo registrato in PROGRESS.md.
- `E2E_BASE_URL=http://localhost:3100 E2E_PWA_PRODUCTION=1 pnpm exec playwright test e2e/auth.spec.ts e2e/theme.spec.ts e2e/pwa.spec.ts e2e/push.spec.ts e2e/import-performance.spec.ts --project=mobile --project=desktop`: 32 casi verdi, due skip intenzionali del workbook opzionale. Il test sintetico verifica SS27 rispetto a SS26, cambio FW26 e indipendenza della card budget.
- `E2E_BASE_URL=http://localhost:3100 E2E_PWA_PRODUCTION=1 pnpm exec playwright test e2e/workspace-ui.spec.ts --grep 'workspace navigation' --project=mobile --project=desktop`: due casi verdi, gruppi, sidebar compatta, ricerca immediata, Escape, focus e contrasto.
- `E2E_BASE_URL=http://localhost:3100 E2E_PWA_PRODUCTION=1 pnpm exec playwright test e2e/orders-editor.spec.ts --project=mobile --project=desktop`: due casi verdi dopo il ripristino degli stili condivisi; matrice, totali esatti, salvataggio, testo 200%, due temi e filtri inline. Aggiornato il selettore del vecchio menu Filtri, già rimosso nella richiesta precedente.
- Browser locale dell'app: Prodotti, ultima pagina, tre metriche sopra i filtri, menu utente nel footer, header assente e paginatore con pagina attiva salvia. Screenshot ispezionato e conservato fuori dal repository.

**Not verified:** screen reader manuale, Safari/dispositivi fisici, RTL e pseudo-localizzazione, secondo accento, movimento rallentato negli strumenti browser. L'errore specifico di caricamento delle metriche riusa LoadError con retry sulla stessa URL, ma non è stato indotto nel browser. Nessuna nuova certificazione della dashboard sotto stress: l'overflow precedente resta fuori dal perimetro.

## Verdict

**Approve** per i sei domini e i flussi indicati; nessun HIGH aperto in quel perimetro. Le verifiche manuali non eseguite rimangono esplicite sopra.
