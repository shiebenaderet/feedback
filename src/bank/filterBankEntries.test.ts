// src/bank/filterBankEntries.test.ts
import { describe, it, expect } from "vitest";
import { filterBankEntries } from "./filterBankEntries";

// BankEntry shape (from src/bank/types.ts):
// { id: string; templateText: string;
//   slots: { key: string; kind: "auto"|"fill"; hint: string }[];
//   tags: { type: string; area: string; objective: string; tone: string } }
const entries = [
  {
    id: "a",
    templateText: "Hi {name}, your writing improved a lot.",
    slots: [{ key: "name", kind: "auto" as const, hint: "" }],
    tags: { type: "success", area: "writing", objective: "clarity", tone: "warm" },
  },
  {
    id: "b",
    templateText: "Let's work on turning in homework on time.",
    slots: [],
    tags: { type: "growth", area: "responsibility", objective: "deadlines", tone: "firm" },
  },
  {
    id: "c",
    templateText: "Your lab WRITING was excellent this semester.",
    slots: [],
    tags: { type: "success", area: "science", objective: "lab-work", tone: "warm" },
  },
];

describe("filterBankEntries", () => {
  it("returns all entries when no filters are set", () => {
    const result = filterBankEntries(entries, { tags: {}, search: "" });
    expect(result.map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  it("filters by a single tag (exact match)", () => {
    const result = filterBankEntries(entries, {
      tags: { type: "success" },
      search: "",
    });
    expect(result.map((e) => e.id)).toEqual(["a", "c"]);
  });

  it("ANDs multiple tag filters together", () => {
    const result = filterBankEntries(entries, {
      tags: { type: "success", tone: "warm", area: "science" },
      search: "",
    });
    expect(result.map((e) => e.id)).toEqual(["c"]);
  });

  it("ignores blank tag filter values", () => {
    const result = filterBankEntries(entries, {
      tags: { type: "success", area: "" },
      search: "",
    });
    expect(result.map((e) => e.id)).toEqual(["a", "c"]);
  });

  it("searches templateText case-insensitively", () => {
    const result = filterBankEntries(entries, { tags: {}, search: "writing" });
    expect(result.map((e) => e.id)).toEqual(["a", "c"]);
  });

  it("trims the search term and ignores surrounding whitespace", () => {
    const result = filterBankEntries(entries, { tags: {}, search: "  homework  " });
    expect(result.map((e) => e.id)).toEqual(["b"]);
  });

  it("combines tag filter AND search", () => {
    const result = filterBankEntries(entries, {
      tags: { type: "success" },
      search: "lab",
    });
    expect(result.map((e) => e.id)).toEqual(["c"]);
  });

  it("returns an empty array when nothing matches", () => {
    const result = filterBankEntries(entries, {
      tags: { type: "success" },
      search: "nonexistent-term",
    });
    expect(result).toEqual([]);
  });
});
