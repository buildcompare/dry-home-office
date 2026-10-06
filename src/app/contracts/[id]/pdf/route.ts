import { createClient } from "@/lib/supabase/server";
import {
  CONTRACT_PDF_SELECT,
  contractPdfFilename,
  renderContractPdf,
} from "@/lib/contract-pdf";

export const runtime = "nodejs";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  request: Request,
  { params }: RouteProps
) {
  const { id } = await params;

  const supabase = await createClient();

  const { data: contract, error } = await supabase
    .from("contracts")
    .select(CONTRACT_PDF_SELECT)
    .eq("id", id)
    .single();

  if (error || !contract) {
    return new Response("Contract not found", {
      status: 404,
    });
  }

  const client = Array.isArray(contract.clients)
    ? contract.clients[0] || null
    : contract.clients;

  const job = Array.isArray(contract.jobs)
    ? contract.jobs[0] || null
    : contract.jobs;

  const quote = Array.isArray(contract.quotes)
    ? contract.quotes[0] || null
    : contract.quotes;

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    new URL(request.url).origin
  ).replace(/\/$/, "");

  const customerUrl = contract.public_token
    ? `${appUrl}/c/${contract.public_token}`
    : appUrl;

  let pdfBuffer: Buffer;

  try {
    pdfBuffer = await renderContractPdf({
      contract,
      client,
      job,
      quote,
      customerUrl,
    });
  } catch (pdfError) {
    console.error("Unable to generate contract PDF:", pdfError);

    return new Response("Unable to generate the contract PDF", {
      status: 500,
    });
  }

  const filename = contractPdfFilename(
    contract.contract_number,
    contract.title
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
