/* Quote form parsing / totals tests. Run: npx tsx src/lib/quote-form.test.ts */
import assert from "node:assert/strict";
import { calculateQuoteTotals, quoteEditRules, readQuoteFields, readQuoteItems } from "./quote-form";

const fd = new FormData();
fd.set("client_id", " c1 ");
fd.set("job_id", "");
fd.set("title", " Tanking ");
fd.set("terms", "   ");
fd.set("vat_enabled", "true");
fd.set(
  "items",
  JSON.stringify([
    { id: "existing-1", description: " Tank walls ", quantity: "2", unit: "", unit_price: "150.5", item_type: "Labour" },
    { id: "new-1", description: "", quantity: 1, unit_price: 10, item_type: "Labour" },
    { id: "new-2", description: "Slurry", quantity: -1, unit_price: -5, item_type: "Materials" },
  ])
);

const fields = readQuoteFields(fd);
assert.equal(fields.clientId, "c1");
assert.equal(fields.jobId, null);
assert.equal(fields.title, "Tanking");
assert.equal(fields.terms, null, "blank additional terms stay blank");
assert.equal(fields.vatEnabled, true);

const items = readQuoteItems(fd)!;
assert.equal(items.length, 2);
assert.deepEqual(items[0], {
  id: "existing-1", description: "Tank walls", quantity: 2, unit: "item", unit_price: 150.5, item_type: "Labour", sort_order: 0,
});
assert.equal(items[1].quantity, 1);
assert.equal(items[1].unit_price, 0);
assert.equal(items[1].sort_order, 2);

const bad = new FormData();
bad.set("items", "{not json");
assert.equal(readQuoteItems(bad), null);

assert.deepEqual(calculateQuoteTotals(items, true), { subtotal: 301, vatRate: 20, vatAmount: 60.2, total: 361.2 });
assert.deepEqual(calculateQuoteTotals(items, false), { subtotal: 301, vatRate: 20, vatAmount: 0, total: 301 });

assert.equal(quoteEditRules("Accepted").needsAcceptedAck, true);
assert.equal(quoteEditRules("Sent").clientHasOlderVersion, true);
assert.equal(quoteEditRules("Viewed").clientHasOlderVersion, true);
assert.equal(quoteEditRules("Draft").clientHasOlderVersion, false);
assert.equal(quoteEditRules("Declined").needsAcceptedAck, false);

console.log("quote-form tests passed");
