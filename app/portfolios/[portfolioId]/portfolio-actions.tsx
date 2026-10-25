"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { EditablePosition } from "@/lib/portfolio-display";

type Intent =
  | { kind: "portfolio" }
  | { kind: "position" }
  | { kind: "movement" | "price"; position: EditablePosition };
type Actions = {
  canWrite: boolean;
  busy: boolean;
  open: (intent: Intent, trigger: HTMLButtonElement) => void;
};
const Context = createContext<Actions | null>(null);
function useActions() {
  const value = useContext(Context);
  if (!value) throw new Error("Portfolio actions require a provider.");
  return value;
}

export function PortfolioActions({
  portfolioId = "",
  canWrite,
  children,
}: {
  portfolioId?: string;
  canWrite: boolean;
  children: ReactNode;
}) {
  const [intent, setIntent] = useState<Intent | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [refreshing, startTransition] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const status = useRef<HTMLParagraphElement>(null);
  const router = useRouter();
  const busy = saving || refreshing;
  useEffect(() => {
    if (intent && dialog.current && !dialog.current.open) {
      dialog.current.showModal();
      dialog.current.querySelector<HTMLElement>("select, input")?.focus();
    }
  }, [intent]);
  useEffect(() => {
    if (notice && !refreshing) status.current?.focus();
  }, [notice, refreshing]);
  return (
    <Context.Provider
      value={{
        canWrite,
        busy,
        open(next, trigger) {
          if (!canWrite || busy) return;
          opener.current = trigger;
          setNotice("");
          setIntent(next);
        },
      }}
    >
      <div className="workspace-status">
        <p
          ref={status}
          tabIndex={-1}
          role="status"
          className={notice ? "success-notice" : "sr-only"}
        >
          {notice}
        </p>
        <p role="status" className="refresh-status">
          {refreshing ? "Refreshing your portfolio…" : ""}
        </p>
        <button
          type="button"
          className="button-quiet refresh-button"
          disabled={busy}
          onClick={() => startTransition(() => router.refresh())}
        >
          ↻ Refresh
        </button>
      </div>
      <div aria-busy={refreshing}>{children}</div>
      <dialog
        ref={dialog}
        className="portfolio-dialog"
        aria-labelledby="editor-title"
        aria-describedby="editor-description"
        onCancel={(event) => {
          if (saving) event.preventDefault();
        }}
        onClose={() => {
          setIntent(null);
          opener.current?.focus();
        }}
      >
        {intent && (
          <MutationForm
            intent={intent}
            portfolioId={portfolioId}
            saving={saving}
            setSaving={setSaving}
            close={() => dialog.current?.close()}
            success={(message, createdPortfolioId) => {
              dialog.current?.close();
              setNotice(message);
              startTransition(() => {
                router.refresh();
                if (createdPortfolioId)
                  router.push(
                    `/portfolios/${encodeURIComponent(createdPortfolioId)}`,
                  );
              });
            }}
          />
        )}
      </dialog>
    </Context.Provider>
  );
}

export function CreatePortfolioButton() {
  const { busy, open } = useActions();
  return (
    <button
      type="button"
      className="button-primary"
      disabled={busy}
      onClick={(event) => open({ kind: "portfolio" }, event.currentTarget)}
    >
      <span aria-hidden="true">＋</span> Create portfolio
    </button>
  );
}

export function AddPositionButton() {
  const { canWrite, busy, open } = useActions();
  return canWrite ? (
    <button
      type="button"
      className="button-primary"
      disabled={busy}
      onClick={(event) => open({ kind: "position" }, event.currentTarget)}
    >
      <span aria-hidden="true">＋</span> Add position
    </button>
  ) : null;
}
export function PositionActions({ position }: { position: EditablePosition }) {
  const { canWrite, busy, open } = useActions();
  if (!canWrite) return null;
  return (
    <div className="position-actions">
      <button
        type="button"
        className="table-action"
        disabled={busy}
        aria-label={`Record movement for ${position.symbol}`}
        onClick={(event) =>
          open({ kind: "movement", position }, event.currentTarget)
        }
      >
        Record movement
      </button>
      {position.assetType !== "CASH" && (
        <button
          type="button"
          className="table-action secondary"
          disabled={busy}
          aria-label={`Update price for ${position.symbol}`}
          onClick={(event) =>
            open({ kind: "price", position }, event.currentTarget)
          }
        >
          Update price
        </button>
      )}
    </div>
  );
}

function MutationForm({
  intent,
  portfolioId,
  saving,
  setSaving,
  close,
  success,
}: {
  intent: Intent;
  portfolioId: string;
  saving: boolean;
  setSaving: (value: boolean) => void;
  close: () => void;
  success: (message: string, createdPortfolioId?: string) => void;
}) {
  const [assetType, setAssetType] = useState("STOCK");
  const [error, setError] = useState("");
  const [signedOut, setSignedOut] = useState(false);
  const errorBox = useRef<HTMLDivElement>(null);
  const pending = useRef(false);
  const operation = useRef<{ fingerprint: string; key: string } | null>(null);
  const cash =
    intent.kind === "portfolio"
      ? false
      : intent.kind === "position"
        ? assetType === "CASH"
        : intent.position.assetType === "CASH";
  const title =
    intent.kind === "portfolio"
      ? "Create a portfolio"
      : intent.kind === "position"
        ? "Add a position"
        : intent.kind === "movement"
          ? "Record a movement"
          : "Update a manual price";
  const buttonText =
    intent.kind === "portfolio"
      ? "Create portfolio"
      : intent.kind === "position"
        ? "Create position"
        : intent.kind === "movement"
          ? "Record movement"
          : "Save price";
  useEffect(() => {
    if (error) errorBox.current?.focus();
  }, [error]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "").trim();
    const base = `/api/portfolios/${encodeURIComponent(portfolioId)}/positions`;
    let body: Record<string, string>;
    let url = base;
    try {
      if (intent.kind === "portfolio") {
        const name = value("name");
        if (!name || name.length > 100) {
          setError("Enter a portfolio name between 1 and 100 characters.");
          return;
        }
        url = "/api/portfolios";
        body = { name };
      } else if (intent.kind === "position")
        body = {
          assetType: value("assetType"),
          label: value("label"),
          symbol: cash ? "USD" : value("symbol"),
          unitPrice: cash ? "1" : value("unitPrice"),
        };
      else if (intent.kind === "price") {
        url += `/${encodeURIComponent(intent.position.id)}/valuation`;
        body = {
          unitPrice: value("unitPrice"),
        };
      } else {
        url += `/${encodeURIComponent(intent.position.id)}/movements`;
        body = {
          signedQuantity: `${value("direction") === "DECREASE" ? "-" : ""}${value("quantity")}`,
          note: value("note"),
        };
        const fingerprint = JSON.stringify(body);
        if (operation.current?.fingerprint !== fingerprint)
          operation.current = { fingerprint, key: crypto.randomUUID() };
        body.requestKey = operation.current!.key;
      }
    } catch {
      setError("Check the entered fields and try again.");
      return;
    }
    pending.current = true;
    setSaving(true);
    setError("");
    setSignedOut(false);
    try {
      const response = await fetch(url, {
        method: intent.kind === "price" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(35000),
      });
      if (!response.ok) {
        const result: unknown = await response.json().catch(() => null);
        const message =
          result &&
          typeof result === "object" &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error.slice(0, 300)
            : "The request could not be completed. Please try again.";
        setSignedOut(response.status === 401);
        setError(message);
        return;
      }
      if (intent.kind === "portfolio") {
        const result: unknown = await response.json().catch(() => null);
        if (
          !result ||
          typeof result !== "object" ||
          !("id" in result) ||
          typeof result.id !== "string" ||
          !result.id
        ) {
          setError(
            "The portfolio may have been created. Refresh the list before trying again.",
          );
          return;
        }
        success("Portfolio created.", result.id);
        return;
      }
      operation.current = null;
      success(
        intent.kind === "position"
          ? "Position created. Record a movement to add its opening quantity."
          : intent.kind === "movement"
            ? "Movement recorded. Your holdings have been updated."
            : "Manual price updated. Quantities are unchanged.",
      );
    } catch {
      setError(
        intent.kind === "portfolio"
          ? "The connection was interrupted. Refresh your portfolio list to check whether it was created before trying again."
          : intent.kind === "movement"
            ? "The connection was interrupted. Check history before changing this adjustment. Retrying unchanged details safely reuses the same operation."
            : "The connection was interrupted. Refresh the portfolio to check whether the change was saved before trying again.",
      );
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }
  // Keep input state local; all portfolio quantities/totals arrive from server refresh.
  return (
    <form onSubmit={submit}>
      <div className="dialog-heading">
        <div>
          <p className="eyebrow">
            {intent.kind === "portfolio"
              ? "NEW PORTFOLIO"
              : intent.kind === "position"
                ? "PORTFOLIO POSITION"
                : intent.position.symbol}
          </p>
          <h2 id="editor-title">{title}</h2>
        </div>
        <button
          type="button"
          className="dialog-close"
          aria-label="Close form"
          onClick={close}
          disabled={saving}
        >
          ×
        </button>
      </div>
      <p id="editor-description" className="dialog-description">
        {intent.kind === "portfolio"
          ? "Start an empty USD portfolio. You will be its Owner, with access to add positions and record holdings."
          : intent.kind === "position"
            ? "Create an asset record first. Its quantity starts at zero until you record a movement."
            : intent.kind === "movement"
              ? "Record an adjustment to externally held assets. This does not execute a purchase or change another position."
              : "Record your observed USD unit price and when it was observed. This is a manual valuation."}
      </p>
      {error && (
        <div ref={errorBox} role="alert" tabIndex={-1} className="form-error">
          <p>{error}</p>
          {signedOut && (
            <Link className="text-link" href="/sign-in">
              Sign in again
            </Link>
          )}
        </div>
      )}
      <fieldset disabled={saving} className="form-fields">
        {intent.kind === "portfolio" && (
          <>
            <label>
              Portfolio name
              <input
                name="name"
                required
                maxLength={100}
                placeholder="e.g. Long-term holdings"
                aria-describedby="portfolio-name-help"
              />
            </label>
            <p id="portfolio-name-help" className="field-hint">
              1–100 characters. Base currency is fixed to USD.
            </p>
          </>
        )}
        {intent.kind === "position" && (
          <>
            <label>
              Asset type
              <select
                name="assetType"
                value={assetType}
                onChange={(event) => setAssetType(event.target.value)}
              >
                <option value="STOCK">Stock</option>
                <option value="CRYPTO">Crypto</option>
                <option value="CASH">Cash</option>
              </select>
            </label>
            <label>
              Position name
              <input
                name="label"
                required
                maxLength={160}
                placeholder="A name you recognise"
              />
            </label>
            <label>
              Symbol
              <input
                key={cash ? "cash-symbol" : "asset-symbol"}
                name="symbol"
                required
                maxLength={32}
                readOnly={cash}
                defaultValue={cash ? "USD" : ""}
                placeholder="e.g. SYMBOL"
                autoCapitalize="characters"
              />
            </label>
          </>
        )}
        {intent.kind === "movement" ? (
          <>
            <label>
              Direction
              <select name="direction" defaultValue="INCREASE">
                <option value="INCREASE">Increase holdings</option>
                <option value="DECREASE">Decrease holdings</option>
              </select>
            </label>
            <label>
              Quantity
              <input
                name="quantity"
                required
                inputMode="decimal"
                pattern={
                  cash
                    ? "[0-9]{1,18}(\\.[0-9]{1,2})?"
                    : "[0-9]{1,18}(\\.[0-9]{1,10})?"
                }
                aria-describedby="quantity-help"
                placeholder="e.g. 2 or 1.5"
              />
            </label>
            <p id="quantity-help" className="field-hint">
              Enter a quantity greater than zero. Your selected direction
              determines the adjustment.
              {cash
                ? " Cash accepts cents only."
                : " Cash is not adjusted automatically."}
            </p>
            <p className="field-hint">Movement recorded at (UTC) is set automatically by the server when saved.</p>
            <label>
              Note <span className="optional-label">optional</span>
              <textarea
                name="note"
                maxLength={500}
                rows={3}
                placeholder="Why are you recording this adjustment?"
              />
            </label>
          </>
        ) : (
          intent.kind !== "portfolio" && (
            <>
              <label>
                {cash ? "Fixed unit price (USD)" : "Manual unit price (USD)"}
                <input
                  key={cash ? "cash-price" : "asset-price"}
                  name="unitPrice"
                  required
                  inputMode="decimal"
                  pattern="[0-9]{1,20}(\.[0-9]{1,8})?"
                  readOnly={cash}
                  defaultValue={
                    cash
                      ? "1"
                      : intent.kind === "price"
                        ? intent.position.unitPrice
                        : ""
                  }
                  aria-describedby="price-help"
                  placeholder="0.00"
                />
              </label>
              <p id="price-help" className="field-hint">
                {cash
                  ? "USD cash always has a unit price of 1."
                  : "Enter a nonnegative price, with up to 8 decimal places."}
              </p>
              <p className="field-hint">Price recorded at (UTC) is set automatically by the server when saved.</p>
            </>
          )
        )}
      </fieldset>
      <div className="dialog-footer">
        <button
          className="button-quiet"
          type="button"
          disabled={saving}
          onClick={close}
        >
          Cancel
        </button>
        <button className="button-primary" type="submit" disabled={saving}>
          {saving ? "Saving…" : buttonText}
        </button>
      </div>
      <p role="status" className="sr-only">
        {saving ? "Saving your change. Please wait." : ""}
      </p>
    </form>
  );
}
