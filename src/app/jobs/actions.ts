"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { allocateDocumentNumber } from "@/lib/numbering";


function isNotNullColumn(
  error: {
    code?: string;
    message?: string;
  },
  column: string
) {
  return (
    error.code === "23502" &&
    (error.message ?? "").includes(
      column
    )
  );
}

/* =========================================================
   CREATE JOB
   ========================================================= */

export async function addJob(
  formData: FormData
) {
  const supabase =
    await createClient();

  const clientId =
    String(
      formData.get(
        "client_id"
      ) ?? ""
    );

  const title =
    String(
      formData.get(
        "title"
      ) ?? ""
    ).trim();

  if (
    !clientId ||
    !title
  ) {
    redirect(
      "/jobs/new?error=Client%20and%20job%20title%20are%20required"
    );
  }

  const {
    data: client,
    error: clientError,
  } = await supabase
    .from("clients")
    .select(`
      address_line_1,
      address_line_2,
      town,
      county,
      postcode
    `)
    .eq(
      "id",
      clientId
    )
    .single();

  if (
    clientError ||
    !client
  ) {
    redirect(
      "/jobs/new?error=Unable%20to%20find%20client"
    );
  }

  const enteredAddress1 =
    String(
      formData.get(
        "address_line_1"
      ) ?? ""
    ).trim();

  const enteredAddress2 =
    String(
      formData.get(
        "address_line_2"
      ) ?? ""
    ).trim();

  const enteredTown =
    String(
      formData.get(
        "town"
      ) ?? ""
    ).trim();

  const enteredCounty =
    String(
      formData.get(
        "county"
      ) ?? ""
    ).trim();

  const enteredPostcode =
    String(
      formData.get(
        "postcode"
      ) ?? ""
    ).trim();

  const job = {
      job_number:
        await allocateDocumentNumber("job"),
      client_id:
        clientId,

      title,

      address_line_1:
        enteredAddress1 ||
        client.address_line_1 ||
        null,

      address_line_2:
        enteredAddress2 ||
        client.address_line_2 ||
        null,

      town:
        enteredTown ||
        client.town ||
        null,

      county:
        enteredCounty ||
        client.county ||
        null,

      postcode:
        enteredPostcode ||
        client.postcode ||
        null,

      description:
        String(
          formData.get(
            "description"
          ) ?? ""
        ).trim() ||
        null,

      notes:
        String(
          formData.get(
            "notes"
          ) ?? ""
        ).trim() ||
        null,
  };

  let {
    error,
  } = await supabase
    .from("jobs")
    .insert(job);

  if (
    error &&
    isNotNullColumn(
      error,
      "job_type"
    ) &&
    isNotNullColumn(
      error,
      "status"
    )
  ) {
    error = (
      await supabase
        .from("jobs")
        .insert({
          ...job,
          job_type: "Other",
          status: "Enquiry",
        })
    ).error;
  } else if (
    error &&
    isNotNullColumn(
      error,
      "job_type"
    )
  ) {
    const retry =
      await supabase
        .from("jobs")
        .insert({
          ...job,
          job_type: "Other",
        });

    error = retry.error;

    if (
      error &&
      isNotNullColumn(
        error,
        "status"
      )
    ) {
      error = (
        await supabase
          .from("jobs")
          .insert({
            ...job,
            job_type: "Other",
            status: "Enquiry",
          })
      ).error;
    }
  } else if (
    error &&
    isNotNullColumn(
      error,
      "status"
    )
  ) {
    const retry =
      await supabase
        .from("jobs")
        .insert({
          ...job,
          status: "Enquiry",
        });

    error = retry.error;

    if (
      error &&
      isNotNullColumn(
        error,
        "job_type"
      )
    ) {
      error = (
        await supabase
          .from("jobs")
          .insert({
            ...job,
            job_type: "Other",
            status: "Enquiry",
          })
      ).error;
    }
  }

  if (error) {
    console.error(
      error
    );

    redirect(
      "/jobs/new?error=Unable%20to%20save%20job"
    );
  }

  revalidatePath(
    "/"
  );

  revalidatePath(
    "/jobs"
  );

  revalidatePath(
    `/clients/${clientId}`
  );

  redirect(
    "/jobs"
  );
}

/* =========================================================
   UPDATE JOB STATUS
   ========================================================= */

export async function updateJobStatus(
  formData: FormData
) {
  const supabase =
    await createClient();

  const jobId =
    String(
      formData.get(
        "job_id"
      ) ?? ""
    ).trim();

  const newStatus =
    String(
      formData.get(
        "status"
      ) ?? ""
    ).trim();

  if (
    !jobId ||
    !newStatus
  ) {
    redirect(
      "/jobs?error=Job%20and%20status%20are%20required"
    );
  }

  /*
   * Only allow statuses that belong
   * to the DryHome workflow.
   */

  const allowedStatuses =
    [
      "Enquiry",
      "Survey Booked",
      "Quoted",
      "Accepted",
      "Scheduled",
      "In Progress",
      "Completed",
      "Complete",
      "Cancelled",
    ];

  if (
    !allowedStatuses.includes(
      newStatus
    )
  ) {
    redirect(
      `/jobs/${jobId}?error=Invalid%20job%20status`
    );
  }

  /*
   * Load the current job first so
   * we preserve existing dates.
   */

  const {
    data: job,
    error: jobError,
  } = await supabase
    .from("jobs")
    .select(`
      id,
      client_id,
      status,
      start_date,
      completion_date
    `)
    .eq(
      "id",
      jobId
    )
    .single();

  if (
    jobError ||
    !job
  ) {
    console.error(
      jobError
    );

    redirect(
      "/jobs?error=Unable%20to%20find%20job"
    );
  }

  const today =
    getLondonDateKey(
      new Date()
    );

  const updates: {
    status: string;
    start_date?: string;
    completion_date?: string;
  } = {
    status:
      newStatus,
  };

  /*
   * When work actually starts,
   * record the start date if the
   * job doesn't already have one.
   */

  if (
    newStatus ===
      "In Progress" &&
    !job.start_date
  ) {
    updates.start_date =
      today;
  }

  /*
   * When the job is completed,
   * record the completion date if
   * one hasn't already been set.
   */

  if (
    (
      newStatus ===
        "Completed" ||
      newStatus ===
        "Complete"
    ) &&
    !job.completion_date
  ) {
    updates.completion_date =
      today;
  }

  const {
    error: updateError,
  } = await supabase
    .from("jobs")
    .update(
      updates
    )
    .eq(
      "id",
      jobId
    );

  if (
    updateError
  ) {
    console.error(
      updateError
    );

    redirect(
      `/jobs/${jobId}?error=Unable%20to%20update%20job%20status`
    );
  }

  /*
   * Refresh all places where job
   * status affects the UI.
   */

  revalidatePath(
    "/"
  );

  revalidatePath(
    "/jobs"
  );

  revalidatePath(
    `/jobs/${jobId}`
  );

  if (
    job.client_id
  ) {
    revalidatePath(
      `/clients/${job.client_id}`
    );
  }

  redirect(
    `/jobs/${jobId}`
  );
}

/* =========================================================
   LONDON DATE
   ========================================================= */

function getLondonDateKey(
  date: Date
) {
  const parts =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone:
          "Europe/London",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",
      }
    ).formatToParts(
      date
    );

  const year =
    parts.find(
      (part) =>
        part.type ===
        "year"
    )?.value;

  const month =
    parts.find(
      (part) =>
        part.type ===
        "month"
    )?.value;

  const day =
    parts.find(
      (part) =>
        part.type ===
        "day"
    )?.value;

  return `${year}-${month}-${day}`;
}