# Verifiche di interfaccia

## M0-T6 e M1-T1: accesso e tema

Ambito: login, recupero password, impostazione password, navigazione autenticata iniziale, design-check. Componenti Arc gratuiti: button, input, password-field, password-strength, alert, segmented-control, theme-switch, avatar.

| Dominio       | Verifica                                                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accessibilità | Label native, errori inline, focus al primo campo invalido, Tab sul campo email; axe chiaro/scuro senza violazioni AA dopo le correzioni. Screen reader manuale non verificato. |
| Layout        | Cinque viewport 360/390/768/1024/1440, nessun overflow; screenshot mobile ispezionati. Corretto box-sizing globale.                                                             |
| Testi         | Italiano tramite next-intl; errori indicano come recuperare; messaggio reset non enumera gli utenti.                                                                            |
| Tipografia    | Geist/Inter, token di dimensione/peso, input 16 px su touch; titoli senza overline.                                                                                             |
| Colori        | Bordo e testo muted originali insufficienti; corretti tramite token semantici. Axe light/dark verde.                                                                            |
| UI            | Sorgenti Arc immutati; target estesi tramite wrapper, feedback in pagina, tema senza transizioni tramite next-themes.                                                           |

Checklist Arc applicata al codice di composizione. Tema persistente verificato prima dell’arrivo del contenuto, anche dopo reload. Accenti alternativi, zoom 200% e lettura con screen reader da completare nella revisione trasversale M8.

I dashboard attuali sono punti d’ingresso, non espongono ancora riepiloghi di business. Test con soli account sintetici locali. Nessuna verifica implicita delle schermate ancora da implementare.

## M2-T1: creare e archiviare un brand

Ambito della revisione better-interface: lista brand → creazione → modifica → referente → archiviazione; lettura staff. Stack e convenzioni: AGENTS.md, DESIGN-GUIDELINES.md, token Arc, next-intl, cinque viewport. Escluse le schermate di catalogo/ordini e la shell definitiva di M2-T3.

| Dominio       | Evidenza                                                                            | Esito                                                                  |
| ------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Accessibilità | e2e/brands.spec.ts, axe sul form, label native/errori inline, conferma esplicita    | Nessuna violazione AA automatica; screen reader manuale non verificato |
| Layout        | Flusso completo su cinque viewport, controllo scrollWidth, form-grid e card mobile  | Nessun overflow rilevato                                               |
| Testi         | messages/it.json, errori con percorso di recupero, conferme con nome del record     | Italiano, conseguenze dell’archiviazione esplicite                     |
| Tipografia    | Input/textarea Arc, form e dettagli con token                                       | Nessuna dimensione o peso fuori scala                                  |
| Colori        | Controllo token, tema chiaro e componenti Arc immutati                              | Nessun colore fisso; contrasto del form verificato con axe             |
| UI            | Pending/disabilitazione, conferma inline, skeleton/error/empty e successo in pagina | Stato percepibile senza affidarsi alla motion                          |

Verifiche passate: `E2E_BASE_URL=http://localhost:3100 pnpm e2e e2e/brands.spec.ts` (10 test), lint/typecheck/test/check:tokens. Non verificati qui: zoom 200%, screen reader manuale e contrasto di questa specifica schermata in scuro (previsti in M8). Nessun problema di interfaccia bloccante rilevato nel perimetro verificato. Verdict: Approve, limitato alle verifiche indicate.
