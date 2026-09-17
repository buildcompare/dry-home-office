import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{
      token: string;
    }>;
  }
) {
  const { token } =
    await context.params;

  const formData =
    await request.formData();

  const signedName =
    String(
      formData.get(
        "signed_name"
      ) || ""
    ).trim();

  const agreement =
    String(
      formData.get(
        "agreement"
      ) || ""
    ).trim();

  if (
    !signedName ||
    agreement !== "yes"
  ) {
    return redirectToContract(
      token,
      "error",
      "Please enter your full name and confirm your agreement."
    );
  }

  const supabase =
    createAdminClient();

  const {
    data: contract,
    error,
  } = await supabase
    .from("contracts")
    .select(`
      id,
      status,
      signed_at,
      signed_name,
      clients (
        email
      )
    `)
    .eq(
      "public_token",
      token
    )
    .single();

  if (error || !contract) {
    return new Response(
      "Contract not found",
      {
        status: 404,
      }
    );
  }

  if (
    contract.status ===
    "Signed"
  ) {
    return redirectToContract(
      token,
      "signed",
      "1"
    );
  }

  const client =
    Array.isArray(
      contract.clients
    )
      ? contract.clients[0]
      : contract.clients;

  const forwardedFor =
    request.headers.get(
      "x-forwarded-for"
    );

  const ipAddress =
    forwardedFor
      ?.split(",")[0]
      ?.trim() ||
    request.headers.get(
      "x-real-ip"
    ) ||
    null;

  const now =
    new Date().toISOString();

  const {
    error: updateError,
  } = await supabase
    .from("contracts")
    .update({
      status: "Signed",
      signed_at: now,
      signed_name: signedName,
      signed_email:
        client?.email || null,
      signed_ip:
        ipAddress,
      viewed_at: now,
    })
    .eq(
      "id",
      contract.id
    );

  if (updateError) {
    console.error(
      "Contract signing error:",
      updateError
    );

    return redirectToContract(
      token,
      "error",
      "Your agreement could not be recorded. Please try again."
    );
  }

  return redirectToContract(
    token,
    "signed",
    "1"
  );
}

function redirectToContract(
  token: string,
  key: string,
  value: string
) {
  const params =
    new URLSearchParams();

  params.set(key, value);

  return new Response(null, {
    status: 303,
    headers: {
      Location: `/c/${token}?${params.toString()}`,
    },
  });
}