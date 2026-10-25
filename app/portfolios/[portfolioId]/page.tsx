import { portfolios } from "@/lib/server/portfolios";
import { privateRead } from "../server-data";
import { DashboardView } from "./dashboard-view";
import { PortfolioAssistant } from "./portfolio-assistant";
import { assistantAvailability } from "@/lib/server/assistant-settings";
export const dynamic = "force-dynamic";

export default async function PortfolioPage({ params }: { params: Promise<{ portfolioId: string }> }) {
  const { portfolioId } = await params;
  const [portfolio, history] = await privateRead(() => Promise.all([
    portfolios().getPortfolio(portfolioId), portfolios().listPortfolioMovements(portfolioId),
  ]));
  return <><DashboardView portfolio={portfolio} history={history} /><PortfolioAssistant key={portfolio.id} portfolioId={portfolio.id} portfolioName={portfolio.name} availability={assistantAvailability()} /></>;
}
