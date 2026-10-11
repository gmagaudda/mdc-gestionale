# Decisioni

## Accesso e accessibilità (M1-T1)

Supabase locale nativo non serve template email personalizzati: recupero locale con PKCE (stesso browser), ambiente gestito con template token_hash in `supabase/templates/recovery.html` (configurare nella dashboard). Entrambi verificano il link sul server. Password da 10 a 128 caratteri, conferma esplicita, logout globale dopo il cambio. Il messaggio di recupero non rivela se un account esiste.

Misurato il bordo originale dei campi: 1,74:1, inferiore al requisito 3:1. Axe ha rilevato 3,87:1 sulle etichette inattive del controllo tema in chiaro. Override semantici in entrambi i temi: `--text-muted` usa `--text-secondary`, `--border-strong` usa il testo secondario. Nessuna modifica ai sorgenti Arc. Area dei pulsanti di rivelazione estesa tramite wrapper.

Build Workers verificata con login, logout, lettura profilo soggetta a RLS e blocco account inattivi. L’umano ha scelto Workers Free. Con `minify: true`, il bundle dopo autenticazione/i18n scende da 3127,03 a 2763,25 KiB gzip (2,70 MiB), sotto il limite di 3 MiB. La misura verrà ripetuta dopo ogni milestone.

## Design system (M0-T6)

Arc installato dal registry gratuito; `ArcProvider` arriva come dipendenza di `avatar` (non esiste un item autonomo `arc-provider`). Componenti originali conservati senza modifiche. Font caricati con next/font; tema con next-themes, senza script duplicati.

Le skill di jakubkrehel sono copiate in `.agents/skills` e tracciate da `skills-lock.json`; letti tutti i nove SKILL.md. Il fallback ufficiale llms.txt/markdown è usato perché questa sessione non espone gli strumenti Arc, pur con autenticazione completata. L’accettazione della ricerca MCP resta da verificare.

Il theme-switch gratuito ha icona da 38 px: un wrapper estende solo l’area cliccabile a 44 px, senza cambiare il componente. Il segmented-control espone Sistema/Chiaro/Scuro in italiano. Su puntatore touch `--text-sm` eredita `--text-base`, per evitare zoom iOS. Le nuove dipendenze sono bloccate a versione esatta. Gli script opzionali di watcher/SWC restano disabilitati perché non usati dal runtime.

| Data       | Scelta                                                                         | Motivo                                                                                                                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-12 | App Next.js 16 con App Router, TypeScript strict e Tailwind 4                  | Sono le versioni stabili disponibili all'avvio; il piano richiede versioni fissate nel lockfile.                                                                                                                                              |
| 2026-10-12 | Nome tecnico `mdc-gestionale`; nome visibile provvisorio “Gestionale showroom” | Il nome definitivo dell'app è un input umano richiesto prima del manifest PWA.                                                                                                                                                                |
| 2026-10-12 | Supabase CLI native runtime per lo sviluppo locale su Apple Silicon            | Docker non è disponibile sulla macchina; la CLI 2.120 supporta `stack = true` sperimentale. La CI userà il runtime Docker standard.                                                                                                           |
| 2026-10-12 | I nuovi utenti ricevono inizialmente il ruolo `brand`                          | È il privilegio minimo; un admin abilita esplicitamente gli utenti interni.                                                                                                                                                                   |
| 2026-10-12 | Uso di `proxy.ts` per il refresh della sessione                                | Next.js 16 ha rinominato il middleware in Proxy; la sessione è verificata con `getClaims()`, non con il cookie non validato.                                                                                                                  |
| 2026-10-12 | Cloudflare Workers usa OpenNext 1.20.10 con Next.js 16.3.8                     | Il piano indica OpenNext. Cloudflare ora raccomanda vinext per nuovi progetti, ma il cambio richiede una decisione dell'umano. Next 16.4.0 causa HTTP 500 in Workers per `preview-props.json`; la correzione OpenNext è ancora una PR aperta. |
| 2026-10-12 | Cache Components e Partial Prefetching disattivati                             | La configurazione generata dal template causava richieste bloccate nel runtime Workers; non servono alle funzioni previste.                                                                                                                   |
| 2026-10-12 | `compatibility_date` Cloudflare 2026-10-11                                     | È la data più recente supportata dal runtime locale al 12 ottobre nel fuso Europe/Rome.                                                                                                                                                       |
| 2026-10-12 | Bundle OpenNext 2.282 MiB gzip allo spike iniziale                             | Misurato con `wrangler deploy --dry-run`; rientra nel limite Free attuale di 3 MiB, ma la misura va ripetuta dopo le funzioni applicative.                                                                                                    |

## Anagrafiche e audit (M2-T1, M1-T4)

Dati leggibili dai brand in `brands`; provvigioni, indirizzi fiscali e note in `brand_private`, referenti in `brand_contacts`. La separazione impedisce fughe di colonne con SELECT dirette: RLS protegge righe, non singoli campi. Il salvataggio pubblico/privato è una funzione SQL con la sessione dell’utente, in un’unica transazione con audit. Nessuna service role nelle azioni di business.

La tabella Arc gratuita viene composta con ordinamento e paginazione GET esterni: i controlli incorporati non espongono tutte le stringhe in italiano né l’ordinamento server richiesto. I sorgenti Arc restano originali. Vista card sotto 768 px, tabella sopra. Le conferme di archiviazione sono al momento inline; la composizione dialog/bottom-sheet rimane in M2-T3.

Import nominati di Zod riducono il bundle Workers delle anagrafiche/utenti da 3097,69 a 2827,14 KiB gzip (2,76 MiB). Evitare l’import del namespace completo nelle nuove funzioni. Piano Free conservato; nessun rilascio remoto effettuato.

## Inviti utenti (M1-T3)

Solo il route handler `/api/users/invite` accede alla service role per generare il link Supabase; verifica prima identità admin, origine, schema e brand. Ruolo e associazioni sono salvati con la sessione admin in una transazione SQL con audit. Le email in modalità `log` sono stampate sul terminale di sviluppo, come richiesto dal piano; nessun messaggio reale inviato nei test. L’invio Resend in ambiente gestito richiede configurazione e verifica in M9. Errori durante l’invito eliminano l’account appena generato; un’email già presente viene rifiutata. I token di invito non vengono restituiti al browser né salvati nell’audit.
