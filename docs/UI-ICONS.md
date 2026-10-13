# Icone della navigazione

Le icone della shell provengono dalla famiglia outline Tabler, recuperata con la skill [Better Icons](https://github.com/better-auth/better-icons). La CLI pubblicata è bloccata a 1.0.4. Nessuna installazione globale o modifica ai server MCP dell’utente.

`components/shared/erp-icon.tsx` contiene solo le 27 icone utilizzate, come SVG React locali: nessuna richiesta a Iconify durante l’uso del gestionale. Colore ereditato tramite `currentColor`, icone decorative escluse dall’albero accessibile e accompagnate da testo.

Per cercare un’icona:

```sh
pnpm dlx better-icons@1.0.4 search dashboard --prefix tabler --limit 4 --json
```

Per rigenerare la selezione e formattarla:

```sh
node scripts/navigation-icons.mjs
pnpm exec prettier --write components/shared/erp-icon.tsx
```

Il generatore richiede `--color none`: la versione 1.0.4 aggiunge un fill ai path privi di attributi propri anche quando il gruppo SVG eredita già `fill="none"`. Questa opzione mantiene il disegno outline e il tratto originale `currentColor`.

Tabler Icons: copyright 2020–2026 Paweł Kuna, [licenza MIT](licenses/tabler-icons.txt). Gli interni dei componenti Arc conservano la loro iconografia originale.
