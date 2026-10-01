"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function revalidate() {
  revalidatePath("/");
  revalidatePath("/todos");
}

export async function addTodo(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const supabase = await createClient();
  const { error } = await supabase.from("office_todos").insert({ title });

  if (error) {
    throw new Error(error.message);
  }

  revalidate();
}

export async function toggleTodo(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const done = String(formData.get("done") ?? "") === "true";
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("office_todos")
    .update({
      done: !done,
      completed_at: !done ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidate();
}

export async function deleteTodo(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.from("office_todos").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidate();
}
