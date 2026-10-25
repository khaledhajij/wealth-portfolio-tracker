import Link from "next/link";
export default function NotFound() {
  return (
    <section className="empty-state">
      <p className="eyebrow">PORTFOLIO UNAVAILABLE</p>
      <h1>This portfolio isn’t available.</h1>
      <p>Choose a portfolio you currently have access to.</p>
      <Link className="button-primary" href="/portfolios">
        Back to portfolios
      </Link>
    </section>
  );
}
