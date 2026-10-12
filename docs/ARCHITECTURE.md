# Architettura

## Calendario, feed e job

Gli eventi usano sessione/RLS per CRUD, archivio e drag. L’abbonamento iCal usa una credenziale bearer casuale conservata soltanto come SHA-256; le azioni con sessione possono ruotare/revocare solo il token del proprio profilo attivo. La route pubblica e il cron sono gli unici accessi di questo modulo via service_role: chiamano RPC ristrette con select esplicite. `read_ical_feed` rivaluta profilo, ruolo, associazione al brand attivo, condivisione e archivio; non restituisce riferimenti a clienti/assegnatari. RLS e grant impediscono agli utenti di invocare letture arbitrarie del feed o il job. Risposte no-store, nessuna credenziale nei log applicativi.

Il cron Workers riusa il fetch OpenNext e invoca la route con CRON_SECRET. Claim e completamento hanno audit nella stessa transazione SQL; vincolo unico evento/assegnatario/data, lease di 10 minuti e chiave Resend stabile. `logged` identifica la sola simulazione locale; `sent` richiede successo del provider. La consegna esterna non è una transazione database: idempotenza provider e lease riducono i duplicati, senza promettere consegna esattamente una volta. Le esecuzioni con errori/limite ritornano 503 e sono ripetibili.

## Documenti e Storage

Le route usano esclusivamente il client con sessione. `documents` ha RLS e audit; `ready` rende visibili soltanto upload finalizzati. Il trigger verifica brand/ordine/cliente e identità immutabile; la finalizzazione controlla size/mimetype dell’oggetto nel bucket privato. Le policy Storage autorizzano percorsi esatti, senza overwrite, usando il record metadata associato. Le scritture business e audit sono atomiche; il trasferimento Storage richiede compensazione e può lasciare un pending non visibile in caso di errore della pulizia.

Download autorizzato a ogni emissione, redirect no-store a URL firmato valido 120 secondi. Condivisione e archivio vengono rivalutati per nuove emissioni; URL già emessi restano validi fino alla scadenza. Nessun dato autenticato viene inserito in cache applicativa. Limite file 10 MiB, involucro multipart massimo 64 KiB aggiuntivi; il proxy Next consente 12 MB per evitare troncamento preliminare.

## Reporting

Tutte le viste economiche sono security_invoker e leggono tabelle protette da RLS. dashboard_report usa sessione, richiede ruolo interno e restituisce un payload validato con Zod: somme SQL in centesimi testuali, conteggi e serie limitate con dimensione totale dichiarata. Le tabelle visibili mantengono valori BigInt esatti; conversione numerica dei soli punti sicuri per la visualizzazione. Nessuna aggregazione economica nel frontend.

Il fatturato legge invoices emesse/inviate/pagate. La tabella è predisposta con vincoli importi e policy di sola lettura interna; scritture, snapshot e provider verranno aggiunti in M7. Il portale non può usare la RPC interna; avrà un payload dedicato con whitelist. Il confronto budget legge l'intero periodo inclusivo e lo scope della singola combinazione, indipendentemente dal periodo più stretto dei KPI.

## Provvigioni ed export

v_commissions security_invoker combina orders e le percentuali private, imponendo app.is_internal. commissions_report filtra e aggrega in una snapshot SQL, serializza centesimi come stringhe e pagina gli ordini. La route export usa sessione/ruolo interno/Zod e lo stesso payload con whitelist, rifiuta oltre 10.000 ordini o 500 brand e genera XLSX in memoria con ExcelJS writeBuffer. Risposte private/no-store/nosniff, nessun URL pubblico, filesystem o service role.
