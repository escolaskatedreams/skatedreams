import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "@/lib/crypto/aes-gcm";

const KEY = Buffer.from("a".repeat(32)).toString("base64");

describe("aes-gcm", () => {
  it("encrypts and decrypts a string", () => {
    const plaintext = "ya29.refresh_token_secret";
    const ciphertext = encrypt(plaintext, KEY);
    expect(ciphertext).not.toBe(plaintext);
    expect(decrypt(ciphertext, KEY)).toBe(plaintext);
  });

  it("produces different ciphertexts for the same plaintext (random IV)", () => {
    const a = encrypt("same", KEY);
    const b = encrypt("same", KEY);
    expect(a).not.toBe(b);
  });

  it("throws on tampered ciphertext", () => {
    const c = encrypt("hello", KEY);
    const tampered = c.slice(0, -2) + "00";
    expect(() => decrypt(tampered, KEY)).toThrow();
  });

  it("throws on wrong key", () => {
    const wrongKey = Buffer.from("b".repeat(32)).toString("base64");
    const c = encrypt("hello", KEY);
    expect(() => decrypt(c, wrongKey)).toThrow();
  });
});
