import assert from "node:assert/strict";
import { parseAddressList, replySubject, safeFolder, safeUid, withoutAddress } from "./addresses";

const r = parseAddressList('"Smith, J" <j@x.co.uk>; bob@y.com,\nAnn <ann@z.org>');
assert.ok(r.ok);
if (r.ok) assert.deepEqual(r.list.map((a) => a.address), ["j@x.co.uk", "bob@y.com", "ann@z.org"]);
if (r.ok) assert.equal(r.list[0].name, "Smith, J");
assert.equal(parseAddressList("not-an-email").ok, false);
assert.equal(parseAddressList("").ok && true, true);
assert.equal(replySubject("Re: Quote", "Re"), "Re: Quote");
assert.equal(replySubject("Quote", "Fwd"), "Fwd: Quote");
assert.deepEqual(withoutAddress(["Me <me@d.co.uk>", "a@b.com", "A@b.com"], "ME@d.co.uk"), ["a@b.com"]);
assert.equal(safeFolder("INBOX\r\nX"), "INBOX");
assert.equal(safeUid("12"), 12);
assert.equal(safeUid("-1"), null);
console.log("mail address tests passed");
