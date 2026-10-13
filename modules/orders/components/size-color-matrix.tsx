"use client";
import { useTranslations } from "next-intl";
import { Input } from "@/components/arc/input/input";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { ArcDataTable } from "@/components/shared/arc-data-table";
import { Alert } from "@/components/arc/alert/alert";
export type MatrixVariant = {
  id: string;
  size: string;
  color: string;
  sku: string;
};
export const validQuantity = (value: number) =>
  Number.isInteger(value) && value >= 0 && value <= 100000;
export function matrixTotals(
  variants: MatrixVariant[],
  quantities: Record<string, number>,
) {
  const rows: Record<string, number> = {};
  const columns: Record<string, number> = {};
  let total = 0;
  for (const variant of variants) {
    const raw = quantities[variant.id] ?? 0;
    const value = validQuantity(raw) ? raw : 0;
    rows[variant.color] = (rows[variant.color] ?? 0) + value;
    columns[variant.size] = (columns[variant.size] ?? 0) + value;
    total += value;
  }
  return { rows, columns, total };
}
export function SizeColorMatrix({
  variants,
  quantities,
  onChange,
  disabled = false,
  error = false,
}: {
  variants: MatrixVariant[];
  quantities: Record<string, number>;
  onChange: (id: string, value: number) => void;
  disabled?: boolean;
  error?: boolean;
}) {
  const t = useTranslations("orders");
  const sizes = [...new Set(variants.map((row) => row.size))];
  const colors = [...new Set(variants.map((row) => row.color))];
  const totals = matrixTotals(variants, quantities);
  const lookup = new Map(
    variants.map((row) => [`${row.color}\0${row.size}`, row]),
  );
  if (!variants.length) return <p role="status">{t("noVariants")}</p>;
  return (
    <div className="stack">
      <p>{t("matrixHint")}</p>
      <Alert open={error} tone="danger" title={t("quantityRange")} />
      <ArcDataTable
        rows={colors.map((color) => ({
          id: color,
          color,
          total: totals.rows[color],
          ...Object.fromEntries(
            sizes.map((size) => [
              `size:${size}`,
              quantities[lookup.get(`${color}\0${size}`)?.id ?? ""] ?? 0,
            ]),
          ),
        }))}
        rowKey="id"
        caption={t("matrix")}
        columns={[
          { key: "color", label: t("color"), width: 120 },
          ...sizes.map((size) => ({
            key: `size:${size}`,
            label: size,
            numeric: false,
            width: 160,
            render: (_value: unknown, row: { color: string }) => {
              const color = row.color;
              const variant = lookup.get(`${color}\0${size}`);
              if (!variant) return <span>{t("unavailable")}</span>;
              const quantity = quantities[variant.id] ?? 0;
              return (
                <Input
                  id={`qty-${variant.id}`}
                  label={t("quantityFor", { color, size })}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100000}
                  step={1}
                  value={quantity === 0 ? "" : quantity}
                  disabled={disabled}
                  error={
                    error && !validQuantity(quantity)
                      ? t("quantityRange")
                      : undefined
                  }
                  onChange={(event) =>
                    onChange(
                      variant.id,
                      event.target.value === ""
                        ? 0
                        : Number(event.target.value),
                    )
                  }
                />
              );
            },
          })),
          {
            key: "total",
            label: t("total"),
            numeric: true,
            width: 100,
            render: (_value, row) => (
              <AnimatedNumber value={totals.rows[row.color]} />
            ),
          },
        ]}
      />
      <dl className="details-grid">
        {sizes.map((size) => (
          <div key={size}>
            <dt>{t("totalForSize", { size })}</dt>
            <dd className="tabular-nums">
              <AnimatedNumber value={totals.columns[size]} />
            </dd>
          </div>
        ))}
        <div>
          <dt>{t("total")}</dt>
          <dd className="tabular-nums">
            <AnimatedNumber value={totals.total} />
          </dd>
        </div>
      </dl>
      <p role="status">{t("pieces", { count: totals.total })}</p>
    </div>
  );
}
