# Decisioni

| Data       | Scelta                                                                         | Motivo                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-12 | App Next.js 16 con App Router, TypeScript strict e Tailwind 4                  | Sono le versioni stabili disponibili all'avvio; il piano richiede versioni fissate nel lockfile.                                    |
| 2026-10-12 | Nome tecnico `mdc-gestionale`; nome visibile provvisorio “Gestionale showroom” | Il nome definitivo dell'app è un input umano richiesto prima del manifest PWA.                                                      |
| 2026-10-12 | Supabase CLI native runtime per lo sviluppo locale su Apple Silicon            | Docker non è disponibile sulla macchina; la CLI 2.120 supporta `stack = true` sperimentale. La CI userà il runtime Docker standard. |
| 2026-10-12 | I nuovi utenti ricevono inizialmente il ruolo `brand`                          | È il privilegio minimo; un admin abilita esplicitamente gli utenti interni.                                                         |
| 2026-10-12 | Uso di `proxy.ts` per il refresh della sessione                                | Next.js 16 ha rinominato il middleware in Proxy; la sessione è verificata con `getClaims()`, non con il cookie non validato.        |
