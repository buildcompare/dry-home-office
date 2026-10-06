import { QUOTE_STANDARD_TERMS } from "@/lib/quote-standard-terms";

/* The shared standard terms (clauses 1–17) for customer-facing pages. */
export default function StandardTermsText() {
  const lines = QUOTE_STANDARD_TERMS.split("\n");

  return (
    <div className="mt-4 text-sm leading-6 text-slate-700">
      {lines.map((line, index) => {
        if (line === "") {
          return <div key={index} className="h-3" />;
        }

        const isHeading =
          /^\d+\.\s/.test(line) && !/^\d+\.\d+/.test(line);

        return (
          <p
            key={index}
            className={
              isHeading
                ? "pt-2 font-semibold text-slate-900"
                : ""
            }
          >
            {line}
          </p>
        );
      })}
    </div>
  );
}
