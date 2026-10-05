export type BarcodeRef = {
    via: "barcode";
    barcode: string;
    displayName: string;
};

export type CatalogRef = {
    via: "catalog";
    source: string;
    sourceId: string;
    displayName: string;
};

export type ManualRef = {
    via: "manual";
    householdManualId: string;
    displayName: string;
};

export type FoodIdentity = { kind: "food" } & (
    BarcodeRef | CatalogRef | ManualRef
);
export type SupplyIdentity = { kind: "supply" } & (
    BarcodeRef | CatalogRef | ManualRef
);

export type ComparableIdentity =
    | { kind: "food" | "supply"; via: "barcode"; barcode: string }
    | {
          kind: "food" | "supply";
          via: "catalog";
          source: string;
          sourceId: string;
      }
    | { kind: "food" | "supply"; via: "manual"; householdManualId: string };

export function comparableIdentity(
    identity: FoodIdentity | SupplyIdentity,
): ComparableIdentity {
    if (identity.via === "barcode") {
        return {
            kind: identity.kind,
            via: "barcode",
            barcode: identity.barcode,
        };
    }
    if (identity.via === "catalog") {
        return {
            kind: identity.kind,
            via: "catalog",
            source: identity.source,
            sourceId: identity.sourceId,
        };
    }
    return {
        kind: identity.kind,
        via: "manual",
        householdManualId: identity.householdManualId,
    };
}

export function identityKey(identity: FoodIdentity | SupplyIdentity): string {
    const comparable = comparableIdentity(identity);
    if (comparable.via === "barcode") {
        return `${identity.kind}:barcode:${comparable.barcode}`;
    }
    if (comparable.via === "catalog") {
        return `${identity.kind}:catalog:${comparable.source}:${comparable.sourceId}`;
    }
    return `${identity.kind}:manual:${comparable.householdManualId}`;
}
