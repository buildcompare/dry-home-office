"use client";

import {
  useMemo,
  useState,
} from "react";

export type InvoiceDefaultItem = {
  description: string;
  quantity?: number;
  unit?: string;
  unit_price: number;
  item_type?:
    | "Labour"
    | "Materials";
};

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
  maxAmount?: number;
  defaultItems?: InvoiceDefaultItem[];
};

function money(
  value: number
) {
  return (
    Math.round(
      (
        value +
        Number.EPSILON
      ) *
        100
    ) / 100
  );
}

function formatMoney(
  value: number
) {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style:
        "currency",
      currency:
        "GBP",
    }
  ).format(
    value
  );
}

function makeItem(
  type:
    | "Labour"
    | "Materials",
  description = "",
  amount = 0
): InvoiceItem {
  return {
    description,
    quantity: 1,
    unit: "item",
    unit_price:
      money(amount),
    item_type:
      type,
  };
}

function normaliseDefaultItem(
  item: InvoiceDefaultItem
): InvoiceItem {
  return {
    description:
      String(
        item.description ??
          ""
      ),

    quantity:
      Number.isFinite(
        Number(
          item.quantity
        )
      )
        ? Number(
            item.quantity
          )
        : 1,

    unit:
      String(
        item.unit ??
          ""
      ).trim() ||
      "item",

    unit_price:
      money(
        Number(
          item.unit_price ??
            0
        )
      ),

    item_type:
      item.item_type ===
      "Materials"
        ? "Materials"
        : "Labour",
  };
}

export default function InvoiceForm({
  defaultAmount = 0,
  defaultDescription = "",
  maxAmount,
  defaultItems = [],
}: InvoiceFormProps) {
  const preparedDefaults =
    defaultItems
      .map(
        normaliseDefaultItem
      )
      .filter(
        (
          item
        ) =>
          item.description
            .trim() !==
            "" ||
          item.unit_price !==
            0
      );

  const initialLabourItems =
    preparedDefaults.filter(
      (
        item
      ) =>
        item.item_type ===
        "Labour"
    );

  const initialMaterialItems =
    preparedDefaults.filter(
      (
        item
      ) =>
        item.item_type ===
        "Materials"
    );

  const [
    labourItems,
    setLabourItems,
  ] =
    useState<
      InvoiceItem[]
    >(
      initialLabourItems.length >
        0
        ? initialLabourItems
        : [
            makeItem(
              "Labour",
              defaultDescription,
              preparedDefaults.length ===
                0
                ? defaultAmount
                : 0
            ),
          ]
    );

  const [
    materialItems,
    setMaterialItems,
  ] =
    useState<
      InvoiceItem[]
    >(
      initialMaterialItems.length >
        0
        ? initialMaterialItems
        : [
            makeItem(
              "Materials"
            ),
          ]
    );

  const [
    vatEnabled,
    setVatEnabled,
  ] =
    useState(
      false
    );

  const [
    vatRate,
    setVatRate,
  ] =
    useState(
      20
    );

  function updateLabourItem(
    index: number,
    field:
      keyof InvoiceItem,
    value:
      | string
      | number
  ) {
    setLabourItems(
      (
        current
      ) =>
        current.map(
          (
            item,
            itemIndex
          ) =>
            itemIndex ===
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

  function updateMaterialItem(
    index: number,
    field:
      keyof InvoiceItem,
    value:
      | string
      | number
  ) {
    setMaterialItems(
      (
        current
      ) =>
        current.map(
          (
            item,
            itemIndex
          ) =>
            itemIndex ===
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

  function addLabourItem() {
    setLabourItems(
      (
        current
      ) => [
        ...current,
        makeItem(
          "Labour"
        ),
      ]
    );
  }

  function addMaterialItem() {
    setMaterialItems(
      (
        current
      ) => [
        ...current,
        makeItem(
          "Materials"
        ),
      ]
    );
  }

  function removeLabourItem(
    index: number
  ) {
    setLabourItems(
      (
        current
      ) =>
        current.length ===
        1
          ? [
              makeItem(
                "Labour"
              ),
            ]
          : current.filter(
              (
                _,
                itemIndex
              ) =>
                itemIndex !==
                index
            )
    );
  }

  function removeMaterialItem(
    index: number
  ) {
    setMaterialItems(
      (
        current
      ) =>
        current.length ===
        1
          ? [
              makeItem(
                "Materials"
              ),
            ]
          : current.filter(
              (
                _,
                itemIndex
              ) =>
                itemIndex !==
                index
            )
    );
  }

  const allItems =
    useMemo(
      () => {
        return [
          ...labourItems,
          ...materialItems,
        ].filter(
          (
            item
          ) => {
            return (
              item.description
                .trim() !==
                "" ||
              Number(
                item.unit_price
              ) !== 0
            );
          }
        );
      },
      [
        labourItems,
        materialItems,
      ]
    );

  const subtotal =
    useMemo(
      () => {
        return money(
          allItems.reduce(
            (
              sum,
              item
            ) => {
              const quantity =
                Number(
                  item.quantity
                ) ||
                0;

              const unitPrice =
                Number(
                  item.unit_price
                ) ||
                0;

              return (
                sum +
                quantity *
                  unitPrice
              );
            },
            0
          )
        );
      },
      [
        allItems,
      ]
    );

  const vatAmount =
    useMemo(
      () => {
        if (
          !vatEnabled
        ) {
          return 0;
        }

        return money(
          subtotal *
            (
              vatRate /
              100
            )
        );
      },
      [
        subtotal,
        vatEnabled,
        vatRate,
      ]
    );

  const total =
    money(
      subtotal +
        vatAmount
    );

  const hasMaximum =
    typeof maxAmount ===
      "number" &&
    Number.isFinite(
      maxAmount
    );

  const overMaximum =
    hasMaximum &&
    Math.round(
      total *
        100
    ) >
      Math.round(
        Number(
          maxAmount
        ) *
          100
      );

  return (
    <div className="space-y-6">
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(
          allItems
        )}
      />

      <input
        type="hidden"
        name="vat_enabled"
        value={
          vatEnabled
            ? "true"
            : "false"
        }
      />

      <input
        type="hidden"
        name="vat_rate"
        value={
          vatRate
        }
      />

      {hasMaximum && (
        <input
          type="number"
          value={total.toFixed(
            2
          )}
          max={Number(
            maxAmount
          ).toFixed(
            2
          )}
          readOnly
          tabIndex={
            -1
          }
          aria-hidden="true"
          className="absolute h-px w-px opacity-0"
        />
      )}

      {hasMaximum && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-blue-900">
                Maximum available to invoice
              </p>

              <p className="mt-1 text-xs text-blue-700">
                You can invoice all or part of the remaining approved job value.
              </p>
            </div>

            <p className="text-xl font-semibold text-blue-950">
              {formatMoney(
                Number(
                  maxAmount
                )
              )}
            </p>
          </div>
        </div>
      )}

      {preparedDefaults.length >
        1 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            Approved works have been added as invoice lines
          </p>

          <p className="mt-1 text-xs leading-5 text-amber-800">
            The original quotation and any accepted variations have been
            brought into the invoice below. You can change the amounts,
            remove lines or invoice only part of the remaining balance.
          </p>
        </div>
      )}

      {/* =====================================================
          LABOUR
          ===================================================== */}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Labour / Works
            </h2>

            <p className="text-sm text-slate-500">
              Approved works and additional labour can be shown as separate
              invoice lines.
            </p>
          </div>

          <button
            type="button"
            onClick={
              addLabourItem
            }
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            + Add Labour
          </button>
        </div>

        <div className="space-y-4">
          {labourItems.map(
            (
              item,
              index
            ) => (
              <div
                key={
                  index
                }
                className="grid gap-3 rounded-lg border border-slate-200 p-4 md:grid-cols-[minmax(0,1fr)_100px_120px_140px_auto]"
              >
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
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
                      updateLabourItem(
                        index,
                        "description",
                        event.target
                          .value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Labour description"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
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
                      updateLabourItem(
                        index,
                        "quantity",
                        event.target
                          .value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
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
                      updateLabourItem(
                        index,
                        "unit",
                        event.target
                          .value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="item"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Unit Price
                  </label>

                  <div className="relative">
                    <span className="absolute left-3 top-2 text-sm text-slate-500">
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
                        updateLabourItem(
                          index,
                          "unit_price",
                          event.target
                            .value
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 py-2 pl-7 pr-3 text-sm"
                    />
                  </div>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() =>
                      removeLabourItem(
                        index
                      )
                    }
                    className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      </section>

      {/* =====================================================
          MATERIALS
          ===================================================== */}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Materials
            </h2>

            <p className="text-sm text-slate-500">
              Add any materials being charged on this invoice.
            </p>
          </div>

          <button
            type="button"
            onClick={
              addMaterialItem
            }
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            + Add Material
          </button>
        </div>

        <div className="space-y-4">
          {materialItems.map(
            (
              item,
              index
            ) => (
              <div
                key={
                  index
                }
                className="grid gap-3 rounded-lg border border-slate-200 p-4 md:grid-cols-[minmax(0,1fr)_100px_120px_140px_auto]"
              >
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
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
                      updateMaterialItem(
                        index,
                        "description",
                        event.target
                          .value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Material description"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
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
                      updateMaterialItem(
                        index,
                        "quantity",
                        event.target
                          .value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
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
                      updateMaterialItem(
                        index,
                        "unit",
                        event.target
                          .value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="item"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Unit Price
                  </label>

                  <div className="relative">
                    <span className="absolute left-3 top-2 text-sm text-slate-500">
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
                        updateMaterialItem(
                          index,
                          "unit_price",
                          event.target
                            .value
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 py-2 pl-7 pr-3 text-sm"
                    />
                  </div>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() =>
                      removeMaterialItem(
                        index
                      )
                    }
                    className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      </section>

      {/* =====================================================
          TOTAL
          ===================================================== */}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={
                  vatEnabled
                }
                onChange={(
                  event
                ) =>
                  setVatEnabled(
                    event.target
                      .checked
                  )
                }
                className="h-4 w-4 rounded border-slate-300"
              />

              <span className="text-sm font-medium text-slate-700">
                Add VAT
              </span>
            </label>

            {vatEnabled && (
              <div className="mt-3 flex items-center gap-2">
                <label className="text-sm text-slate-600">
                  VAT Rate
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    vatRate
                  }
                  onChange={(
                    event
                  ) =>
                    setVatRate(
                      Number(
                        event.target
                          .value
                      ) ||
                        0
                    )
                  }
                  className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />

                <span className="text-sm text-slate-600">
                  %
                </span>
              </div>
            )}
          </div>

          <div className="w-full max-w-sm space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>
                Subtotal
              </span>

              <span>
                {formatMoney(
                  subtotal
                )}
              </span>
            </div>

            {vatEnabled && (
              <div className="flex justify-between text-slate-600">
                <span>
                  VAT (
                  {
                    vatRate
                  }
                  %)
                </span>

                <span>
                  {formatMoney(
                    vatAmount
                  )}
                </span>
              </div>
            )}

            <div className="border-t border-slate-200 pt-2">
              <div className="flex justify-between text-lg font-semibold text-slate-900">
                <span>
                  Invoice Total
                </span>

                <span>
                  {formatMoney(
                    total
                  )}
                </span>
              </div>
            </div>

            {hasMaximum && (
              <div className="flex justify-between text-sm text-slate-600">
                <span>
                  Remaining approved value
                </span>

                <span>
                  {formatMoney(
                    Number(
                      maxAmount
                    )
                  )}
                </span>
              </div>
            )}
          </div>
        </div>

        {overMaximum && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="font-medium text-red-800">
              Invoice amount is too high
            </p>

            <p className="mt-1 text-sm text-red-700">
              The invoice total cannot exceed{" "}
              {formatMoney(
                Number(
                  maxAmount
                )
              )}
              , which is the remaining approved value for this job.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}