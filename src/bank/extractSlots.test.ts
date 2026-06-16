// src/bank/extractSlots.test.ts
import { describe, it, expect } from "vitest";
import { extractSlots } from "./extractSlots";

describe("extractSlots", () => {
  it("returns no slots for template text without placeholders", () => {
    expect(extractSlots("Great work this term.")).toEqual([]);
  });

  it("classifies name and semester as auto slots", () => {
    expect(extractSlots("Hi {name}, this {semester} was strong.")).toEqual([
      { key: "name", kind: "auto", hint: "" },
      { key: "semester", kind: "auto", hint: "" },
    ]);
  });

  it("classifies any other slot as fill", () => {
    expect(extractSlots("You improved at {skill}.")).toEqual([
      { key: "skill", kind: "fill", hint: "" },
    ]);
  });

  it("is case-insensitive for auto keys and normalizes the key to lowercase", () => {
    expect(extractSlots("Hi {Name}, the {SEMESTER}.")).toEqual([
      { key: "name", kind: "auto", hint: "" },
      { key: "semester", kind: "auto", hint: "" },
    ]);
  });

  it("trims whitespace inside braces", () => {
    expect(extractSlots("Hi { name }.")).toEqual([
      { key: "name", kind: "auto", hint: "" },
    ]);
  });

  it("dedupes a repeated slot, keeping first occurrence order", () => {
    expect(extractSlots("{name} did well. Keep it up, {name}!")).toEqual([
      { key: "name", kind: "auto", hint: "" },
    ]);
  });

  it("mixes auto and fill slots in source order", () => {
    expect(
      extractSlots("Hi {name}, you grew in {area} this {semester}.")
    ).toEqual([
      { key: "name", kind: "auto", hint: "" },
      { key: "area", kind: "fill", hint: "" },
      { key: "semester", kind: "auto", hint: "" },
    ]);
  });

  it("ignores empty braces", () => {
    expect(extractSlots("This {} is not a slot, but {x} is.")).toEqual([
      { key: "x", kind: "fill", hint: "" },
    ]);
  });
});
