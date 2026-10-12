import { uuid, enum as enumeration } from "zod";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth";
import { getPdfModel } from "@/lib/pdf/models";
import { PrintPdfRenderer, UnsupportedPdfCharacters } from "@/lib/pdf/renderer";
import { pdfFont } from "@/lib/pdf/font";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return new Response(null, { status: 401 });
  const { type, id } = await params;
  const parsed = enumeration(["order-confirmation", "line-sheet"]).safeParse(
    type,
  );
  if (!parsed.success || !uuid().safeParse(id).success)
    return new Response(null, { status: 404 });
  try {
    const model = await getPdfModel(parsed.data, id);
    if (!model) return new Response(null, { status: 404 });
    const renderer = new PrintPdfRenderer(await pdfFont());
    const bytes = await renderer.render(parsed.data, model);
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
        error instanceof UnsupportedPdfCharacters
          ? "unsupportedCharacters"
          : "generationError",
      ),
      {
        status: error instanceof UnsupportedPdfCharacters ? 422 : 503,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}
