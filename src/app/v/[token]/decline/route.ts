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
      "Accepted" ||
    variation.status ===
      "Cancelled"
  ) {
    return relativeRedirect(
      `/v/${token}`
    );
  }

  if (
    variation.status ===
    "Declined"
  ) {
    return relativeRedirect(
      `/v/${token}?declined=1`
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
        "Declined",

      declined_at:
        now,

      accepted_at:
        null,

      viewed_at:
        variation.viewed_at ||
        now,

      acceptance_method:
        null,

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
      "Unable to decline variation:",
      updateError
    );

    return new Response(
      "Unable to decline variation",
      {
        status: 500,
      }
    );
  }

  return relativeRedirect(
    `/v/${token}?declined=1`
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