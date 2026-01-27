import { describe, expect, it } from "vitest";
import { copy, languages } from "@/lib/i18n";

describe("i18n copy", () => {
  it("has both TR and EN entries", () => {
    const codes = languages.map((lang) => lang.code);
    expect(codes).toContain("tr");
    expect(codes).toContain("en");
  });

  it("has required navigation keys", () => {
    expect(copy.tr.nav.services).toBeTruthy();
    expect(copy.en.nav.services).toBeTruthy();
  });

  it("has error messages", () => {
    expect(copy.tr.errors.notFound.title).toBeTruthy();
    expect(copy.en.errors.service.title).toBeTruthy();
  });
});
