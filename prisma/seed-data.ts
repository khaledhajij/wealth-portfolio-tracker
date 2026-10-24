// All accounts are synthetic and cannot sign in. No credentials are seeded.
export const seedUsers = [
  { id: "demo-owner", email: "owner@example.invalid", name: "Demo Owner" },
  { id: "demo-editor", email: "editor@example.invalid", name: "Demo Editor" },
  { id: "demo-viewer", email: "viewer@example.invalid", name: "Demo Viewer" },
  { id: "demo-other-owner", email: "other@example.invalid", name: "Demo Other Owner" },
];

export const seedPortfolios = [
  { id: "demo-primary", name: "Demo portfolio A", currency: "USD" },
  { id: "demo-secondary", name: "Demo portfolio B", currency: "USD" },
];

export const seedMemberships = [
  { userId: "demo-owner", portfolioId: "demo-primary", role: "OWNER" as const },
  { userId: "demo-editor", portfolioId: "demo-primary", role: "EDITOR" as const },
  { userId: "demo-viewer", portfolioId: "demo-primary", role: "VIEWER" as const },
  { userId: "demo-other-owner", portfolioId: "demo-secondary", role: "OWNER" as const },
  { userId: "demo-owner", portfolioId: "demo-secondary", role: "VIEWER" as const },
];

export const seedTime = new Date("2026-10-24T10:00:00.000Z");
export const seedPositions = [
  { id: "demo-stock", portfolioId: "demo-primary", assetType: "STOCK" as const, label: "Synthetic stock", symbol: "DEMO", unitPrice: "50", priceAsOf: seedTime },
  { id: "demo-cash", portfolioId: "demo-primary", assetType: "CASH" as const, label: "USD cash", symbol: "USD", unitPrice: "1", priceAsOf: seedTime },
  { id: "demo-crypto", portfolioId: "demo-secondary", assetType: "CRYPTO" as const, label: "Synthetic crypto", symbol: "DEMOCOIN", unitPrice: "800", priceAsOf: seedTime },
];

export const seedMovements = [
  { id: "demo-stock-open", requestKey: "seed:v1:stock-open", portfolioId: "demo-primary", positionId: "demo-stock", signedQuantity: "12", createdBy: "demo-owner", occurredAt: seedTime, note: "Synthetic opening balance" },
  { id: "demo-stock-reduce", requestKey: "seed:v1:stock-reduce", portfolioId: "demo-primary", positionId: "demo-stock", signedQuantity: "-2", createdBy: "demo-editor", occurredAt: seedTime, note: "Synthetic balance reduction, not a sale" },
  { id: "demo-cash-open", requestKey: "seed:v1:cash-open", portfolioId: "demo-primary", positionId: "demo-cash", signedQuantity: "100", createdBy: "demo-owner", occurredAt: seedTime, note: "Synthetic USD balance" },
  { id: "demo-crypto-open", requestKey: "seed:v1:crypto-open", portfolioId: "demo-secondary", positionId: "demo-crypto", signedQuantity: "0.25", createdBy: "demo-other-owner", occurredAt: seedTime, note: "Synthetic fractional balance" },
];
