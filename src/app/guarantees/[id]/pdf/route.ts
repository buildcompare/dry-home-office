import { createClient } from "@/lib/supabase/server";
import {
  guaranteePdfFilename,
  loadGuaranteePdfSource,
  renderGuaranteePdf,
} from "@/lib/guarantee-pdf";

export const runtime = "nodejs";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: Request,
  { params }: RouteProps
) {
  const { id } = await params;

  const supabase = await createClient();

  const source = await loadGuaranteePdfSource(supabase, id);

  if (!source) {
    return new Response("Guarantee not found", {
      status: 404,
    });
  }

  let pdfBuffer: Buffer;

  try {
    pdfBuffer = await renderGuaranteePdf(source);
  } catch (pdfError) {
    console.error("Unable to generate guarantee PDF:", pdfError);

    return new Response("Unable to generate the guarantee PDF", {
      status: 500,
    });
  }

  const filename = guaranteePdfFilename(
    source.guarantee.guarantee_number,
    source.guarantee.title
  );

  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
