export const CLIENT_CSV_COLUMNS = [
  "display_name",
  "friendly_name",
  "company_name",
  "email",
  "secondary_email",
  "phone",
  "address_line_1",
  "address_line_2",
  "town",
  "county",
  "postcode",
  "notes",
] as const;

export type ClientCsvColumn = (typeof CLIENT_CSV_COLUMNS)[number];

/*
 * Columns that may be missing from older export files.
 * They are read as empty when absent.
 */
export const OPTIONAL_CLIENT_CSV_COLUMNS: readonly ClientCsvColumn[] = [
  "secondary_email",
];

export type ClientCsvRow = Record<ClientCsvColumn, string | null>;

function csvEscape(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

export function clientsToCsv(
  clients: Partial<Record<ClientCsvColumn, string | null>>[]
) {
  const lines = [CLIENT_CSV_COLUMNS.join(",")];

  for (const client of clients) {
    lines.push(
      CLIENT_CSV_COLUMNS.map((column) =>
        csvEscape(client[column] ?? "")
      ).join(",")
    );
  }

  return `${lines.join("\r\n")}\r\n`;
}

export function parseCsv(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") {
        i++;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) =>
    cells.some((cell) => cell.trim() !== "")
  );
}

export function rowsFromCsv(text: string): ClientCsvRow[] {
  const table = parseCsv(text);

  if (table.length === 0) {
    return [];
  }

  const headers = table[0].map((header) =>
    header.trim().toLowerCase()
  );
  const missing = CLIENT_CSV_COLUMNS.filter(
    (column) =>
      !OPTIONAL_CLIENT_CSV_COLUMNS.includes(column) &&
      !headers.includes(column)
  );

  if (missing.length > 0) {
    throw new Error(
      `CSV is missing columns: ${missing.join(", ")}`
    );
  }

  const index = new Map(
    headers.map((header, position) => [header, position])
  );

  return table.slice(1).map((cells) => {
    const row = {} as ClientCsvRow;

    for (const column of CLIENT_CSV_COLUMNS) {
      const value = (cells[index.get(column) ?? -1] ?? "").trim();
      row[column] = value === "" ? null : value;
    }

    return row;
  });
}
