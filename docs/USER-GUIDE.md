# Guida rapida per ruolo

## Accesso

Accedi con email e password. Il recupero invia un link da aprire nello stesso browser. Gli amministratori configurano un’app di autenticazione al primo accesso e inseriscono il codice a sei cifre ad ogni nuova sessione. Conserva privatamente la chiave di configurazione. Se perdi l’app, contatta il responsabile: il recupero password non elimina il secondo fattore.

Preferenze utente permette di scegliere tema, installare l’app e attivare/revocare notifiche. I salvataggi richiedono connessione. Salva le bozze prima di chiudere il tab o aggiornare l’app.

## Admin

Gestisci utenti e associazioni ai brand in Impostazioni → Utenti; consulta l’audit in Modifiche. Invita solo con servizio email configurato. Crea prima brand e stagioni, poi prodotti e negozi; controlla dati fiscali, prezzi e varianti.

Importazioni → Dati storici legge il RECAP BUDGET e alimenta Analisi. Le colonne FW26/SS27 identificano la stagione senza inventare date: i valori ORDINE restano dati aggregati storici. Analisi consente filtri e raggruppamenti coerenti con la pivot.

Importazioni → Importazione operativa carica negozi, ordini o budget con colonne mappate. Correggi/escludi errori, conferma gli abbinamenti e controlla anteprima e differenze prima di confermare. Il riepilogo permette export, originale privato e annullamento se i dati non sono stati modificati/utilizzati successivamente. Un budget operativo richiede date esplicite; il foglio storico non le fornisce. Vedi [IMPORT.md](IMPORT.md).

## Staff

Gestisci negozi, catalogo, ordini, appuntamenti e documenti. Un ordine si modifica come bozza; controlla quantità, sconti e totale prima di confermarlo e avanzarne lo stato. Dal dettaglio scarica conferma PDF e CSV; dalla stagione scarica il catalogo. Leggi dashboard, budget, provvigioni e fatture.

Per condividere un documento o evento con un brand, abilita esplicitamente la visibilità. Controlla il contenuto del file: viene condiviso integralmente. Il calendario offre un abbonamento iCal personale, revocabile; conserva privatamente il suo link.

## Amministrazione

Gestisci budget con periodo e perimetro espliciti, controlla venduto, scostamenti e provvigioni. Puoi importare e preparare budget; la conferma operativa e l’annullamento richiedono un admin.

Da un ordine consegnato genera la fattura, verifica dati fiscali e scadenza. In locale l’emissione è simulata. Registra gli incassi effettivi: lo stato “pagata” del provider non crea automaticamente un movimento di denaro. Dopo un errore riprova sulla fattura esistente. Le rettifiche fiscali richiedono un flusso esterno al gestionale corrente. Vedi [INVOICING.md](INVOICING.md).

## Brand

Consulta dashboard, ordini, vendite, calendario e documenti dei soli brand associati. Le informazioni sono in lettura; senza associazioni chiedi all’amministratore. La visibilità dei nomi dei negozi dipende dalla configurazione del brand e si applica anche agli export. Il portale non mostra provvigioni, note interne o fatture.

## Come leggere i confronti

Il venduto comprende ordini confermati e successivi, escludendo bozze e annullati. Il fatturato comprende fatture emesse/inviate/pagate. Gli importi sono in euro, conservati in centesimi interi. Uno scostamento percentuale rispetto a zero o a dati mancanti non è calcolabile. I dati storici importati sono distinti dai movimenti operativi; nei report controlla stagione e filtri prima di confrontare totali.
