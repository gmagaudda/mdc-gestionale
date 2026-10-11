# Avanzamento

## M0

- T1–T3: implementati e verificati localmente.
- T4: workflow pronto e controlli locali verdi; PR di prova da verificare quando è configurato un remoto GitHub.
- T5: build/preview Workers, login/logout, redirect, lettura profilo RLS e blocco account inattivi verificati. Nessun deploy. Piano gratuito scelto dall’umano; minificazione verificata a 2,70 MiB gzip dopo M1-T1. Controllo da ripetere sulle nuove funzioni.
- T6: foundation e componenti Arc gratuiti, provider, font, tema, skill, linee guida e controllo token. MCP autenticato nel client ma strumenti non esposti alla sessione; usato il fallback ufficiale llms.txt/documentazione markdown. Ricerca MCP di accettazione da verificare quando gli strumenti sono disponibili.

## M1

- T1: login/logout, recupero password via Mailpit, verifica link e attivazione invito implementati. Login valido/errato, reset, disattivazione e isolamento delle aree verificati nei cinque viewport.
- T2: identità verificata con getUser, profilo attivo, guardia di ruolo e destinazioni implementate. requireBrandAccess da completare con brand_users in M2-T1.
- T4: tabella audit immutabile, trigger transazionale sui profili, helper e protezione ultimo admin; 6 test pgTAP verdi. Vista di consultazione in lavorazione.
