// English display only. Preserve decimal strings; never parse money as a Number.
export function decimalText(value: string, minimumFraction = 0) {
  if (!/^-?\d+(\.\d+)?$/.test(value))
    throw new Error("Invalid display decimal.");
  const [integer, fraction = ""] = value.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const decimals = fraction.padEnd(minimumFraction, "0");
  return grouped + (decimals ? `.${decimals}` : "");
}
export function usd(value: string) {
  return `$${decimalText(value, 2)}`;
}
export function utcTime(value: string) {
  return (
    new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }).format(new Date(value)) + " UTC"
  );
}
export const assetName = {
  STOCK: "Stock",
  CRYPTO: "Crypto",
  CASH: "Cash",
} as const;
export const roleName = {
  OWNER: "Owner",
  EDITOR: "Editor",
  VIEWER: "Viewer",
} as const;
export type EditablePosition = {
  id: string;
  label: string;
  symbol: string;
  assetType: keyof typeof assetName;
  unitPrice: string;
};
