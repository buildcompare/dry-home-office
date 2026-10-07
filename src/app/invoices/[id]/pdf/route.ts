import { createClient } from "@/lib/supabase/server";
import {
  invoicePdfFilename,
  loadInvoicePdfSource,
  renderInvoicePdf,
} from "@/lib/invoice-pdf";

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

  const source = await loadInvoicePdfSource(supabase, id);

  if (!source) {
    return new Response("Invoice not found", {
      status: 404,
    });
  }

  let pdfBuffer: Buffer;

  try {
    pdfBuffer = await renderInvoicePdf(source);
  } catch (pdfError) {
    console.error("Unable to generate invoice PDF:", pdfError);

    return new Response("Unable to generate the invoice PDF", {
      status: 500,
    });
  }

  const filename = invoicePdfFilename(
    source.invoice.invoice_number,
    source.invoice.title || source.invoice.invoice_type
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
