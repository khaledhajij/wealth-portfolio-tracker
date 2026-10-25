export default function Loading() {
  return <div className="dashboard-loading" aria-busy="true" role="status"><p className="eyebrow">LOADING YOUR WORKSPACE</p><h1>Reading your portfolios…</h1><div className="loading-line" /><div className="loading-block" /><p>Retrieving your recorded holdings and manual prices.</p></div>;
}
