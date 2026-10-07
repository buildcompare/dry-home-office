"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { isValidEmailAddress } from "@/lib/email-recipients";
import { isMissingSecondaryEmailColumn } from "@/lib/client-secondary-email";
import { insertClientRow } from "@/lib/client-create";

/* =========================================================
   SECONDARY EMAIL
   ========================================================= */

function readSecondaryEmail(
  formData: FormData
) {
  return (
    String(
      formData.get(
        "secondary_email"
      ) || ""
    )
      .trim()
      .toLowerCase() ||
    null
  );
}

/* =========================================================
   ADD CLIENT
   ========================================================= */

export async function addClient(
  formData: FormData
) {
  const supabase =
    await createClient();

  const displayName =
    String(
      formData.get(
        "display_name"
      ) || ""
    ).trim();

  const friendlyName =
    String(
      formData.get(
        "friendly_name"
      ) || ""
    ).trim() || null;

  const companyName =
    String(
      formData.get(
        "company_name"
      ) || ""
    ).trim() || null;

  const email =
    String(
      formData.get(
        "email"
      ) || ""
    )
      .trim()
      .toLowerCase() ||
    null;

  const phone =
    String(
      formData.get(
        "phone"
      ) || ""
    ).trim() || null;

  const addressLine1 =
    String(
      formData.get(
        "address_line_1"
      ) || ""
    ).trim() || null;

  const addressLine2 =
    String(
      formData.get(
        "address_line_2"
      ) || ""
    ).trim() || null;

  const town =
    String(
      formData.get(
        "town"
      ) || ""
    ).trim() || null;

  const county =
    String(
      formData.get(
        "county"
      ) || ""
    ).trim() || null;

  const postcode =
    String(
      formData.get(
        "postcode"
      ) || ""
    )
      .trim()
      .toUpperCase() ||
    null;

  const notes =
    String(
      formData.get(
        "notes"
      ) || ""
    ).trim() || null;

  const hasSecondaryEmailField =
    formData.has(
      "secondary_email"
    );

  const secondaryEmail =
    readSecondaryEmail(
      formData
    );

  if (!displayName) {
    redirect(
      "/clients/new?error=Please%20enter%20a%20client%20name"
    );
  }

  if (
    secondaryEmail &&
    !isValidEmailAddress(
      secondaryEmail
    )
  ) {
    redirect(
      "/clients/new?error=Please%20enter%20a%20valid%20secondary%20email%20address"
    );
  }

  const baseRow = {
    display_name:
      displayName,

    friendly_name:
      friendlyName,

    company_name:
      companyName,

    email,

    phone,

    address_line_1:
      addressLine1,

    address_line_2:
      addressLine2,

    town,

    county,

    postcode,

    notes,
  };

  const {
    clientId: newClientId,
    error,
    secondaryEmailNotSaved,
  } = await insertClientRow(
    supabase,
    baseRow,
    hasSecondaryEmailField
      ? secondaryEmail
      : null
  );

  const client =
    newClientId
      ? {
          id: newClientId,
        }
      : null;

  if (
    error ||
    !client
  ) {
    console.error(
      "Client creation error:",
      error
    );

    redirect(
      "/clients/new?error=Unable%20to%20create%20client"
    );
  }

  revalidateClientPages(
    client.id
  );

  redirect(
    secondaryEmailNotSaved
      ? `/clients/${client.id}?secondary_email_not_saved=1`
      : `/clients/${client.id}`
  );
}

/* =========================================================
   UPDATE CLIENT
   ========================================================= */

export async function updateClient(
  formData: FormData
) {
  const supabase =
    await createClient();

  const clientId =
    String(
      formData.get(
        "client_id"
      ) || ""
    ).trim();

  const displayName =
    String(
      formData.get(
        "display_name"
      ) || ""
    ).trim();

  const friendlyName =
    String(
      formData.get(
        "friendly_name"
      ) || ""
    ).trim() || null;

  const companyName =
    String(
      formData.get(
        "company_name"
      ) || ""
    ).trim() || null;

  const email =
    String(
      formData.get(
        "email"
      ) || ""
    )
      .trim()
      .toLowerCase() ||
    null;

  const phone =
    String(
      formData.get(
        "phone"
      ) || ""
    ).trim() || null;

  const addressLine1 =
    String(
      formData.get(
        "address_line_1"
      ) || ""
    ).trim() || null;

  const addressLine2 =
    String(
      formData.get(
        "address_line_2"
      ) || ""
    ).trim() || null;

  const town =
    String(
      formData.get(
        "town"
      ) || ""
    ).trim() || null;

  const county =
    String(
      formData.get(
        "county"
      ) || ""
    ).trim() || null;

  const postcode =
    String(
      formData.get(
        "postcode"
      ) || ""
    )
      .trim()
      .toUpperCase() ||
    null;

  const notes =
    String(
      formData.get(
        "notes"
      ) || ""
    ).trim() || null;

  const hasSecondaryEmailField =
    formData.has(
      "secondary_email"
    );

  const secondaryEmail =
    readSecondaryEmail(
      formData
    );

  if (!clientId) {
    redirect(
      "/clients?error=Client%20ID%20is%20missing"
    );
  }

  if (!displayName) {
    redirect(
      `/clients/${clientId}/edit?error=Please%20enter%20a%20client%20name`
    );
  }

  if (
    secondaryEmail &&
    !isValidEmailAddress(
      secondaryEmail
    )
  ) {
    redirect(
      `/clients/${clientId}/edit?error=Please%20enter%20a%20valid%20secondary%20email%20address`
    );
  }

  const baseUpdate = {
    display_name:
      displayName,

    friendly_name:
      friendlyName,

    company_name:
      companyName,

    email,

    phone,

    address_line_1:
      addressLine1,

    address_line_2:
      addressLine2,

    town,

    county,

    postcode,

    notes,
  };

  let secondaryEmailNotSaved =
    false;

  /*
   * Only touch secondary_email when the form actually sent the
   * field, so other callers can never blank it by accident.
   */

  let {
    error,
  } = await supabase
    .from("clients")
    .update({
      ...baseUpdate,

      ...(hasSecondaryEmailField
        ? {
            secondary_email:
              secondaryEmail,
          }
        : {}),
    })
    .eq(
      "id",
      clientId
    );

  if (
    hasSecondaryEmailField &&
    isMissingSecondaryEmailColumn(
      error
    )
  ) {
    console.error(
      "clients.secondary_email column is missing; updating client without it."
    );

    secondaryEmailNotSaved =
      Boolean(
        secondaryEmail
      );

    ({
      error,
    } = await supabase
      .from("clients")
      .update(baseUpdate)
      .eq(
        "id",
        clientId
      ));
  }

  if (error) {
    console.error(
      "Client update error:",
      error
    );

    redirect(
      `/clients/${clientId}/edit?error=Unable%20to%20update%20client`
    );
  }

  revalidateClientPages(
    clientId
  );

  redirect(
    secondaryEmailNotSaved
      ? `/clients/${clientId}?updated=1&secondary_email_not_saved=1`
      : `/clients/${clientId}?updated=1`
  );
}

/* =========================================================
   DELETE CLIENT
   ========================================================= */

export async function deleteClient(
  formData: FormData
) {
  const supabase =
    await createClient();

  const clientId =
    String(
      formData.get(
        "client_id"
      ) || ""
    ).trim();

  const confirmation =
    String(
      formData.get(
        "confirm_delete"
      ) || ""
    );

  if (!clientId) {
    redirect(
      "/clients?error=Client%20ID%20is%20missing"
    );
  }

  if (
    confirmation !==
    "yes"
  ) {
    redirect(
      `/clients/${clientId}/edit?error=Please%20confirm%20that%20you%20want%20to%20delete%20this%20client`
    );
  }

  /*
   * Check for business records before attempting
   * permanent deletion.
   */

  const [
    jobsResult,
    quotesResult,
    invoicesResult,
    contractsResult,
    guaranteesResult,
  ] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        "id",
        {
          count:
            "exact",

          head:
            true,
        }
      )
      .eq(
        "client_id",
        clientId
      ),

    supabase
      .from("quotes")
      .select(
        "id",
        {
          count:
            "exact",

          head:
            true,
        }
      )
      .eq(
        "client_id",
        clientId
      ),

    supabase
      .from("invoices")
      .select(
        "id",
        {
          count:
            "exact",

          head:
            true,
        }
      )
      .eq(
        "client_id",
        clientId
      ),

    supabase
      .from("contracts")
      .select(
        "id",
        {
          count:
            "exact",

          head:
            true,
        }
      )
      .eq(
        "client_id",
        clientId
      ),

    supabase
      .from("guarantees")
      .select(
        "id",
        {
          count:
            "exact",

          head:
            true,
        }
      )
      .eq(
        "client_id",
        clientId
      ),
  ]);

  const linkedRecords =
    (jobsResult.count ??
      0) +
    (quotesResult.count ??
      0) +
    (invoicesResult.count ??
      0) +
    (contractsResult.count ??
      0) +
    (guaranteesResult.count ??
      0);

  if (
    linkedRecords >
    0
  ) {
    redirect(
      `/clients/${clientId}/edit?error=This%20client%20cannot%20be%20deleted%20because%20they%20have%20linked%20jobs%20or%20business%20records`
    );
  }

  const {
    error,
  } = await supabase
    .from("clients")
    .delete()
    .eq(
      "id",
      clientId
    );

  if (error) {
    console.error(
      "Client deletion error:",
      error
    );

    redirect(
      `/clients/${clientId}/edit?error=Unable%20to%20delete%20client`
    );
  }

  revalidatePath("/");
  revalidatePath(
    "/clients"
  );

  redirect(
    "/clients?deleted=1"
  );
}

/* =========================================================
   REVALIDATION
   ========================================================= */

function revalidateClientPages(
  clientId: string
) {
  revalidatePath("/");
  revalidatePath(
    "/clients"
  );

  revalidatePath(
    `/clients/${clientId}`
  );

  revalidatePath(
    `/clients/${clientId}/edit`
  );

  revalidatePath(
    "/jobs"
  );

  revalidatePath(
    "/quotes"
  );

  revalidatePath(
    "/invoices"
  );

  revalidatePath(
    "/contracts"
  );

  revalidatePath(
    "/guarantees"
  );
}