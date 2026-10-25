"use client";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { CHAT_LIMITS, type PositionsOutput, type SummaryOutput } from "@/lib/chat-contracts";
import { assetName, usd, utcTime } from "@/lib/portfolio-display";

type Message = UIMessage<unknown, Record<string, never>, {
  getPortfolioSummary: { input: Record<string, never>; output: SummaryOutput };
  listPositions: { input: Record<string, never>; output: PositionsOutput };
}>;

export function PortfolioAssistant({ portfolioId, availability }: { portfolioId: string; availability: { enabled: boolean; message: string } }) {
  const [input, setInput] = useState("");
  const [notice, setNotice] = useState("");
  const draft = useRef("");
  const pending = useRef(false);
  const errorBox = useRef<HTMLDivElement>(null);
  const [transport] = useState(() => new DefaultChatTransport<Message>({
    api: "/api/chat", credentials: "same-origin",
    prepareSendMessagesRequest: ({ messages }) => {
      const last = messages.at(-1);
      const message = last?.role === "user" ? last.parts.filter((part) => part.type === "text").map((part) => part.text).join("") : "";
      // No browser tool results, assistant assertions or prior portfolio history
      // are accepted as model context. Each question is an independent request.
      return { body: { portfolioId, message } };
    },
  }));
  const { messages, sendMessage, status, error, stop, clearError, setMessages } = useChat<Message>({
    id: `portfolio:${portfolioId}`, transport,
    onError: () => { setInput(draft.current); },
    onFinish: ({ isAbort }) => { if (isAbort) setNotice("Response stopped or timed out. Partial content may be incomplete."); },
  });
  const busy = status === "submitted" || status === "streaming";
  const full = messages.filter((message) => message.role === "user").length >= 6;
  useEffect(() => { if (error) errorBox.current?.focus(); }, [error]);
  useEffect(() => () => { void stop(); }, [stop]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = input.trim();
    if (!availability.enabled || busy || pending.current || full || !question || question.length > CHAT_LIMITS.questionCharacters) return;
    pending.current = true; draft.current = input; setNotice(""); clearError(); setInput("");
    try { await sendMessage({ text: question }); }
    finally { pending.current = false; }
  }
  return <section className="assistant-panel data-section" aria-labelledby="assistant-heading">
    <div className="section-heading"><div><p className="eyebrow">READ-ONLY ASSISTANT</p><h2 id="assistant-heading">Ask about this portfolio</h2></div><span className="prototype-tag">Prototype</span></div>
    <p className="assistant-description">Review recorded holdings and manual USD valuations. Use synthetic demo data only. No changes, live prices or trading recommendations. Each question stands alone; switching portfolios clears this conversation.</p>
    <p className="field-hint">{availability.message}</p>
    {messages.length > 0 && <ol className="assistant-messages" aria-label="Portfolio conversation">{messages.map((message) => <li key={message.id} className={`assistant-message assistant-${message.role}`}>
      <strong>{message.role === "user" ? "You" : "Assistant"}</strong>
      {message.parts.map((part, index) => {
        if (part.type === "text") return <p className="assistant-text" key={index}>{part.text}</p>;
        if (part.type === "tool-getPortfolioSummary" || part.type === "tool-listPositions") {
          const name = part.type === "tool-getPortfolioSummary" ? "Portfolio summary" : "Positions";
          if (part.state === "output-available") return part.type === "tool-getPortfolioSummary"
            ? <SummaryResult key={index} result={part.output} /> : <PositionsResult key={index} result={part.output} />;
          return <p key={index} className="assistant-tool-status" role="status">{part.state === "output-error" || part.state === "output-denied" ? `${name} unavailable. Access may have changed.` : `Reading ${name.toLowerCase()}…`}</p>;
        }
        return null;
      })}
    </li>)}</ol>}
    {error && <div ref={errorBox} role="alert" tabIndex={-1} className="form-error"><p>The assistant could not complete this response. Your question is kept below. Check your session or try a shorter question; partial content may be incomplete.</p><Link href="/sign-in" className="text-link">Sign in again</Link></div>}
    <p role="status" className="assistant-status">{busy ? status === "submitted" ? "Waiting for the assistant…" : "Receiving response…" : notice}</p>
    <form onSubmit={submit} className="assistant-form">
      <label htmlFor="portfolio-question">Your question<textarea id="portfolio-question" name="question" rows={3} required maxLength={CHAT_LIMITS.questionCharacters} value={input} onChange={(event) => setInput(event.target.value)} disabled={!availability.enabled || busy || full} aria-describedby="assistant-question-help" placeholder="What is this portfolio worth at its manual prices?" /></label>
      <p id="assistant-question-help" className="field-hint">Up to 2,000 characters. Only this question and authorized read-tool results are sent to Google Gemini. Conversations are held in this page, not saved.</p>
      {full && <p className="field-hint">Six questions reached. Clear the conversation to ask another.</p>}
      <div className="assistant-controls"><button className="button-quiet" type="button" disabled={busy || !messages.length} onClick={() => { setMessages([]); clearError(); setNotice(""); setInput(""); }}>Clear conversation</button>
        {busy ? <button key="stop" className="button-quiet" type="button" onClick={(event) => { event.preventDefault(); setNotice("Stopping response…"); setInput(draft.current); void stop(); }}>Stop response</button>
          : <button key="ask" className="button-primary" type="submit" disabled={!availability.enabled || full || !input.trim()}>Ask assistant</button>}</div>
    </form>
    <p className="field-hint">AI text may be inaccurate. The server results below each tool are the source figures; prices are manually recorded.</p>
  </section>;
}

function SummaryResult({ result }: { result: SummaryOutput }) {
  return <div className="assistant-result"><h3>Server result · Portfolio summary</h3><p>Total: <strong>{usd(result.displayTotal)}</strong> USD · {result.positionCount} positions</p>
    <p>Manual-price observations: {result.manualPriceWindow.oldest ? `${utcTime(result.manualPriceWindow.oldest)} to ${utcTime(result.manualPriceWindow.newest!)}` : "none (empty portfolio)"}.</p>
    <ul>{result.allocationByAssetType.map((row) => <li key={row.assetType}>{assetName[row.assetType]}: {usd(row.value)} USD · {row.allocationPercent}%</li>)}</ul>
  </div>;
}
function PositionsResult({ result }: { result: PositionsOutput }) {
  return <div className="assistant-result"><h3>Server result · Positions</h3>{!result.positions.length ? <p>No positions recorded.</p>
    : <ul>{result.positions.map((row, index) => <li key={index}><strong>{row.label} ({row.symbol})</strong><p>Quantity: {row.quantity} · Unit price: {row.unitPrice} USD · Value: {row.value} USD</p><p>Manual price: {utcTime(row.priceAsOf)}</p></li>)}</ul>}
    {result.hasMore && <p>Showing the first 10 positions only. Open the positions table for all holdings.</p>}
  </div>;
}
