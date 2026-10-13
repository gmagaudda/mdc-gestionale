# PLAN.md: Gestionale Showroom Moda (versione per agente)

> Documento operativo per un agente di sviluppo AI. Leggilo per intero prima di scrivere codice. Le sezioni 0-3 sono regole e decisioni vincolanti; la sezione 8 è la lista ordinata dei task da eseguire.

---

## 0. Regole operative per l'agente

1. **Lavora per milestone e per task nell'ordine indicato** (sez. 8). Non iniziare un task se le dipendenze non sono completate.
2. **Ogni task termina solo quando i criteri di accettazione sono verificati** eseguendo i comandi indicati. Se un controllo fallisce, correggi prima di proseguire.
3. **Un commit per task**, formato Conventional Commits (`feat(orders): add status transitions`). Referenzia l'ID del task nel messaggio (es. `[M3-T2]`).
4. **Design:** l'interfaccia è costruita sui componenti **Arc** (https://uiarc.dev) e segue le linee guida di 7.12; esiste il tema chiaro e scuro (7.13). Prima di scrivere qualsiasi UI cerca un componente o blocco Arc con il server MCP, leggi la sua pagina e usalo senza modificarne gli interni. Lo stile dell'intero sito deriva dai token di Arc: nessun colore, font o raggio scritto a mano.
5. **Non inventare requisiti.** Se un punto non è coperto qui, scegli l'opzione più semplice e reversibile, annotala in `docs/DECISIONS.md` (data, scelta, motivo) e prosegui. Fermati e chiedi all'umano solo per i punti elencati in sez. 10 come "bloccanti".
6. **Sicurezza prima di tutto:** nessun segreto nel repository, nessuna disabilitazione di RLS, nessuna query che usi la service role key da codice raggiungibile dal browser.
7. **Tutto ciò che è dato utente passa da validazione Zod** lato server, anche se già validato lato client.
8. **Testi dell'interfaccia in italiano**, tramite `next-intl` (file `messages/it.json`); nomi di codice, tabelle e commit in inglese.
9. Mantieni aggiornati `README.md` (setup e comandi) e `docs/DECISIONS.md`.
10. **Mobile-first e responsive:** ogni schermata deve funzionare da 360 px di larghezza in su (vedi 7.10). Scrivi prima il layout mobile, poi estendi ai breakpoint maggiori. Nessuna funzione può dipendere dall'hover o dal mouse.
11. **Compatibilità con il runtime Cloudflare Workers:** l'app gira su Workers (non su Node completo). Non usare `fs`, processi figli, Chromium locale o altre API Node non supportate. Ogni dipendenza con parti native o Node-only va verificata con `pnpm preview:cf` prima di adottarla; se non funziona, usa l'alternativa indicata e registra la scelta in `docs/DECISIONS.md`.
12. **PWA:** l'app è installabile (vedi 7.11). Il service worker non deve mai memorizzare in cache dati autenticati.

---

## 1. Contesto

Uno showroom di moda rappresenta più brand e li presenta a clienti professionali (boutique, retailer, buyer). Il gestionale sostituisce Excel, email e calendari sparsi.

**Copre:** anagrafiche brand e clienti, catalogo per collezione/stagione, ordini con matrice taglie × colori, calendario appuntamenti e scadenze, budget, venduto e fatturato, portale per i brand con accesso limitato ai propri dati.

**Utenti:** 5 interni (admin, staff, amministrazione) + utenti brand esterni. Carico basso: priorità a correttezza, isolamento dei dati e semplicità.

**Software di riferimento** (solo per ispirazione dei flussi): JOOR, NuORDER, Brandboom, Zedonk (ordini wholesale, matrice taglie/colori, line sheet, portale buyer), Odoo (CRM → preventivo → ordine → fattura), Fatture in Cloud/Danea (fatturazione italiana), HubSpot/Pipedrive (storico interazioni e attività).

**Piattaforma:** web application responsive (mobile-first), installabile come **PWA**, ospitata su **Cloudflare Workers**; database, autenticazione e storage su **Supabase** (servizio esterno, regione UE).

**Design:** interfaccia costruita sui componenti **Arc**, con tema chiaro e scuro; linee guida generali: Web Interface Guidelines (interfaces.rauno.me), Interface Cheat Sheet (interfaces.dev/cheat-sheet) e Lessons of Design (lessons.design); per le decisioni di interfaccia l'agente consulta anche le skill di jakubkrehel/skills (github.com/jakubkrehel/skills). Dettagli in 7.12 e 7.13.

**Fuori ambito:** identità di brand definitiva (logo, palette personalizzata), emissione diretta SDI, e-commerce B2C, magazzino/inventario, portale clienti (fase successiva), app native iOS/Android, modifica dei dati in modalità offline.

---

## 2. Decisioni già prese (vincolanti, modificabili solo dall'umano)

| #   | Tema                           | Decisione di default                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Visibilità clienti per i brand | Il brand vede, per i propri ordini, solo ragione sociale e città del cliente. Mai contatti, note interne, né ordini di altri brand. Flag `brands.can_see_customer_names` (default `true`); se `false` il cliente appare come "Cliente riservato".                                                                                                                                                                        |
| D2  | Permessi brand                 | Sola lettura su ordini, venduto/budget, documenti condivisi e calendario dei propri brand.                                                                                                                                                                                                                                                                                                                               |
| D3  | Provvigione                    | Percentuale per brand (`brands.commission_pct`), sovrascrivibile sul singolo ordine (`orders.commission_pct_override`).                                                                                                                                                                                                                                                                                                  |
| D4  | Venduto vs fatturato           | **Venduto** = somma netta degli ordini in stato `confirmed` o successivo (esclusi `draft`, `cancelled`). **Fatturato** = somma netta delle fatture emesse (non annullate).                                                                                                                                                                                                                                               |
| D5  | Fatturazione                   | Interfaccia `InvoicingProvider` con implementazione `MockInvoicingProvider` ora; Fatture in Cloud dietro la stessa interfaccia nella M7.                                                                                                                                                                                                                                                                                 |
| D6  | Lingua e valuta                | Solo italiano ed EUR, ma stringhe in `next-intl` e colonna `currency` (default `'EUR'`) per estensioni future.                                                                                                                                                                                                                                                                                                           |
| D7  | Magazzino                      | Non gestito. Gli ordini sono per stagione.                                                                                                                                                                                                                                                                                                                                                                               |
| D8  | Calendario esterno             | Solo feed iCal in sola lettura (nessuna sincronizzazione bidirezionale).                                                                                                                                                                                                                                                                                                                                                 |
| D9  | Importazione Excel             | Milestone **M10** (necessaria per il go-live): importa da un file Excel gli ordini di una stagione, i budget della stagione successiva e l'anagrafica dei negozi, e calcola il totale ordini per brand. **I campi reali del file non sono ancora noti**: il sistema è guidato da un catalogo di campi canonici e da profili di mappatura configurabili; i nomi reali delle colonne si configurano in M10-T9 (vedi 7.8).  |
| D10 | Accesso dati                   | Un'unica sorgente di verità per lo schema: migrazioni SQL di Supabase. Query a runtime tramite client Supabase con la sessione dell'utente, così le RLS sono sempre applicate.                                                                                                                                                                                                                                           |
| D11 | Responsive                     | Mobile-first con i breakpoint predefiniti di Tailwind; viewport minimo supportato 360 px; test automatici su 5 viewport (vedi 7.10).                                                                                                                                                                                                                                                                                     |
| D12 | PWA                            | Installabile (manifest + service worker). Offline in **sola lettura limitata**: pagina di fallback e asset statici in cache; nessun dato autenticato in cache, nessuna scrittura offline, nessuna sincronizzazione in background.                                                                                                                                                                                        |
| D13 | Hosting                        | App Next.js su **Cloudflare Workers** tramite adapter OpenNext (`@opennextjs/cloudflare`). Verificare nella documentazione Cloudflare corrente se per i nuovi progetti è raccomandata un'alternativa (es. vinext) e registrare la scelta in `docs/DECISIONS.md`. Il database resta su Supabase: l'app lo raggiunge via HTTPS con `supabase-js`, quindi **non servono Hyperdrive né connessioni TCP dirette** a Postgres. |
| D14 | Notifiche push                 | Opzionali (M8-T5), da attivare solo se lo spike di compatibilità con Workers dà esito positivo.                                                                                                                                                                                                                                                                                                                          |
| D15 | Libreria UI                    | **Arc** (https://uiarc.dev) è la base di tutta l'interfaccia: componenti e blocchi installati con la CLI di shadcn dal registry `@uiarc`. Si usano solo elementi **gratuiti**; i componenti Pro (es. `data-grid`, `share-access`) solo se l'umano dispone di un piano Pro.                                                                                                                                               |
| D16 | Tema                           | Tre modalità: **Sistema** (default), **Chiaro**, **Scuro**. Attributo `data-theme` su `<html>` (convenzione di Arc), gestito da `next-themes`. Colore d'accento di default: `neutral` (`data-accent="neutral"`), cambiabile in seguito con un solo attributo.                                                                                                                                                            |
| D17 | Linee guida                    | Ordine di precedenza: accessibilità (WCAG AA) > regole di Arc > Web Interface Guidelines (Rauno), Interface Cheat Sheet (interfaces.dev) e skill `better-*` di jakubkrehel/skills, tutte di pari livello > Lessons of Design. I conflitti noti sono risolti in 7.12.                                                                                                                                                     |
| D18 | Componenti non coperti da Arc  | Calendario eventi (FullCalendar) e matrice taglie × colori sono compositi: usano elementi e token Arc dove possibile, mai stili propri con colori fissi.                                                                                                                                                                                                                                                                 |
| D19 | Architettura import            | Il file viene letto **nel browser** (Web Worker), le righe vengono salvate in tabelle di staging a blocchi e il commit avviene in **una sola transazione Postgres** (funzione `import_commit`), con rollback per lotto. Non si legge l'XLSX sul runtime Workers (limiti di CPU e di librerie).                                                                                                                           |

---

## 3. Stack tecnologico (versioni: ultima stabile al momento dell'avvio, poi bloccate in `package.json`)

| Livello             | Scelta                                                                                                                                                                                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime             | Node.js LTS corrente, **pnpm**                                                                                                                                                                                                                                                |
| Framework           | **Next.js** (App Router) + **TypeScript** in modalità `strict`                                                                                                                                                                                                                |
| UI                  | **Arc** (componenti e blocchi React, token in `foundation.css`) installato con la CLI di **shadcn** dal registry `@uiarc`; **Tailwind CSS** solo per il layout (spaziature, flex/grid), mai per i colori                                                                      |
| Tema                | **next-themes** (`attribute="data-theme"`), tema chiaro, scuro e sistema; `theme-switch` di Arc                                                                                                                                                                               |
| Animazioni e icone  | **motion** (richiesta da Arc, con i token di `components/arc/lib/motion-tokens`) e **lucide-react**                                                                                                                                                                           |
| Design con agente   | Server **MCP di Arc** (`https://uiarc.dev/api/mcp`) collegato a **Codex** + regole Arc in `AGENTS.md` + skill di interfaccia `jakubkrehel/skills` (installate con `npx skills add`)                                                                                           |
| Tabelle             | Componenti Arc (`sortable-data-table`, `filter-toolbar`, `pagination`, `search-field`); **@tanstack/react-table** solo come logica headless se Arc non copre paginazione/ordinamento lato server, con rendering sempre tramite elementi e token Arc                           |
| Form                | **react-hook-form** + **zod** + `@hookform/resolvers`                                                                                                                                                                                                                         |
| Stato server client | **@tanstack/react-query**                                                                                                                                                                                                                                                     |
| DB / Auth / Storage | **Supabase** (Postgres, Auth, Storage); sviluppo locale con **Supabase CLI** (`supabase start`)                                                                                                                                                                               |
| Client DB           | `@supabase/supabase-js` + `@supabase/ssr`; tipi generati con `supabase gen types typescript`                                                                                                                                                                                  |
| Calendario          | **FullCalendar** (`@fullcalendar/react`, daygrid, timegrid, list, interaction) con stile mappato sui token Arc tramite variabili CSS `--fc-*`; `calendar` e `date-picker` di Arc per la selezione delle date                                                                  |
| Grafici             | Grafici **Arc** (`bar-chart`, `line-chart`, `donut-chart`, `sparkline`, `metric-card`); **Recharts** solo se serve un grafico assente tra quelli gratuiti di Arc                                                                                                              |
| PDF                 | Interfaccia `PdfRenderer`; libreria scelta con spike su Workers in M3-T5 (candidati: `@react-pdf/renderer`, `pdf-lib`; fallback: Cloudflare Browser Rendering). Vedi 7.4                                                                                                      |
| Email               | **Resend** + **@react-email/components**                                                                                                                                                                                                                                      |
| Import/Export       | **papaparse** (CSV); lettura XLSX **nel browser** con libreria scelta in M10-T1 (candidati: `exceljs` build browser, `read-excel-file`, SheetJS CE); scrittura XLSX per gli export con `exceljs` (da verificare su Workers, vedi 7.8); `pg_trgm` per l'abbinamento dei negozi |
| Date                | **date-fns** (+ `date-fns-tz`), fuso `Europe/Rome`                                                                                                                                                                                                                            |
| i18n                | **next-intl**                                                                                                                                                                                                                                                                 |
| PWA                 | `app/manifest.ts` (manifest nativo di Next.js) + service worker scritto a mano in `public/sw.js` (poche decine di righe, controllo totale sulla cache); **Serwist** solo se serve più complessità                                                                             |
| Job schedulati      | **pg_cron** + `pg_net` che chiama via HTTPS un route handler protetto da `CRON_SECRET` (alternativa: Cloudflare Cron Triggers)                                                                                                                                                |
| Errori              | **Sentry** con SDK per Cloudflare (opzionale in M9, non bloccante)                                                                                                                                                                                                            |
| Test                | **Vitest** (unit), **Playwright** (e2e), **pgTAP** o test Vitest contro Supabase locale (RLS)                                                                                                                                                                                 |
| Qualità             | **ESLint**, **Prettier**, **tsc --noEmit**, **husky** + **lint-staged**                                                                                                                                                                                                       |
| CI                  | **GitHub Actions**                                                                                                                                                                                                                                                            |
| Hosting             | **Cloudflare Workers** (app, via OpenNext + **Wrangler**; piano a pagamento probabilmente necessario per i limiti di dimensione del bundle: verificare) + **Supabase** (progetto gestito, regione UE; abilitare Smart Placement per avvicinare il Worker al database)         |

---

## 4. Convenzioni di codice e dati

### Struttura del repository

```
/app
  /(auth)/login, /(auth)/reset-password, /(auth)/accept-invite
  /(internal)/            # area interna (admin, staff, accounting)
    dashboard, brands, customers, seasons, products, orders,
    calendar, budgets, invoices, documents, imports, settings/users
  /(portal)/portal/       # portale brand
    dashboard, orders, sales, documents, calendar
  /api/                   # route handlers: pdf, ical, cron, webhooks
/components
  /arc                    # componenti Arc installati dalla CLI (non modificarne gli interni)
  /shared                 # DataTable, PageHeader, ConfirmDialog, EmptyState...
/modules                  # un modulo per dominio
  /brands | /customers | /seasons | /products | /orders | /calendar
  /budgets | /invoices | /documents | /users | /imports
    schema.ts             # schemi Zod
    queries.ts            # letture (lato server)
    actions.ts            # scritture (server actions)
    components/           # componenti specifici
    __tests__/
/lib
  /supabase               # client server/browser, middleware
  /auth                   # getSessionUser, requireRole, requireBrandAccess
  /pdf, /email, /invoicing, /ical, /money, /dates, /errors
/emails                   # template React Email
/public                   # sw.js, icons/, _headers (se supportato), offline.html
/app/manifest.ts          # manifest PWA
/wrangler.jsonc           # configurazione Cloudflare Workers
/open-next.config.ts      # configurazione adapter OpenNext
/components.json          # shadcn + registry @uiarc
/AGENTS.md                # regole per l'agente (include le regole Arc, vedi 7.12)
/.codex/config.toml       # server MCP di Arc per Codex (solo progetti attendibili)
/.agents/skills           # skill di interfaccia installate (percorso da verificare, vedi 7.12)
/docs/DESIGN-GUIDELINES.md  # sintesi delle linee guida (Arc, Rauno, Lessons of Design)
/messages/it.json
/supabase
  /migrations             # SQL ordinato, unica fonte dello schema
  /seed.sql               # dati di sviluppo
  /tests                  # test RLS
/docs                     # DECISIONS.md, ARCHITECTURE.md
/e2e                      # test Playwright
```

### Regole di dati

- **ID:** `uuid` (`gen_random_uuid()`).
- **Importi:** interi in **centesimi** (`bigint`), mai float. Helper in `lib/money` per formattazione (`Intl.NumberFormat('it-IT')`) e calcoli.
- **Percentuali:** `numeric(5,2)`.
- **Timestamp:** `timestamptz` UTC; `created_at`, `updated_at` (trigger) su tutte le tabelle.
- **Soft delete:** `deleted_at timestamptz` su anagrafiche, prodotti, ordini; nessuna cancellazione fisica di fatture o ordini.
- **Nomi:** tabelle e colonne `snake_case`, tabelle al plurale.
- **Isolamento brand:** ogni tabella che dipende da un brand ha `brand_id not null` (denormalizzato anche sulle righe figlie) per policy semplici e veloci.

### Pattern applicativo

- **Letture:** funzioni in `queries.ts` che usano il client Supabase server con la sessione utente.
- **Scritture:** server actions in `actions.ts` con questo flusso fisso: `requireRole(...)` → parse Zod → operazione → `audit_log` → `revalidatePath` → ritorno `{ ok: true, data } | { ok: false, error }`.
- **Errori:** mai lanciare errori grezzi al client; usa `lib/errors` con codici stabili (`FORBIDDEN`, `VALIDATION`, `NOT_FOUND`, `CONFLICT`).
- **Autorizzazione:** doppia barriera. RLS nel database (obbligatoria) e controllo ruolo in `actions.ts` (per messaggi d'errore chiari).
- **Service role:** usabile solo in `lib/supabase/admin.ts`, importabile solo da route handler server e job (regola ESLint `no-restricted-imports` per impedire l'uso nei componenti client).

---

## 5. Ruoli e permessi

Enum `app_role`: `admin`, `staff`, `accounting`, `brand`.

| Risorsa             | admin | staff | accounting                        | brand                                                  |
| ------------------- | ----- | ----- | --------------------------------- | ------------------------------------------------------ |
| Utenti e inviti     | CRUD  | -     | -                                 | -                                                      |
| Brand               | CRUD  | R     | R                                 | R (solo i propri, campi limitati)                      |
| Clienti             | CRUD  | CRUD  | R                                 | R limitato (D1, solo tramite ordini)                   |
| Stagioni / prodotti | CRUD  | CRUD  | R                                 | R (propri brand)                                       |
| Ordini              | CRUD  | CRUD  | R + cambio stato verso `invoiced` | R (propri brand)                                       |
| Calendario          | CRUD  | CRUD  | R                                 | R (eventi marcati `visible_to_brand` dei propri brand) |
| Budget              | CRUD  | R     | CRUD                              | R (propri brand)                                       |
| Fatture             | CRUD  | R     | CRUD                              | -                                                      |
| Documenti           | CRUD  | CRUD  | R                                 | R (solo `shared_with_brand = true`, propri brand)      |
| Audit log           | R     | -     | -                                 | -                                                      |
| Importazioni Excel  | CRUD  | -     | solo budget                       | -                                                      |

(R = lettura, CRUD = lettura/creazione/modifica/archiviazione)

---

## 6. Schema dati (da implementare come migrazioni SQL)

### Enum

```
app_role: admin | staff | accounting | brand
order_status: draft | confirmed | in_production | shipped | delivered | invoiced | cancelled
event_type: appointment | campaign | delivery | payment_due | other
invoice_status: draft | issued | sent | paid | cancelled | rejected
document_kind: catalog | lookbook | price_list | order_confirmation | contract | other
```

### Tabelle

| Tabella                | Colonne principali                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `profiles`             | `id` (FK `auth.users`), `role app_role`, `full_name`, `email`, `is_active`                                                                                                                                                                                                                                                                                                           |
| `brands`               | `id`, `name`, `legal_name`, `vat_number`, `tax_code`, `address`, `city`, `country`, `commission_pct`, `can_see_customer_names bool`, `notes`, `deleted_at`                                                                                                                                                                                                                           |
| `brand_users`          | `brand_id`, `user_id` (PK composta)                                                                                                                                                                                                                                                                                                                                                  |
| `brand_contacts`       | `id`, `brand_id`, `name`, `role_title`, `email`, `phone`                                                                                                                                                                                                                                                                                                                             |
| `customers`            | `id`, `legal_name`, `trade_name`, `vat_number`, `tax_code`, `sdi_code`, `pec`, `billing_address` (jsonb), `shipping_address` (jsonb), `city`, `country`, `payment_terms`, `notes`, `deleted_at`                                                                                                                                                                                      |
| `customer_contacts`    | `id`, `customer_id`, `name`, `role_title`, `email`, `phone`                                                                                                                                                                                                                                                                                                                          |
| `seasons`              | `id`, `brand_id`, `code` (es. `FW26`), `name`, `campaign_start`, `campaign_end`, `delivery_start`, `delivery_end`                                                                                                                                                                                                                                                                    |
| `products`             | `id`, `brand_id`, `season_id`, `sku_base`, `name`, `description`, `wholesale_price_cents`, `retail_price_cents`, `vat_rate`, `deleted_at`                                                                                                                                                                                                                                            |
| `product_variants`     | `id`, `product_id`, `brand_id`, `size`, `color`, `sku` (unico)                                                                                                                                                                                                                                                                                                                       |
| `orders`               | `id`, `number` (progressivo annuale), `brand_id`, `customer_id`, `season_id`, `status`, `order_date`, `delivery_date`, `payment_terms`, `discount_pct`, `commission_pct_override`, `currency`, `net_total_cents`, `vat_total_cents`, `gross_total_cents`, `internal_notes`, `created_by`, `deleted_at`                                                                               |
| `order_lines`          | `id`, `order_id`, `brand_id`, `variant_id`, `quantity`, `unit_price_cents`, `discount_pct`, `line_net_cents`                                                                                                                                                                                                                                                                         |
| `order_status_history` | `id`, `order_id`, `brand_id`, `from_status`, `to_status`, `changed_by`, `changed_at`, `note`                                                                                                                                                                                                                                                                                         |
| `events`               | `id`, `type`, `title`, `description`, `starts_at`, `ends_at`, `all_day`, `brand_id` (nullable), `customer_id` (nullable), `assigned_to`, `visible_to_brand bool`, `location`                                                                                                                                                                                                         |
| `budgets`              | `id`, `brand_id`, `season_id` (nullable), `customer_id` (nullable), `amount_cents`, `period_start`, `period_end`, `notes`                                                                                                                                                                                                                                                            |
| `invoices`             | `id`, `number`, `brand_id`, `customer_id`, `order_id` (nullable), `status`, `issue_date`, `due_date`, `net_cents`, `vat_cents`, `gross_cents`, `external_id`, `external_status`, `pdf_path`                                                                                                                                                                                          |
| `payments`             | `id`, `invoice_id`, `amount_cents`, `paid_at`, `method`                                                                                                                                                                                                                                                                                                                              |
| `documents`            | `id`, `kind`, `name`, `storage_path`, `brand_id`, `customer_id` (nullable), `order_id` (nullable), `shared_with_brand bool`, `uploaded_by`                                                                                                                                                                                                                                           |
| `audit_log`            | `id`, `actor_id`, `action`, `table_name`, `record_id`, `before jsonb`, `after jsonb`, `created_at`                                                                                                                                                                                                                                                                                   |
| `order_counters`       | `year`, `last_number` (per numerazione sicura dei progressivi)                                                                                                                                                                                                                                                                                                                       |
| `import_profiles`      | `id`, `name`, `entity` (`customers` \| `orders` \| `budgets`), `sheet_name`, `header_row`, `mapping` (jsonb: campo canonico → colonna), `options` (jsonb: formato date, separatori decimali, valori di default, modalità), `created_by`                                                                                                                                              |
| `import_batches`       | `id`, `kind`, `profile_id`, `season_id` (stagione ordini), `budget_season_id` (stagione budget), `file_name`, `file_sha256`, `storage_path`, `status` (`uploaded` \| `mapped` \| `validated` \| `ready` \| `importing` \| `completed` \| `failed` \| `rolled_back`), `stats` (jsonb), `expected_totals` (jsonb, totali di controllo), `created_by`, `completed_at`, `rolled_back_at` |
| `import_rows`          | `id`, `batch_id`, `sheet`, `row_number`, `raw` (jsonb), `mapped` (jsonb), `status` (`valid` \| `warning` \| `error` \| `skipped` \| `imported`), `messages` (jsonb), `match` (jsonb: entità abbinata e decisione), `target_id`                                                                                                                                                       |

Colonne aggiuntive per l'importazione: `external_code` su `customers` e `brands` (codice del file di origine, con indice unico parziale), `external_ref` su `orders` (riferimento d'ordine di origine) e `import_batch_id` su `customers`, `orders`, `order_lines`, `seasons`, `products`, `product_variants`, `budgets` (serve al rollback per lotto). Estensione `pg_trgm` per l'abbinamento per somiglianza. Le tabelle `import_*` sono leggibili e scrivibili solo da `admin` (e da `accounting` per i lotti di soli budget); il bucket Storage `imports` è privato con le stesse regole.

### Viste SQL (con `security_invoker = true` per rispettare le RLS)

- `v_sales_by_brand_season`: venduto netto per brand e stagione (D4)
- `v_revenue_by_brand_period`: fatturato netto per brand e mese (D4)
- `v_budget_vs_actual`: budget, venduto, fatturato, scostamento assoluto e percentuale per brand/stagione
- `v_sales_by_customer`: venduto per cliente e brand
- `v_commissions`: provvigione calcolata per ordine (D3)
- `v_import_batch_totals`: totali di un lotto in staging per brand (righe, ordini, pezzi, netto), per l'anteprima prima del commit
- `v_budget_vs_previous_season`: per brand e cliente, venduto della stagione precedente, budget della stagione successiva e scostamento

### Trigger e funzioni

- `set_updated_at()` su tutte le tabelle
- Ricalcolo totali ordine al variare di `order_lines` (o funzione `recalculate_order_totals(order_id)`)
- Numerazione ordine progressiva per anno tramite `order_counters` con lock di riga
- Scrittura automatica in `order_status_history` al cambio di stato
- Validazione transizioni di stato (vedi sotto)

### Transizioni di stato ordine consentite

```
draft → confirmed | cancelled
confirmed → in_production | cancelled
in_production → shipped | cancelled
shipped → delivered
delivered → invoiced
cancelled → (nessuna)
invoiced → (nessuna)
```

Ogni transizione richiede ruolo `admin`/`staff` (tranne `→ invoiced`, anche `accounting`). Transizioni non valide devono fallire sia nell'applicazione sia nel database (trigger).

### Schema RLS (pattern da seguire per tutte le tabelle)

```sql
-- Funzioni helper in schema "app", security definer, search_path fisso
create function app.current_role() returns app_role
  language sql stable security definer set search_path = public
  as $$ select role from profiles where id = auth.uid() and is_active $$;

create function app.is_internal() returns boolean
  language sql stable security definer set search_path = public
  as $$ select coalesce(app.current_role() in ('admin','staff','accounting'), false) $$;

create function app.user_brand_ids() returns setof uuid
  language sql stable security definer set search_path = public
  as $$ select brand_id from brand_users where user_id = auth.uid() $$;

-- Esempio su "orders"
alter table orders enable row level security;

create policy orders_select on orders for select to authenticated
  using (deleted_at is null
         and (app.is_internal() or brand_id in (select app.user_brand_ids())));

create policy orders_write on orders for all to authenticated
  using (app.current_role() in ('admin','staff'))
  with check (app.current_role() in ('admin','staff'));
```

Regole:

- RLS **abilitata su tutte** le tabelle in `public`; nessuna tabella senza policy.
- Il ruolo `brand` non ha mai policy di scrittura sui dati di business.
- Per D1, i brand non leggono `customers` direttamente: usare la vista/funzione `portal_orders` che espone `customer_display_name` (ragione sociale e città, oppure "Cliente riservato" secondo il flag) e nessun altro dato cliente.
- Storage: bucket privato `documents`; policy di lettura per brand solo se esiste un record `documents` con `shared_with_brand = true` e `brand_id` nei propri brand.

---

## 7. Componenti e integrazioni (specifiche)

### 7.1 DataTable condivisa (`components/shared/data-table`)

Composta con componenti Arc (`sortable-data-table`, `filter-toolbar`, `pagination`, `search-field`, `empty-state`, `skeleton`); TanStack Table solo come logica headless se necessaria (7.12). Funzioni: ordinamento, filtri per colonna, ricerca globale, paginazione lato server (parametri in query string), selezione righe, export CSV, stato vuoto e caricamento. Tutte le liste la usano.

### 7.2 Editor ordine con matrice taglie × colori

- Selezione prodotto → mostra griglia con righe = colori, colonne = taglie (dalle `product_variants`).
- Celle numeriche per le quantità; totali per riga, colonna e ordine calcolati in tempo reale.
- Prezzo unitario preso dal prodotto, modificabile; sconto per riga e per ordine.
- Salvataggio atomico (ordine + righe) tramite una singola funzione/transazione.
- Totali sempre ricalcolati lato server; i totali del client sono solo anteprima.

### 7.3 Calendario

- FullCalendar con viste mese, settimana, giorno, lista; drag & drop e ridimensionamento (solo ruoli interni).
- Filtri per utente assegnato, brand, cliente, tipo.
- Fuso orario `Europe/Rome`; salvataggio in UTC.
- Feed iCal: `GET /api/ical/[token]`, token per utente (tabella `ical_tokens`, revocabile). Il feed brand include solo eventi `visible_to_brand`.
- Promemoria: job giornaliero che invia email per appuntamenti del giorno successivo.

### 7.4 PDF (`lib/pdf`, route `GET /api/pdf/[type]/[id]`)

Tipi: `order-confirmation`, `line-sheet`, `brand-summary`.

- Si definisce un'interfaccia `PdfRenderer` (`render(type, data): Promise<Uint8Array>`) così la libreria è sostituibile.
- **Vincolo Workers:** non si può usare Puppeteer/Chromium locale. In M3-T5 l'agente esegue uno **spike** in `pnpm preview:cf` provando in quest'ordine: (1) `@react-pdf/renderer`; (2) `pdf-lib` con costruzione programmatica dei layout; (3) **Cloudflare Browser Rendering** (HTML → PDF, richiede piano a pagamento) se servono layout complessi. Si adotta la prima opzione che funziona nel runtime Workers entro i limiti di dimensione e di tempo, e si registra la scelta in `docs/DECISIONS.md`.
- Autorizzazione verificata con la stessa logica delle RLS prima di generare.
- Layout sobrio coerente con i token di Arc: sempre in tema chiaro (anche se l'utente usa il tema scuro), pensato per la stampa; font Inter incorporato se la libreria lo consente, altrimenti font standard del PDF.
- Salvataggio opzionale in Storage e record in `documents`.

### 7.5 Grafici (Arc)

Componenti: `BudgetVsActualChart`, `SalesTrendChart`, `TopCustomersChart`. Costruiti con i grafici Arc; i colori vengono dai token (`--accent` per i dati in evidenza, `--success`/`--warning`/`--danger` solo per veri stati e sempre con etichetta). Leggono dalle viste SQL (sez. 6); nessun calcolo di aggregazione nel frontend.

### 7.6 Email (`lib/email`, `/emails`)

Template: invito utente, invito brand, conferma ordine, promemoria appuntamento. Invio tramite Resend con funzione `sendEmail()` che in sviluppo scrive su console/log invece di inviare (`EMAIL_MODE=log|send`).

### 7.7 Fatturazione (`lib/invoicing`)

```ts
interface InvoicingProvider {
  createInvoice(
    input: InvoiceInput,
  ): Promise<{ externalId: string; status: ExternalStatus }>;
  getStatus(externalId: string): Promise<ExternalStatus>;
  cancelInvoice(externalId: string): Promise<void>;
  parseWebhook(
    req: Request,
  ): Promise<{ externalId: string; status: ExternalStatus }>;
}
```

- `MockInvoicingProvider` (M7-T1): simula stati e ritardi, usato in test e sviluppo.
- `FattureInCloudProvider` (M7-T3): implementazione reale, attivata con `INVOICING_PROVIDER=fic`.
- I dati fiscali dell'emissione sono sempre copiati in `invoices` (non dipendere dal provider per lo storico).

### 7.8 Importazione Excel e esportazioni

#### Obiettivo

Caricare un file Excel che contiene (in uno o più fogli) tutti gli **ordini di una stagione**, i **budget della stagione successiva** e l'**anagrafica dei negozi** (clienti), e ottenere il **totale degli ordini per brand**, con controlli e possibilità di annullare l'importazione. **I campi reali dell'Excel non sono ancora definiti:** il sistema non deve contenere nomi di colonna fissi, ma un catalogo di campi canonici e profili di mappatura (vedi sotto). Quando i campi reali saranno noti si configura il profilo (M10-T9) senza modificare la logica.

#### Funzionalità tipiche di un gestionale di questo tipo che vanno previste

- Procedura guidata (wizard) con avanzamento: caricamento → mappatura → validazione → abbinamenti → riepilogo e controllo totali → conferma → report.
- **Profili di mappatura salvabili** e riutilizzabili (per esempio "Ordini stagione", "Budget", "Anagrafica negozi"), con suggerimento automatico delle colonne per somiglianza dei nomi.
- **Anteprima e validazione riga per riga**, con conteggio di righe valide, avvisi ed errori e **report degli errori scaricabile** (numero di riga e motivo).
- **Abbinamento intelligente** di negozi, brand e articoli già presenti (evita i duplicati), con scelta manuale dei casi dubbi.
- **Simulazione** (dry run) che mostra cosa verrà creato o aggiornato prima di scrivere sul database.
- **Totali di controllo**: confronto tra i totali calcolati e quelli attesi (digitati o letti dal file) per brand.
- **Importazione atomica** e **annullamento (rollback) per lotto**; storico delle importazioni con file originale, autore e esito.
- **Rilevamento di file già caricato** (hash) e di righe già importate (riferimento d'ordine), per evitare doppioni.
- **Modello di file scaricabile** e, quando i campi saranno noti, esportazione nello stesso formato.

#### Catalogo dei campi canonici (provvisorio, da sostituire con i campi reali)

Il codice legge solo questi campi interni, definiti in un'unica fonte (`modules/imports/fields.ts`): per ciascuno entità, nome, tipo, obbligatorietà, sinonimi per la mappatura automatica e validatori.

| Entità            | Campi canonici                                                                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Negozio (cliente) | codice esterno, ragione sociale, insegna, P.IVA, codice fiscale, indirizzo, CAP, città, provincia, paese, email, telefono, agente/area, categoria, condizioni di pagamento, codice SDI/PEC, note |
| Ordine (testata)  | riferimento d'ordine esterno, data ordine, negozio, brand, stagione, data di consegna, stato, sconto, totale d'ordine (se presente), note                                                        |
| Riga d'ordine     | riferimento d'ordine, articolo/SKU, descrizione, colore, taglia, quantità, prezzo unitario, sconto, importo netto di riga                                                                        |
| Budget            | brand, stagione, negozio (facoltativo), importo budget, periodo, note                                                                                                                            |

Il file può avere **una riga per riga d'ordine** o **una riga per ordine con il solo totale**: il profilo indica la granularità (`order_lines` oppure `order_totals`); nel secondo caso l'ordine importato ha un'unica riga di riepilogo e va marcato come tale.

#### Flusso tecnico

1. **Caricamento:** componente `file-dropzone` di Arc; accetta `.xlsx` e `.csv` (non `.xlsm`, non `.xls`); controllo di estensione, tipo reale del file e dimensione (limite predefinito 10 MB e 20.000 righe, configurabile). Il file originale viene salvato nel bucket privato `imports` con il suo hash SHA-256.
2. **Lettura nel browser:** il file si legge in un **Web Worker** (D19); si leggono i **valori calcolati** delle celle, mai formule o macro. L'elenco dei fogli e le prime righe alimentano la mappatura.
3. **Mappatura:** scelta di foglio, riga di intestazione e colonna per ogni campo canonico; valori di default per ciò che non è nel file (stagione, brand, stato); formato di date e numeri. Salvataggio come profilo.
4. **Normalizzazione e validazione** (funzioni pure, con test unitari): numeri in formato italiano (virgola decimale, punto delle migliaia, simbolo €), date `gg/mm/aaaa` e numeri seriali di Excel, spazi e maiuscole, P.IVA (11 cifre con cifra di controllo) e codice fiscale, email, quantità intere positive, importi non negativi, coerenza `quantità × prezzo × (1 − sconto)` con tolleranza di 1 centesimo (avviso), duplicati nel file, brand o stagione sconosciuti. Ogni riga riceve stato `valid`, `warning`, `error` o `skipped` e i messaggi.
5. **Staging:** le righe normalizzate si inviano al server **a blocchi di 500** (con barra di avanzamento) e si salvano in `import_rows`.
6. **Abbinamenti:** negozi per codice esterno, poi P.IVA, poi nome e città per somiglianza (`pg_trgm`, soglia configurabile); brand per nome normalizzato; articoli per SKU. Per ogni caso dubbio o nuovo l'utente sceglie _collega a esistente_, _crea nuovo_ o _ignora_; le scelte restano salvate nel lotto.
7. **Riepilogo e controllo dei totali:** vedi sotto. Il commit non è possibile finché ci sono errori; l'utente può però escludere esplicitamente le righe con errori (con elenco e conferma).
8. **Commit:** funzione Postgres `import_commit(batch_id)` (solo admin, con controllo del ruolo all'interno), in **una transazione**, con blocco del lotto e un solo commit alla volta. Ordine di scrittura: brand e stagioni mancanti, negozi, articoli e varianti, ordini con righe, budget. Imposta `import_batch_id` su ogni riga creata, scrive l'audit e aggiorna lo stato del lotto.
9. **Rollback:** funzione `import_rollback(batch_id)` (solo admin): archivia (soft delete) tutto ciò che il lotto ha creato e ripristina i valori precedenti delle righe aggiornate (salvati prima del commit). Non è consentito se gli ordini creati sono già oltre lo stato `confirmed` o hanno fatture collegate.
10. **Report finale:** conteggi per tipo (creati, aggiornati, ignorati, errori), totali per brand, link al file originale e al report degli errori.

**Modalità di importazione:** `insert_only` (le righe già esistenti vengono saltate con avviso) e `upsert` (le righe esistenti si aggiornano, con anteprima delle differenze campo per campo). Predefinite: negozi in `upsert`, ordini in `insert_only`, budget in `upsert` per la stessa combinazione brand/stagione/negozio.

**Ordine delle entità in un file con più fogli:** negozi → ordini → budget (i budget possono riferirsi ai negozi appena importati). Il wizard esegue gli step nell'ordine e li include in un unico lotto.

#### Totale ordini per brand

- **Definizione** (D4): somma degli importi netti di riga (dopo sconti) degli ordini non annullati, per brand e stagione; mostrato anche con IVA se presente. Insieme a numero di ordini, numero di negozi e pezzi.
- **Prima del commit:** calcolato dalle righe in staging (`v_import_batch_totals`), con tabella per brand e totale generale, confronto con i **totali attesi** (inseriti a mano o letti da una cella/colonna indicata nel profilo) e differenza evidenziata; se ci sono differenze l'utente deve confermarle esplicitamente.
- **Dopo il commit:** dalle viste di sez. 6 (`v_sales_by_brand_season`), con filtro per stagione e drill-down per negozio.
- **Confronto con i budget:** per ogni brand e negozio, venduto della stagione importata contro budget della stagione successiva (`v_budget_vs_previous_season`), con scostamento assoluto e percentuale; esportabile in XLSX.

#### Esportazioni

- CSV sempre disponibile da tutte le liste principali; XLSX con `exceljs` (verificare in `pnpm preview:cf` e, se non compatibile con Workers, generare il file nel browser o con una libreria edge-compatibile).
- Nelle celle esportate che iniziano con `=`, `+`, `-` o `@` si antepone un apostrofo, per evitare l'iniezione di formule.

#### Sicurezza e privacy

- Solo `admin` (e `accounting` per i budget) può importare; il controllo avviene anche dentro le funzioni Postgres.
- Il file non viene mai eseguito: niente formule né macro; limiti di dimensione, di righe e di fogli contro file malevoli.
- I dati personali dei negozi (referenti, email, telefoni) seguono le regole GDPR di sez. 10; il file originale viene conservato per un periodo configurabile (predefinito 90 giorni) e poi eliminato dal bucket, mantenendo le statistiche del lotto.
- Tutte le operazioni di import e rollback sono registrate nell'audit.

### 7.9 Audit log

Funzione `logAudit({ action, table, recordId, before, after })` chiamata da ogni server action di scrittura. Solo gli admin possono leggere `audit_log`.

### 7.10 Responsive (mobile-first)

**Principi (comportamento, non stile):**

- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`; uso di `dvh` al posto di `vh`; rispetto di `env(safe-area-inset-*)` per notch e barre di sistema.
- Breakpoint predefiniti di Tailwind; nessun layout a larghezza fissa; nessuno scroll orizzontale della pagina.
- Target interattivi di almeno 44×44 px; nessuna funzione solo-hover; campi `input` con `inputMode`/`type` corretti (`numeric`, `email`, `tel`, `date`) per la tastiera mobile.
- Testo di almeno 16 px nei campi di input (evita lo zoom automatico su iOS).

**Pattern per componenti:**

| Componente               | Mobile (< `md`)                                                                                                                           | Desktop (≥ `md`/`lg`)                |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `AppShell` (navigazione) | Menu a scomparsa (drawer) aperto da un pulsante, o barra inferiore con le 4-5 voci principali; header compatto                            | Barra laterale fissa                 |
| `DataTable`              | Per ogni tabella si dichiara una vista **card** (`mobileCard`) con i 3-4 campi chiave; azioni in menu; filtri in un pannello a scomparsa  | Tabella completa                     |
| Form                     | Una colonna, barra azioni fissa in basso, validazione inline                                                                              | Griglia a più colonne                |
| Dialog/modali            | Si presentano a schermo intero (`Drawer`/`Bottom sheet` di Arc) tramite `ResponsiveDialog`                                                | Dialog centrato                      |
| `SizeColorMatrix`        | Scroll orizzontale **dentro il componente**, prima colonna (colore) fissa, tastierino numerico, totali sempre visibili in una barra fissa | Griglia completa                     |
| Calendario               | Vista predefinita `listWeek` o `timeGridDay`; mese solo su richiesta; trascinamento disattivato, modifica tramite modale                  | Vista mese/settimana con drag & drop |
| Grafici                  | `ResponsiveContainer`, legenda sotto, etichette ridotte                                                                                   | Legenda laterale                     |
| PDF                      | Apertura/scarica tramite link (nessun viewer incorporato)                                                                                 | Idem                                 |

**Test obbligatori:** Playwright con 5 progetti di viewport: `mobile-s` 360×640, `mobile` 390×844, `tablet` 768×1024, `laptop` 1024×768, `desktop` 1440×900 (include i 390, 768, 1024 e 1440 px richiesti dalle regole di Arc). Per ogni route principale (interna e portale) verificare: assenza di overflow orizzontale (`document.documentElement.scrollWidth <= window.innerWidth`), presenza della navigazione, e che i pulsanti principali siano visibili e cliccabili.

### 7.11 PWA

**Manifest (`app/manifest.ts`):**

- `name` e `short_name` provvisori ("Gestionale Showroom"), da sostituire con il nome definitivo; `start_url: "/"`, `scope: "/"`, `display: "standalone"`, `lang: "it"`.
- `background_color` e `theme_color` coerenti con `--background` del tema chiaro; nel layout `viewport.themeColor` con due varianti (`prefers-color-scheme: light` e `dark`) allineate a `--background` di Arc nei due temi.
- Icone: 192×192, 512×512 e 512×512 `maskable`, più `apple-touch-icon` 180×180. Usare **icone segnaposto neutre** (quadrato a tinta unita con le iniziali) generate da script (`pnpm icons`), segnalate in `docs/DECISIONS.md` come da sostituire.
- Tag in `<head>`: `theme-color`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-title`, link a `apple-touch-icon`.

**Service worker (`public/sw.js`), regole di cache:**

- `CACHE_VERSION` esplicita; all'evento `activate` si eliminano le cache di versioni precedenti.
- **Cache-first** solo per asset statici immutabili: `/_next/static/*`, `/icons/*`, font.
- **Network-first con fallback** per le navigazioni: se la rete manca, si mostra `/offline` (pagina statica pre-cachata, in italiano, con pulsante "Riprova").
- **Mai in cache:** risposte HTML autenticate, `/api/*`, richieste a Supabase (Auth, REST, Storage), PDF, URL firmati, qualunque risposta con cookie di sessione. Motivo: privacy su dispositivi condivisi e coerenza con le RLS.
- Aggiornamento: il nuovo service worker resta in attesa; l'app mostra un avviso "Nuova versione disponibile" con pulsante "Aggiorna" che invia `SKIP_WAITING` e ricarica la pagina.
- **Logout:** al logout si eliminano tutte le cache dinamiche e si annulla qualunque dato locale (`caches.delete(...)`, pulizia di `localStorage`/`sessionStorage`).
- Registrazione solo in produzione, tramite componente `PwaRegister`.

**Esperienza utente:**

- Hook `useOnlineStatus` e banner "Sei offline": i pulsanti di salvataggio sono disabilitati offline con messaggio esplicativo (nessuna scrittura offline, D12).
- Installazione: su Chrome/Android si intercetta `beforeinstallprompt` e si mostra la voce "Installa app" nel menu utente; su iOS/Safari si mostra un breve testo di istruzioni ("Condividi → Aggiungi alla schermata Home"), visibile solo se non già installata (`display-mode: standalone`).

**Header di risposta su Cloudflare:**

- `/sw.js`: `Cache-Control: no-cache` e `Service-Worker-Allowed: /`.
- `/manifest.webmanifest`: `Content-Type: application/manifest+json`.
- Configurazione tramite `headers()` in `next.config` oppure `public/_headers` se supportato dall'adapter in uso: verificare in `pnpm preview:cf` e registrare l'esito.

**Notifiche push (opzionali, D14):** Web Push con chiavi VAPID, tabella `push_subscriptions`, invio per i promemoria appuntamenti. Su iOS funzionano solo con l'app installata. La libreria di invio deve funzionare sul runtime Workers (usare Web Crypto): verificare con uno spike prima di implementare.

### 7.12 Design system e linee guida

#### Arc come base dell'interfaccia

Arc (https://uiarc.dev) è una libreria di componenti e blocchi React con animazioni integrate, pensata per l'uso con agenti AI. Si installa con la CLI di shadcn e i file finiscono nel repository (`components/arc/`). Lo stile dell'intero sito nasce dai suoi token: `--background`, `--surface`, `--surface-raised`, `--surface-muted`, `--foreground`, `--text-secondary`, `--text-muted`, `--border`, `--border-subtle`, `--border-strong`, `--accent`, `--success`, `--warning`, `--danger`, `--radius-control`, `--radius-panel`, `--radius-surface`, `--font-display` (Geist, titoli da 30 px in su), `--font-body` (Inter), `--shadow-floating`.

#### Installazione e collegamento dell'agente (da eseguire in M0-T6)

1. **Server MCP per Codex** (sola lettura, remoto, trasporto Streamable HTTP). Due modi equivalenti:
   - Da CLI (scrive nel config utente `~/.codex/config.toml`):
     ```bash
     codex mcp add arc --url https://uiarc.dev/api/mcp
     codex mcp login arc
     ```
   - Oppure, per condividerlo con il team, nel file `.codex/config.toml` nella radice del progetto (Codex lo legge solo nei progetti che ha marcato come attendibili), da committare:
     ```toml
     [mcp_servers.arc]
     url = "https://uiarc.dev/api/mcp"
     ```
     e poi `codex mcp login arc`.

   `codex mcp login arc` avvia l'autenticazione OAuth: si apre il **login di Arc nel browser** (basta un account gratuito) e deve completarlo l'umano. Poi verifica con `codex mcp list` e `codex mcp get arc` (il server deve risultare abilitato) e riavvia la sessione di Codex perché gli strumenti compaiano. Con versioni meno recenti di Codex il login OAuth può richiedere `experimental_use_rmcp_client = true` nel livello superiore del config. Se gli strumenti non compaiono, controlla `codex mcp list --json` e riavvia Codex.

   Con un piano Arc Pro (D15) aggiungi nella tabella `[mcp_servers.arc]` la riga `bearer_token_env_var = "ARC_PRO_TOKEN"` e imposta la variabile d'ambiente `ARC_PRO_TOKEN` sulla macchina (mai nel repository, mai in `.codex/config.toml`).

   Strumenti esposti: `search_components` (ricerca per intento, es. "confirm a destructive action"), `list_components`, `get_component` (quando usarlo e quando no, props, accessibilità, motion, responsive, comando di installazione), `get_install_command` (un solo comando per più elementi) e `get_skill`.

2. **Regole per l'agente.** Codex legge `AGENTS.md`: copia in `AGENTS.md` il contenuto di https://uiarc.dev/r/skills/arc/INSTRUCTIONS.md. Per le istruzioni complete (scelta dei componenti, composizione, motion, accessibilità, checklist) l'agente le richiede con `get_skill` dell'MCP o le legge da https://uiarc.dev/r/skills/arc/SKILL.md. Non serve installare la skill in `.claude/skills`.
3. **Registry in `components.json`** (dopo `shadcn init`):
   ```json
   { "registries": { "@uiarc": "https://uiarc.dev/r/{name}.json" } }
   ```
4. **Fondamenta (token e stili), una sola volta:**
   ```bash
   pnpm dlx shadcn@latest add @uiarc/arc-foundation
   pnpm add motion lucide-react
   ```
   Importa `@/components/arc/foundation.css` una sola volta nel layout radice.
5. **Provider.** Avvolgi l'app in `ArcProvider` (instrada link e immagini di Arc attraverso `next/link` e `next/image`), insieme al provider del tema (7.13):
   ```tsx
   "use client";
   import Image from "next/image";
   import Link from "next/link";
   import { ArcProvider } from "@/components/arc/lib/arc-provider";
   // ...dentro <Providers>: <ArcProvider link={Link} image={Image}>{children}</ArcProvider>
   ```
6. **Font:** Geist (titoli) e Inter (testo) tramite `next/font`, collegati a `--font-display` e `--font-body`; verifica come `foundation.css` li referenzia e allinea i nomi delle variabili.
7. **Installare i componenti:**
   ```bash
   pnpm dlx shadcn@latest add @uiarc/button @uiarc/dialog @uiarc/input
   ```
   I componenti vengono copiati in `components/arc/<nome>/`. Le informazioni testuali di ogni componente sono leggibili anche come markdown aggiungendo `/markdown` all'URL della sua pagina, oppure da https://uiarc.dev/llms.txt.

#### Flusso obbligatorio per ogni schermata o componente

1. Descrivi **il compito**, non il markup, e cerca con `search_components` (o `llms.txt`).
2. Leggi con `get_component` (o la pagina `/markdown`) "quando usarlo" e "quando non usarlo", props documentate, accessibilità, motion e note responsive.
3. Installa con la CLI (`get_install_command` per più elementi).
4. **Componi e avvolgi**: mai forkare né restilizzare gli interni di Arc; usa solo le props documentate.
5. Per ogni **decisione di interfaccia non coperta dalla pagina del componente** (spaziature, allineamenti, gerarchia, tipografia, colori, testi, accessibilità, animazioni proprie), leggi lo `SKILL.md` della skill pertinente (sottosezione seguente) e applicalo.
6. Prima di chiudere il task esegui la checklist Arc (`get_skill`, voce checklist, oppure https://uiarc.dev/r/skills/arc/checklist.md) e poi la revisione con la skill `better-interface`.

#### Mappa indicativa bisogno → componente Arc (da verificare con l'MCP; solo elementi gratuiti)

| Bisogno            | Componenti Arc da cercare                                                                                                                                                                                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Navigazione e menu | `tabs`, `breadcrumb`, `pagination`, `user-menu`, `dropdown-menu`, `context-menu`, blocchi di layout/sidebar (cercare con l'MCP)                                                                                                                                                               |
| Elenchi e tabelle  | `sortable-data-table`, `filter-toolbar`, `search-field`, `badge` (stato ordine), `avatar`, `empty-state`, `skeleton`, `swipe-actions` (azioni di riga su mobile)                                                                                                                              |
| Form               | `input`, `textarea`, `select`, `combobox` (scelta cliente/brand), `multi-select`, `number-field` (quantità), `money-input` (prezzi), `phone-input`, `date-picker`, `date-range-picker`, `switch`, `checkbox`, `radio-group`, `segmented-control`, `inline-edit`, `file-dropzone`, `tag-input` |
| Azioni e conferme  | `button`, `hold-to-confirm` o `confirm-morph` (azioni distruttive, es. annullare un ordine), `dialog`, `drawer`, `bottom-sheet`, `popover`, `tooltip`                                                                                                                                         |
| Feedback           | `toast` (mai come unica conferma di un'azione in primo piano), `alert` (errori inline), `progress`, `stepper` (avanzamento stati ordine), `timeline` (storico stati e audit)                                                                                                                  |
| Dashboard          | `metric-card`, `bar-chart` (budget vs fatturato), `line-chart` (andamento), `donut-chart` (quote per brand), `sparkline`, `animated-counter`                                                                                                                                                  |
| Tema               | `theme-switch`                                                                                                                                                                                                                                                                                |

**Non coperto da Arc:** matrice taglie × colori (si compone con `number-field`/`input` Arc dentro una tabella con scroll interno, 7.10) e calendario eventi (FullCalendar con token Arc, vedi stack).
**Componenti Pro** (es. `data-grid`, `share-access`): non usare (D15).

#### Regole di Arc da rispettare sempre (sintesi di INSTRUCTIONS.md)

- Usa un componente o blocco Arc esistente prima di scrivere UI; solo props documentate; componi e avvolgi, non forkare.
- Un solo contenitore di pagina per app; i blocchi riempiono la loro colonna senza secondo margine o larghezza massima.
- Un solo `h1`, un solo pulsante primario per superficie (gli altri `secondary` o `ghost`), un solo dettaglio memorabile per vista.
- Solo token semantici per colori, raggi, testo e spaziature; niente esadecimali, niente classi colore di Tailwind, niente pesi sopra 500, niente dimensioni di testo arbitrarie.
- L'accento segna elementi attivi, selezionati, progresso e dati in evidenza; i colori di stato solo per stati reali e con etichetta.
- Tipografia: Geist per titoli da 30 px in su, Inter per il resto; pesi 400 e 500; `tabular-nums` per i numeri che cambiano.
- Angoli annidati concentrici: raggio interno = raggio esterno meno il padding.
- Motion: solo dai token di `motion-tokens` (`spring.smooth`, `spring.snappy`, `spring.morph`); anima `transform` e `opacity`; ramo `prefers-reduced-motion` per ogni animazione.
- Primo render sicuro lato server (niente `window`, `localStorage`, `Date.now()`, `Math.random()` nell'output iniziale).
- Ogni area dati ha stato di caricamento (`skeleton`), vuoto (`empty-state`), errore (`alert` inline) e successo in-place.
- Controllo a 390, 768, 1024 e 1440 px: nessuno scroll laterale, le tabelle larghe scorrono dentro la loro card, target touch di almeno 44 px.
- **Mai:** etichette sopra i titoli (eyebrow), testo tutto maiuscolo, trattini lunghi (—) nei testi, anelli di focus fatti a mano, gradienti/aloni/ombre colorate decorativi, icone in tile arrotondati, card decorative annidate, un toast come unica conferma, animazioni in loop senza significato. Testi dell'interfaccia in italiano con la sola iniziale maiuscola e verbi sui pulsanti.

#### Skill per le decisioni di interfaccia (https://github.com/jakubkrehel/skills)

Raccolta di skill per agenti (licenza MIT) di Jakub Krehel, basata sugli stessi temi dell'Interface Cheat Sheet e della rivista Interfaces. Servono all'agente **ogni volta che deve prendere una decisione sull'interfaccia** che la documentazione di Arc non risolve.

**Installazione (da eseguire in M0-T6), per Codex:**

```bash
npx skills add jakubkrehel/skills -a codex
```

- Senza `-a` la CLI chiede per quali agenti installare; con `--skill <nome>` si sceglie un sottoinsieme; senza `-g` l'installazione è per il progetto.
- La cartella di destinazione dipende dalla versione della CLI (di norma `.agents/skills/` nel progetto, oppure `~/.codex/skills/` con l'installazione globale): verifica dove sono finite le skill, annota il percorso in `docs/DECISIONS.md` e controlla che Codex le veda (riavvia la sessione).
- Le skill sono istruzioni di terze parti: **leggi ogni `SKILL.md` prima di usarla**, non eseguire script o comandi che contiene senza averli letti, e committa la cartella solo dopo la revisione. Le skill sono una guida: non sostituiscono le regole di Arc né questo piano.

**Quando usare quale skill:**

| Skill                  | Cosa copre                                                                                                                          | Quando usarla in questo progetto                                                                                                                                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `better-ui`            | angoli concentrici, allineamento ottico, icone contestuali, aree cliccabili, animazioni                                             | Costruendo o modificando un componente o una schermata, soprattutto composizioni proprie (matrice taglie × colori, calendario, wizard di import)                                                                                   |
| `better-typography`    | scala tipografica, spaziatura, dimensioni, font variabili, funzioni OpenType, a capo e troncamento                                  | Titoli, tabelle con cifre, prezzi, identificativi lunghi (SKU, P.IVA), testi abbreviati                                                                                                                                            |
| `better-colors`        | sistema di colori, palette, token semantici, conversioni di formato, contrasto                                                      | Override dei token in `globals.css`, scelta dell'accento, tema scuro, colori dei grafici e di FullCalendar                                                                                                                         |
| `better-accessibility` | conformità e buone pratiche di accessibilità                                                                                        | Form, dialog, menu, tabelle, navigazione da tastiera, gestione del focus, stati di errore                                                                                                                                          |
| `better-layout`        | raggruppamento, allineamento, ordine di lettura                                                                                     | `AppShell`, pagine di elenco e dettaglio, dashboard, editor ordine, riepilogo di import                                                                                                                                            |
| `better-writing`       | testi di prodotto, coerenza dei testi                                                                                               | Etichette, errori, stati vuoti, conferme, messaggi del wizard di import                                                                                                                                                            |
| `better-interface`     | unisce tutte le `better-*` in un'unica revisione                                                                                    | **Alla fine di ogni task con UI** e in M8-T6                                                                                                                                                                                       |
| `interface-review`     | analisi dettagliata multi-categoria (UI, tipografia, layout, colore, testi, accessibilità), pensata per essere invocata dall'utente | In M8-T6 l'agente ne segue le istruzioni; l'umano può invocarla in ogni momento                                                                                                                                                    |
| `break`                | mostra un componente in ogni stato e scenario su una pagina temporanea e lo mette sotto stress, invocata dall'utente                | Componenti critici: `SizeColorMatrix`, vista a card delle tabelle su mobile, wrapper del calendario, wizard di import. La pagina temporanea va nella route di sviluppo (`/design-check`) e **non** si committa né va in produzione |
| `variant`              | costruisce più varianti di un componente per scegliere, invocata dall'utente                                                        | Solo su richiesta dell'umano, mai di default                                                                                                                                                                                       |
| `explain-interface`    | ricostruisce come è fatta un'animazione o una UI web, invocata dall'utente                                                          | Solo se l'umano porta un riferimento da replicare                                                                                                                                                                                  |

**Regola di decisione per l'agente** (ogni volta che serve una scelta di interfaccia):

1. Cerca prima un componente o blocco Arc (MCP) e rispetta le sue regole.
2. Se resta un dubbio, leggi la skill pertinente della tabella e applicala.
3. Se la skill contraddice Arc o l'accessibilità, vale la precedenza di D17 (stesse risoluzioni della tabella dei conflitti: per esempio ombre a più livelli, trattino lungo e `text-transform` non si usano).
4. Annota in `docs/DECISIONS.md` (sezione Design) le scelte non ovvie, con la skill o la fonte che le motiva.

#### Web Interface Guidelines (https://interfaces.rauno.me)

L'agente legge la pagina completa e ne riporta una sintesi in `docs/DESIGN-GUIDELINES.md`. Punti principali:

- **Interattività:** cliccare l'etichetta mette a fuoco il campo; gli input stanno in un `<form>` (invio con Enter), hanno `type` corretto e usano la validazione HTML (`required`); icone o decorazioni dentro un campo sono posizionate sopra l'input e ne attivano il focus; i toggle hanno effetto immediato; i pulsanti si disabilitano dopo l'invio per evitare richieste doppie; elementi interattivi in liste senza aree morte tra uno e l'altro.
- **Tipografia:** `-webkit-font-smoothing: antialiased`, `text-rendering: optimizeLegibility`, font con subset, nessun cambio di peso in hover o selezione (evita spostamenti di layout), `font-variant-numeric: tabular-nums` per tabelle e valori che cambiano, `-webkit-text-size-adjust: 100%`, dimensioni fluide con `clamp()` dove serve.
- **Motion:** nessuna transizione durante il cambio di tema; durate sotto i 200 ms per le interazioni; valori proporzionali al trigger (scala da ~0,96, non da 0; dialog con scala/opacità da ~0,8); niente animazioni extra su azioni frequenti (menu contestuale, aggiunta/eliminazione di righe, hover banali); animazioni in loop in pausa quando non visibili; `scroll-behavior: smooth` per le ancore con offset.
- **Touch:** stati hover solo con `@media (hover: hover)`; testo degli input ≥ 16 px; nessun autofocus su dispositivi touch; `touch-action` disattivato per gesture personalizzate; evidenziazione tap di iOS sostituita da un'alternativa adeguata.
- **Ottimizzazioni:** valori elevati di `blur()` e `backdrop-filter` possono essere lenti; `will-change` solo come ultima risorsa; per valori in tempo reale valutare l'aggiornamento diretto del DOM tramite ref.
- **Accessibilità:** niente tooltip su pulsanti disabilitati (non sono raggiungibili da tastiera: spiegare il motivo in altro modo); `aria-label` esplicito sui controlli con sola icona; tooltip senza contenuto interattivo; navigazione con frecce ↑ ↓ negli elenchi focalizzabili; menu a tendina che si aprono alla pressione; immagini con `<img>`; favicon SVG che segue `prefers-color-scheme`; stile `::selection` definito.
- **Design:** aggiornamenti ottimistici con rollback ed errore visibile; redirect di autenticazione lato server prima del caricamento del client; feedback vicino al punto di azione (spunta temporanea inline dopo una copia, campi evidenziati negli errori di form); stati vuoti che invitano a creare un elemento.

#### Interface Cheat Sheet (https://interfaces.dev/cheat-sheet)

Raccolta di consigli pratici di design engineering. L'agente legge la pagina completa e ne riporta una sintesi in `docs/DESIGN-GUIDELINES.md`. Sintesi per area (le regole già coperte da Arc o da Rauno non si ripetono):

- **Interfaccia:** angoli annidati concentrici (raggio esterno = raggio interno + spazio tra gli elementi); allineamento ottico prima di quello geometrico; in un pulsante con testo e icona, padding leggermente minore dal lato dell'icona; spessore del tratto delle icone uguale a quello del testo accanto; immagini con contorno di 1 px, offset di −1 px, nero all'8% in tema chiaro e bianco all'8% in tema scuro (da definire una sola volta come token in `globals.css`, per esempio `--image-outline`).
- **Animazione:** far partire l'animazione dall'elemento che la attiva (`transform-origin`); per i menu aperti spesso, animare solo la chiusura; uscite più discrete delle entrate (spostamento breve, dissolvenza con blur di 4 px); mai `transition: all`, ma elencare le proprietà; pulsante premuto: scala tra 0,95 e 0,98 con `transition: scale 200ms ease-out`; scambio di icone con dissolvenza incrociata (la nuova entra da scala 0,25, opacità 0 e blur 4 px, la vecchia fa il contrario); transizioni CSS per le interazioni (possono invertirsi a metà) e keyframes per sequenze che girano una volta sola; nessuna transizione al cambio tema; `will-change: transform` solo se un elemento "trema" di 1-2 px durante l'animazione (soprattutto Safari iOS); ingressi a piccoli gruppi con breve ritardo invece di un blocco unico; nessuna animazione al caricamento della pagina salvo intenzione; interazioni frequenti istantanee o rapidissime (es. colore al passaggio del mouse); animazioni dentro `@media (prefers-reduced-motion: no-preference)`.
- **Tipografia:** solo `.woff2` (lo garantisce `next/font`); `tabular-nums` per timer, contatori, prezzi e tabelle; righe di testo lungo di 60-75 caratteri; `text-wrap: balance` sui titoli e `text-wrap: pretty` sulle descrizioni (non sul testo lungo); `overflow-wrap: break-word` per parole lunghe, link e identificativi (codici articolo, P.IVA, riferimenti d'ordine) e `white-space: nowrap` per etichette e badge; `-webkit-font-smoothing: antialiased` e `-moz-osx-font-smoothing: grayscale` sulla radice; punteggiatura tipografica (virgolette curve, trattino en per gli intervalli come 2010–2020, puntini di sospensione «…» al posto di tre punti); sottolineature che non tagliano le discendenti (`text-underline-position: from-font`, `text-decoration-skip-ink: auto`); quando il testo è abbreviato con i puntini, il testo completo deve essere leggibile in un tooltip o in una vista estesa.
- **Colori:** ogni gradino della palette ha uno scopo (sfondo pagina, hover, bordo, riempimento, testo); i componenti usano token semantici, mai valori primitivi; token nominati per funzione (`--color-accent-solid`, non `--color-blue-button`); `accent` riservato al colore di brand, senza usare `primary` sia per il brand sia per il testo; contrasto misurato sullo sfondo direttamente dietro l'elemento (la superficie, non la pagina); palette scura separata, non invertita; un solo modo per cambiare tema (qui `data-theme`, mai in parallelo `prefers-color-scheme` nei componenti).
- **Accessibilità:** elementi HTML nativi (`<button>`, `<a>`); stili su `:focus-visible`, senza togliere l'outline se non c'è un sostituto; solo `tabindex` 0 e −1; `aria-label` descrittivo sui pulsanti con sola icona e mai `aria-hidden` su elementi focalizzabili; testo alternativo che spiega scopo e contenuto dell'immagine, `alt=""` per quelle decorative; ogni input con `<label>` visibile e `type` e `inputmode` corretti; **non bloccare mai l'incolla**; pulsante di invio attivo fino all'avvio della richiesta, errori controllati all'invio, campi non validi con `aria-invalid="true"`, messaggi collegati con `aria-describedby` e focus sul primo campo non valido; aree cliccabili di almeno 24×24 px (obiettivo 44×44 su touch e 40×40 su desktop), mai sovrapposte; `pointer-events: none` sugli elementi decorativi; hover dentro `@media (hover: hover)`; `role="status"` per aggiornamenti di routine e `role="alert"` solo per errori urgenti; mai il solo colore per indicare uno stato (aggiungere icona, etichetta o sottolineatura); link «Vai al contenuto» come primo elemento raggiungibile con Tab.
- **Layout:** `scroll-margin-top` sui titoli raggiunti da ancore; tra gruppi almeno il doppio dello spazio che c'è tra gli elementi dello stesso gruppo (es. 8 px tra le voci, 16 px o più tra i gruppi).
- **Scrittura (da applicare ai testi in italiano):** le etichette dei pulsanti iniziano con un verbo ("Salva bozza", mai "OK" o "Sì"); i pulsanti di conferma dicono cosa succede ("Elimina ordine" accanto ad "Annulla"); la stessa etichetta per avanzare in tutto un flusso (per esempio sempre "Continua"); i link descrivono la destinazione (mai "clicca qui"); capitalizzazione uguale ovunque, con la sola iniziale maiuscola; i toggle dicono cosa succede quando sono attivi ("Invia conferme di lettura", non "Disattiva conferme di lettura"); le viste vuote spiegano cosa vi apparirà e offrono una sola azione per iniziare; rivolgersi a chi legge in seconda persona, non con "l'utente" (forma "tu" o "Lei" da scegliere e usare ovunque).

#### Lessons of Design (https://lessons.design)

La pagina è generata dinamicamente e il suo contenuto non è leggibile con un semplice fetch. L'agente deve aprirla con uno strumento in grado di eseguire JavaScript (browser/Playwright), leggere tutte le lezioni e riassumerle in `docs/DESIGN-GUIDELINES.md` nella sezione "Lessons of Design", con 1-2 righe di applicazione pratica per ciascuna. Se non riesce, chiede all'umano di incollare il testo: la mancanza di questa sintesi blocca solo M8-T6, non le altre milestone.

#### Conflitti noti tra le fonti e come risolverli

| Tema                    | Rauno                                     | Arc                                                                    | Si applica                                                             |
| ----------------------- | ----------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Peso dei font           | Titoli medi tra 500 e 600                 | Solo 400 e 500                                                         | **Arc**                                                                |
| Anello di focus         | Usare `box-shadow`, non `outline`         | Nessun anello fatto a mano: `:focus-visible` è già in `foundation.css` | **Arc** (non scrivere stili di focus propri)                           |
| Durata delle animazioni | Sotto i 200 ms                            | Spring dai token (`smooth`, `snappy`, `morph`)                         | **Token Arc**; per interazioni frequenti nessuna animazione aggiuntiva |
| Gradienti e aloni       | Disabilitare `pointer-events` se presenti | Vietati se decorativi                                                  | **Arc**: non usarli                                                    |
| Cambio tema             | Nessuna transizione                       | Attributo `data-theme`                                                 | **Entrambi** (7.13)                                                    |

**Conflitti con l'Interface Cheat Sheet**

| Tema                    | Cheat Sheet                                   | Arc                                                                                      | Si applica                                                                                      |
| ----------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Profondità              | `box-shadow` a più livelli al posto dei bordi | Bordi da 1 px con `--border`; ombra (`--shadow-floating`) solo per i livelli sovrapposti | **Arc**                                                                                         |
| Trattino lungo          | Trattino em per le incidentali                | Vietato nei testi                                                                        | **Arc** (punto, virgola, due punti o parentesi); il trattino en per gli intervalli è consentito |
| Valori di animazione    | Scala, durate e blur propri                   | Spring dai token                                                                         | **Token Arc** per i componenti Arc; il Cheat Sheet solo per elementi scritti da noi             |
| Testo maiuscolo         | `text-transform` per la resa                  | Vietato il maiuscolo                                                                     | **Arc**                                                                                         |
| Contorno delle immagini | Contorno di 1 px all'8%                       | Nessuna regola, ma niente colori scritti a mano                                          | **Cheat Sheet**, definito come token una sola volta in `globals.css`                            |
| Aree cliccabili         | 44 px su touch, 40 px su desktop              | 44 px                                                                                    | **44 px** su touch e **almeno 40 px** su desktop                                                |

### 7.13 Tema chiaro e scuro

- **Modalità:** Sistema (predefinita, segue `prefers-color-scheme`), Chiaro, Scuro. La scelta è per dispositivo (`localStorage`, chiave `theme`) ed è modificabile dal menu utente tramite `theme-switch` di Arc. Se `theme-switch` gestisce solo due stati, la voce "Sistema" si aggiunge nelle impostazioni con un `segmented-control`.
- **Come funziona in Arc:** il tema scuro si attiva con `data-theme="dark"` su `<html>`; i valori scuri sono tarati separatamente, non invertiti. L'accento si imposta con `data-accent` (otto accenti predefiniti: neutral, violet, blue, green, amber, orange, coral, rose).
- **Implementazione:**
  ```tsx
  // app/providers.tsx
  <ThemeProvider
    attribute="data-theme"
    defaultTheme="system"
    enableSystem
    disableTransitionOnChange
    storageKey="theme"
    themes={["light", "dark"]}
  >
    <ArcProvider link={Link} image={Image}>
      {children}
    </ArcProvider>
  </ThemeProvider>
  // app/layout.tsx: <html lang="it" data-accent="neutral" suppressHydrationWarning>
  ```
  `next-themes` imposta l'attributo prima del primo render (nessun lampeggio del tema sbagliato) e disattiva le transizioni durante il cambio, come richiesto dalle linee guida di Rauno. Non aggiungere in parallelo lo script di tema di Arc (sarebbe un duplicato).
- **Variante `dark` di Tailwind** (solo per il layout): con Tailwind v4 `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));`; con v3 `darkMode: ["selector", '[data-theme="dark"]']`.
- **Override dei token:** si fanno solo in `app/globals.css`, dopo l'import di `foundation.css`, e sempre in coppia (`:root` e `:root[data-theme="dark"]`) controllando il contrasto in entrambi i temi.
- **Da adeguare ai due temi:** FullCalendar (variabili `--fc-*` mappate sui token), grafici, immagini con sfondo trasparente, favicon SVG con `prefers-color-scheme`, `viewport.themeColor` a due varianti (7.11), pagine di errore e di offline.
- **Fuori dal tema:** PDF ed email restano in tema chiaro.
- **Verifiche automatiche:** Playwright con `colorScheme: "light"` e `"dark"` per le route principali (dashboard, lista ordini, editor ordine, calendario, portale brand); `@axe-core/playwright` per il contrasto in entrambi i temi; script `pnpm check:tokens` che fallisce se trova esadecimali, `rgb()/hsl()` o classi colore di Tailwind in `app/`, `modules/`, `components/` (esclusa `components/arc/`).

---

## 8. Milestone e task

**Legenda:** ogni task ha _Dipende da_, _Passi_, _Accettazione_ (verificabile con comandi). Comandi di verifica standard: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm e2e`, `supabase db reset` (applica migrazioni e seed), `pnpm supabase:test` (test RLS).

### M0: Fondamenta del progetto

**M0-T1 Inizializzazione repository**

- Passi: crea app Next.js (App Router, TS strict, Tailwind), inizializza la CLI di shadcn (`shadcn init`, necessaria per il registry Arc, vedi M0-T6), ESLint, Prettier, husky + lint-staged; configura alias `@/`; aggiungi script `lint`, `typecheck`, `test`, `e2e`, `supabase:test`; crea `README.md`, `docs/DECISIONS.md`, `.env.example`.
- Accettazione: `pnpm lint && pnpm typecheck` passano; `pnpm dev` serve una pagina vuota.

**M0-T2 Supabase locale e migrazioni base**

- Dipende da: M0-T1.
- Passi: `supabase init`; migrazione `0001_enums_and_profiles.sql` (enum, `profiles`, trigger creazione profilo su nuovo utente, funzioni `app.*`); configura generazione tipi in `lib/supabase/types.ts` (script `pnpm types`).
- Accettazione: `supabase db reset` termina senza errori; `pnpm types` genera i tipi; `pnpm typecheck` passa.

**M0-T3 Client Supabase e middleware**

- Dipende da: M0-T2.
- Passi: `lib/supabase/{server,browser,admin}.ts`, middleware che rinfresca la sessione e protegge `/(internal)` e `/(portal)`; regola ESLint che vieta l'import di `admin.ts` fuori da `app/api` e `lib`.
- Accettazione: una pagina protetta reindirizza a `/login` senza sessione; test unit sul middleware.

**M0-T4 CI**

- Dipende da: M0-T1.
- Passi: workflow GitHub Actions con lint, typecheck, test unit, avvio Supabase locale, test RLS, build Next.js e build per Cloudflare (`opennextjs-cloudflare build`).
- Accettazione: pipeline verde su una PR di prova.

**M0-T5 Hosting su Cloudflare Workers (spike di fattibilità)**

- Dipende da: M0-T3.
- Passi: leggi la documentazione Cloudflare corrente per Next.js su Workers; installa `@opennextjs/cloudflare` e `wrangler`; crea `wrangler.jsonc` (con `nodejs_compat`, `compatibility_date` recente, Smart Placement) e `open-next.config.ts`; aggiungi script `preview:cf` (build + anteprima nel runtime Workers) e `deploy:cf`; verifica che app, middleware (sessione Supabase), server actions e route handler funzionino; lettura da Supabase via `supabase-js`; variabili d'ambiente e segreti tramite binding Workers. Registra in `docs/DECISIONS.md` la versione dell'adapter e le eventuali limitazioni (es. middleware Node non supportato).
- Accettazione: `pnpm preview:cf` serve l'app; login e una lettura protetta da RLS funzionano nel runtime Workers; la dimensione del bundle compresso è documentata e rientra nel limite del piano scelto.

**M0-T6 Design system: Arc, MCP, tema chiaro/scuro**

- Dipende da: M0-T1, M0-T3.
- Passi: installa le skill di interfaccia come descritto nella sottosezione dedicata di 7.12 (`npx skills add jakubkrehel/skills -a codex`), rivedine i `SKILL.md` e annota il percorso di installazione in `docs/DECISIONS.md`; esegui i punti 1-7 di 7.12 (server MCP per Codex, regole in `AGENTS.md`, registry, `arc-foundation`, `motion` e `lucide-react`, `ArcProvider`, font Geist e Inter); implementa il tema di 7.13 con `next-themes`; crea `AGENTS.md` con le regole Arc e l'istruzione di consultare le skill di interfaccia (7.12); crea `docs/DESIGN-GUIDELINES.md` (sintesi Arc + Rauno + Interface Cheat Sheet; la sezione Lessons of Design si completa come indicato in 7.12); aggiungi lo script `check:tokens`; crea una pagina `/design-check` disponibile solo in sviluppo (in produzione risponde 404) che mostra i componenti Arc in uso nei due temi; imposta `data-accent="neutral"`.
- Accettazione: `search_components` dell'MCP restituisce risultati per "confirm a destructive action"; `pnpm dev` mostra un `Button` Arc corretto in tema chiaro e scuro; ricaricando la pagina in tema scuro non compare alcun lampeggio del tema chiaro (test e2e); cambiare tema non attiva transizioni sugli elementi; `pnpm check:tokens` e `pnpm lint` passano; le skill `better-*` risultano installate e leggibili da Codex.

### M1: Autenticazione, ruoli, utenti

**M1-T1 Login, logout, reset password**

- Dipende da: M0-T3.
- Passi: pagine `/login`, `/reset-password`, `/accept-invite`; form con Zod; messaggi in `it.json`; configura Playwright con i 5 progetti di viewport (7.10).
- Accettazione: e2e Playwright: login valido, login errato, reset password (con inbucket locale).

**M1-T2 Helper di autorizzazione**

- Dipende da: M1-T1.
- Passi: `getSessionUser()`, `requireRole(roles[])`, `requireBrandAccess(brandId)` in `lib/auth`; redirect per ruolo (interno → `/dashboard`, brand → `/portal/dashboard`).
- Accettazione: unit test per ogni helper e per ogni ruolo.

**M1-T3 Gestione utenti (solo admin)**

- Dipende da: M1-T2, M2-T1 (per l'associazione ai brand si completa in M2).
- Passi: elenco utenti, invito via email (Resend in modalità `log`), cambio ruolo, disattivazione (`is_active=false`); associazione utenti brand ↔ brand (tabella `brand_users`).
- Accettazione: e2e: admin invita staff; staff non vede `/settings/users`.

**M1-T4 Audit log base**

- Passi: migrazione `audit_log`, `logAudit()`, pagina di consultazione per admin.
- Accettazione: ogni azione di M1-T3 produce una riga di audit; test unit.

### M2: Anagrafiche

**M2-T1 Brand**

- Passi: migrazione `brands`, `brand_users`, `brand_contacts` con RLS; modulo `brands` (lista con DataTable, dettaglio, creazione/modifica, archiviazione, referenti).
- Accettazione: CRUD funzionante per admin; staff/accounting in sola lettura; test RLS: un utente brand legge solo i propri brand.

**M2-T2 Clienti**

- Passi: migrazione `customers`, `customer_contacts` con RLS; modulo `customers` con validazione P.IVA (11 cifre), codice SDI (7 caratteri) o PEC, indirizzi; lista, dettaglio, modifica, archiviazione.
- Accettazione: validazioni coperte da test unit; un utente brand non può leggere `customers` (test RLS).

**M2-T3 DataTable condivisa e componenti base**

- Passi: tutti i componenti sono composti con elementi Arc trovati via MCP (7.12): `AppShell` (navigazione responsive, 7.10), `DataTable` con vista card su mobile, `ResponsiveDialog` (Arc `dialog` + `bottom-sheet`), `ThemeSwitch` nel menu utente, link «Vai al contenuto» come primo elemento raggiungibile con Tab, `PageHeader`, `ConfirmDialog`, `EmptyState`, `FormField`; filtri e paginazione lato server.
- Accettazione: usata da M2-T1 e M2-T2; test unit su parsing parametri di query; e2e nei 5 viewport senza overflow orizzontale.

### M3: Catalogo e ordini

**M3-T1 Stagioni e prodotti**

- Dipende da: M2-T1.
- Passi: migrazioni `seasons`, `products`, `product_variants` con RLS; moduli con lista e form; generazione varianti da elenco taglie × colori; vincolo unicità SKU.
- Accettazione: creazione di un prodotto con 5 taglie × 3 colori genera 15 varianti; test RLS per brand.

**M3-T2 Schema ordini e logica di dominio**

- Dipende da: M3-T1, M2-T2.
- Passi: migrazioni `orders`, `order_lines`, `order_status_history`, `order_counters`, trigger di totali, numerazione e transizioni; viste `portal_orders`; modulo `lib/money`.
- Accettazione: test DB: numerazione senza duplicati con inserimenti concorrenti; transizione non valida rifiutata; totali corretti con arrotondamento al centesimo.

**M3-T3 Editor ordine (matrice taglie × colori)**

- Dipende da: M3-T2.
- Passi: pagina creazione/modifica ordine, componente `SizeColorMatrix`, selezione cliente/brand/stagione, sconto, condizioni di pagamento, salvataggio atomico, ricalcolo server; usabile da mobile (7.10); verifica `SizeColorMatrix` in tutti gli stati (vuoto, un solo colore, molte taglie, valori massimi, errori, mobile) con la skill `break` su una pagina temporanea non committata (7.12).
- Accettazione: e2e: creare un ordine con 3 prodotti, verificare totali; unit test `SizeColorMatrix`.

**M3-T4 Elenco e dettaglio ordini, cambio stato**

- Dipende da: M3-T3.
- Passi: lista con filtri (stato, brand, cliente, stagione, periodo), dettaglio con storico stati, azioni di transizione in base al ruolo, duplicazione ordine, export CSV.
- Accettazione: e2e: percorso `draft → confirmed → in_production → shipped → delivered`; i pulsanti mostrano solo transizioni valide.

**M3-T5 PDF conferma d'ordine e line sheet**

- Dipende da: M3-T4.
- Passi: spike di compatibilità del generatore PDF su Workers (vedi 7.4) e scelta documentata; `lib/pdf` con interfaccia `PdfRenderer`; route `/api/pdf/[type]/[id]` con verifica permessi, template neutri; salvataggio opzionale in Storage.
- Accettazione: il PDF si genera per un ordine di test **in `pnpm preview:cf`** (runtime Workers); un utente brand non può scaricare il PDF di un altro brand (test).

### M4: Calendario e documenti

**M4-T1 Eventi**

- Passi: migrazione `events` con RLS (brand vede solo `visible_to_brand`); modulo con FullCalendar, creazione/modifica da modale, drag & drop (solo desktop), filtri; su mobile vista predefinita lista/giorno (7.10).
- Accettazione: e2e: creare e spostare un evento; test RLS sul filtro `visible_to_brand`.

**M4-T2 Feed iCal e promemoria**

- Dipende da: M4-T1.
- Passi: tabella `ical_tokens`, route `/api/ical/[token]`, job promemoria giornaliero (route protetta da `CRON_SECRET` + `pg_cron`/scheduler), template email.
- Accettazione: il feed è importabile in un client iCal (test con parser `ical.js`); token revocato → 404.

**M4-T3 Documenti**

- Passi: migrazione `documents`, bucket privato, upload con validazione tipo/dimensione, URL firmati a scadenza, flag `shared_with_brand`.
- Accettazione: un file non condiviso non è accessibile da un utente brand (test Storage + RLS).

### M5: Budget, venduto, fatturato (parte analitica)

**M5-T1 Budget**

- Passi: migrazione `budgets` con RLS; modulo con CRUD (admin e accounting); validazione sovrapposizione periodi per stessa combinazione brand/stagione/cliente.
- Accettazione: test unit sulla sovrapposizione; RLS: brand legge solo i propri.

**M5-T2 Viste e dashboard**

- Dipende da: M3-T2, M5-T1.
- Passi: viste SQL di sez. 6; pagina dashboard interna (KPI, `BudgetVsActualChart`, `SalesTrendChart`, `TopCustomersChart`); filtri per stagione, brand, periodo.
- Accettazione: test su dati seed con risultati attesi calcolati a mano; le viste rispettano le RLS (`security_invoker`).

**M5-T3 Provvigioni**

- Passi: vista `v_commissions`, report per brand/periodo, export XLSX.
- Accettazione: test su ordini con e senza `commission_pct_override`.

### M6: Portale brand

**M6-T1 Layout e dashboard portale**

- Dipende da: M5-T2.
- Passi: route group `(portal)`, navigazione dedicata, dashboard con venduto vs budget dei propri brand.
- Accettazione: e2e: utente brand vede solo i propri brand; tentativo di aprire un `brandId` altrui restituisce 404.

**M6-T2 Ordini, vendite, documenti, calendario nel portale**

- Passi: lista e dettaglio ordini in sola lettura (tramite `portal_orders`, rispetta D1), pagina vendite per cliente/stagione, documenti condivisi, calendario filtrato; download PDF autorizzato.
- Accettazione: con `can_see_customer_names=false` il cliente appare come "Cliente riservato" ovunque (UI, PDF, export); nessun campo interno (`internal_notes`) è presente nelle risposte.

**M6-T3 Suite di test di isolamento**

- Passi: test automatici che, per **ogni tabella e vista** esposta, verificano che un utente brand A non legga né scriva dati del brand B, e che l'utente brand non scriva mai dati di business.
- Accettazione: `pnpm supabase:test` verde e parte obbligatoria della CI.

### M7: Fatturazione

**M7-T1 Interfaccia e provider mock**

- Passi: `lib/invoicing` con `InvoicingProvider` e `MockInvoicingProvider`; migrazioni `invoices`, `payments`.
- Accettazione: test unit del mock su tutti gli stati.

**M7-T2 Flusso fattura da ordine**

- Dipende da: M7-T1, M3-T4.
- Passi: azione "Genera fattura" da ordine `delivered`, copia dei dati fiscali, chiamata al provider, aggiornamento stato ordine a `invoiced`, scadenzario incassi, registrazione pagamenti, webhook `/api/webhooks/invoicing`.
- Accettazione: e2e col mock: ordine → fattura → pagamento; fatturato aggiornato nelle viste.

**M7-T3 Provider Fatture in Cloud**

- Passi: implementazione reale dietro la stessa interfaccia, OAuth/token da variabili d'ambiente, gestione errori e retry, test con risposte registrate (mock HTTP).
- Accettazione: i contract test sono gli stessi del mock; attivabile solo con `INVOICING_PROVIDER=fic`.

### M8: Responsive (audit) e PWA

**M8-T1 Audit responsive trasversale**

- Dipende da: M6-T2.
- Passi: suite Playwright che visita tutte le route principali (interne e portale) nei 5 viewport (7.10) e verifica assenza di overflow orizzontale, navigazione presente, azioni principali raggiungibili; correggi i difetti trovati; verifica input con tastiera corretta e target ≥ 44 px.
- Accettazione: `pnpm e2e --project=mobile-s --project=mobile --project=tablet --project=laptop --project=desktop` verde; per dashboard, lista ordini, editor ordine e calendario i test girano anche in tema chiaro e scuro (`colorScheme`).

**M8-T2 Manifest, icone, meta tag**

- Passi: `app/manifest.ts`, script `pnpm icons` per le icone segnaposto (192, 512, maskable, apple-touch-icon), tag nel layout, header per il manifest (7.11).
- Accettazione: e2e: `/manifest.webmanifest` risponde 200 con content-type corretto e i campi richiesti; le icone esistono e sono raggiungibili; il manifest è valido in DevTools → Application.

**M8-T3 Service worker, cache e pagina offline**

- Dipende da: M8-T2.
- Passi: `public/sw.js` con le regole di 7.11, pagina `/offline`, componente `PwaRegister`, pulizia delle cache al logout, header `Cache-Control: no-cache` su `/sw.js`.
- Accettazione: e2e Playwright: (a) il service worker si registra in build di produzione; (b) con `context.setOffline(true)` una navigazione mostra `/offline`; (c) dopo login e navigazione su ordini e clienti, nessuna cache contiene HTML autenticato, risposte `/api/*` o richieste Supabase; (d) dopo il logout le cache dinamiche sono vuote.

**M8-T4 Esperienza di installazione e aggiornamento**

- Dipende da: M8-T3.
- Passi: `useOnlineStatus` con banner offline e pulsanti di salvataggio disabilitati offline; voce "Installa app" (Chrome/Android) e istruzioni per iOS; avviso "Nuova versione disponibile" con aggiornamento controllato.
- Accettazione: test unit/e2e sui tre comportamenti; checklist manuale (installazione su Android Chrome e su iOS Safari, avvio in modalità standalone, aggiornamento versione) compilata in `docs/ARCHITECTURE.md`.

**M8-T5 (opzionale) Notifiche push**

- Dipende da: M8-T4, M4-T2.
- Passi: spike di compatibilità della libreria Web Push con il runtime Workers; se positivo, tabella `push_subscriptions` con RLS, richiesta di consenso esplicita nelle impostazioni, invio dei promemoria appuntamenti; se negativo, registra l'esito in `docs/DECISIONS.md` e salta il task.
- Accettazione: una notifica di prova arriva su un dispositivo con app installata; l'utente può revocare il consenso.

**M8-T6 Revisione di design**

- Dipende da: M8-T1, M8-T3.
- Passi: completa la sezione "Lessons of Design" di `docs/DESIGN-GUIDELINES.md` (se mancante, chiedi il testo all'umano); esegui la checklist Arc (https://uiarc.dev/r/skills/arc/checklist.md), la revisione con la skill `better-interface` (seguendo anche le istruzioni di `interface-review`) e le linee guida di Rauno e dell'Interface Cheat Sheet su tutte le schermate, in tema chiaro e scuro; verifica stati di caricamento, vuoto, errore e successo di ogni area dati; verifica contrasto con `@axe-core/playwright` nei due temi; correggi senza modificare gli interni dei componenti Arc.
- Accettazione: report in `docs/DESIGN-REVIEW.md`; nessuna violazione axe di gravità "serious" o "critical" nei due temi; `pnpm check:tokens` verde.

### M9: Rifinitura e rilascio

**M9-T1 Hardening**

- Passi: rate limiting su login e API pubbliche, header di sicurezza (CSP di base), MFA per admin, revisione di tutte le policy RLS, controllo che nessun segreto sia esposto al client.
- Accettazione: checklist di sicurezza in `docs/ARCHITECTURE.md` compilata; test e2e sul rate limiting.

**M9-T2 Osservabilità e backup**

- Passi: Sentry (opzionale), log strutturati, documentazione di backup/restore Supabase e prova di ripristino.
- Accettazione: procedura documentata in `README.md`.

**M9-T3 Ambienti e deploy**

- Passi: progetti Supabase staging e produzione (regione UE); ambienti Cloudflare Workers `staging` e `production` in `wrangler.jsonc`; segreti tramite `wrangler secret` (mai nel repository); dominio e certificati su Cloudflare; migrazioni in CI; seed solo per staging; deploy da GitHub Actions o Workers Builds.
- Accettazione: deploy automatico su staging a ogni merge; promozione manuale in produzione.

**M9-T4 Documentazione finale**

- Passi: `README.md` (setup, comandi, variabili), `docs/ARCHITECTURE.md`, `docs/DECISIONS.md` aggiornati, guida utente breve per ruolo.
- Accettazione: un nuovo sviluppatore avvia il progetto seguendo solo il README.

### M10: Importazione Excel (stagione, budget, negozi)

Dipende da M2-T2 (negozi), M3-T2 (ordini) e M5-T1 (budget); si può svolgere in parallelo a M8 e M9. **Il go-live in produzione (M9-T3) richiede M10 completata.** Le attività M10-T1...M10-T8 si sviluppano con un **file sintetico** generato da script (nessun dato reale); M10-T9 configura i campi reali quando l'umano li fornisce.

**M10-T1 Fondamenta e spike del parser**

- Passi: migrazioni delle tabelle e colonne di import (sez. 6), estensione `pg_trgm`, bucket privato `imports` con policy, RLS solo admin (e accounting per i budget); spike per scegliere la libreria di lettura XLSX nel browser (candidati in sez. 3), misurando tempo e memoria su un file da 20.000 righe in un Web Worker; registra la scelta in `docs/DECISIONS.md`; script `pnpm fixtures:import` che genera file Excel sintetici (negozi, ordini, budget, con errori voluti).
- Accettazione: `supabase db reset` passa; test RLS: un utente non admin non legge `import_*`; la libreria scelta legge il file da 20.000 righe in meno di 10 secondi senza bloccare l'interfaccia.

**M10-T2 Catalogo campi, parsing e mappatura**

- Dipende da: M10-T1.
- Passi: `modules/imports/fields.ts` (catalogo canonico con sinonimi e validatori); funzioni pure di normalizzazione (numeri e date italiani, serial di Excel, P.IVA, codice fiscale, testi); interfaccia di mappatura con suggerimenti automatici, scelta di foglio e riga di intestazione, valori di default, salvataggio e caricamento dei profili (`import_profiles`); wizard con `stepper`, `file-dropzone` e `progress` di Arc.
- Accettazione: unit test sulle funzioni di normalizzazione con almeno 30 casi (formati misti, celle vuote, testo al posto di numeri); la mappatura automatica indovina le colonne del file sintetico; e2e: caricare, mappare e salvare un profilo.

**M10-T3 Validazione e staging**

- Dipende da: M10-T2.
- Passi: regole di validazione per entità (passo 4 di 7.8) con stati e messaggi in italiano; invio a blocchi di 500 righe a `import_rows`; pagina di anteprima con `sortable-data-table`, filtri per stato, conteggi; report errori scaricabile (XLSX/CSV con numero di riga e motivo); rilevamento file già caricato (hash).
- Accettazione: sul file sintetico gli errori inseriti vengono tutti rilevati con il messaggio atteso; 20.000 righe validate e salvate in meno di 60 secondi; riscaricando lo stesso file compare l'avviso.

**M10-T4 Abbinamenti (negozi, brand, articoli)**

- Dipende da: M10-T3.
- Passi: abbinamento negozi per codice esterno, P.IVA, poi nome e città con `pg_trgm`; brand per nome normalizzato; articoli per SKU; interfaccia di risoluzione dei casi dubbi (collega, crea, ignora) con salvataggio delle decisioni nel lotto.
- Accettazione: test su coppie di nomi simili (maiuscole, punteggiatura, "S.r.l." e "srl", abbreviazioni); nessun duplicato creato quando un negozio esiste già; le decisioni restano dopo il ricaricamento della pagina.

**M10-T5 Funzioni di commit e rollback**

- Dipende da: M10-T4, M3-T2, M5-T1.
- Passi: `import_commit(batch_id)` e `import_rollback(batch_id)` in SQL (sicurezza e ordine di scrittura come in 7.8); raggruppamento delle righe in ordini (per riferimento esterno, oppure per negozio+brand+stagione+data se manca); stato degli ordini importati e tipo di granularità dal profilo; snapshot dei valori prima di un aggiornamento; audit; blocco contro commit concorrenti; limiti di tempo (`statement_timeout`) adeguati.
- Accettazione: test su Supabase locale: commit di un lotto sintetico crea i record attesi; riesecuzione dello stesso lotto non crea doppioni; un errore a metà annulla tutto (nessuna scrittura parziale); rollback ripristina lo stato precedente e viene rifiutato se un ordine importato risulta fatturato.

**M10-T6 Anagrafica negozi, ordini e budget (flussi per entità)**

- Dipende da: M10-T5.
- Passi: collegare le tre entità al wizard con le modalità di 7.8 (`upsert` / `insert_only`); anteprima delle differenze per gli aggiornamenti; creazione automatica di stagioni mancanti previa conferma; controllo della sovrapposizione dei budget (M5-T1); gestione di file con più fogli in un unico lotto nell'ordine negozi → ordini → budget.
- Accettazione: e2e sul file sintetico a tre fogli: importazione completa con conteggi corretti per entità; un secondo import dello stesso file segnala tutto come già presente.

**M10-T7 Totali per brand, controlli e confronti**

- Dipende da: M10-T3 (anteprima) e M10-T5 (dopo il commit).
- Passi: viste `v_import_batch_totals` e `v_budget_vs_previous_season`; schermata di riepilogo con tabella per brand, totale generale e confronto con i totali attesi (inseriti a mano o letti da una cella/colonna del profilo); conferma esplicita in presenza di differenze; pagina del lotto con report finale; export XLSX del confronto ordinato/budget; scheda riepilogativa nella dashboard.
- Accettazione: i totali calcolati in anteprima coincidono con quelli dopo il commit e con quelli di un calcolo indipendente nei test; una differenza forzata nei totali attesi blocca il commit finché non viene confermata.

**M10-T8 Storico, sicurezza e test finale**

- Dipende da: M10-T6, M10-T7.
- Passi: pagina storico dei lotti (autore, file, esito, link al report, pulsante di rollback con le sue condizioni); controlli di sicurezza del file (tipo reale, limiti, niente `.xlsm`, solo valori calcolati); conservazione del file originale con scadenza configurabile e job di pulizia; protezione dall'iniezione di formule negli export; `docs/IMPORT.md` con la guida d'uso; test e2e completo: caricamento → mappatura → validazione → abbinamenti → controllo totali → commit → totali per brand → rollback; verifica nei 5 viewport (l'interfaccia deve restare usabile, non è richiesto il flusso completo su telefono) e nei due temi.
- Accettazione: suite e2e verde; un utente non admin non può avviare né vedere importazioni (test); un file `.xlsm` o oltre i limiti viene rifiutato con messaggio chiaro.

**M10-T9 Configurazione dei campi reali (quando disponibili)**

- Dipende da: M10-T8 e dal file reale (bloccante n. 3, sez. 10).
- Passi: analizza il file reale o un suo esempio anonimizzato; aggiorna `modules/imports/fields.ts` (sinonimi, campi aggiuntivi, validatori); crea i profili predefiniti per ordini, budget e negozi; adegua la granularità (`order_lines` o `order_totals`) e le regole di raggruppamento degli ordini; aggiorna il modello di file scaricabile e le fixture; esegui un'importazione di prova su staging con dati anonimizzati e confronta i totali per brand con quelli del file originale.
- Accettazione: i totali per brand dopo l'importazione coincidono con quelli del file (o le differenze sono spiegate e documentate); `docs/IMPORT.md` descrive i campi reali.

---

## 9. Variabili d'ambiente (`.env.example`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # solo server
APP_URL=
RESEND_API_KEY=
EMAIL_FROM=
EMAIL_MODE=log                      # log | send
CRON_SECRET=
INVOICING_PROVIDER=mock             # mock | fic
FIC_ACCESS_TOKEN=
FIC_COMPANY_ID=
SENTRY_DSN=
CLOUDFLARE_ACCOUNT_ID=              # solo CI/deploy
CLOUDFLARE_API_TOKEN=               # solo CI/deploy
NEXT_PUBLIC_VAPID_PUBLIC_KEY=       # solo se si attivano le notifiche push
VAPID_PRIVATE_KEY=                  # solo server, solo se push
ARC_PRO_TOKEN=                      # solo se esiste un piano Arc Pro; mai nel repository
```

---

## 10. Quando fermarsi e chiedere all'umano

**Bloccanti** (non procedere con il task interessato senza risposta):

1. Provider di fatturazione definitivo e credenziali (solo per M7-T3).
2. Conferma delle decisioni D1 e D3 se i brand hanno accordi contrattuali diversi da quelli di default.
3. L'**elenco dei campi reali dell'Excel** (o un esempio anonimizzato): fogli, colonne, formato di date e numeri, se c'è una riga per ordine o per riga d'ordine, come sono indicati brand, stagioni e negozi, e se il file contiene totali di controllo. Blocca solo M10-T9: M10-T1...M10-T8 si sviluppano con il file sintetico. Servono inoltre un esempio di ordine, di listino e di fattura per validare il resto del modello.
4. Credenziali e accessi dei progetti Supabase, Cloudflare e Resend di staging e produzione (prima di M9-T3).
5. Piano Cloudflare da usare e dominio (se il bundle supera i limiti del piano gratuito, serve un piano a pagamento).
6. Nome definitivo dell'app (per manifest e icone) e, se si vuole un colore d'accento diverso dal neutro, quale dei temi di accento di Arc (o quale colore di brand) usare.
7. Autenticazione del server MCP di Arc in Codex (`codex mcp login arc`): richiede il login nel browser con un account Arc (gratuito) e può completarla solo l'umano (prima di M0-T6).
8. Se si vogliono componenti Arc Pro (es. `data-grid`): serve un piano Pro e un token (`ARC_PRO_TOKEN`); in assenza, solo componenti gratuiti.

**Non bloccanti** (scegli il default, registra in `docs/DECISIONS.md`): nomi di campi secondari, ordine delle colonne nelle tabelle, testi di interfaccia, forma di rivolgersi a chi legge ("tu" o "Lei"; default "tu"), dettagli di validazione non specificati.

---

## 11. Definition of Done (per ogni task)

- [ ] Codice completo, tipato, senza `any` non motivati
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` verdi
- [ ] Test aggiunti per logica di dominio, validazioni e RLS toccate dal task
- [ ] Nuove tabelle: RLS abilitata, policy scritte e testate
- [ ] Server actions: `requireRole`, validazione Zod, `logAudit`, gestione errori standard
- [ ] Testi in `messages/it.json`
- [ ] UI costruita con componenti Arc (cercati via MCP e letta la loro pagina), senza colori, font o raggi scritti a mano (`pnpm check:tokens` passa)
- [ ] Verificata in tema chiaro e scuro; stati di caricamento, vuoto, errore e successo presenti per ogni area dati
- [ ] Rispettate le regole di Arc e le linee guida di `docs/DESIGN-GUIDELINES.md`
- [ ] Per le decisioni di interfaccia non coperte da Arc è stata consultata la skill pertinente (7.12) e le scelte non ovvie sono annotate in `docs/DECISIONS.md`
- [ ] UI verificata nei 5 viewport (nessun overflow orizzontale, target touch adeguati)
- [ ] Funziona nel runtime Workers (`pnpm preview:cf`) se il task tocca route handler, PDF, export, email o librerie nuove
- [ ] Nessun dato autenticato finisce nella cache del service worker
- [ ] Documentazione aggiornata se cambiano comandi, variabili o decisioni
- [ ] Commit con ID del task

---

## 12. Cose da NON fare

- Non usare float per importi.
- Non usare la service role key in codice raggiungibile dal browser.
- Non disattivare o aggirare le RLS per "far funzionare" una query: correggi la policy.
- Non cancellare fisicamente ordini, fatture o anagrafiche.
- Non calcolare aggregazioni economiche nel frontend.
- Non implementare direttamente il protocollo SDI.
- Non scrivere UI personalizzata se esiste un componente o blocco Arc adatto; non modificare gli interni dei componenti Arc.
- Non usare colori esadecimali, classi colore di Tailwind, font, raggi o ombre scritti a mano: solo token Arc.
- Non usare componenti Arc Pro senza piano Pro, né aggiungere altre librerie UI.
- Non scrivere nei testi trattini lunghi, etichette sopra i titoli o testo tutto maiuscolo (regole Arc).
- Non scrivere stili di focus propri né transizioni attive durante il cambio di tema.
- Non aggiungere dipendenze non elencate in sez. 3 senza annotarle in `docs/DECISIONS.md` con motivazione.
- Non usare API Node non supportate da Cloudflare Workers (`fs`, processi figli, Chromium locale) senza averle verificate in `pnpm preview:cf`.
- Non memorizzare nel service worker pagine autenticate, risposte API, richieste Supabase, PDF o URL firmati.
- Non implementare la scrittura offline né la sincronizzazione in background (D12).
- Non progettare per desktop e "adattare" poi: parti dal layout mobile.
- Non scrivere nomi di colonna Excel nella logica di dominio: stanno solo nel catalogo campi e nei profili di mappatura.
- Non leggere l'XLSX sul runtime Workers né eseguire formule o macro del file; non scrivere sul database righe di un lotto fuori dalla funzione `import_commit`.
- Non importare mai con errori non risolti senza esclusione esplicita e conferma dell'utente.
- Non eseguire script o comandi contenuti in skill di terze parti senza averli letti; le skill guidano le scelte ma non sostituiscono le regole di Arc né questo piano.
