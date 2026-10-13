# Review better-interface: liste, selezione, combobox e navigazione

## Perimetro e convenzioni

Flusso completo: Clienti (filtri, ricerca, ordinamento, selezione, CSV e creazione), Ordini (combobox, matrice, filtri e salvataggio), navigazione laterale/mobile. Verifiche aggiuntive del riuso nelle altre liste e nel portale. Stack Next 16.3.8/React, next-intl, Arc gratuito, primitive Radix per i dialoghi, token semantici e Better Icons/Tabler. Letti AGENTS.md, PLAN.md, DESIGN-GUIDELINES.md, DECISIONS.md e le sei skill better-*; checklist Arc recuperata via MCP.

Non è una revisione di tutte le route dell’app. Le anagrafiche paginate applicano il sort prima della paginazione sul server; le viste aggregate complete ordinano localmente valori numerici/date. La ricerca conserva l’ambito dichiarato dalla propria etichetta. Le viste senza creazione autorizzata non mostrano un pulsante di aggiunta.

| Dominio       | Evidenze esaminate                                                                                                                                                                    | Risultato                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Accessibility | `arc-data-table.tsx`, `search-select.tsx`, `responsive-dialog.tsx`, `app-navigation.tsx`; nomi italiani, header e checkbox nello stesso th, tastiera, Escape, focus, axe nei due temi | Clear nel perimetro automatizzato e ispezionato |
| Layout        | `list-view.tsx`, `selectable-list-table.tsx`, `data-table.tsx`, `globals.css`; screenshot mobile, tablet, laptop e desktop; toolbar, campi data, intestazioni e sidebar compatta      | Clear                                           |
| Writing       | `messages/it.json`; azioni disponibili, selezione limitata alla pagina, export riuscito/errore/limite, ricerca sidebar senza risultati                                                | Clear                                           |
| Typography    | Token Inter/Geist esistenti, pesi 400/500, Number Flow/tabular-nums, nomi lunghi che vanno a capo, input selezionati disabilitati leggibili per intero                                | Clear                                           |
| Colors        | Token semantici nei due temi salvia, axe sui controlli e sulla tabella, indicatore di ordinamento e voce attiva accompagnati da stato/nome                                            | Clear                                           |
| UI            | Arc SortableDataTable/Combobox/SearchField, props documentate, file vendor esistenti immutati, icone locali currentColor, movimento ridotto e stati async                             | Clear                                           |

## Risultati

Nessun rilievo di interfaccia azionabile residuo nel perimetro verificato. Correzioni applicate durante il flusso: minimo intrinseco dei campi data a 320 px/testo 200%, azioni sticky sopra gli alert, larghezze delle colonne per evitare intestazioni sovrapposte, Escape gestito prima dalla combobox, ricerca mobile azzerata prima della chiusura del menu. Comandi generali sopra la tabella e azioni della selezione sotto, con ritorno a capo quando lo spazio manca.

## Verifica

- `pnpm typecheck`, `pnpm lint`, `pnpm check:tokens`, `git diff --check`: verdi.
- `pnpm test`: 276 test in 52 file verdi. Normalizzazione monetaria locale verificata anche oltre Number.MAX_SAFE_INTEGER, importi negativi e date italiane.
- `pnpm supabase:test`: 1.466 controlli in 35 file verdi dopo la migrazione 044, applicata senza reset. Sessione/RLS, mascheratura portale, whitelist sort e ordine CSV conservati.
- `pnpm build:cf`: build OpenNext locale verde. `pnpm check:client-secrets`: 187 asset client controllati, nessun segreto server configurato.
- Playwright su Workers locale: `list-exports`, `orders-editor`, `portal-flow`, `workspace-ui`, `budget-recommendation`. Viewport 360/390/768/1024/1440, stress aggiuntivo 320 px/testo 200%; controlli pointer e tastiera, filtri combinati, date/importi, selezione/paginazione/CSV, vuoto e invalidi, combobox remota e scelta corrente, sidebar compatta e filtro per ruolo.
- Gate browser: 25 scenari liste/ordini/portale nei cinque viewport verificati, più sei casi documenti/calendario/conferme su mobile-s/desktop. La ripetizione finale di calendario/export è verde (4/4). Sidebar/ruoli (8) e budget suggerito (5) verdi nella precedente esecuzione; 12 skip intenzionali di ruoli duplicati.
- Screenshot ispezionati: `list-toolbar-light.png` mobile/laptop/desktop, `sidebar-collapsed.png` desktop e matrice ordini. Artefatti di test locali, non versionati.
- L’audit CSV usa movimento ridotto e attende opacità finale del testo prima di misurare il contrasto quando il pulsante torna dal caricamento. Il calendario attende che il menu della combobox sia rimosso dopo la selezione. I selettori del portale escludono le copie DOM nascoste mantenute da Next durante la navigazione.

### Non verificato

Screen reader manuale, dispositivi fisici e Safari mobile, RTL/pseudo-localizzazione e secondo accento neutro. Il verde salvia richiesto dall’umano è conservato. Nessun nuovo invio reale, deploy o importazione del workbook originale; non ripetuta la suite browser completa di tutte le route.

## Checklist Arc

- [x] Testi italiani sentence case, senza eyebrow o trattini lunghi; pesi e dimensioni dai token.
- [x] Azioni etichettate; errori recuperabili, numeri allineati e conteggio con Number Flow.
- [x] Token semantici, accento per azione primaria/selezione, stati con testo; nessun effetto decorativo nuovo.
- [x] Un contenitore di pagina; allineamento toolbar/tabella, spazi e raggi esistenti; scroll confinato alle tabelle larghe.
- [x] Componenti gratuiti e props documentate, nessun interno Arc esistente modificato, una sola azione primaria.
- [x] Caricamento, vuoto, errore e successo in posizione; valori lunghi raggiungibili e campi disabilitati leggibili.
- [x] Motion Arc con ramo reduced motion; nessuna animazione aggiunta al filtro ad alta frequenza.
- [x] Primo render server-safe, chiavi stabili per righe e varianti, output di denaro esatto.
- [x] Semantica nativa, icone con nomi, focus condiviso, Escape/focus trap e stato non affidato al solo colore.
- [x] 390/768/1024/1440 verificati; 360/320 supplementari, nessuno scroll laterale della pagina, target touch almeno 44 px nel perimetro controllato.
- [x] Tema chiaro e scuro salvia verificati.
- [ ] Secondo accento neutro: non rivalidato perché l’umano ha richiesto verde salvia.

## Esito

Approve per i sei domini nel perimetro dichiarato e nelle verifiche eseguite. Le verifiche manuali elencate restano aperte.
