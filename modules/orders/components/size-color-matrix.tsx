"use client";
import { useTranslations } from "next-intl";
import { Input } from "@/components/arc/input/input";
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
      <div
        className="matrix-scroll"
        role="region"
        tabIndex={0}
        aria-label={t("matrix")}
      >
        <table
          className="size-color-matrix"
          style={{ width: `${12 + sizes.length * 10}rem` }}
        >
          <caption>{t("matrix")}</caption>
          <colgroup>
            <col className="matrix-label-column" />
            {sizes.map((size) => (
              <col key={size} />
            ))}
            <col className="matrix-label-column" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">{t("color")}</th>
              {sizes.map((size) => (
                <th scope="col" key={size}>
                  <bdi>{size}</bdi>
                </th>
              ))}
              <th scope="col">{t("total")}</th>
            </tr>
          </thead>
          <tbody>
            {colors.map((color) => (
              <tr key={color}>
                <th scope="row">
                  <bdi>{color}</bdi>
                </th>
                {sizes.map((size) => {
                  const variant = lookup.get(`${color}\0${size}`);
                  if (!variant) return <td key={size}>{t("unavailable")}</td>;
                  const quantity = quantities[variant.id] ?? 0;
                  return (
                    <td key={size}>
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
                    </td>
                  );
                })}
                <td className="tabular-nums">{totals.rows[color]}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">{t("total")}</th>
              {sizes.map((size) => (
                <td className="tabular-nums" key={size}>
                  {totals.columns[size]}
                </td>
              ))}
              <td className="tabular-nums">{totals.total}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p role="status">{t("pieces", { count: totals.total })}</p>
    </div>
  );
}
