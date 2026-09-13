"use client";

import { useMemo, useState } from "react";

type QuoteItem = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  item_type: "Labour" | "Materials";
};

function createItem(
  type: "Labour" | "Materials"
): QuoteItem {
  return {
    id: crypto.randomUUID(),
    description: "",
    quantity: 1,
    unit: type === "Labour" ? "item" : "item",
    unit_price: 0,
    item_type: type,
  };
}

export default function QuoteFormItems() {
  const [labourItems, setLabourItems] = useState<
    QuoteItem[]
  >([createItem("Labour")]);

  const [materialItems, setMaterialItems] = useState<
    QuoteItem[]
  >([createItem("Materials")]);

  const [vatEnabled, setVatEnabled] =
    useState(false);

  const allItems = useMemo(
    () => [...labourItems, ...materialItems],
    [labourItems, materialItems]
  );

  const subtotal = useMemo(() => {
    return allItems.reduce((total, item) => {
      return (
        total +
        Number(item.quantity || 0) *
          Number(item.unit_price || 0)
      );
    }, 0);
  }, [allItems]);

  const vatAmount = vatEnabled
    ? subtotal * 0.2
    : 0;

  const total = subtotal + vatAmount;

  function updateItem(
    type: "Labour" | "Materials",
    id: string,
    field:
      | "description"
      | "quantity"
      | "unit"
      | "unit_price",
    value: string
  ) {
    const update = (items: QuoteItem[]) =>
      items.map((item) => {
        if (item.id !== id) {
          return item;
        }

        if (
          field === "quantity" ||
          field === "unit_price"
        ) {
          return {
            ...item,
            [field]: Number(value),
          };
        }

        return {
          ...item,
          [field]: value,
        };
      });

    if (type === "Labour") {
      setLabourItems(update(labourItems));
    } else {
      setMaterialItems(update(materialItems));
    }
  }

  function addItem(
    type: "Labour" | "Materials"
  ) {
    if (type === "Labour") {
      setLabourItems([
        ...labourItems,
        createItem("Labour"),
      ]);
    } else {
      setMaterialItems([
        ...materialItems,
        createItem("Materials"),
      ]);
    }
  }

  function removeItem(
    type: "Labour" | "Materials",
    id: string
  ) {
    if (type === "Labour") {
      setLabourItems(
        labourItems.filter(
          (item) => item.id !== id
        )
      );
    } else {
      setMaterialItems(
        materialItems.filter(
          (item) => item.id !== id
        )
      );
    }
  }

  return (
    <>
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(allItems)}
      />

      <input
        type="hidden"
        name="vat_enabled"
        value={vatEnabled ? "true" : "false"}
      />

      {/* Labour */}
      <section className="rounded-2xl bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Labour
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Add the labour involved in carrying
              out the work.
            </p>
          </div>

          <button
            type="button"
            onClick={() => addItem("Labour")}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            + Add Labour Item
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {labourItems.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">
              No labour items added.
            </div>
          ) : (
            labourItems.map((item, index) => (
              <QuoteItemRow
                key={item.id}
                item={item}
                index={index}
                onChange={updateItem}
                onRemove={removeItem}
              />
            ))
          )}
        </div>
      </section>

      {/* Materials */}
      <section className="mt-8 rounded-2xl bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Materials
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Add materials and products required
              for the work.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              addItem("Materials")
            }
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            + Add Material Item
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {materialItems.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">
              No material items added.
            </div>
          ) : (
            materialItems.map(
              (item, index) => (
                <QuoteItemRow
                  key={item.id}
                  item={item}
                  index={index}
                  onChange={updateItem}
                  onRemove={removeItem}
                />
              )
            )
          )}
        </div>
      </section>

      {/* Totals */}
      <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
        <div className="ml-auto max-w-md">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <span className="text-sm font-medium text-slate-600">
              Subtotal
            </span>

            <span className="text-lg font-semibold text-slate-900">
              {formatCurrency(subtotal)}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-slate-200 py-5">
            <div>
              <p className="font-semibold text-slate-900">
                Add 20% VAT
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Turn this on when VAT should be
                added to the quotation.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setVatEnabled(!vatEnabled)
              }
              className={`relative h-7 w-12 rounded-full transition ${
                vatEnabled
                  ? "bg-slate-900"
                  : "bg-slate-300"
              }`}
              aria-pressed={vatEnabled}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                  vatEnabled
                    ? "left-6"
                    : "left-1"
                }`}
              />
            </button>
          </div>

          {vatEnabled && (
            <div className="flex items-center justify-between border-b border-slate-200 py-4">
              <span className="text-sm font-medium text-slate-600">
                VAT (20%)
              </span>

              <span className="font-semibold text-slate-900">
                {formatCurrency(vatAmount)}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between pt-5">
            <span className="text-lg font-bold text-slate-900">
              Total
            </span>

            <span className="text-2xl font-bold text-slate-900">
              {formatCurrency(total)}
            </span>
          </div>
        </div>
      </section>
    </>
  );
}

function QuoteItemRow({
  item,
  index,
  onChange,
  onRemove,
}: {
  item: QuoteItem;
  index: number;
  onChange: (
    type: "Labour" | "Materials",
    id: string,
    field:
      | "description"
      | "quantity"
      | "unit"
      | "unit_price",
    value: string
  ) => void;
  onRemove: (
    type: "Labour" | "Materials",
    id: string
  ) => void;
}) {
  const lineTotal =
    Number(item.quantity || 0) *
    Number(item.unit_price || 0);

  return (
    <div className="p-6">
      <div className="grid gap-4 xl:grid-cols-[1fr_110px_120px_150px_120px_50px] xl:items-end">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Item
          </label>

          <input
            type="text"
            value={item.description}
            onChange={(event) =>
              onChange(
                item.item_type,
                item.id,
                "description",
                event.target.value
              )
            }
            placeholder={
              item.item_type === "Labour"
                ? `Labour item ${index + 1}`
                : `Material item ${index + 1}`
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Qty
          </label>

          <input
            type="number"
            min="0"
            step="0.01"
            value={item.quantity}
            onChange={(event) =>
              onChange(
                item.item_type,
                item.id,
                "quantity",
                event.target.value
              )
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Unit
          </label>

          <input
            type="text"
            value={item.unit}
            onChange={(event) =>
              onChange(
                item.item_type,
                item.id,
                "unit",
                event.target.value
              )
            }
            placeholder="item"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
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
              value={item.unit_price}
              onChange={(event) =>
                onChange(
                  item.item_type,
                  item.id,
                  "unit_price",
                  event.target.value
                )
              }
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-7 pr-3 text-slate-900 outline-none focus:border-slate-500"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Total
          </label>

          <div className="py-2.5 font-semibold text-slate-900">
            {formatCurrency(lineTotal)}
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            onRemove(
              item.item_type,
              item.id
            )
          }
          className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-lg text-slate-500 hover:bg-red-50 hover:text-red-600"
          title="Remove item"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}