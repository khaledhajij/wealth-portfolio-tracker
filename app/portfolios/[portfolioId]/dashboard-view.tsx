import Link from "next/link";
import type { createPortfolioService } from "@/lib/server/portfolio-service";
import { assetName, roleName, usd, decimalText, utcTime } from "@/lib/portfolio-display";
import { AddPositionButton, PortfolioActions, PositionActions } from "./portfolio-actions";

type Service = ReturnType<typeof createPortfolioService>;
type Portfolio = Awaited<ReturnType<Service["getPortfolio"]>>;
type History = Awaited<ReturnType<Service["listPortfolioMovements"]>>;

export function DashboardView({ portfolio, history }: { portfolio: Portfolio; history: History }) {
  const canWrite = portfolio.role === "OWNER" || portfolio.role === "EDITOR";
  const values = new Map(portfolio.valuation.positions.map((row) => [row.id, row]));
  return <PortfolioActions portfolioId={portfolio.id} canWrite={canWrite}>
    <Link href="/portfolios" className="back-link">← All portfolios</Link>
    <div className="page-heading"><div><p className="eyebrow">PORTFOLIO OVERVIEW</p><h1>{portfolio.name}</h1><p className="page-description">Your recorded holdings, brought into focus.</p></div><div className="heading-actions"><span className="role-badge">{roleName[portfolio.role]}</span><AddPositionButton /></div></div>
    {!canWrite && <p className="viewer-note">View-only access. You can review this portfolio’s positions and history.</p>}
    <div className="overview-grid">
      <section className="total-card" aria-labelledby="total-heading"><div className="total-top"><h2 id="total-heading">Total portfolio value</h2><span>USD</span></div>
        <p className="total-value" data-testid="portfolio-total">{usd(portfolio.valuation.displayTotal)}</p>
        <div className="total-bottom"><span className="manual-dot" /><p>Based on your manual prices</p><span>{portfolio.positions.length} {portfolio.positions.length === 1 ? "position" : "positions"}</span></div>
      </section>
      <section className="allocation-card" aria-labelledby="allocation-heading"><div className="card-heading"><h2 id="allocation-heading">Asset allocation</h2><span>By current value</span></div>
        <div className="allocation-track" aria-hidden="true">{portfolio.valuation.allocationByAssetType.map((row) => <span key={row.assetType} className={`allocation-segment allocation-${row.assetType.toLowerCase()}`} style={{ width: `${row.allocationPercent}%` }} />)}</div>
        <ul className="allocation-list">{portfolio.valuation.allocationByAssetType.map((row) => <li key={row.assetType}><span className={`asset-dot allocation-${row.assetType.toLowerCase()}`} /><span>{row.assetType === "STOCK" ? "Stocks" : assetName[row.assetType]}</span><strong>{usd(row.value)}</strong><span>{decimalText(row.allocationPercent.replace(/\.?0+$/, "") || "0")}%</span></li>)}</ul>
        {portfolio.valuation.totalValue === "0" && <p className="field-hint">Allocation appears when recorded holdings have a positive value.</p>}
      </section>
    </div>
    <section id="positions" className="data-section" aria-labelledby="positions-heading"><div className="section-heading"><div><h2 id="positions-heading">Positions</h2><p>Movement-derived quantities. Manual USD prices.</p></div><span className="section-count">{portfolio.positions.length} total</span></div>
      {portfolio.positions.length > 0 && <p className="table-hint">Scroll the table horizontally for all position details.</p>}
      {portfolio.positions.length ? <div className="table-scroll" tabIndex={0} role="region" aria-label="Positions table, scroll horizontally on smaller screens"><table className="positions-table"><caption className="sr-only">Recorded positions and manual valuations in USD</caption><thead><tr><th scope="col">Asset</th><th scope="col" className="numeric">Quantity</th><th scope="col" className="numeric">Unit price</th><th scope="col" className="numeric">Value</th><th scope="col">Price timestamp</th>{canWrite && <th scope="col"><span className="sr-only">Actions</span></th>}</tr></thead>
        <tbody>{portfolio.positions.map((position) => {
          const valuation = values.get(position.id)!;
          return <tr key={position.id}><th scope="row"><div className="asset-cell"><span className={`asset-avatar asset-${position.assetType.toLowerCase()}`} aria-hidden="true">{position.symbol.slice(0, 2)}</span><div><strong>{position.label}</strong><span>{position.symbol} <span className="cell-separator">·</span> {assetName[position.assetType]}</span></div></div></th>
            <td className="numeric">{decimalText(valuation.quantity)}</td><td className="numeric">{usd(position.unitPrice)}{position.assetType === "CASH" && <span className="cell-subtext">Fixed</span>}</td><td className="numeric position-value">{usd(valuation.value)}</td><td className="timestamp-cell"><time dateTime={position.priceAsOf}>{utcTime(position.priceAsOf)}</time><span className="cell-subtext">{position.assetType === "CASH" ? "Fixed price confirmed" : "Manually recorded"}</span></td>
            {canWrite && <td><PositionActions position={{ id: position.id, label: position.label, symbol: position.symbol, assetType: position.assetType, unitPrice: position.unitPrice }} /></td>}</tr>;
        })}</tbody></table></div> : <div className="empty-state"><span className="empty-symbol" aria-hidden="true">＋</span><h3>A clear starting point</h3><p>{canWrite ? "Add your first position, then record a movement to enter its quantity." : "No positions have been recorded in this portfolio yet."}</p>{canWrite && <AddPositionButton />}</div>}
    </section>
    <section id="history" className="data-section" aria-labelledby="history-heading"><div className="section-heading"><div><h2 id="history-heading">Movement history</h2><p>Recorded quantity adjustments, never purchases or sales.</p></div><span className="section-count">Latest {history.length} · up to 100</span></div>
      {history.length ? <ol className="history-list">{history.map((row) => <li key={row.id}><span className={`movement-mark ${row.signedQuantity.startsWith("-") ? "decrease" : "increase"}`} aria-hidden="true">{row.signedQuantity.startsWith("-") ? "−" : "+"}</span><div className="movement-detail"><strong>{row.label}</strong><span>{row.symbol} · {row.signedQuantity.startsWith("-") ? "Decrease" : "Increase"}</span>{row.note && <p>{row.note}</p>}</div><div className="movement-amount"><strong>{row.signedQuantity.startsWith("-") ? "" : "+"}{decimalText(row.signedQuantity)}</strong><time dateTime={row.occurredAt}>{utcTime(row.occurredAt)}</time></div></li>)}</ol> : <div className="empty-state history-empty"><h3>No movements recorded</h3><p>Opening quantities and later adjustments will appear here. Corrections are recorded as new movements.</p></div>}
    </section>
  </PortfolioActions>;
}
