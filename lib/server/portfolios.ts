import "server-only";
import { getDatabase } from "./db";
import { requireUser } from "./session";
import { createPortfolioService } from "./portfolio-service";

// The only production service composition. No caller-supplied user/role argument.
export function portfolios() {
  return createPortfolioService(getDatabase(), requireUser);
}
