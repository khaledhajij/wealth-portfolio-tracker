"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { ShieldCheck, Sparkles, X } from "lucide-react";

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  content: ReactNode;
}

interface ChatMessagesProps {
  messages: ChatMessage[];
  portfolioName: string;
  pending: boolean;
  onClose: () => void;
  context: ReactNode;
  children: ReactNode;
}

// Adapted from the supplied visual reference. Controlled SDK messages only:
// no demo defaults, autoplay, replay, delayed canned answers or second chat state.
export function ChatMessages({ messages, portfolioName, pending, onClose, context, children }: ChatMessagesProps) {
  const scroll = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (follow.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [messages, pending]);

  return <LazyMotion features={domAnimation} strict>
    <div className="chat-messages">
      <header className="chat-header">
        <span className="chat-avatar" aria-hidden="true"><Sparkles size={19} /></span>
        <div className="chat-heading"><h2 id="assistant-heading">Wealth assistant</h2><p id="assistant-portfolio" title={portfolioName}><ShieldCheck size={12} aria-hidden="true" /> Read-only <span aria-hidden="true">·</span> <span>{portfolioName}</span></p></div>
        <button type="button" className="chat-icon-button" onClick={onClose} aria-label="Close assistant"><X size={19} aria-hidden="true" /></button>
      </header>
      <div className="chat-context" id="assistant-context" tabIndex={0}>{context}</div>
      <div ref={scroll} className="chat-scroll" role="log" tabIndex={0} aria-label="Portfolio conversation" aria-live="polite" aria-relevant="additions"
        onScroll={() => { const element = scroll.current; if (element) follow.current = element.scrollHeight - element.scrollTop - element.clientHeight < 72; }}>
        {messages.length ? <ol className="chat-message-list">{messages.map((message) => <m.li key={message.id}
          initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.18 }}
          className={`chat-message chat-message-${message.sender}`}>
          {message.sender === "assistant" && <span className="chat-message-avatar" aria-hidden="true"><Sparkles size={14} /></span>}
          <div className="chat-bubble"><span className="chat-sender">{message.sender === "user" ? "You" : "Assistant"}</span>{message.content}</div>
        </m.li>)}</ol> : <div className="chat-empty"><span className="chat-empty-mark" aria-hidden="true"><Sparkles size={25} /></span><h3>Your portfolio, explained.</h3><p>Ask about recorded holdings, allocation or manual prices.</p><span>No conversation yet</span></div>}
        {pending && <div className="chat-typing" aria-hidden="true">{[0, 1, 2].map((index) => <m.span key={index}
          animate={reducedMotion ? { opacity: 0.65 } : { opacity: [0.35, 1, 0.35], y: [0, -3, 0] }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.9, repeat: Infinity, delay: index * 0.15 }} />)}</div>}
      </div>
      <div className="chat-composer">{children}</div>
    </div>
  </LazyMotion>;
}
