"use client";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { MessageCircle, RotateCcw, Send, Square } from "lucide-react";
import { ChatMessages } from "@/components/ui/chat-messages";
import { CHAT_LIMITS, type PositionsOutput, type SummaryOutput } from "@/lib/chat-contracts";
import { assetName, usd, utcTime } from "@/lib/portfolio-display";

type Message = UIMessage<unknown, Record<string, never>, {
  getPortfolioSummary: { input: Record<string, never>; output: SummaryOutput };
  listPositions: { input: Record<string, never>; output: PositionsOutput };
}>;

export function PortfolioAssistant({ portfolioId, portfolioName, availability }: { portfolioId: string; portfolioName: string; availability: { enabled: boolean; message: string } }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [notice, setNotice] = useState("");
  const draft = useRef("");
  const pending = useRef(false);
  const errorBox = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
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
  useEffect(() => { if (error && open && dialog.current?.open) errorBox.current?.focus(); }, [error, open]);
  useEffect(() => () => { void stop(); }, [stop]);

  function openChat() {
    dialog.current?.showModal(); setOpen(true);
    const target = dialog.current?.querySelector<HTMLElement>("textarea:not(:disabled)")
      ?? dialog.current?.querySelector<HTMLElement>("button");
    target?.focus();
  }
  function closeChat() {
    if (busy || pending.current) { setInput(draft.current); setNotice("Response stopped. Partial content may be incomplete."); }
    void stop();
    dialog.current?.close();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = input.trim();
    if (!availability.enabled || busy || pending.current || full || !question || question.length > CHAT_LIMITS.questionCharacters) return;
    pending.current = true; draft.current = input; setNotice(""); clearError(); setInput("");
    try { await sendMessage({ text: question }); }
    finally { pending.current = false; }
  }
  return <>
    <button ref={launcher} type="button" className="assistant-launcher" aria-haspopup="dialog" aria-expanded={open} aria-controls="portfolio-assistant-popup" onClick={openChat}><MessageCircle size={20} aria-hidden="true" /><span>Ask AI</span><span className="assistant-launcher-badge">Read-only</span></button>
    <dialog ref={dialog} id="portfolio-assistant-popup" className="chat-popup" aria-labelledby="assistant-heading" aria-describedby="assistant-portfolio assistant-context"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]');
        const first = controls?.[0]; const last = controls?.[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}
      onCancel={(event) => { event.preventDefault(); closeChat(); }} onClose={() => { setOpen(false); launcher.current?.focus(); }}>
    <ChatMessages portfolioName={portfolioName} pending={busy} onClose={closeChat}
      context={<><p>Manual USD valuations</p><p className="field-hint">{availability.message}</p></>}
      messages={messages.map((message) => ({ id: message.id, sender: message.role === "user" ? "user" : "assistant", content: message.parts.map((part, index) => {
        if (part.type === "text") return <p className="assistant-text" key={index}>{part.text}</p>;
        if (part.type === "tool-getPortfolioSummary" || part.type === "tool-listPositions") {
          const name = part.type === "tool-getPortfolioSummary" ? "Portfolio summary" : "Positions";
          if (part.state === "output-available") return part.type === "tool-getPortfolioSummary"
            ? <SummaryResult key={index} result={part.output} /> : <PositionsResult key={index} result={part.output} />;
          return <p key={index} className="assistant-tool-status" role="status">{part.state === "output-error" || part.state === "output-denied" ? `${name} unavailable. Access may have changed.` : `Reading ${name.toLowerCase()}…`}</p>;
        }
        return null;
      }) }))}>
    {error && <div ref={errorBox} role="alert" tabIndex={-1} className="form-error"><p>The assistant could not complete this response. Your question is kept below. Check your session or try a shorter question; partial content may be incomplete.</p><Link href="/sign-in" className="text-link">Sign in again</Link></div>}
    <p role="status" className="assistant-status">{busy ? status === "submitted" ? "Waiting for the assistant…" : "Receiving response…" : notice}</p>
    <form onSubmit={submit} className="assistant-form">
      <label htmlFor="portfolio-question">Your question<textarea id="portfolio-question" name="question" rows={2} required maxLength={CHAT_LIMITS.questionCharacters} value={input} onChange={(event) => setInput(event.target.value)} disabled={!availability.enabled || busy || full} aria-describedby="assistant-question-help" placeholder="What is this portfolio worth at its manual prices?"
        onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} /></label>
      <p id="assistant-question-help" className="field-hint">2,000 characters · Enter to send · Shift+Enter for a new line. Questions and authorized tool results go to Google Gemini; chat stays on this page.</p>
      {full && <p className="field-hint">Six questions reached. Clear the conversation to ask another.</p>}
      <div className="assistant-controls"><button className="chat-secondary-button" type="button" disabled={busy || !messages.length} onClick={() => { setMessages([]); clearError(); setNotice(""); setInput(""); }}><RotateCcw size={13} aria-hidden="true" />Clear conversation</button>
        {busy ? <button key="stop" className="chat-secondary-button" type="button" onClick={(event) => { event.preventDefault(); setNotice("Stopping response…"); setInput(draft.current); void stop(); }}><Square size={13} aria-hidden="true" />Stop response</button>
          : <button key="ask" className="chat-send-button" type="submit" disabled={!availability.enabled || full || !input.trim()}><Send size={14} aria-hidden="true" />Ask assistant</button>}</div>
    </form>
    <p className="field-hint chat-disclaimer">Each question stands alone. AI text may be inaccurate; server results and manual timestamps are the source figures.</p>
    </ChatMessages>
    </dialog>
  </>;
}

function SummaryResult({ result }: { result: SummaryOutput }) {
  return <div className="assistant-result"><h3>Server result · Portfolio summary</h3><p>Total: <strong>{usd(result.displayTotal)}</strong> USD · {result.positionCount} positions</p>
    <p>Manual-price timestamps: {result.manualPriceWindow.oldest ? `${utcTime(result.manualPriceWindow.oldest)} to ${utcTime(result.manualPriceWindow.newest!)}` : "none (empty portfolio)"}.</p>
    <ul>{result.allocationByAssetType.map((row) => <li key={row.assetType}>{assetName[row.assetType]}: {usd(row.value)} USD · {row.allocationPercent}%</li>)}</ul>
  </div>;
}
function PositionsResult({ result }: { result: PositionsOutput }) {
  return <div className="assistant-result"><h3>Server result · Positions</h3>{!result.positions.length ? <p>No positions recorded.</p>
    : <ul>{result.positions.map((row, index) => <li key={index}><strong>{row.label} ({row.symbol})</strong><p>Quantity: {row.quantity} · Unit price: {row.unitPrice} USD · Value: {row.value} USD</p><p>Manual price: {utcTime(row.priceAsOf)}</p></li>)}</ul>}
    {result.hasMore && <p>Showing the first 10 positions only. Open the positions table for all holdings.</p>}
  </div>;
}
