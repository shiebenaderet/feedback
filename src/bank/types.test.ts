// src/bank/types.test.ts
import { describe, it, expect } from "vitest";
import { EMPTY_TAGS, makeBankEntryInput } from "./types";

describe("makeBankEntryInput", () => {
  it("derives slots from the template text", () => {
    const input = makeBankEntryInput({
      templateText: "Hi {name}, you grew in {area}.",
      tags: EMPTY_TAGS,
    });
    expect(input.slots).toEqual([
      { key: "name", kind: "auto", hint: "" },
      { key: "area", kind: "fill", hint: "" },
    ]);
  });

  it("keeps the provided template text and tags", () => {
    const tags = { type: "success", area: "writing", objective: "", tone: "warm" };
    const input = makeBankEntryInput({
      templateText: "Nice work {name}.",
      tags,
    });
    expect(input.templateText).toBe("Nice work {name}.");
    expect(input.tags).toEqual(tags);
  });

  it("EMPTY_TAGS has all four tag keys blank", () => {
    expect(EMPTY_TAGS).toEqual({ type: "", area: "", objective: "", tone: "" });
  });

  it("produces an empty slots array when there are no placeholders", () => {
    const input = makeBankEntryInput({
      templateText: "Great term overall.",
      tags: EMPTY_TAGS,
    });
    expect(input.slots).toEqual([]);
  });
});
