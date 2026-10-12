# Architettura

## Calendario, feed e job

Gli eventi usano sessione/RLS per CRUD, archivio e drag. L’abbonamento iCal usa una credenziale bearer casuale conservata soltanto come SHA-256; le azioni con sessione possono ruotare/revocare solo il token del proprio profilo attivo. La route pubblica e il cron sono gli unici accessi di questo modulo via service_role: chiamano RPC ristrette con select esplicite. `read_ical_feed` rivaluta profilo, ruolo, associazione al brand attivo, condivisione e archivio; non restituisce riferimenti a clienti/assegnatari. RLS e grant impediscono agli utenti di invocare letture arbitrarie del feed o il job. Risposte no-store, nessuna credenziale nei log applicativi.

Il cron Workers riusa il fetch OpenNext e invoca la route con CRON_SECRET. Claim e completamento hanno audit nella stessa transazione SQL; vincolo unico evento/assegnatario/data, lease di 10 minuti e chiave Resend stabile. `logged` identifica la sola simulazione locale; `sent` richiede successo del provider. La consegna esterna non è una transazione database: idempotenza provider e lease riducono i duplicati, senza promettere consegna esattamente una volta. Le esecuzioni con errori/limite ritornano 503 e sono ripetibili.
