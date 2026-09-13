"use client";

import { useMemo, useState } from "react";

type QuoteItem = {
  id: number;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
};

export default function QuoteFormItems() {
  const [items, setItems] = useState<QuoteItem[]>([
    {
      id: 1,
      description: "",
      quantity: "1",
      unit: "",
      unit_price: "",
    },
  ]);

  const total = useMemo(() => {
    return items.reduce((sum, item) => {
      const quantity = Number(item.quantity) || 0;
      const price = Number(item.unit_price) || 0;

      return sum + quantity * price;
    }, 0);
  }, [items]);

  function updateItem(
    id: number,
    field: keyof Omit<QuoteItem, "id">,
    value: string
  ) {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  }

  function addItem() {
    setItems((current) => [
      ...current,
      {
        id: Date.now(),
        description: "",
        quantity: "1",
        unit: "",
        unit_price: "",
      },
    ]);
  }

  function removeItem(id: number) {
    setItems((current) => {
      if (current.length === 1) {
        return current;
      }

      return current.filter(
        (item) => item.id !== id
      );
    });
  }

  const serialisedItems = JSON.stringify(
    items.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity) || 0,
      unit: item.unit,
      unit_price: Number(item.unit_price) || 0,
    }))
  );

  return (
    <div>
      <input
        type="hidden"
        name="items"
        value={serialisedItems}
      />

      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Quote Items
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Add the work and materials included in this quote.
          </p>
        </div>

        <button
          type="button"
          onClick={addItem}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          + Add Item
        </button>
      </div>

      <div className="space-y-4">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="rounded-xl border border-slate-200 p-4"
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">
                Item {index + 1}
              </p>

              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="text-sm font-medium text-red-600 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-12">
              <div className="md:col-span-6">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Description
                </label>

                <input
                  type="text"
                  value={item.description}
                  onChange={(event) =>
                    updateItem(
                      item.id,
                      "description",
                      event.target.value
                    )
                  }
                  placeholder="e.g. Remove defective plaster"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Qty
                </label>

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={item.quantity}
                  onChange={(event) =>
                    updateItem(
                      item.id,
                      "quantity",
                      event.target.value
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Unit
                </label>

                <input
                  type="text"
                  value={item.unit}
                  onChange={(event) =>
                    updateItem(
                      item.id,
                      "unit",
                      event.target.value
                    )
                  }
                  placeholder="m²"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Unit Price
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unit_price}
                  onChange={(event) =>
                    updateItem(
                      item.id,
                      "unit_price",
                      event.target.value
                    )
                  }
                  placeholder="0.00"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
                />
              </div>
            </div>

            <div className="mt-3 text-right text-sm font-medium text-slate-600">
              Line total:{" "}
              {formatCurrency(
                (Number(item.quantity) || 0) *
                  (Number(item.unit_price) || 0)
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <div className="w-full max-w-sm rounded-xl bg-slate-50 p-5">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-600">
              Quote Total
            </span>

            <span className="text-2xl font-bold text-slate-900">
              {formatCurrency(total)}
            </span>
          </div>
        </div>
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