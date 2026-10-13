import { uuid, enum as enumeration } from "zod";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth";
import { getPdfModel } from "@/lib/pdf/models";
import { renderPdf, UnsupportedPdfCharacters } from "@/lib/pdf/renderer";
import { pdfFont } from "@/lib/pdf/font";
import { dashboardFiltersSchema } from "@/modules/dashboard/schema";
import { PdfSummaryTooLarge } from "@/lib/pdf/summary-schema";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return new Response(null, { status: 401 });
  const { type, id } = await params;
  const parsed = enumeration([
    "order-confirmation",
    "line-sheet",
    "brand-summary",
  ]).safeParse(type);
  if (!parsed.success || !uuid().safeParse(id).success)
    return new Response(null, { status: 404 });
  try {
    const input = dashboardFiltersSchema.safeParse({
      ...Object.fromEntries(new URL(request.url).searchParams),
      brand_id: id,
    });
    if (parsed.data === "brand-summary" && !input.success) {
      const t = await getTranslations("portal");
      return new Response(t("invalidFilters"), {
        status: 400,
        headers: { "Cache-Control": "private, no-store" },
      });
    }
    const model = await getPdfModel(
      parsed.data,
      id,
      input.success ? input.data : undefined,
    );
    if (!model) return new Response(null, { status: 404 });
    const bytes = await renderPdf(model, await pdfFont());
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${parsed.data}-${id}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const t = await getTranslations("pdf");
    return new Response(
      t(
        error instanceof PdfSummaryTooLarge
          ? "summaryTooLarge"
          : error instanceof UnsupportedPdfCharacters
            ? "unsupportedCharacters"
            : "generationError",
      ),
      {
        status:
          error instanceof PdfSummaryTooLarge
            ? 413
            : error instanceof UnsupportedPdfCharacters
              ? 422
              : 503,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}
