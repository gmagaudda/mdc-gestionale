# Sidebar animata, 15 ottobre 2026

## Scope and coverage

Navigazione interna e portale, pannello desktop espanso/ridotto, strumenti, etichette, sottomenu, indicatore attivo e menu mobile esistente. Next.js 16.3.8, React, Motion, pulsanti e token Arc già presenti. Consultati AGENTS.md, PLAN.md, DESIGN-GUIDELINES.md, DECISIONS.md, guida Next locale, catalogo Arc gratuito e documentazione Button. Riferimento richiesto: [beUI Animated Sidebar](https://beui.dev/components/motion/animated-sidebar). Comportamento adattato alla struttura del gestionale, senza installare una seconda libreria di sidebar né modificare vendor Arc.

| Domain        | Evidence inspected                                                                                                                                                                                                  | Result                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Accessibility | Pulsanti dei gruppi con aria-expanded/aria-controls, link con nome anche senza etichetta visiva, sottomenu in uscita inert; tastiera, Escape, ritorno focus, axe nei due temi; MotionConfig e ramo useReducedMotion | Clear nel flusso verificato |
| Layout        | Proiezione del layout con spring.smooth per pannello, strumenti, icone e contenuto; gruppi e link stabili tra le due larghezze; quattro viewport, 320 px e testo 200%                                               | Clear nel flusso verificato |
| Writing       | Etichette italiane e messaggio vuoto esistenti da messages/it.json; nomi espandi/riduci e ricerca coerenti con lo stato                                                                                             | Clear                       |
| Typography    | Font, pesi e scala esistenti; nessuna ellissi aggiunta; title e nome accessibile completi sulle icone                                                                                                               | Clear                       |
| Colors        | Indicatore selezionato con --accent-subtle, testo --accent, aria-current conservato; misure contrasto e axe chiaro/scuro della suite workspace                                                                      | Clear nei temi verificati   |
| UI            | Layout FLIP con transform, dissolvenze brevi, sottomenu progressivi e indicatore condiviso spring.morph; niente animazione iniziale dello stato, ricerca senza attese; reduced motion senza spostamenti/stagger     | Clear nel flusso verificato |

## Findings

No actionable interface findings nel flusso ispezionato. Corretto l’overflow transitorio del contenuto durante il cambio di larghezza con overflow-x: clip sul contenitore applicativo, senza nascondere dati nello stato finale. Rimosso layoutRoot dal pannello: in Motion 14 disabilita la sua interpolazione. La prova della larghezza su frame consecutivi verifica che l’animazione avvenga realmente. L’audit axe attende le posizioni e le opacità finali, anziché misurare gli ingressi intermedi.

## Verification

- Typecheck, ESLint sui file interessati, token e diff verificati. Build OpenNext production completata; scanner client su 213 asset senza segreti server configurati.
- Suite workspace: navigazione, gruppi attivi, ricerca/vuoto, tastiera/focus, due temi, axe, 390/768/1024/1440 px, stress 320 px e testo 200%. Selettori aggiornati dai details ai pulsanti dei gruppi, senza indebolire le verifiche delle destinazioni.
- Desktop: prova di inversione prima del termine della spring, lettura della larghezza su frame consecutivi, riduzione del movimento e attivazione da tastiera. Destinazioni staff/accounting/brand verificate con gli stessi vincoli precedenti.
- Anteprima locale su Workers, porta 3100. Osservati nel browser dashboard, collasso a icone, strumenti impilati ed espansione; schermata fuori repository.

Not verified: screen reader manuale, Safari/device fisici, RTL/pseudo-localizzazione, forced colors e motion rallentata al 10%. Nessuna modifica a schema, query business, dati reali o permessi. Il dialog mobile conserva il comportamento di apertura esistente; le animazioni di voci e sottomenu sono condivise.

## Verdict

Approve nei sei domini e nel flusso ispezionati. Nessun HIGH residuo individuato.
