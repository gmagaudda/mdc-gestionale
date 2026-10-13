# Review better-interface: menu utente

## Perimetro e copertura

Flusso dell'account condiviso fra gestionale e portale: avatar, identità, apertura/chiusura, Aspetto, installazione dell'app, notifiche e uscita con recupero dell'errore. Stack Next 16.3.8/React, next-intl, next-themes, Arc gratuito, Radix Dialog e token semantici del prodotto. Documenti esaminati: AGENTS.md, PLAN.md, docs/DESIGN-GUIDELINES.md, docs/DECISIONS.md e le sei skill better-*. Letta la guida Next locale Server and Client Boundary e la documentazione MCP UserMenu prima dell'uso. Nessuna revisione globale di tutte le route.

| Dominio       | Evidenze esaminate                                                                                                                                                                                                 | Risultato                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| Accessibility | AccountMenu, UserMenu, ResponsiveDialog, ThemeControls, PushSettings; nomi italiani, role/aria-expanded, typeahead, frecce/Home/End/Escape, focus restituito, axe in chiaro/scuro, target touch e errore di uscita | Clear nel flusso verificato    |
| Layout        | SessionShell, globals.css, popover desktop e sheet mobile, pannelli, intestazioni, 390/768/1024/1440 px e stress 320 px/testo 200% su Clienti                                                                      | Clear nel perimetro verificato |
| Writing       | messages/it.json, User Guide; voci brevi, nome account completo nel titolo accessibile, istruzioni di installazione, stato notifiche, errori recuperabili e uscita in corso                                        | Clear                          |
| Typography    | Geist/Inter e scale esistenti; iniziali, ellissi di nome/email con titolo completo, etichette del menu contenute nei target sotto stress                                                                           | Clear                          |
| Colors        | Token Arc e salvia esistenti, contrasto axe nei due temi; stato notifiche espresso anche con testo, errori accompagnati da etichetta                                                                               | Clear                          |
| UI            | Icone applicative Better Icons e icone originali Arc, motion originale con riduzione, menu compatto, dialog singolo senza duplicazione del titolo notifiche                                                        | Clear                          |

## Findings

Nessun rilievo azionabile rimasto nel flusso del menu utente verificato.

Correzioni applicate: rimosso aria-modal dal role=menu mobile attraverso il wrapper; localizzati trigger, uscita e typeahead; voce Notifiche abbreviata per mantenere il testo nel target; target dell'avatar di almeno 44 px; errore di logout persistente e focus ripristinato. Nessun intervento sugli interni Arc.

## Verifica

- Menu da avatar e tastiera; frecce/Home/End, ricerca per iniziale italiana, Escape, apertura di ogni pannello e focus restituito. Tema Sistema/Chiaro/Scuro e persistenza al reload; primo contenuto coerente con la scelta salvata.
- Installazione: istruzioni Safari, evento beforeinstallprompt differito, invocazione solo dopo pulsante e stato App installata. Notifiche: consenso solo dal comando dedicato, revoca del dispositivo e del consenso su browser bloccato, stati e audit senza endpoint/chiavi esposti.
- Logout: revoca server, pulizia delle cache private e storage locale, navigazione a login; errore di rete simulato, alert persistente, focus all'avatar e nuovo tentativo riuscito. Brand senza voce Notifiche e accesso alle route interne negato.
- Axe nei due temi, movimento ridotto, screenshot mobile/desktop e verifica nel browser dell'app. Controllo dello scroll e dei limiti del testo dei pulsanti a 320 px/testo 200% sul flusso Clienti; le tabelle scorrono dentro la propria regione.
- I selettori dei test delle altre route sono aggiornati ai comandi del menu e ai pannelli. Gli audit attendono la rimozione effettiva della superficie Arc in uscita, compresa quando Radix la nasconde all'accessibilità.

### Comandi e risultati

- `pnpm test`: 276 test in 52 file verdi.
- `pnpm lint`, `pnpm typecheck`, `pnpm check:tokens`, `git diff --check`: verdi.
- `pnpm build:cf`: build OpenNext completata; `pnpm check:client-secrets`: 193 asset client senza segreti server configurati.
- `E2E_BASE_URL=http://localhost:3100 E2E_PWA_PRODUCTION=1 pnpm exec playwright test e2e/theme.spec.ts e2e/auth.spec.ts e2e/pwa.spec.ts e2e/push.spec.ts --project=mobile --project=desktop`: 30/30 verdi sulla build finale.
- `E2E_BASE_URL=http://localhost:3100 E2E_PWA_PRODUCTION=1 pnpm exec playwright test e2e/theme.spec.ts --project=tablet --project=laptop --grep 'account menu'`: 2/2 verdi.
- `E2E_BASE_URL=http://localhost:3100 pnpm exec playwright test e2e/mfa.spec.ts --project=desktop`: 1/1 verde, configurazione/codice errato/MFA/accesso AAL1 negato/uscita/nuovo accesso.

### Non verificato e confini

Screen reader manuale, dispositivi fisici/Safari, RTL/pseudo-localizzazione, accento alternativo e motion rallentata negli strumenti browser non verificati. Non ripetuta l'intera suite browser di tutte le route; nessuna migrazione o nuova scrittura di business.

Lo stress iniziale sulla dashboard ha mostrato un overflow preesistente di Number Flow su un importo a 320 px/testo 200%, esterno al menu. Non modificata la regione metriche in questo intervento; la verifica finale del menu sotto stress usa Clienti.

## Checklist Arc

- [x] Item gratuito dal catalogo e props documentate; sorgenti originali installati, interni immutati.
- [x] Un solo ingresso account; due/tre destinazioni consentite per ruolo e uscita asincrona.
- [x] Tema applicato con next-themes, primo render sicuro per il server.
- [x] Token semantici applicativi, font e accento esistenti, focus della foundation.
- [x] Pannelli con caricamento/stato/errore/risultato in posizione; notifiche senza richiesta automatica di permesso.
- [x] Interazione da tastiera, movimento ridotto, hit area e stress testo.

## Verdict

Approve per i sei domini nel flusso dichiarato e per le verifiche automatizzate indicate; i controlli manuali sopra rimangono non verificati.
