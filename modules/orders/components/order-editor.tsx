"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Input } from "@/components/arc/input/input";
import { Textarea } from "@/components/arc/textarea/textarea";
import { MoneyInput } from "@/components/arc/money-input/money-input";
import { Button } from "@/components/arc/button/button";
import { Alert } from "@/components/arc/alert/alert";
import { SearchSelect } from "@/components/shared/search-select";
import { calculateLine, formatMoney } from "@/lib/money";
import { orderSchema, type OrderInput } from "../schema";
import { saveOrder, searchOrderCustomers } from "../actions";
import type { MatrixProduct } from "../queries";
import { SizeColorMatrix, validQuantity } from "./size-color-matrix";
type Initial = OrderInput & { vatRates?: Record<string, number> };
export function OrderEditor({
  id = null,
  initial,
  brands,
  seasons,
  customers,
  products,
  serverTotals,
}: {
  id?: string | null;
  initial: Initial;
  brands: { id: string; name: string }[];
  seasons: { id: string; brand_id: string; code: string; name: string }[];
  customers: { id: string; legal_name: string; city: string }[];
  products: MatrixProduct[];
  serverTotals?: { net: number; vat: number; gross: number };
}) {
  const t = useTranslations("orders");
  const router = useRouter();
  const [header, setHeader] = useState(initial.header);
  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries(
      initial.lines.map((line) => [line.variant_id, line.quantity]),
    ),
  );
  const [prices, setPrices] = useState<Record<string, number>>(
    Object.fromEntries(
      initial.lines.map((line) => [line.variant_id, line.unit_price_cents]),
    ),
  );
  const [discounts, setDiscounts] = useState<Record<string, number>>(
    Object.fromEntries(
      initial.lines.map((line) => [line.variant_id, line.discount_pct]),
    ),
  );
  const [selected, setSelected] = useState<string[]>(
    products
      .filter((product) =>
        product.product_variants.some((variant) =>
          initial.lines.some((line) => line.variant_id === variant.id),
        ),
      )
      .map((product) => product.id),
  );
  const [chosen, setChosen] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [matrixError, setMatrixError] = useState(false);
  const [pending, start] = useTransition();
  const selectedProducts = products.filter((product) =>
    selected.includes(product.id),
  );
  const lines = selectedProducts.flatMap((product) =>
    product.product_variants
      .filter((variant) => (quantities[variant.id] ?? 0) !== 0)
      .map((variant) => ({
        variant_id: variant.id,
        quantity: quantities[variant.id],
        unit_price_cents: prices[variant.id] ?? product.wholesale_price_cents,
        discount_pct: discounts[variant.id] ?? 0,
      })),
  );
  let net = 0n,
    vat = 0n;
  let invalidPreview = false;
  for (const line of lines) {
    const product = selectedProducts.find((product) =>
      product.product_variants.some(
        (variant) => variant.id === line.variant_id,
      ),
    )!;
    try {
      if (!validQuantity(line.quantity)) throw Error("Invalid quantity");
      const amount = calculateLine({
        quantity: line.quantity,
        unitPriceCents: line.unit_price_cents,
        lineDiscount: line.discount_pct,
        orderDiscount: header.discount_pct,
        vatRate: initial.vatRates?.[line.variant_id] ?? product.vat_rate,
      });
      net += amount.net;
      vat += amount.vat;
    } catch {
      invalidPreview = true;
    }
  }
  const update = <K extends keyof Initial["header"]>(
    key: K,
    value: Initial["header"][K],
  ) => setHeader((current) => ({ ...current, [key]: value }));
  return (
    <form
      className="stack"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setError("");
        setFields({});
        setMatrixError(false);
        const parsed = orderSchema.safeParse({ header, lines });
        if (!parsed.success) {
          const fieldErrors: Record<string, string> = {};
          for (const issue of parsed.error.issues) {
            if (issue.path[0] === "header")
              fieldErrors[String(issue.path[1])] = t("validation");
            else {
              const line = lines[Number(issue.path[1])];
              if (issue.path[2] === "quantity") setMatrixError(true);
              if (line)
                fieldErrors[
                  `line-${line.variant_id}-${String(issue.path[2])}`
                ] = t("validation");
            }
          }
          setFields(fieldErrors);
          const first = parsed.error.issues[0];
          if (first.path[0] === "lines") {
            const line = lines[Number(first.path[1])];
            if (line) {
              const element = document.getElementById(
                first.path[2] === "quantity"
                  ? `qty-${line.variant_id}`
                  : `line-${line.variant_id}-${String(first.path[2])}`,
              );
              const disclosure = element?.closest("details");
              if (disclosure) disclosure.open = true;
              element?.focus();
            }
          } else
            document.getElementById(`order-${String(first.path[1])}`)?.focus();
          setError("validation");
          return;
        }
        start(async () => {
          try {
            const result = await saveOrder(id, parsed.data);
            if (!result.ok) setError(result.error);
            else {
              router.push(`/orders/${result.data}/edit?saved=1`);
              router.refresh();
            }
          } catch {
            setError("saveError");
          }
        });
      }}
    >
      <div className="form-grid">
        <SearchSelect
          id="order-brand_id"
          label={t("brand")}
          value={header.brand_id}
          options={brands.map((row) => ({ value: row.id, label: row.name }))}
          disabled={Boolean(id) || selected.length > 0 || pending}
          error={fields.brand_id}
          onValueChange={(value) => {
            update("brand_id", value);
            update("season_id", "");
          }}
        />
        <SearchSelect
          id="order-season_id"
          label={t("season")}
          value={header.season_id}
          options={seasons
            .filter((row) => row.brand_id === header.brand_id)
            .map((row) => ({
              value: row.id,
              label: `${row.code}: ${row.name}`,
            }))}
          disabled={Boolean(id) || selected.length > 0 || pending}
          error={fields.season_id}
          onValueChange={(value) => update("season_id", value)}
        />
        <SearchSelect
          id="order-customer_id"
          label={t("customer")}
          value={header.customer_id}
          options={customers.map((row) => ({
            value: row.id,
            label: `${row.legal_name}${row.city ? ` · ${row.city}` : ""}`,
          }))}
          disabled={pending}
          error={fields.customer_id}
          loadOptions={searchOrderCustomers}
          onValueChange={(value) => update("customer_id", value)}
        />
        <Input
          id="order-order_date"
          label={t("order_date")}
          type="date"
          required
          value={header.order_date}
          disabled={pending}
          error={fields.order_date}
          onChange={(event) => update("order_date", event.target.value)}
        />
        <Input
          id="order-delivery_date"
          label={t("delivery_date")}
          type="date"
          value={header.delivery_date}
          disabled={pending}
          error={fields.delivery_date}
          onChange={(event) => update("delivery_date", event.target.value)}
        />
        <Input
          id="order-payment_terms"
          label={t("payment_terms")}
          value={header.payment_terms}
          maxLength={500}
          disabled={pending}
          error={fields.payment_terms}
          onChange={(event) => update("payment_terms", event.target.value)}
        />
        <Input
          id="order-discount_pct"
          label={t("discount_pct")}
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          step="0.01"
          value={header.discount_pct}
          disabled={pending}
          error={fields.discount_pct}
          onChange={(event) =>
            update("discount_pct", Number(event.target.value))
          }
        />
        <Input
          id="order-commission_pct_override"
          label={t("commission_pct_override")}
          description={t("brandCommission")}
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          step="0.01"
          value={header.commission_pct_override ?? ""}
          disabled={pending}
          error={fields.commission_pct_override}
          onChange={(event) =>
            update(
              "commission_pct_override",
              event.target.value === "" ? null : Number(event.target.value),
            )
          }
        />
      </div>
      <section className="stack">
        <h2>{t("products")}</h2>
        <SearchSelect
          label={t("chooseProduct")}
          value={chosen}
          options={products
            .filter(
              (product) =>
                product.brand_id === header.brand_id &&
                product.season_id === header.season_id &&
                !product.deleted_at &&
                !selected.includes(product.id),
            )
            .map((product) => ({
              value: product.id,
              label: `${product.sku_base}: ${product.name}`,
            }))}
          disabled={pending}
          onValueChange={setChosen}
        />
        <Button
          variant="secondary"
          type="button"
          size="lg"
          disabled={!chosen || pending}
          onClick={() => {
            setSelected((current) => [...current, chosen]);
            setChosen("");
          }}
        >
          {t("addProduct")}
        </Button>
        {!selectedProducts.length && <p>{t("emptyProducts")}</p>}
        {selectedProducts.map((product) => (
          <section key={product.id} className="stack order-product">
            <div className="page-header">
              <h3>{product.name}</h3>
              <Button
                variant="ghost"
                type="button"
                size="lg"
                disabled={pending}
                onClick={() =>
                  setSelected((current) =>
                    current.filter((value) => value !== product.id),
                  )
                }
              >
                {t("removeProduct")}
              </Button>
            </div>
            {product.deleted_at && <p>{t("archivedProduct")}</p>}
            <SizeColorMatrix
              variants={product.product_variants}
              quantities={quantities}
              onChange={(variant, value) =>
                setQuantities((current) => ({ ...current, [variant]: value }))
              }
              disabled={pending}
              error={matrixError}
            />
            <details>
              <summary className="text-link">{t("lineAdjustments")}</summary>
              <div className="stack line-adjustments">
                {product.product_variants
                  .filter((variant) => (quantities[variant.id] ?? 0) > 0)
                  .map((variant) => (
                    <fieldset className="stack address-fields" key={variant.id}>
                      <legend>
                        {variant.color} · {variant.size}
                      </legend>
                      <div className="form-grid">
                        <MoneyInput
                          id={`line-${variant.id}-unit_price_cents`}
                          label={t("unit_price_cents")}
                          error={fields[`line-${variant.id}-unit_price_cents`]}
                          value={
                            prices[variant.id] ?? product.wholesale_price_cents
                          }
                          currency="EUR"
                          currencies={["EUR"]}
                          locale="it-IT"
                          quickAdd={[]}
                          disabled={pending}
                          onValueChange={(value) =>
                            setPrices((current) => ({
                              ...current,
                              [variant.id]: value ?? 0,
                            }))
                          }
                        />
                        <Input
                          id={`line-${variant.id}-discount_pct`}
                          label={t("line_discount_pct")}
                          error={fields[`line-${variant.id}-discount_pct`]}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={100}
                          step="0.01"
                          value={discounts[variant.id] ?? 0}
                          disabled={pending}
                          onChange={(event) =>
                            setDiscounts((current) => ({
                              ...current,
                              [variant.id]: Number(event.target.value),
                            }))
                          }
                        />
                      </div>
                    </fieldset>
                  ))}
                {!product.product_variants.some(
                  (variant) => (quantities[variant.id] ?? 0) > 0,
                ) && <p>{t("quantitiesFirst")}</p>}
              </div>
            </details>
          </section>
        ))}
      </section>
      <Textarea
        id="order-internal_notes"
        label={t("internal_notes")}
        value={header.internal_notes}
        maxLength={10000}
        disabled={pending}
        error={fields.internal_notes}
        onChange={(event) => update("internal_notes", event.target.value)}
      />
      <section className="stack" aria-label={t("preview")}>
        <h2>{t("preview")}</h2>
        <p>{t("serverRecalculates")}</p>
        {invalidPreview ? (
          <Alert tone="warning" title={t("validation")} />
        ) : (
          <dl className="details-grid tabular-nums">
            <div>
              <dt>{t("net")}</dt>
              <dd>{formatMoney(net)}</dd>
            </div>
            <div>
              <dt>{t("vat")}</dt>
              <dd>{formatMoney(vat)}</dd>
            </div>
            <div>
              <dt>{t("gross")}</dt>
              <dd>{formatMoney(net + vat)}</dd>
            </div>
          </dl>
        )}
      </section>
      {serverTotals && (
        <section className="stack" aria-label={t("savedTotals")}>
          <h2>{t("savedTotals")}</h2>
          <dl className="details-grid tabular-nums">
            <div>
              <dt>{t("net")}</dt>
              <dd>{formatMoney(serverTotals.net)}</dd>
            </div>
            <div>
              <dt>{t("vat")}</dt>
              <dd>{formatMoney(serverTotals.vat)}</dd>
            </div>
            <div>
              <dt>{t("gross")}</dt>
              <dd>{formatMoney(serverTotals.gross)}</dd>
            </div>
          </dl>
        </section>
      )}
      <Alert
        open={Boolean(error)}
        tone="danger"
        title={error ? t(error) : ""}
      />
      <div className="form-actions">
        <Button size="lg" type="submit" loading={pending} disabled={pending}>
          {t("saveDraft")}
        </Button>
      </div>
    </form>
  );
}
