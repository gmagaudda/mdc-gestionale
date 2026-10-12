"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Input } from "@/components/arc/input/input";
import { Checkbox } from "@/components/arc/checkbox/checkbox";
import { Button } from "@/components/arc/button/button";
import { Alert } from "@/components/arc/alert/alert";
import { SelectField } from "@/components/shared/select-field";
import { SearchSelect } from "@/components/shared/search-select";
import { searchOrderCustomers } from "@/modules/orders/actions";
import {
  documentSchema,
  documentKinds,
  acceptedDocumentTypes,
  maxDocumentSize,
  type DocumentInput,
} from "../schema";
import { updateDocument, searchDocumentOrders } from "../actions";
export function DocumentForm({
  brands,
  existing,
}: {
  brands: { id: string; name: string }[];
  existing?: DocumentInput & {
    id: string;
    updated_at: string;
    customer_name?: string;
    order_number?: string;
  };
}) {
  const t = useTranslations("documents"),
    router = useRouter();
  const [value, setValue] = useState<DocumentInput>(
    existing ?? {
      name: "",
      kind: "other",
      brand_id: "",
      customer_id: "",
      order_id: "",
      shared_with_brand: false,
    },
  );
  const [fields, setFields] = useState<Record<string, string>>({}),
    [error, setError] = useState("");
  const [pending, start] = useTransition();
  const form = useRef<HTMLFormElement>(null),
    file = useRef<HTMLInputElement>(null);
  const focusError = useRef(false);
  useEffect(() => {
    if (!pending && focusError.current) {
      form.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus();
      focusError.current = false;
    }
  }, [fields, pending]);
  const set = <K extends keyof DocumentInput>(key: K, data: DocumentInput[K]) =>
    setValue((current) => ({ ...current, [key]: data }));
  function fail(fieldErrors: Record<string, string>) {
    focusError.current = true;
    setFields(fieldErrors);
    setError(t("validation"));
  }
  return (
    <form
      ref={form}
      className="stack"
      aria-busy={pending}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setError("");
        setFields({});
        const parsed = documentSchema.safeParse(value);
        if (!parsed.success) {
          const errors: Record<string, string> = {};
          for (const issue of parsed.error.issues)
            errors[String(issue.path[0])] = t("required");
          fail(errors);
          return;
        }
        const selected = file.current?.files?.[0];
        if (
          !existing &&
          (!selected || selected.size > maxDocumentSize || selected.size === 0)
        ) {
          fail({ file: t(selected ? "size" : "fileRequired") });
          return;
        }
        start(async () => {
          try {
            if (existing) {
              const result = await updateDocument(
                existing.id,
                value,
                existing.updated_at,
              );
              if (!result.ok) {
                setError(t(result.error));
                return;
              }
              router.push(`/documents/${existing.id}?saved=1`);
            } else {
              const data = new FormData();
              data.set("metadata", JSON.stringify(value));
              data.set("file", selected!);
              const response = await fetch("/api/documents/upload", {
                method: "POST",
                body: data,
              });
              const result = await response.json();
              if (!response.ok) {
                setError(
                  t.has(result.error) ? t(result.error) : t("uploadError"),
                );
                if (["type", "size", "filename", "file"].includes(result.error))
                  fail({
                    file: t.has(result.error)
                      ? t(result.error)
                      : t("fileRequired"),
                  });
                return;
              }
              router.push(`/documents/${result.id}?saved=1`);
            }
            router.refresh();
          } catch {
            setError(t(existing ? "saveError" : "uploadError"));
          }
        });
      }}
    >
      <Alert open={!!error} tone="danger" title={error} />
      <fieldset className="form-grid" disabled={pending}>
        <legend className="sr-only">{t(existing ? "edit" : "upload")}</legend>
        <Input
          label={t("name")}
          value={value.name}
          maxLength={200}
          error={fields.name}
          onChange={(e) => set("name", e.target.value)}
        />
        <SelectField
          label={t("kind")}
          value={value.kind}
          error={fields.kind}
          options={documentKinds.map((kind) => ({
            value: kind,
            label: t(`kinds.${kind}`),
          }))}
          onValueChange={(kind) => set("kind", kind as DocumentInput["kind"])}
        />
        {!existing ? (
          <SearchSelect
            label={t("brand")}
            value={value.brand_id}
            error={fields.brand_id}
            options={brands.map((brand) => ({
              value: brand.id,
              label: brand.name,
            }))}
            onValueChange={(brand) =>
              setValue((current) => ({
                ...current,
                brand_id: brand,
                order_id: "",
              }))
            }
          />
        ) : (
          <p>
            {t("brand")}:{" "}
            {brands.find((brand) => brand.id === value.brand_id)?.name}
          </p>
        )}
        <SearchSelect
          label={t("customer")}
          value={value.customer_id || "none"}
          options={[
            { value: "none", label: t("none") },
            ...(existing?.customer_id && existing.customer_name
              ? [{ value: existing.customer_id, label: existing.customer_name }]
              : []),
          ]}
          loadOptions={async (term) => {
            const result = await searchOrderCustomers(term);
            return result.ok
              ? {
                  ok: true,
                  data: [{ value: "none", label: t("none") }, ...result.data],
                }
              : result;
          }}
          onValueChange={(id) => set("customer_id", id === "none" ? "" : id)}
        />
        {value.brand_id && (
          <div className="stack">
            <SearchSelect
              key={value.brand_id}
              label={t("order")}
              value={value.order_id || "none"}
              options={[
                { value: "none", label: t("none") },
                ...(existing?.order_id && existing.order_number
                  ? [{ value: existing.order_id, label: existing.order_number }]
                  : []),
              ]}
              loadOptions={async (query) => {
                const result = await searchDocumentOrders(
                  value.brand_id,
                  query,
                );
                return result.ok
                  ? {
                      ok: true,
                      data: [
                        { value: "none", label: t("none") },
                        ...result.data,
                      ],
                    }
                  : result;
              }}
              onValueChange={(id) => set("order_id", id === "none" ? "" : id)}
            />
            <p className="text-secondary">{t("orderHint")}</p>
          </div>
        )}
        {!existing && (
          <Input
            ref={file}
            label={t("file")}
            type="file"
            accept={acceptedDocumentTypes}
            description={t("fileHint")}
            error={fields.file}
          />
        )}
        <Checkbox
          label={t("shared")}
          description={t("shareHint")}
          checked={value.shared_with_brand}
          onCheckedChange={(checked) =>
            set("shared_with_brand", checked === true)
          }
        />
      </fieldset>
      <div className="form-actions">
        <Button size="lg" type="submit" loading={pending} disabled={pending}>
          {t(existing ? "save" : "upload")}
        </Button>
        <Button
          size="lg"
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            router.push(existing ? `/documents/${existing.id}` : "/documents")
          }
        >
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
