"use client";

import { HONEYPOT_FIELD } from "@/lib/site";

/** Hidden field for public auth POSTs. Bots that fill it are rejected server-side. */
export function HoneypotField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      className="absolute -left-[10000px] h-px w-px overflow-hidden"
      aria-hidden="true"
    >
      <label>
        Company website
        <input
          type="text"
          name={HONEYPOT_FIELD}
          tabIndex={-1}
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    </div>
  );
}
