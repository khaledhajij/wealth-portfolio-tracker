import Link from "next/link";
import { roleName } from "@/lib/portfolio-display";
import { CreatePortfolioButton, PortfolioActions } from "./[portfolioId]/portfolio-actions";

type Portfolio = { id: string; name: string; currency: string; role: keyof typeof roleName };

// Presentation receives only authorized DTOs from the Server Component.
export function PortfolioListView({ rows }: { rows: Portfolio[] }) {
  return <PortfolioActions canWrite>
    <div className="page-heading"><div><p className="eyebrow">YOUR WORKSPACE</p><h1>Your portfolios</h1><p className="page-description">A quiet place to keep your holdings in perspective.</p></div><div className="heading-actions"><span className="valuation-tag">Manual prices</span><CreatePortfolioButton /></div></div>
    <section aria-labelledby="portfolio-list-heading"><h2 id="portfolio-list-heading" className="section-kicker">Choose a portfolio <span>{rows.length}</span></h2>
      {rows.length ? <div className="portfolio-grid">{rows.map((row, index) => <Link className="portfolio-card" href={`/portfolios/${encodeURIComponent(row.id)}`} key={row.id}>
        <div className="portfolio-card-top"><span className="portfolio-number">{String(index + 1).padStart(2, "0")}</span><span className="role-badge">{roleName[row.role]}</span></div>
        <h3>{row.name}</h3><p>USD · Manual valuation</p><span className="portfolio-open">Open portfolio <span aria-hidden="true">↗</span></span>
      </Link>)}</div> : <div className="empty-state"><h3>No portfolios yet</h3><p>Create your first USD portfolio. It starts empty, ready for the positions and holdings you choose to record.</p><CreatePortfolioButton /></div>}
    </section>
  </PortfolioActions>;
}
