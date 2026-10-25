import { portfolios } from "@/lib/server/portfolios";
import { privateRead } from "./server-data";
import { PortfolioListView } from "./list-view";
export const dynamic = "force-dynamic";

export default async function PortfoliosPage() {
  const rows = await privateRead(() => portfolios().listPortfolios());
  return <PortfolioListView rows={rows} />;
}
