# Linee guida dell’interfaccia

Precedenza: WCAG AA, Arc, Web Interface Guidelines e Interface Cheat Sheet/skill better-*, Lessons of Design.

## Arc

Componenti gratuiti dal registry ufficiale, interni immutati. Token semantici per colore, spazio, raggi e tipografia. Una sola gerarchia con titolo e azione principale; nessuna decorazione superflua. Tema tramite `data-theme`, accento verde salvia richiesto dall’umano il 13 ottobre 2026. Token del prodotto in `lib/theme/sage.css`, senza modificare la foundation Arc. Verde chiaro per la selezione, tinta scura leggibile per azioni e testi; tema scuro con valori dedicati. Raggi compatti condivisi per il gestionale. Font Geist e Inter, pesi 400/500. Focus della foundation, controlli nativi etichettati, motion ridotta. Caricamento, vuoto, errore e conferma restano vicini ai dati. [Regole e checklist](https://uiarc.dev/r/skills/arc/SKILL.md).

## Web Interface Guidelines

Form nativi con etichette cliccabili, tipo e autocomplete appropriati; invio con Enter e protezione dai doppi invii. Redirect di accesso sul server e feedback vicino all’azione. Input almeno 16 px su touch; hover solo sui puntatori compatibili. Numeri tabulari, font leggibili e nessuna transizione nel cambio tema. [Fonte](https://interfaces.rauno.me).

## Interface Cheat Sheet e skill

Allineamenti condivisi, angoli concentrici e spazio che raggruppa contenuti. Testo lungo raggiungibile, misure adattabili, colori semantici e contrasto misurato. Animazioni interrompibili, motion ridotta e proprietà nominate. Bordi e focus seguono Arc dove le fonti divergono. Target touch di 44 px, pesi massimi 500, nessun maiuscolo né trattino lungo nei testi. [Fonte](https://interfaces.dev/cheat-sheet).

Le nove skill richieste sono in `.agents/skills`; ogni `SKILL.md` è stato letto. `better-interface` si applica alla revisione dei flussi; `interface-review` e `break` rispettano il loro ambito previsto nel piano.

## Lessons of Design

Fonte: [Lessons of Design](https://lessons.design), Fabricio Teixeira. Letta con Chromium/Playwright il 12 ottobre 2026, incluse le sette sezioni e i relativi esempi. Sintesi in parole proprie:

1. **Modelli concettuali:** una struttura comprensibile rende coerente la crescita del prodotto. Nel gestionale brand, stagione, cliente e ordine restano riconoscibili nei filtri e nei dettagli.
2. **Semplicità:** eliminare ridondanze e mostrare i dettagli al momento opportuno. Azione principale unica, filtri espandibili e prezzi per variante sotto una disclosure.
3. **Contesto delle decisioni:** spiegare il beneficio e le conseguenze di una scelta. Conferme di annullamento, fatturazione e aggiornamento descrivono l’effetto sui dati.
4. **Coerenza:** controlli e parole familiari riducono il lavoro necessario per imparare. Token, form, stati e formati italiani condivisi tra area interna e portale.
5. **Variazioni intenzionali:** adattare un sistema quando il compito richiede una soluzione diversa. SortableDataTable Arc anche su telefono, con selezione nella prima colonna; Combobox Arc per unificare ricerca e scelta. I select nativi restano per le scelte brevi dei flussi di importazione e delle impostazioni.
6. **Miglioramento continuo:** portare le decisioni fino all’esperienza effettivamente utilizzabile. Testare i flussi completi, correggere i difetti e conservare la motivazione della soluzione.
7. **Qualità delle relazioni:** il valore del lavoro comprende l’effetto sulle persone. Messaggi rispettosi, errori recuperabili, accessibilità e documentazione comprensibile per ciascun ruolo.

## Numeri animati

Per indicazione dell’umano, i valori numerici che cambiano in tempo reale usano [Number Flow](https://number-flow.barvian.me). Wrapper AnimatedNumber/AnimatedMoney: formato italiano, numeri tabulari, tempi dai token Arc e respectMotionPreference attivo. Nessuna animazione nei controlli di immissione o nei documenti di stampa. Per anteprime monetarie fuori dal limite applicativo resta la formattazione BigInt esatta.

## Shell del gestionale

Ispirazione dai tre ERP indicati dall’umano: [VANTUS](https://dribbble.com/shots/26719780-ERP-Dashboard-Redesign-VANTUS-Manufacturing-Scheduling), [Catalyst](https://dribbble.com/shots/27613285-Catalyst-Certificate-Creation-for-Laboratory-ERP), [Sales Automation](https://dribbble.com/shots/26370765-ERP-Sales-Automation-Dashboard-Recent-Activity-Feed-Order-List). Sidebar persistente con gruppi nativi espandibili, icone e sottomenu; menu utente Arc nel fondo della sidebar, senza barra superiore. Il pulsante Menu apre la navigazione su telefono. Etichette e destinazioni rispettano il ruolo. Panoramica con metriche visibili e filtri espandibili, aperti quando un filtro è applicato. [Icone Better Icons](UI-ICONS.md).

## Riepiloghi delle tabelle

Tre card prima della toolbar nelle liste, con periodi indipendenti e confronto annuo in testo neutro. MetricCard Arc per contatori semplici; gli importi e i numeri che richiedono formato italiano usano superfici applicative con centesimi esatti. Gli importi animati usano NumberFlow quando lo spazio consente di mostrarli interamente; negli spazi stretti rimane il valore completo formattato, con ritorno a capo. Gli interni Arc restano immutati.

I selettori 7/30/90 giorni sono verticali a destra; se il testo ingrandito supera lo spazio disponibile passano sotto, allineati a destra. Nell’analisi storica i selettori sono stagioni omologhe, secondo la scelta umana. Il paginatore usa collegamenti reali nelle liste e Button Arc nelle anteprime, con numeri, puntini e accento salvia sulla pagina attuale.
