import Link from "next/link";
import { portfolios } from "@/lib/server/portfolios";
import { roleName } from "@/lib/portfolio-display";
import { privateRead } from "./server-data";
export const dynamic = "force-dynamic";

export default async function PortfoliosPage() {
  const rows = await privateRead(() => portfolios().listPortfolios());
  return <>
    <div className="page-heading"><div><p className="eyebrow">YOUR WORKSPACE</p><h1>Your portfolios</h1><p className="page-description">A quiet place to keep your holdings in perspective.</p></div><span className="prototype-tag">Prototype · Manual prices</span></div>
    <section aria-labelledby="portfolio-list-heading"><h2 id="portfolio-list-heading" className="section-kicker">Choose a portfolio <span>{rows.length}</span></h2>
      {rows.length ? <div className="portfolio-grid">{rows.map((row, index) => <Link className="portfolio-card" href={`/portfolios/${encodeURIComponent(row.id)}`} key={row.id}>
        <div className="portfolio-card-top"><span className="portfolio-number">{String(index + 1).padStart(2, "0")}</span><span className="role-badge">{roleName[row.role]}</span></div>
        <h3>{row.name}</h3><p>USD · Manual valuation</p><span className="portfolio-open">Open portfolio <span aria-hidden="true">↗</span></span>
      </Link>)}</div> : <div className="empty-state"><h3>No portfolios yet</h3><p>You do not currently have access to any portfolios. Portfolio creation and membership management are not available in this prototype.</p></div>}
    </section>
  </>;
}
