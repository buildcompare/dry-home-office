import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type RouteProps = {
  params: Promise<{
    token: string;
  }>;
};

export async function POST(
  _request: Request,
  { params }: RouteProps
) {
  const { token } = await params;

  const supabase =
    createAdminClient();

  const { data: quote, error } =
    await supabase
      .from("quotes")
      .select(`
        id,
        status,
        viewed_at
      `)
      .eq("public_token", token)
      .single();

  if (error || !quote) {
    return new Response(
      "Quotation not found",
      {
        status: 404,
      }
    );
  }

  /*
   * Do not allow an accepted quote
   * to be declined accidentally.
   */
  if (
    quote.status === "Accepted"
  ) {
    return relativeRedirect(
      `/q/${token}`
    );
  }

  const now =
    new Date().toISOString();

  const { error: updateError } =
    await supabase
      .from("quotes")
      .update({
        status: "Declined",
        declined_at: now,
        accepted_at: null,
        viewed_at:
          quote.viewed_at || now,
      })
      .eq("id", quote.id);

  if (updateError) {
    console.error(
      "Unable to decline quote:",
      updateError
    );

    return new Response(
      "Unable to decline quotation",
      {
        status: 500,
      }
    );
  }

  return relativeRedirect(
    `/q/${token}?declined=1`
  );
}

function relativeRedirect(
  location: string
) {
  return new Response(null, {
    status: 303,

    headers: {
      Location: location,
    },
  });
}