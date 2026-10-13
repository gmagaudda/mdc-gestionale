# Budget suggerito per stagione

## Uso

In **Budget → Crea budget**, scegli brand, cliente e stagione. Il pannello «Suggerimento per la prossima stagione» calcola una proposta per quella combinazione. Il codice della stagione deve essere SS o FW seguito dall’anno, per esempio SS28 o FW2028.

1. Seleziona **Calcola suggerimento**.
2. Controlla spesa netta, fonte, stato e peso delle stagioni.
3. In **Verifica le stagioni e le eccezioni**, conferma la chiusura delle stagioni senza date, gli zeri verificati o le esclusioni eccezionali. Le conferme richiedono una motivazione.
4. Se modifichi impostazioni o eccezioni, seleziona **Ricalcola suggerimento**.
5. Seleziona **Usa importo suggerito**, controlla il periodo del budget e infine **Salva budget**. Se cambi l’importo suggerito, indica il motivo.

L’anteprima non scrive budget. Solo admin con MFA e accounting possono calcolare e applicare una proposta; staff può leggere l’origine nel dettaglio. Il portale brand non espone lo storico cliente o le motivazioni.

## Formula e stagionalità

Si considerano dodici stagioni precedenti, equivalenti a sei anni. SS è confrontata solo con SS, FW solo con FW. Vengono utilizzate le tre stagioni omologhe più recenti con dati disponibili e chiusura verificata. I pesi iniziali sono 50, 30 e 20, modificabili da 1 a 1.000. Con due o una stagione, si usano i primi pesi disponibili e si divide per la loro somma.

La proposta è arrotondata al centesimo una sola volta:

`somma(spesa netta in centesimi × peso) × (10.000 + crescita in punti base) / (somma pesi × 10.000)`.

La crescita iniziale è zero; si può impostare da −100% a +100%. Il limite del budget resta 1.000.000.000.000 centesimi. Non viene effettuato un arrotondamento a centinaia di euro.

Per il profilo servono almeno due anni con entrambe le stagioni concluse e disponibili. Un cliente è prevalentemente estivo quando, in ogni coppia osservata, FW non supera il 20% di SS e SS è positiva; viceversa per un cliente invernale. La soglia è modificabile da 1% a 50%. Entrambe le spese positive e sopra la soglia danno un profilo continuativo; cicli misti o tutti a zero danno un profilo irregolare. Meno di due coppie dà «Storico insufficiente».

Il profilo può essere corretto con motivazione e viene conservato nella proposta applicata. Descrive lo storico e non modifica la formula: un cliente estivo riceve un budget FW basato sulle sue FW, eventualmente zero. Copertura e numero di cicli sono indicatori di disponibilità dei dati, non una probabilità statistica.

## Fonti e dati mancanti

- **Ordini confermati:** netto dopo sconti, dagli stati confirmed/in_production/shipped/delivered/invoiced. Bozze, annullati e archiviati sono esclusi. La misura rappresenta l’ordinato, non i pagamenti incassati.
- **Storico Excel:** solo righe performance importate di un lotto completato, metriche ORDINE della stagione. I budget Excel non diventano spesa. Celle vuote restano mancanti; zero resta zero. Un aggregato con una cella mancante è considerato incompleto.
- **Abbinamento automatico:** nome brand e ragione sociale oppure insegna cliente coincidenti senza distinzione di maiuscole o spazi esterni, identità univoche. Si usa un solo lotto, il più recente; non vengono sommate ripetizioni dello stesso storico. Più città/paesi o nomi anagrafici duplicati richiedono la scelta esplicita dell’identità in **Configura il calcolo → Storico Excel**. L’operatore può anche abbinare nomi differenti.
- **Fonti sovrapposte:** se sono presenti ordini e storico per la stessa stagione, il dato resta in conflitto finché si sceglie quale fonte utilizzare. Le due spese non sono sommate.
- **Chiusura:** si considera la data finale più tarda fra campagna e consegna. Senza una data finale, serve conferma con motivazione. Una fine futura non può essere forzata come conclusa.
- **Nessun ordine:** l’assenza di ordini non documenta la completezza dello storico. Resta dato mancante finché l’operatore conferma uno zero. Una spesa positiva in una delle fonti impedisce di dichiarare zero.
- **Eccezione:** una stagione può essere esclusa con motivazione. Il valore e la motivazione restano nella snapshot applicata.

Non vengono inventate date per lo storico SS/FW. Il periodo del budget operativo resta obbligatorio e viene scelto nel modulo.

## Tracciabilità

Il salvataggio ricalcola la proposta dal database. Un cambiamento rispetto all’anteprima produce un errore recuperabile e richiede una nuova anteprima. Budget, note, origine e audit sono scritti nella stessa transazione; un errore o una sovrapposizione annulla l’intera operazione.

Il dettaglio conserva impostazioni, importo suggerito e applicato, fonti, pesi, copertura, profilo ed eccezioni. Gli aggiornamenti successivi del budget manuale non alterano questa snapshot iniziale, che mostra l’importo applicato al momento della creazione. Il suggerimento è disponibile nella creazione di un budget; la modifica di un budget esistente conserva il normale flusso manuale.
