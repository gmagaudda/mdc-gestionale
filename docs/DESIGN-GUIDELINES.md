# Linee guida dell’interfaccia

Precedenza: WCAG AA, Arc, Web Interface Guidelines e Interface Cheat Sheet/skill better-*, Lessons of Design.

## Arc

Componenti gratuiti dal registry ufficiale, interni immutati. Token semantici per colore, spazio, raggi e tipografia. Una sola gerarchia con titolo e azione principale; nessuna decorazione superflua. Tema tramite `data-theme`, accento neutro. Font Geist e Inter, pesi 400/500. Focus della foundation, controlli nativi etichettati, motion ridotta. Caricamento, vuoto, errore e conferma restano vicini ai dati. [Regole e checklist](https://uiarc.dev/r/skills/arc/SKILL.md).

## Web Interface Guidelines

Form nativi con etichette cliccabili, tipo e autocomplete appropriati; invio con Enter e protezione dai doppi invii. Redirect di accesso sul server e feedback vicino all’azione. Input almeno 16 px su touch; hover solo sui puntatori compatibili. Numeri tabulari, font leggibili e nessuna transizione nel cambio tema. [Fonte](https://interfaces.rauno.me).

## Interface Cheat Sheet e skill

Allineamenti condivisi, angoli concentrici e spazio che raggruppa contenuti. Testo lungo raggiungibile, misure adattabili, colori semantici e contrasto misurato. Animazioni interrompibili, motion ridotta e proprietà nominate. Bordi e focus seguono Arc dove le fonti divergono. Target touch di 44 px, pesi massimi 500, nessun maiuscolo né trattino lungo nei testi. [Fonte](https://interfaces.dev/cheat-sheet).

Le nove skill richieste sono in `.agents/skills`; ogni `SKILL.md` è stato letto. `better-interface` si applica alla revisione dei flussi; `interface-review` e `break` rispettano il loro ambito previsto nel piano.

## Lessons of Design

Il sito [Lessons of Design](https://lessons.design) non restituisce testo leggibile allo strumento. Sintesi da completare in M8-T6 con il contenuto fornito dall’utente, come previsto dal piano.
