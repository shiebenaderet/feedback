// src/bank/BankEntryForm.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BankEntryForm } from "./BankEntryForm";

// BankEntryInput = {
//   templateText: string;
//   slots: { key: string; kind: "auto"|"fill"; hint: string }[];
//   tags: { type; area; objective; tone };
// }

describe("BankEntryForm", () => {
  it("shows derived slots live as the template text changes", () => {
    render(<BankEntryForm onSave={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/template text/i), {
      target: { value: "Hi {name}, you grew in {area}." },
    });
    // auto slot labeled auto, fill slot labeled fill
    expect(screen.getByTestId("slot-name")).toHaveTextContent(/name/);
    expect(screen.getByTestId("slot-name")).toHaveTextContent(/auto/i);
    expect(screen.getByTestId("slot-area")).toHaveTextContent(/fill/i);
  });

  it("calls onSave with the template text, derived slots, and tags", () => {
    const onSave = vi.fn();
    render(<BankEntryForm onSave={onSave} />);

    fireEvent.change(screen.getByLabelText(/template text/i), {
      target: { value: "Hi {name}, your {area} improved." },
    });
    fireEvent.change(screen.getByLabelText(/^type$/i), {
      target: { value: "success" },
    });
    fireEvent.change(screen.getByLabelText(/^tone$/i), {
      target: { value: "warm" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({
      templateText: "Hi {name}, your {area} improved.",
      slots: [
        { key: "name", kind: "auto", hint: "" },
        { key: "area", kind: "fill", hint: "" },
      ],
      tags: { type: "success", area: "", objective: "", tone: "warm" },
    });
  });

  it("prefills fields when editing an existing entry", () => {
    render(
      <BankEntryForm
        initial={{
          templateText: "Nice work {name}.",
          slots: [{ key: "name", kind: "auto", hint: "" }],
          tags: { type: "success", area: "writing", objective: "", tone: "warm" },
        }}
        onSave={vi.fn()}
      />
    );
    expect(screen.getByLabelText(/template text/i)).toHaveValue("Nice work {name}.");
    expect(screen.getByLabelText(/^area$/i)).toHaveValue("writing");
  });
});
