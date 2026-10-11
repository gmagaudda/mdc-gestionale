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
