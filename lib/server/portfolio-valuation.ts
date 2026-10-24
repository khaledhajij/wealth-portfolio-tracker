import "server-only";
import { portfolios } from "./portfolios";

// Shared read for future API/AI callers: only the selected portfolio is supplied.
export async function getPortfolioValuation(portfolioId: string) {
  return (await portfolios().getPortfolio(portfolioId)).valuation;
}
