"use client";

import {
  useMemo,
  useState,
} from "react";

type InvoiceItem = {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  item_type:
    | "Labour"
    | "Materials";
};

type InvoiceFormProps = {
  defaultAmount?: number;
  defaultDescription?: string;
};

export default function InvoiceForm({
  defaultAmount = 0,
  defaultDescription = "",
}: InvoiceFormProps) {
  const [
    labourItems,
    setLabourItems,
  ] =
    useState<InvoiceItem[]>([
      {
        description:
          defaultDescription ||
          "Labour and works as agreed",
        quantity: 1,
        unit: "item",
        unit_price:
          defaultAmount > 0
            ? defaultAmount
            : 0,
        item_type:
          "Labour",
      },
    ]);

  const [
    materialItems,
    setMaterialItems,
  ] =
    useState<InvoiceItem[]>(
      []
    );

  const [
    vatEnabled,
    setVatEnabled,
  ] =
    useState(false);

  const vatRate = 20;

  const allItems = [
    ...labourItems,
    ...materialItems,
  ];

  const subtotal =
    useMemo(() => {
      return allItems.reduce(
        (
          total,
          item
        ) =>
          total +
          Number(
            item.quantity ||
              0
          ) *
            Number(
              item.unit_price ||
                0
            ),
        0
      );
    }, [
      labourItems,
      materialItems,
    ]);

  const vatAmount =
    vatEnabled
      ? subtotal *
        (vatRate / 100)
      : 0;

  const total =
    subtotal +
    vatAmount;

  function setInvoiceAmount(
    value: string
  ) {
    const amount =
      Number(value);

    setLabourItems(
      (current) => {
        if (
          current.length === 0
        ) {
          return [
            {
              description:
                defaultDescription ||
                "Labour and works as agreed",
              quantity: 1,
              unit: "item",
              unit_price:
                Number.isFinite(
                  amount
                )
                  ? amount
                  : 0,
              item_type:
                "Labour",
            },
          ];
        }

        return current.map(
          (
            item,
            index
          ) =>
            index === 0
              ? {
                  ...item,
                  quantity:
                    1,
                  unit_price:
                    Number.isFinite(
                      amount
                    )
                      ? amount
                      : 0,
                }
              : item
        );
      }
    );
  }

  function updateItem(
    type:
      | "Labour"
      | "Materials",
    index: number,
    field:
      | "description"
      | "quantity"
      | "unit"
      | "unit_price",
    value: string
  ) {
    const setter =
      type === "Labour"
        ? setLabourItems
        : setMaterialItems;

    setter(
      (current) =>
        current.map(
          (
            item,
            i
          ) =>
            i ===
            index
              ? {
                  ...item,
                  [field]:
                    field ===
                      "quantity" ||
                    field ===
                      "unit_price"
                      ? Number(
                          value
                        )
                      : value,
                }
              : item
        )
    );
  }

  function addItem(
    type:
      | "Labour"
      | "Materials"
  ) {
    const item: InvoiceItem =
      {
        description: "",
        quantity: 1,
        unit: "item",
        unit_price: 0,
        item_type:
          type,
      };

    if (
      type === "Labour"
    ) {
      setLabourItems(
        (current) => [
          ...current,
          item,
        ]
      );
    } else {
      setMaterialItems(
        (current) => [
          ...current,
          item,
        ]
      );
    }
  }

  function removeItem(
    type:
      | "Labour"
      | "Materials",
    index: number
  ) {
    if (
      type === "Labour"
    ) {
      setLabourItems(
        (current) =>
          current.filter(
            (
              _,
              i
            ) =>
              i !==
              index
          )
      );
    } else {
      setMaterialItems(
        (current) =>
          current.filter(
            (
              _,
              i
            ) =>
              i !==
              index
          )
      );
    }
  }

  return (
    <>
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(
          allItems
        )}
      />

      <input
        type="hidden"
        name="vat_rate"
        value={
          vatRate
        }
      />

      <section className="mt-8 rounded-2xl border border-blue-200 bg-blue-50 p-6">
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            Invoice Amount
          </p>

          <h2 className="mt-2 text-xl font-bold text-blue-950">
            Amount for this invoice
          </h2>

          <p className="mt-2 text-sm leading-6 text-blue-800">
            For a deposit or
            interim invoice,
            enter only the
            amount you want to
            invoice now. For a
            final invoice, enter
            the final amount due.
          </p>

          <div className="mt-5">
            <label
              htmlFor="invoice_amount"
              className="mb-2 block text-sm font-semibold text-blue-950"
            >
              Invoice amount
            </label>

            <div className="relative">
              <span className="absolute left-3 top-3 text-slate-500">
                £
              </span>

              <input
                id="invoice_amount"
                type="number"
                min="0"
                step="0.01"
                value={
                  labourItems[0]
                    ?.unit_price ??
                  0
                }
                onChange={(
                  event
                ) =>
                  setInvoiceAmount(
                    event
                      .target
                      .value
                  )
                }
                className="w-full rounded-lg border border-blue-300 bg-white py-3 pl-8 pr-4 text-lg font-semibold text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            {defaultAmount >
              0 && (
              <p className="mt-2 text-sm text-blue-700">
                Full source
                value:{" "}
                <span className="font-semibold">
                  {formatCurrency(
                    defaultAmount
                  )}
                </span>
              </p>
            )}
          </div>
        </div>
      </section>

      <InvoiceSection
        title="Labour"
        items={
          labourItems
        }
        type="Labour"
        onAdd={() =>
          addItem(
            "Labour"
          )
        }
        onRemove={(
          index
        ) =>
          removeItem(
            "Labour",
            index
          )
        }
        onChange={
          updateItem
        }
      />

      <InvoiceSection
        title="Materials"
        items={
          materialItems
        }
        type="Materials"
        onAdd={() =>
          addItem(
            "Materials"
          )
        }
        onRemove={(
          index
        ) =>
          removeItem(
            "Materials",
            index
          )
        }
        onChange={
          updateItem
        }
      />

      <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              VAT
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Add 20% VAT to
              this invoice.
            </p>
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              name="vat_enabled"
              checked={
                vatEnabled
              }
              onChange={(
                event
              ) =>
                setVatEnabled(
                  event
                    .target
                    .checked
                )
              }
              className="h-5 w-5"
            />

            <span className="text-sm font-semibold text-slate-700">
              Add VAT
            </span>
          </label>
        </div>

        <div className="ml-auto mt-8 max-w-md">
          <TotalRow
            label="Subtotal"
            value={formatCurrency(
              subtotal
            )}
          />

          {vatEnabled && (
            <TotalRow
              label="VAT (20%)"
              value={formatCurrency(
                vatAmount
              )}
            />
          )}

          <div className="mt-4 flex items-center justify-between border-t-2 border-slate-900 pt-5">
            <span className="text-xl font-bold text-slate-900">
              Total
            </span>

            <span className="text-2xl font-bold text-slate-900">
              {formatCurrency(
                total
              )}
            </span>
          </div>
        </div>
      </section>
    </>
  );
}

function InvoiceSection({
  title,
  items,
  type,
  onAdd,
  onRemove,
  onChange,
}: {
  title: string;
  items: InvoiceItem[];
  type:
    | "Labour"
    | "Materials";
  onAdd: () => void;
  onRemove: (
    index: number
  ) => void;
  onChange: (
    type:
      | "Labour"
      | "Materials",
    index: number,
    field:
      | "description"
      | "quantity"
      | "unit"
      | "unit_price",
    value: string
  ) => void;
}) {
  return (
    <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            {title}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Add the{" "}
            {title.toLowerCase()}{" "}
            included on this
            invoice.
          </p>
        </div>

        <button
          type="button"
          onClick={
            onAdd
          }
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          + Add Item
        </button>
      </div>

      {items.length ===
      0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          No{" "}
          {title.toLowerCase()}{" "}
          items added.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {items.map(
            (
              item,
              index
            ) => (
              <div
                key={
                  index
                }
                className="grid gap-4 rounded-xl border border-slate-200 p-4 lg:grid-cols-[2fr_120px_120px_150px_auto]"
              >
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Description
                  </label>

                  <input
                    type="text"
                    value={
                      item.description
                    }
                    onChange={(
                      event
                    ) =>
                      onChange(
                        type,
                        index,
                        "description",
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="Description"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Qty
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      item.quantity
                    }
                    onChange={(
                      event
                    ) =>
                      onChange(
                        type,
                        index,
                        "quantity",
                        event
                          .target
                          .value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Unit
                  </label>

                  <input
                    type="text"
                    value={
                      item.unit
                    }
                    onChange={(
                      event
                    ) =>
                      onChange(
                        type,
                        index,
                        "unit",
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="item"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Unit Price
                  </label>

                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-500">
                      £
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        item.unit_price
                      }
                      onChange={(
                        event
                      ) =>
                        onChange(
                          type,
                          index,
                          "unit_price",
                          event
                            .target
                            .value
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 py-2.5 pl-7 pr-3 text-slate-900 outline-none focus:border-slate-500"
                    />
                  </div>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() =>
                      onRemove(
                        index
                      )
                    }
                    className="w-full rounded-lg border border-red-200 px-3 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </section>
  );
}

function TotalRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 py-4">
      <span className="font-medium text-slate-600">
        {label}
      </span>

      <span className="font-semibold text-slate-900">
        {value}
      </span>
    </div>
  );
}

function formatCurrency(
  value: number
) {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",
    }
  ).format(value);
}