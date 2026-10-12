# Importazione e analisi delle stagioni

## Dati storici dal file RECAP BUDGET

Da **Importazioni**, scegli **Importa dati storici** e carica il file Excel. La lettura avviene nel browser; il file originale viene caricato solo dopo la conferma del salvataggio.

Il profilo attuale riconosce il foglio `RECAP BUDGET ` anche con lo spazio finale. Cerca le intestazioni BRAND e CLIENTI (nel file fornito sono in riga 2), poi legge queste cinque misure:

| Colonna del file | Indicatore       | Stagione |
| ---------------- | ---------------- | -------- |
| ORDINE SS26      | Ordinato storico | SS26     |
| BDG FW26         | Budget storico   | FW26     |
| ORDINE FW26      | Ordinato storico | FW26     |
| BDG SS27         | Budget storico   | SS27     |
| ORDINE SS27      | Ordinato storico | SS27     |

Commerciale, AREA, STATO (paese), REGIONE, CITTA e STATUS forniscono i filtri. CLIENTI è una denominazione storica, non un collegamento automatico all'anagrafica operativa. Non occorrono date: la stagione deriva dalla colonna. Il flusso conserva dati storici e non crea ordini o budget operativi.

L'anteprima legge da **Analisi Pivot** i brand elencati sotto Etichette di riga e i cinque totali della riga Totale complessivo. Il dettaglio può contenere altri brand: questi vengono conservati e sono visibili scegliendo **Tutti i brand del file**. Con un singolo brand selezionato, il report usa quel brand anche se escluso dalla pivot.

Controlla le segnalazioni. Le righe senza nome negozio restano nei totali del brand e sono escluse dal conteggio delle denominazioni distinte (nome, città, paese). Un brand assente o un importo non valido blocca il salvataggio. Puoi scaricare tutte le segnalazioni in CSV. Le celle vuote restano **Non presente**, senza diventare zero. Lo scostamento percentuale non è calcolabile se il budget è zero o mancante.

Conferma **Salva dati storici** dopo aver confrontato i totali. Se differiscono dalla pivot, la finestra richiede una conferma esplicita. Il server rivalida ogni riga e ripete il controllo delle somme prima di completare il lotto. Le righe vengono inviate a blocchi di 500; un tentativo ripetuto non le duplica.

## Analisi e download

**Analisi stagioni** consente di scegliere una versione del file, filtrare e raggruppare per brand, area, commerciale, paese, regione o negozio. Il riepilogo mostra sempre il totale del perimetro applicato, anche quando i gruppi sono su più pagine (100 per pagina). Le righe di origine non indicano il numero dei singoli ordini.

Scarica Excel o CSV dopo aver applicato i filtri. Il download comprende tutti i gruppi del perimetro, fino a 5.000. L'Excel include riepilogo, dati aggregati, scostamenti e filtri; il CSV contiene i dati aggregati. Gli euro sono celle testo esatte per preservare i centesimi. I testi sono protetti dall'iniezione di formule.

Lo **Storico importazioni** mostra autore, file, stato e data. **Scarica originale** richiede una sessione autorizzata e genera un link privato valido 60 secondi. Non condividere il link firmato. La scadenza predefinita del file è 90 giorni, configurabile con `IMPORT_RETENTION_DAYS` (1–3650). Alla scadenza il download è negato anche prima della pulizia. Il cron giornaliero delle 06:00 UTC rimuove il file da Storage tramite API, elimina le celle grezze e conserva dati normalizzati, riepiloghi, audit e snapshot di rollback. In locale esegui il cron manualmente o usa Wrangler con `--test-scheduled`.

**Annulla importazione** richiede conferma ed esclude il lotto dall'analisi. Conserva il file e lo storico; non modifica dati operativi. Lo stesso file può essere importato nuovamente dopo l'annullamento. Se il lotto è già completo, un nuovo caricamento segnala il duplicato; un lotto incompleto dello stesso autore può riprendere il salvataggio.

## Limiti e accesso

Il profilo storico accetta XLSX senza macro o collegamenti esterni, fino a 10 MiB, 20.000 righe non vuote complessive, 20 fogli e 128 colonne. Legge i risultati delle formule salvati in Excel, senza ricalcolo. Se i risultati non sono aggiornati, ricalcola e salva il workbook in Excel prima di caricarlo. File non validi o oltre i limiti ricevono un messaggio italiano.

I dati storici sono riservati agli amministratori. Accounting può accedere solo ai lotti budget previsti dalle policy. Staff e utenti brand non accedono alle importazioni né ai relativi download. Le scritture e l'audit sono transazionali; gli originali non vengono messi in cache offline.

## Importazione operativa di negozi, ordini e budget

Scegli **Importa dati operativi**. Scarica il modello Excel a tre fogli oppure carica XLSX/CSV. Accounting usa solo il foglio Budget; un amministratore conferma la scrittura finale. Le fixture sintetiche si generano con `pnpm fixtures:import`; nessun dato reale è nel repository.

1. **Mappatura**: seleziona i fogli, l’entità, la riga di intestazione e la colonna per ciascun campo. I suggerimenti ambigui restano vuoti. Imposta i formati numerici e delle date e, se necessario, valori predefiniti per campi senza colonna. Le celle vuote in colonne mappate non prendono il valore predefinito. Salva un profilo per riutilizzarlo.
2. **Validazione**: verifica errori, avvisi e conteggi. Scarica le segnalazioni CSV; correggi il file o escludi esplicitamente le righe errate negli abbinamenti. Prezzi e importi devono essere non negativi; quantità intere positive; P.IVA e codice fiscale sono controllati formalmente, senza verificare l’assegnazione esterna. Il limite di 20.000 righe comprende le intestazioni e tutti i fogli non vuoti.
3. **Staging**: prepara gli abbinamenti. Il server normalizza nuovamente le celle con il profilo salvato, in blocchi di massimo 500 righe e 650.000 byte. Le revisioni impediscono di mescolare decisioni e mappature di due finestre. Rimappare il lotto cancella lo staging precedente. Un file identico completo segnala un duplicato; un lotto incompleto dello stesso autore può riprendere.
4. **Abbinamenti**: conferma negozio, brand, stagione e SKU. I suggerimenti non diventano decisioni senza salvataggio. Gli amministratori possono scegliere crea o ignora; la creazione di stagioni deve essere autorizzata anche nel profilo. Cambiare brand o stagione invalida gli abbinamenti dipendenti. Le decisioni restano dopo il ricaricamento.
5. **Riepilogo**: controlla totali per brand/stagione e differenze campo per campo. Puoi inserire i totali netti attesi per brand in euro; salvali prima di confermare. Uno scostamento richiede conferma esplicita. Il lordo è non disponibile finché manca l’IVA dell’articolo.
6. **Conferma**: il database scrive negozi, ordini e budget in una transazione unica con audit. Un errore annulla tutte le modifiche. `insert_only` salta i record già presenti; `upsert` aggiorna solo dopo conferma. Gli ordini esistenti si aggiornano solo se sono bozze e restano bozze. Non vengono sovrascritti ordini confermati.
7. **Report e rollback**: la pagina del lotto e la scheda in Panoramica consentono di consultare i totali. Excel include totali, confronto budget e origine del report; CSV include il confronto. Il limite di export è 5.000 budget. I report sono snapshot del completamento e restano stabili dopo modifiche successive o rollback. Il confronto precedente usa SS dell’anno per FW, e FW dell’anno precedente per SS. Altri codici, stagioni mancanti e budget zero non producono percentuali inventate.

### Campi e granularità

Negozi: ragione sociale obbligatoria; codice esterno, P.IVA, codice fiscale, indirizzo, città, paese, recapiti aziendali, commerciale, area, categoria e note facoltativi. Le colonne non mappate preservano i valori esistenti negli aggiornamenti. I recapiti aziendali non inventano una persona di contatto.

Ordini: negozio, brand, stagione e data ordine obbligatori. **Righe ordine** richiede SKU, quantità e prezzo unitario; un nuovo articolo richiede anche descrizione, taglia, colore e IVA. Il raggruppamento usa brand e riferimento esterno, oppure negozio + brand + stagione + data. **Totali ordine** richiede totale netto, descrizione e IVA e crea una sola riga di riepilogo con quantità 1; entrambi gli sconti devono essere zero. Non usare questo flusso per il RECAP storico senza date.

Budget: brand, importo, inizio e fine validità obbligatori; stagione e negozio facoltativi. Periodi sovrapposti nello stesso ambito sono rifiutati dal database. I confronti distinguono gli ordini del lotto nel periodo del budget dal venduto confermato dell’intera stagione precedente.

### Condizioni di annullamento

L’amministratore può annullare un lotto completo se nessun record coinvolto è stato modificato o usato da nuovi dati. Un ordine fatturato o avanzato oltre confermato impedisce l’annullamento. I record creati vengono archiviati; gli aggiornamenti e i valori fiscali storici delle righe vengono ripristinati dagli snapshot. Il rollback non cancella fisicamente ordini o anagrafiche. Un errore lascia l’intero lotto intatto.

### Pulizia degli originali

`POST /api/cron/imports` richiede il segreto cron in Authorization. Ogni esecuzione tratta massimo 100 file scaduti; se resta lavoro o una rimozione fallisce restituisce 503 per richiedere un nuovo tentativo. I lotti scaduti incompleti diventano falliti e richiedono un nuovo upload. Completati e annullati conservano l’esito e il report. Il cron usa una credenziale privilegiata solo sul server per la pulizia; le query e le scritture commerciali usano la sessione dell’utente e le RLS.
