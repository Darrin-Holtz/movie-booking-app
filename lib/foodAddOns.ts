export const FOOD_ADD_ONS = [
  {
    id: "popcorn",
    name: "Large Popcorn",
    description: "Fresh-popped buttery popcorn.",
    price: 7.5,
  },
  {
    id: "soda",
    name: "Fountain Soda",
    description: "Ice-cold soft drink.",
    price: 4.5,
  },
  {
    id: "combo",
    name: "Popcorn Combo",
    description: "Large popcorn and soda for one price.",
    price: 10.5,
  },
] as const;

export type FoodAddOnId = (typeof FOOD_ADD_ONS)[number]["id"];

export type FoodAddOnSelection = {
  id: FoodAddOnId;
  quantity: number;
};

export type FoodAddOnPurchase = {
  id: FoodAddOnId;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

const MAX_ADD_ON_QUANTITY = 10;

const FOOD_ADD_ON_LOOKUP = Object.fromEntries(
  FOOD_ADD_ONS.map((item) => [item.id, item])
) as Record<FoodAddOnId, (typeof FOOD_ADD_ONS)[number]>;

export const normalizeFoodAddOnSelections = (
  selections: FoodAddOnSelection[] | undefined
): FoodAddOnPurchase[] => {
  if (!selections?.length) {
    return [];
  }

  const mergedQuantities = new Map<FoodAddOnId, number>();

  for (const selection of selections) {
    const definition = FOOD_ADD_ON_LOOKUP[selection.id];

    if (!definition) {
      continue;
    }

    const safeQuantity = Number.isFinite(selection.quantity)
      ? Math.max(0, Math.min(MAX_ADD_ON_QUANTITY, Math.floor(selection.quantity)))
      : 0;

    if (safeQuantity === 0) {
      continue;
    }

    mergedQuantities.set(
      selection.id,
      Math.min(
        MAX_ADD_ON_QUANTITY,
        (mergedQuantities.get(selection.id) ?? 0) + safeQuantity
      )
    );
  }

  return Array.from(mergedQuantities.entries()).map(([id, quantity]) => {
    const definition = FOOD_ADD_ON_LOOKUP[id];

    return {
      id,
      name: definition.name,
      description: definition.description,
      quantity,
      unitPrice: definition.price,
      totalPrice: Number((definition.price * quantity).toFixed(2)),
    };
  });
};

export const getFoodAddOnsTotal = (purchases: FoodAddOnPurchase[]) =>
  Number(purchases.reduce((sum, item) => sum + item.totalPrice, 0).toFixed(2));
