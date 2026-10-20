import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { openSecret, sealSecret, mailKeyConfigured } from "./crypto";

process.env.MAIL_CREDENTIALS_KEY = randomBytes(32).toString("base64");
assert.ok(mailKeyConfigured());
const sealed = sealSecret("p@ss wörd", "user-1:a@b.co.uk");
assert.notEqual(sealed.ciphertext, "p@ss wörd");
assert.equal(openSecret(sealed, "user-1:a@b.co.uk"), "p@ss wörd");
assert.throws(() => openSecret(sealed, "user-2:a@b.co.uk"));
const tampered = { ...sealed, ciphertext: Buffer.from("x" + sealed.ciphertext).toString("base64") };
assert.throws(() => openSecret(tampered, "user-1:a@b.co.uk"));
process.env.MAIL_CREDENTIALS_KEY = "short";
assert.equal(mailKeyConfigured(), false);
console.log("mail crypto tests passed");
