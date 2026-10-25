import Link from "next/link";
import type { ReactNode } from "react";
import { SignOutButton } from "../account/sign-out-button";

export default function PortfolioLayout({ children }: { children: ReactNode }) {
  return <div className="dashboard-shell">
    <aside className="dashboard-sidebar">
      <Link href="/portfolios" className="brand" aria-label="Wealth Portfolio home"><span className="brand-mark" aria-hidden="true">w.</span><span>wealth<span className="brand-subtitle">PORTFOLIO TRACKER</span></span></Link>
      <nav aria-label="Main navigation" className="side-nav"><Link href="/portfolios">Portfolios <span aria-hidden="true">↗</span></Link><Link href="/account">Account</Link></nav>
      <div className="sidebar-note"><span className="eyebrow">A considered view</span><p>Your holdings, at the prices you record.</p></div>
    </aside>
    <div className="dashboard-body">
      <header className="dashboard-topbar"><span className="topbar-label">Your financial workspace</span><div className="topbar-tools"><span className="currency-tag">USD only</span><SignOutButton compact /></div></header>
      <main id="main-content" className="dashboard-main">{children}</main>
      <footer className="dashboard-footer">Manual valuations. Recorded holdings. <span>No market feeds or trade execution.</span></footer>
    </div>
  </div>;
}
