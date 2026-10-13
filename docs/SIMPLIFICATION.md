# Passaggio ablativo

Richiesta umana del 13 ottobre 2026: ridurre la complessità conservando interfaccia e funzionalità. Ricognizione di `lib`, `modules`, componenti condivisi e chiamanti nelle route, con ricerca dei riferimenti e lettura mirata delle astrazioni. Nessuna migrazione o modifica ai componenti vendor.

## Interventi in ordine

| Passaggio              | Prima                                                                                                    | Dopo                                                                          | Verifica del comportamento                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Alias UI               | File condivisi che riesportavano soltanto Input ed EmptyState                                            | Import diretti degli stessi componenti Arc                                    | JSX, props, CSS e messaggi preservati; regression test dei flussi                                            |
| Codice senza chiamanti | Server action currentHome; budgetsOverlap usata soltanto dai suoi test                                   | Rimozione dei due simboli                                                     | Navigazione continua a usare homeForRole; sovrapposizioni gestite dalla constraint SQL e verificate in pgTAP |
| Generazione PDF        | Interfaccia, classe con il solo font e tipo ripetuto anche nel modello                                   | Funzione renderPdf(modello, font)                                             | Confronto dei PDF prima/dopo, unit ed endpoint browser                                                       |
| Tabelle PDF            | Due implementazioni quasi identiche di righe, intestazioni e cambio pagina                               | Una funzione locale di disegno usata dai due template                         | PDF multipagina di ordine e riepilogo identici dopo normalizzazione delle sole date tecniche                 |
| Simulazione fatture    | Store in memoria e transizioni sintetiche nel modulo runtime; simulateStatus senza chiamanti applicativi | Fixture nei test; test modificano direttamente il loro store                  | Tutti gli scenari di stato, idempotenza e contract test mock/FIC conservati                                  |
| Parametri liste        | Estrazione/codifica cf_ duplicate e metadati defaultSort separati                                        | Helper URL in list.ts riusati; primo sort come default in una tupla non vuota | Sette default confrontati con la versione precedente; documenti continuano a ordinare per created_at         |
| Budget suggerito       | Due booleani per disponibilità/accettazione; somma pesi ripetuta per riga                                | Un solo stato stale/ready/accepted; somma calcolata una volta                 | Invalidation, esclusioni, ricalcolo, motivazione e snapshot protetti come prima                              |
| Preview Excel          | Raggruppatore parametrico usato soltanto per brand; accumulatori e contatori paralleli                   | Raggruppamento per brand; un accumulatore nullable per metrica                | Zero distinto da dato mancante, BigInt esatto e identità clienti senza collisioni verificati                 |
| Importazione           | Default delle entità mai usato e condizione del passo ripetuta                                           | Entità esplicite del ruolo e condizione diretta                               | Whitelist admin/accounting invariata; Analisi mantiene i suoi raggruppamenti SQL                             |
| Log e dipendenze       | Tipi dei log ripetuti rispetto agli enum Zod; plugin Turbopack non configurato                           | Tipi derivati dallo schema; rimosso @tailwindcss/turbopack                    | Whitelist dei log e pipeline PostCSS restano operative; build Workers verde                                  |

Riduzione netta: **154 righe TypeScript applicativo**, esclusi test, fixture e documentazione; due file alias rimossi e una dipendenza di sviluppo eliminata. La quantità di righe è una misura descrittiva, non una prova di qualità o di aumento delle prestazioni.

## Confini conservati

- Sessione Supabase, RLS, MFA, validazione degli input e audit transazionale.
- Contratto InvoicingProvider usato da due implementazioni, adapter persistenti, lease, deduplicazione e controlli dei callback.
- Parser Excel nel worker, chunk limitati, revisioni di staging e rollback atomico.
- Composizioni UI che aggiungono comportamento effettivo: accessibilità dei Select, tabelle responsive, ricerca remota, stati di caricamento e supporto offline.
- Formattazione monetaria esatta e Number Flow con rispetto del movimento ridotto.

## Verifiche

- 274 unit test in 51 file. Eliminati soltanto i due test della funzione budgetsOverlap rimossa; i controlli della regola SQL operativa rimangono.
- 1.423 controlli SQL in 35 file, senza reset del database.
- Typecheck, lint senza warning applicativi, token, diff check, build OpenNext e scanner di 185 asset client verdi.
- Browser Workers locale: 60 casi applicabili verificati nei cinque viewport; 5 skip del workbook opzionale. Prima esecuzione: 59 passati e un audit PDF tablet durante la dissolvenza dell'etichetta. Ripetizione senza modifiche verde; attesa delle animazioni nel test e ripetizione finale del riepilogo PDF nei cinque viewport, 5/5 verdi. Nessuna modifica visiva. Nessun file reale importato automaticamente.

Non è una nuova certificazione di tutti i flussi del piano: i controlli browser riguardano le aree raggiunte dalla semplificazione. I gate esterni già documentati rimangono separati.
