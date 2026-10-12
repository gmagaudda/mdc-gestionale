# Fatturazione

## Modalità locale

`INVOICING_PROVIDER=mock` resta il default. Generazione, aggiornamento stato, callback, incassi e annullamento sono simulati nel database locale. Nessuna fattura fiscale viene inviata. La factory runtime non usa uno store in memoria.

## Fatture in Cloud

Attivazione esplicita con `INVOICING_PROVIDER=fic` e `FIC_ACCESS_TOKEN` server. Il token può essere ottenuto con OAuth o con il metodo manuale documentato dal provider. `exchangeFicToken` supporta scambio codice con PKCE e refresh; restituisce entrambi i token. Il refresh non è automatico: l'operatore deve salvare anche il refresh token ruotato prima di sostituire le credenziali e riavviare l'ambiente locale. Un refresh automatico in memoria perderebbe la rotazione tra isolate Workers. [Autenticazione ufficiale](https://developers.fattureincloud.it/docs/basics/authentication/), [OAuth](https://developers.fattureincloud.it/docs/authentication/code-flow/vanilla-code/).

Configura `FIC_COMPANIES_JSON` come mappa esplicita UUID brand → configurazione azienda. Esempio **sintetico**, da sostituire dopo verifica delle aziende autorizzate:

```json
{
  "00000000-0000-4000-8000-000000000804": {
    "companyId": 12345,
    "supplierVat": "12345678901",
    "numeration": "/MDC",
    "vatIds": { "22": 0 }
  }
}
```

Nessuna azienda predefinita per brand non mappati. Verifica in Fatture in Cloud che companyId sia l'emittente con quella P.IVA e che il sezionale sia corretto. La API Company Info non espone una P.IVA fiscale verificabile: la corrispondenza azienda/P.IVA nella configurazione richiede questa verifica umana. L'app confronta la P.IVA dello snapshot con la configurazione, e gli ID IVA con l'elenco restituito da Pre-Create Info. Non deduce natura IVA, esenzioni o aliquote zero da una percentuale ambigua. Permessi necessari: lettura/scrittura fatture e lettura impostazioni. [OpenAPI ufficiale](https://github.com/fattureincloud/openapi-fattureincloud), [creazione](https://developers.fattureincloud.it/docs/guides/invoice-creation/).

I segreti restano nei file ignorati `.env.local`/`.dev.vars` per i rispettivi server, o nei segreti del futuro ambiente gestito. Non inserirli nelle variabili NEXT_PUBLIC, nei log o nel repository.

## Importi e riferimenti

Il riferimento interno resta immutabile. Fatture in Cloud assegna il progressivo del documento; l'app conserva e mostra separatamente numero esterno e azienda/documento. La richiesta copia il cliente e le righe senza creare nuove anagrafiche nel provider. Prezzi effettivi comprendono gli sconti già applicati nello snapshot; quantità preservate. I totali sono verificati con l'endpoint di calcolo prima della creazione e con la risposta dopo la creazione. Differenze anche di un centesimo bloccano la finalizzazione. Anche il polling rifiuta totali esterni diversi da quelli conservati. [Calcolo totali](https://developers.fattureincloud.it/docs/guides/invoice-totals/).

Creare il documento **non invia a SdI**: la richiesta imposta e_invoice=false e non chiama e_invoice/send. Invio elettronico e rettifiche si gestiscono in Fatture in Cloud. Gli stati di invio/SdI osservati successivamente vengono tradotti negli stati applicativi; error/attempt/pending non diventano falsi rifiuti. I pagamenti del provider possono segnalare paid, ma il registro incassi locale richiede il movimento effettivo.

## Retry e creazione incerta

Un registro SQL conserva fingerprint, azienda, stato del tentativo e identità esterna. Prima del POST si scrive uncertain. Una stringa di correlazione in subject comprende chiave idempotente e fingerprint, cercata con il filtro documentato any_subject. Un retry dopo timeout recupera il documento corrispondente; richieste diverse con la stessa chiave sono respinte. Se non esiste una corrispondenza visibile dopo una risposta incerta, l'app non ripete il POST: una lista vuota non prova che la richiesta precedente non sia stata eseguita.

Risposte di rifiuto HTTP consentono un nuovo tentativo esplicito; rete/5xx restano incerte. Solo letture e calcolo totali hanno retry automatici limitati con backoff/Retry-After. Errori restituiti all'utente sono codici stabili, senza contenuto diagnostico del provider. [Filtri ufficiali](https://developers.fattureincloud.it/docs/basics/filter-results/queries/).

Se il recupero resta bloccato, verificare documento/sezionale/subject in Fatture in Cloud e contattare l'amministratore. Non cancellare la fattura locale e non azzerare il registro per tentare di nuovo alla cieca. Non viene promessa atomicità tra provider esterno e database.

## Annullamento

Consentito solo per documenti non elettronici, non inviati, non bloccati e senza incassi presso entrambi i sistemi. La DELETE del documento attivo è seguita dalla verifica nel cestino recuperabile; non viene mai chiamata la DELETE del cestino. Lo snapshot locale e gli audit restano conservati. Il tempo di conservazione nel cestino dipende dal piano Fatture in Cloud. Una risposta 404 del documento attivo da sola non equivale a un annullamento. [API documento/cestino](https://github.com/fattureincloud/openapi-fattureincloud/blob/master/openapi-enriched.yaml), [conservazione del provider](https://www.fattureincloud.it/costo/).

Un rifiuto certo prima della scrittura libera il blocco incassi. Un esito incerto mantiene il blocco fino alla verifica. Non è un flusso per note di credito, correzioni SdI o fatture sostitutive.

## Callback e recupero

`GET /api/webhooks/invoicing` gestisce la verifica della sottoscrizione (header/query challenge) dopo autenticazione JWT. `POST` accetta CloudEvents binari o strutturati, massimo 16 KiB/1.000 ID. Configura `FIC_APPLICATION_ID` e APP_URL HTTPS uguale all'origine pubblica della sottoscrizione. Il JWT viene verificato con la chiave ES256 pubblicata dal provider; issuer, audience, application ID, scadenza, subject ed event ID devono corrispondere. La chiave non viene presa dal messaggio ricevuto. [Sottoscrizioni](https://developers.fattureincloud.it/docs/webhooks/subscriptions/), [notifiche e chiave pubblica](https://developers.fattureincloud.it/docs/webhooks/notifications/).

Sottoscrivi create/update/delete/email_sent delle fatture ed e_invoices.status_update. I payload non portano lo stato contabile: la route salva metadati minimi di documenti locali già collegati e risponde 202. Un job after recupera lo stato autenticato dal provider, in gruppi di tre e massimo dieci eventi per claim. Nessun JWT, segreto o payload fiscale viene conservato. Callback duplicati non riaprono lavori completati; contenuto diverso con lo stesso ID viene rifiutato. Associazioni ignote non avviano letture esterne.

Cloudflare Cron `*/5 * * * *` invoca `/api/cron/invoicing` con CRON_SECRET soltanto in modalità fic; il cron giornaliero dei promemoria resta separato. Claim/lease di dieci minuti, errori persistenti e aggiornamenti con audit transazionale permettono il recupero. La route cron si può invocare manualmente in locale con il segreto configurato, senza stamparlo. “Aggiorna stato” offre anche un recupero interattivo. Stato monotono: rettifiche di documenti rifiutati/pagati richiedono un processo dedicato.

## Verifica e limiti di accettazione

Contract test comuni a mock/FIC: creazione, lettura, input errato, stessa chiave, conflitto, concorrenza, annullamento ripetuto e callback senza autenticazione. Recording HTTP sintetiche verificano la forma API ufficiale, retry, timeout dopo creazione, configurazione fiscale, totali e stati. Test JWT con chiavi sintetiche e import della chiave pubblica ufficiale; test SQL con ruoli reali su journal, finalizzazione, code e incassi. Spike workerd locale con trasporto HTTP iniettato, timeout recuperato, cancellazione e verifica ES256.

Il collegamento a un account reale, i sezionali/ID IVA effettivi, OAuth reale, ricezione webhook via HTTPS e le regole fiscali del caso concreto restano da verificare con credenziali e configurazione dell'emittente. Per indicazione dell'umano i test attuali sono locali; nessun deploy e nessuna emissione reale.
