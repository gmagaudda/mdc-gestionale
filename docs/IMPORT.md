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

Lo **Storico importazioni** mostra autore, file, stato e data. **Scarica originale** richiede una sessione autorizzata e genera un link privato valido 60 secondi. Non condividere il link firmato. La scadenza prevista del file è 90 giorni; il job automatico di eliminazione è ancora da implementare e non va dato per attivo.

**Annulla importazione** richiede conferma ed esclude il lotto dall'analisi. Conserva il file e lo storico; non modifica dati operativi. Lo stesso file può essere importato nuovamente dopo l'annullamento. Se il lotto è già completo, un nuovo caricamento segnala il duplicato; un lotto incompleto dello stesso autore può riprendere il salvataggio.

## Limiti e accesso

Il profilo storico accetta XLSX senza macro o collegamenti esterni, fino a 10 MiB, 20.000 righe non vuote complessive, 20 fogli e 128 colonne. Legge i risultati delle formule salvati in Excel, senza ricalcolo. Se i risultati non sono aggiornati, ricalcola e salva il workbook in Excel prima di caricarlo. File non validi o oltre i limiti ricevono un messaggio italiano.

I dati storici sono riservati agli amministratori. Accounting può accedere solo ai lotti budget previsti dalle policy. Staff e utenti brand non accedono alle importazioni né ai relativi download. Le scritture e l'audit sono transazionali; gli originali non vengono messi in cache offline.

## Flussi operativi del piano

L'importazione configurabile di negozi, ordini e budget, con profili, abbinamenti e rollback dei record operativi, è ancora in sviluppo. Non usare il profilo storico per creare questi record. Le fixture sintetiche si generano con `pnpm fixtures:import`; nessun dato reale fa parte del repository.
