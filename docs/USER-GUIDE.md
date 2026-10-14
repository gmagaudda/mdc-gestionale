# Guida rapida per ruolo

## Accesso

Accedi con email e password. Il recupero invia un link da aprire nello stesso browser. Gli amministratori configurano un’app di autenticazione al primo accesso e inseriscono il codice a sei cifre ad ogni nuova sessione. Conserva privatamente la chiave di configurazione. Se perdi l’app, contatta il responsabile: il recupero password non elimina il secondo fattore.

Il menu utente si apre dall’avatar nel fondo della sidebar. **Aspetto** passa direttamente da chiaro a scuro; **Notifiche** attiva o disattiva i promemoria su questo dispositivo. L’icona e lo stato accessibile indicano la scelta attuale. Per attivare le notifiche serve connessione e, quando richiesto, il consenso del browser; sono disponibili agli utenti interni. **Accento** apre una piccola palette vicino all’avatar: Salvia, Blu, Viola e Neutro. Tema e accento si conservano in questo browser. **Installa app** apre la guida di installazione; **Esci** revoca il consenso alle notifiche su tutti i dispositivi e pulisce i dati locali. Salva le bozze prima di uscire o aggiornare l’app.

## Admin

Gestisci utenti e associazioni ai brand in Impostazioni → Utenti; consulta l’audit in Modifiche. Invita solo con servizio email configurato. Crea prima brand e stagioni, poi prodotti e negozi; controlla dati fiscali, prezzi e varianti.

Importazioni → Dati storici legge il RECAP BUDGET e alimenta Analisi. Le colonne FW26/SS27 identificano la stagione senza inventare date: i valori ORDINE restano dati aggregati storici. Analisi consente filtri e raggruppamenti coerenti con la pivot.

Importazioni → Importazione operativa carica negozi, ordini o budget con colonne mappate. Correggi/escludi errori, conferma gli abbinamenti e controlla anteprima e differenze prima di confermare. Il riepilogo permette export, originale privato e annullamento se i dati non sono stati modificati/utilizzati successivamente. Un budget operativo richiede date esplicite; il foglio storico non le fornisce. Vedi [IMPORT.md](IMPORT.md).

## Staff

Gestisci negozi, catalogo, ordini, appuntamenti e documenti. Un ordine si modifica come bozza; controlla quantità, sconti e totale prima di confermarlo e avanzarne lo stato. Dal dettaglio scarica la conferma PDF; dalla lista ordini esporta il CSV con i filtri correnti. Dalla stagione scarica il catalogo. Leggi dashboard, budget, provvigioni e fatture.

Nel dettaglio di un ordine confermato usa «Invia conferma», scegli un contatto del cliente e controlla l’esito. Se mancano destinatari, aggiungi un contatto con email dal cliente. In locale la modalità log registra l’operazione senza inviare email. Lo storico resta visibile dopo il ricaricamento; la stessa conferma completata non viene inviata di nuovo allo stesso contatto.

Per condividere un documento o evento con un brand, abilita esplicitamente la visibilità. Controlla il contenuto del file: viene condiviso integralmente. Il calendario offre un abbonamento iCal personale, revocabile; conserva privatamente il suo link.

## Amministrazione

Gestisci budget con periodo e perimetro espliciti, controlla venduto, scostamenti e provvigioni. Puoi importare e preparare budget; la conferma operativa e l’annullamento richiedono un admin.

Da un ordine consegnato genera la fattura, verifica dati fiscali e scadenza. In locale l’emissione è simulata. Registra gli incassi effettivi: lo stato “pagata” del provider non crea automaticamente un movimento di denaro. Dopo un errore riprova sulla fattura esistente. Le rettifiche fiscali richiedono un flusso esterno al gestionale corrente. Vedi [INVOICING.md](INVOICING.md).

## Brand

Consulta dashboard, ordini, vendite, calendario e documenti dei soli brand associati. Le informazioni sono in lettura; senza associazioni chiedi all’amministratore. La visibilità dei nomi dei negozi dipende dalla configurazione del brand e si applica anche agli export. Il portale non mostra provvigioni, note interne o fatture.

## Export

Le liste principali hanno «Esporta CSV»: il file comprende tutte le pagine con ricerca, ordinamento e filtri correnti. Il limite è 10.000 righe; oltre il limite restringi i filtri. Importi in formato italiano, separatore punto e virgola. Le provvigioni offrono anche Excel.

In Brand, Negozi, Stagioni, Prodotti, Budget, Documenti e Fatture apri «Filtri per colonna» per affinare la ricerca sui campi disponibili. I filtri si combinano: il testo cerca anche dentro al valore, mentre euro, date e dimensioni in byte devono coincidere esattamente. Inserisci gli importi senza separatori delle migliaia, ad esempio `123,45`. «Azzera filtri per colonna» conserva la ricerca e i filtri di dominio.

Nelle stesse liste e in Ordini, seleziona le caselle delle righe oppure tutte quelle della pagina e usa «Esporta selezione CSV». Il file rispetta anche i filtri correnti. La selezione riguarda la pagina visibile e viene azzerata cambiando pagina, filtri o ordinamento; «Esporta CSV» continua a comprendere tutte le pagine.

Dal dettaglio brand o dalla panoramica filtrata per brand scarica il riepilogo vendite PDF. Nel portale Vendite trovi CSV e riepilogo PDF quando è selezionato un brand (oppure ne hai uno solo). Stagione e date ordine vengono rispettate; oltre 1.000 gruppi restringi i filtri per il PDF. I nomi/città restano riservati se il brand non ha il permesso di vederli. Questi export riguardano ordini operativi; i dati storici Excel hanno export separati in Analisi.

## Come leggere i confronti

Il venduto comprende ordini confermati e successivi, escludendo bozze e annullati. Il fatturato comprende fatture emesse/inviate/pagate. Gli importi sono in euro, conservati in centesimi interi. Uno scostamento percentuale rispetto a zero o a dati mancanti non è calcolabile. I dati storici importati sono distinti dai movimenti operativi; nei report controlla stagione e filtri prima di confrontare totali.

## Budget suggerito per la stagione successiva

In **Budget → Crea budget**, seleziona brand, cliente e stagione e usa **Calcola suggerimento**. Il confronto usa solo stagioni omologhe (SS con SS, FW con FW). Verifica le stagioni senza date, gli zeri e le eventuali eccezioni; poi ricalcola e seleziona **Usa importo suggerito**. Completa il periodo e salva il budget. Se cambi l’importo, indica il motivo.

Lo storico Excel è utilizzato solo da lotti completati. Celle vuote, stagioni aperte e conflitti fra fonti non diventano automaticamente zero. Puoi configurare pesi, crescita, profilo e fonte storica. Un cambiamento dopo l’accettazione richiede una nuova conferma oppure **Continua con budget manuale**. L’origine rimane consultabile nel dettaglio.

Regole, formula ed esempi: [Budget suggerito per stagione](BUDGET-RECOMMENDATIONS.md).

## Metriche delle liste

Tra titolo e filtri trovi tre card di riepilogo con il valore in grande e la variazione in alto a destra, quando confrontabile. I periodi 7, 30 e 90 giorni sono sempre visibili nella barra in fondo a ogni card: seleziona un periodo per aggiornare soltanto quella card. Da tastiera usa le frecce, Home o End. I dati includono tutte le pagine e rispettano ricerca e filtri della tabella. Il periodo delle card non limita le righe mostrate nella tabella.

Ordini e provvigioni usano la data ordine; le fatture usano la data fattura. Anagrafiche, catalogo, budget, documenti, utenti e importazioni usano la data di creazione. La nota sotto le card indica la base del calcolo. I saldi delle fatture sono quelli attuali delle fatture emesse nel periodo.

Il confronto usa lo stesso intervallo di calendario dell’anno precedente. Una base nulla o negativa non produce una percentuale fuorviante; il valore precedente resta visibile. I riepiloghi storici di Analisi hanno selettori di stagione: SS27 si confronta con SS26, mentre FW26 non ha un confronto FW25 quando quella stagione manca nel file. Le celle vuote restano dati non disponibili.

La paginazione usa pulsanti numerati, pagina attuale verde e puntini per le pagine intermedie. Ricerca, filtri e ordinamento restano applicati cambiando pagina.
