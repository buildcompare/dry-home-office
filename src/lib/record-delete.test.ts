/* Order / safety tests for record-delete with an in-memory fake Supabase. */
import assert from "node:assert/strict";
import {
  DeleteError,
  collectDeleteGraph,
  deleteGraph,
  deleteContractRecord,
  deleteInvoiceRecord,
  graphPaidTotal,
  graphSummary,
  graphTotal,
} from "./record-delete";
import { confirmSatisfied } from "./delete-preview";

type Row = Record<string, unknown>;
type Db = Record<string, Row[]>;

function fake(db: Db, opts: { rlsBlockDelete?: string[] } = {}) {
  const log: string[] = [];

  function builder(table: string) {
    let mode: "select" | "delete" | "update" = "select";
    let patch: Row = {};
    const filters: ((row: Row) => boolean)[] = [];
    let single = false;

    const run = () => {
      const rows = db[table] ?? [];
      const matched = rows.filter((row) => filters.every((f) => f(row)));

      if (mode === "delete") {
        if (opts.rlsBlockDelete?.includes(table)) return { data: [], error: null };
        db[table] = rows.filter((row) => !matched.includes(row));
        log.push(`delete ${table} ${matched.length}`);
        return { data: matched.map((r) => ({ id: r.id })), error: null };
      }

      if (mode === "update") {
        for (const row of matched) Object.assign(row, patch);
        log.push(`update ${table} ${Object.keys(patch).join(",")} ${matched.length}`);
        return { data: matched.map((r) => ({ id: r.id })), error: null };
      }

      return { data: single ? matched[0] ?? null : matched, error: null };
    };

    const api = {
      select: () => api,
      delete: () => ((mode = "delete"), api),
      update: (value: Row) => ((mode = "update"), (patch = value), api),
      in: (column: string, values: string[]) => (filters.push((row) => values.includes(String(row[column]))), api),
      eq: (column: string, value: string) => (filters.push((row) => String(row[column]) === value), api),
      limit: () => api,
      maybeSingle: () => ((single = true), api),
      then: (resolve: (value: unknown) => void) => resolve(run()),
    };

    return api;
  }

  return {
    log,
    client: {
      from: (table: string) => builder(table),
      storage: { from: () => ({ remove: async (paths: string[]) => (log.push(`storage remove ${paths.length}`), { data: [], error: null }) }) },
    } as never,
  };
}

function sampleDb(): Db {
  return {
    clients: [{ id: "c1", display_name: "James Test" }],
    jobs: [{ id: "j1", job_number: "JOB-1005", title: "Damp survey", client_id: "c1" }],
    quotes: [{ id: "q1", quote_number: "Q-1001", job_id: "j1", client_id: "c1" }],
    quote_items: [{ id: "qi1", quote_id: "q1" }, { id: "qi2", quote_id: "q1" }],
    contracts: [{ id: "k1", contract_number: "C-1001", quote_id: "q1", job_id: "j1", client_id: "c1" }],
    variations: [{ id: "v1", variation_number: "V-1001", quote_id: "q1", job_id: "j1" }],
    variation_items: [{ id: "vi1", variation_id: "v1" }],
    invoices: [{ id: "i1", invoice_number: "INV-1018", job_id: "j1", contract_id: "k1", client_id: "c1", amount_paid: 150 }],
    invoice_items: [{ id: "ii1", invoice_id: "i1" }],
    invoice_payments: [{ id: "p1", invoice_id: "i1", amount: 150 }],
    guarantees: [{ id: "g1", guarantee_number: "G-1001", invoice_id: "i1", contract_id: "k1", job_id: "j1" }],
    schedule_events: [{ id: "e1", title: "Survey", start_date: "2026-10-09", job_id: "j1", google_event_id: null, google_calendar_id: null }],
    survey_reports: [{ id: "r1", job_id: "j1", title: "Report", file_path: "j1/r1.pdf" }],
    other_client_job: [],
  };
}

async function main() {
  // Whole job graph, deleted children first.
  {
    const db = sampleDb();
    const { client, log } = fake(db);
    const graph = await collectDeleteGraph(client, { jobIds: ["j1"] });
    assert.equal(graphTotal(graph), 9);
    assert.equal(graphPaidTotal(graph), 150);
    assert.ok(graphSummary(graph).some((g) => g.label.startsWith("1 invoice") && g.items[0].includes("£150.00 paid")));

    await deleteGraph(client, graph);
    const deletes = log.filter((l) => l.startsWith("delete")).map((l) => l.split(" ")[1]);
    assert.deepEqual(deletes, [
      "schedule_events", "survey_reports", "invoice_payments", "guarantees", "invoice_items", "invoices",
      "variation_items", "variations", "contracts", "quote_items", "quotes", "jobs",
    ]);
    assert.ok(log.includes("storage remove 1"));
    assert.equal(db.clients.length, 1, "deleting a job keeps the client");
    for (const t of ["jobs", "quotes", "quote_items", "invoices", "invoice_payments", "guarantees", "schedule_events"]) assert.equal(db[t].length, 0, t);
  }

  // Client and everything, client last.
  {
    const db = sampleDb();
    const { client, log } = fake(db);
    const graph = await collectDeleteGraph(client, { clientId: "c1" });
    assert.equal(graph.client?.label, "James Test");
    await deleteGraph(client, graph);
    assert.equal(log.filter((l) => l.startsWith("delete")).at(-1), "delete clients 1");
    assert.equal(db.clients.length, 0);
  }

  // RLS silently skipping a delete is reported with the table name; nothing after it runs.
  {
    const db = sampleDb();
    const { client } = fake(db, { rlsBlockDelete: ["invoices"] });
    const graph = await collectDeleteGraph(client, { jobIds: ["j1"] });
    await assert.rejects(deleteGraph(client, graph), (error: unknown) => {
      assert.ok(error instanceof DeleteError);
      assert.match(error.message, /"invoices" table/);
      assert.match(error.message, /delete_policies\.sql/);
      assert.match(error.message, /Already deleted: 1 Schedule appointment, 1 survey report, 1 payment record, 1 guarantee, 1 invoice item\./);
      return true;
    });
    assert.equal(db.jobs.length, 1, "job not deleted after the failure");
    assert.equal(db.quotes.length, 1);
  }

  // Single invoice: payments + items deleted, guarantee kept with link cleared.
  {
    const db = sampleDb();
    const { client, log } = fake(db);
    const done = await deleteInvoiceRecord(client, "i1", "INV-1018");
    assert.equal(db.invoices.length, 0);
    assert.equal(db.invoice_payments.length, 0);
    assert.equal(db.guarantees.length, 1);
    assert.equal(db.guarantees[0].invoice_id, null);
    assert.equal(log[0], "delete invoice_payments 1");
    assert.ok(done.includes("INV-1018"));
  }

  // Contract: links cleared from invoices, guarantees and appointments, those are kept.
  {
    const db = sampleDb();
    db.schedule_events[0].contract_id = "k1";
    const { client } = fake(db);
    await deleteContractRecord(client, "k1", "C-1001");
    assert.equal(db.contracts.length, 0);
    assert.equal(db.invoices[0].contract_id, null);
    assert.equal(db.guarantees[0].contract_id, null);
    assert.equal(db.schedule_events[0].contract_id, null);
  }

  // Confirm rules.
  assert.equal(confirmSatisfied({ mode: "none" }, { ticked: false, typed: "" }), true);
  assert.equal(confirmSatisfied({ mode: "tick", label: "" }, { ticked: false, typed: "" }), false);
  assert.equal(confirmSatisfied({ mode: "type", text: "James  Test", label: "" }, { ticked: true, typed: " james test " }), true);
  assert.equal(confirmSatisfied({ mode: "type", text: "INV-1018", label: "" }, { ticked: true, typed: "INV-101" }), false);
  assert.equal(confirmSatisfied({ mode: "type", text: "INV-1018", label: "" }, { ticked: true, typed: "" }), false);

  console.log("record delete: all tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
