// src/bank/BankList.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BankList } from "./BankList";

// BankEntry = { id; templateText; slots; tags: { type; area; objective; tone } }
const entries = [
  {
    id: "a",
    templateText: "Hi {name}, your writing improved.",
    slots: [{ key: "name", kind: "auto" as const, hint: "" }],
    tags: { type: "success", area: "writing", objective: "", tone: "warm" },
  },
  {
    id: "b",
    templateText: "Let's work on homework deadlines.",
    slots: [],
    tags: { type: "growth", area: "responsibility", objective: "", tone: "firm" },
  },
  {
    id: "c",
    templateText: "Strong lab writing this term.",
    slots: [],
    tags: { type: "success", area: "science", objective: "", tone: "warm" },
  },
];

describe("BankList", () => {
  it("renders all entries initially", () => {
    render(<BankList entries={entries} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("filters by search text over template text", () => {
    render(<BankList entries={entries} />);
    fireEvent.change(screen.getByLabelText(/search/i), {
      target: { value: "homework" },
    });
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent(/homework deadlines/i);
  });

  it("filters by the type tag", () => {
    render(<BankList entries={entries} />);
    fireEvent.change(screen.getByLabelText(/filter by type/i), {
      target: { value: "success" },
    });
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("combines a type tag filter with a search term", () => {
    render(<BankList entries={entries} />);
    fireEvent.change(screen.getByLabelText(/filter by type/i), {
      target: { value: "success" },
    });
    fireEvent.change(screen.getByLabelText(/search/i), {
      target: { value: "lab" },
    });
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent(/strong lab writing/i);
  });

  it("shows an empty message when nothing matches", () => {
    render(<BankList entries={entries} />);
    fireEvent.change(screen.getByLabelText(/search/i), {
      target: { value: "no-such-thing" },
    });
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.getByText(/no entries match/i)).toBeInTheDocument();
  });
});
