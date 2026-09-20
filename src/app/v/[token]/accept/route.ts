import { createAdminClient } from "@/lib/supabase/admin";

export const runtime =
  "nodejs";

type RouteProps = {
  params: Promise<{
    token: string;
  }>;
};

export async function POST(
  _request: Request,
  {
    params,
  }: RouteProps
) {
  const {
    token,
  } = await params;

  const supabase =
    createAdminClient();

  const {
    data: variation,
    error,
  } = await supabase
    .from(
      "variations"
    )
    .select(`
      id,
      status,
      viewed_at
    `)
    .eq(
      "public_token",
      token
    )
    .single();

  if (
    error ||
    !variation
  ) {
    return new Response(
      "Variation not found",
      {
        status: 404,
      }
    );
  }

  /* =========================================================
     DO NOT REVERSE A FINAL DECISION
     ========================================================= */

  if (
    variation.status ===
      "Declined" ||
    variation.status ===
      "Cancelled"
  ) {
    return relativeRedirect(
      `/v/${token}`
    );
  }

  if (
    variation.status ===
    "Accepted"
  ) {
    return relativeRedirect(
      `/v/${token}?accepted=1`
    );
  }

  const now =
    new Date()
      .toISOString();

  const {
    error:
      updateError,
  } = await supabase
    .from(
      "variations"
    )
    .update({
      status:
        "Accepted",

      accepted_at:
        now,

      declined_at:
        null,

      viewed_at:
        variation.viewed_at ||
        now,

      acceptance_method:
        "Customer",

      accepted_by:
        null,

      updated_at:
        now,
    })
    .eq(
      "id",
      variation.id
    );

  if (
    updateError
  ) {
    console.error(
      "Unable to accept variation:",
      updateError
    );

    return new Response(
      "Unable to accept variation",
      {
        status: 500,
      }
    );
  }

  /*
   * Deliberately do NOT alter the job status here.
   *
   * A variation may be accepted while the job is already
   * Scheduled or In Progress, so moving the job back to
   * Accepted would be incorrect.
   */

  return relativeRedirect(
    `/v/${token}?accepted=1`
  );
}

function relativeRedirect(
  location: string
) {
  return new Response(
    null,
    {
      status: 303,

      headers: {
        Location:
          location,
      },
    }
  );
}