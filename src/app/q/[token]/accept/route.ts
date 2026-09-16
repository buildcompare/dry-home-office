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
   * Do not allow a previously declined
   * quote to be changed accidentally.
   */
  if (
    quote.status === "Declined"
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
        status: "Accepted",
        accepted_at: now,
        declined_at: null,
        viewed_at:
          quote.viewed_at || now,
      })
      .eq("id", quote.id);

  if (updateError) {
    console.error(
      "Unable to accept quote:",
      updateError
    );

    return new Response(
      "Unable to accept quotation",
      {
        status: 500,
      }
    );
  }

  return relativeRedirect(
    `/q/${token}?accepted=1`
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