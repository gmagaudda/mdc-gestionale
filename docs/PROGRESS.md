# Avanzamento

## M0

- T1–T3: implementati e verificati localmente.
- T4: workflow pronto e controlli locali verdi; PR di prova da verificare quando è configurato un remoto GitHub.
- T5: build/preview Workers, login/logout, redirect, lettura profilo RLS e blocco account inattivi verificati. Nessun deploy. Piano gratuito scelto dall’umano; minificazione verificata a 2,70 MiB gzip dopo M1-T1. Ultima misura dopo brand/utenti: 2,76 MiB gzip. Per indicazione dell’umano, dal 12 ottobre lo sviluppo e i test proseguono in locale senza vincolo di dimensione del bundle.
- T6: foundation e componenti Arc gratuiti, provider, font, tema, skill, linee guida e controllo token. MCP autenticato nel client ma strumenti non esposti alla sessione; usato il fallback ufficiale llms.txt/documentazione markdown. Ricerca MCP di accettazione da verificare quando gli strumenti sono disponibili.

## M1

- T1: login/logout, recupero password via Mailpit, verifica link e attivazione invito implementati. Login valido/errato, reset, disattivazione e isolamento delle aree verificati nei cinque viewport.
- T2: identità verificata con getUser, profilo attivo, guardie di ruolo/brand e destinazioni implementate. Unit test per tutti i ruoli e rifiuto in caso di errore del database.
- T3: gestione utenti admin, invito in modalità log, cambio ruolo, disattivazione e associazione brand implementati. 10 e2e nei cinque viewport verdi; staff respinto anche dall’endpoint inviti. Invio reale Resend da configurare con l’ambiente gestito.
- T4: tabella audit immutabile, trigger transazionali, helper, protezione ultimo admin e consultazione con dettaglio per admin. Inviti, ruoli, disattivazioni e associazioni ai brand verificati con audit.

## M2

- T1: lista, dettaglio, creazione/modifica, archiviazione e referenti implementati. RLS: brand assegnati soltanto, campi privati separati; staff in sola lettura. 12 test database e 10 e2e nei cinque viewport verdi, axe sul form senza violazioni AA.
- T2: clienti con dati fiscali, indirizzi, referenti e archiviazione; scrittura admin/staff, sola lettura amministrazione, accesso brand escluso. Validazioni P.IVA/SDI/PEC testate; 9 test RLS e 10 e2e nei cinque viewport verdi.
- T3: tabelle/card mobile, filtri, ordinamento e paginazione server, caricamento, stato vuoto/errore, conferma inline e controllo tema condivisi. Shell definitiva e dialog responsive da completare dopo i clienti.
