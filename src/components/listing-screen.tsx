import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { PublishDesk } from "@/components/publish-desk";
import { Shell } from "@/components/shell";
import { deleteListing, saveListing, type ListingStatus, type SavedListing } from "@/lib/closet";
import { identifyItem } from "@/lib/identify.functions";
import { base64FromDataUrl } from "@/lib/image";
import {
  CONDITIONS,
  buildDescription,
  fitTitle,
  mergeResearch,
  sellerFee,
  usd,
  type Condition,
} from "@/lib/listing";
import { cn } from "@/lib/utils";

const STATUSES: { id: ListingStatus; label: string }[] = [
  { id: "ready", label: "Ready" },
  { id: "listed", label: "Listed" },
  { id: "sold", label: "Sold" },
];

export function ListingScreen({ initial }: { initial: SavedListing }) {
  const navigate = useNavigate();
  const [listing, setListing] = useState(initial);
  const [desk, setDesk] = useState(false);
  const [priceText, setPriceText] = useState(initial.askPrice ? String(initial.askPrice) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [soldOpen, setSoldOpen] = useState(false);
  const [soldText, setSoldText] = useState(String(initial.soldPrice ?? initial.askPrice ?? ""));
  const listingRef = useRef(listing);
  const timer = useRef<number | null>(null);
  listingRef.current = listing;

  useEffect(() => {
    return () => {
      if (timer.current) {
        window.clearTimeout(timer.current);
        void saveListing(listingRef.current);
      }
    };
  }, []);

  function commit(patch: Partial<SavedListing>) {
    const next: SavedListing = { ...listingRef.current, ...patch, updatedAt: Date.now() };
    listingRef.current = next;
    setListing(next);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      void saveListing(next).catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Couldn’t save this listing.");
      });
    }, 350);
  }

  function applyPrice(amount: number) {
    const next = Math.max(0, Math.min(20000, Math.round(amount)));
    setPriceText(next ? String(next) : "");
    commit({ askPrice: next });
  }

  function updateDraft(patch: Partial<SavedListing["draft"]>) {
    commit({ draft: { ...listingRef.current.draft, ...patch } });
  }

  async function refreshPrice() {
    setBusy(true);
    setError("");
    const current = listingRef.current;
    const hint = [
      current.draft.brand ? `Brand: ${current.draft.brand}` : "",
      current.draft.size ? `Size: ${current.draft.size}` : "",
      `Condition: ${current.draft.condition}`,
      current.draft.color ? `Color: ${current.draft.color}` : "",
      current.draft.flaws ? `Flaws: ${current.draft.flaws}` : "",
      current.draft.measurements ? `Measurements: ${current.draft.measurements}` : "",
    ]
      .filter(Boolean)
      .join(". ")
      .slice(0, 280);
    try {
      const result = await identifyItem({
        data: { imageBase64: base64FromDataUrl(current.imageDataUrl), mime: "image/jpeg", hint },
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const merged = mergeResearch(listingRef.current.draft, result.draft);
      const ask = merged.priceMarket || merged.priceQuick || listingRef.current.askPrice;
      setPriceText(ask ? String(ask) : "");
      commit({
        draft: merged,
        askPrice: ask,
        citations: result.citations.length > 0 ? result.citations : listingRef.current.citations,
      });
      toast("Price updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t update the price.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    await deleteListing(listing.id);
    await navigate({ to: "/" });
  }

  if (desk) {
    return (
      <PublishDesk
        listing={listing}
        onBack={() => setDesk(false)}
        onPrice={applyPrice}
        onListed={(platform) => commit({ status: "listed", platform })}
      />
    );
  }

  const draft = listing.draft;
  const posh = sellerFee("poshmark", listing.askPrice);
  const title = fitTitle(draft, 80);
  const description = buildDescription(draft, "poshmark");
  const tiers = [
    { id: "quick", label: "Sell fast", amount: draft.priceQuick },
    { id: "market", label: "Fair", amount: draft.priceMarket },
    { id: "patient", label: "Hold", amount: draft.pricePatient },
  ];

  return (
    <Shell
      footer={
        <Button className="w-full" onClick={() => setDesk(true)} disabled={listing.askPrice <= 0}>
          Fill on Poshmark
        </Button>
      }
    >
      <header className="pt-safe flex flex-wrap items-center justify-between gap-3">
        <Link to="/" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft aria-hidden="true" className="size-5" />
          Closet
        </Link>
        <div className="flex rounded-lg bg-subtle p-1">
          {STATUSES.map((status) => (
            <button
              key={status.id}
              type="button"
              aria-pressed={listing.status === status.id}
              className={cn(
                "press h-11 rounded-md px-3 text-sm",
                listing.status === status.id ? "bg-fg text-bg" : "text-muted",
              )}
              onClick={() => {
                if (status.id === "sold") {
                  setSoldText(String(listing.soldPrice ?? listing.askPrice ?? ""));
                  setSoldOpen(true);
                  return;
                }
                setSoldOpen(false);
                commit({ status: status.id, soldPrice: undefined });
              }}
            >
              {status.label}
            </button>
          ))}
        </div>
      </header>

      {soldOpen ? (
        <div className="mt-4 border-y border-line py-4">
          <label className="block text-sm text-muted" htmlFor="sold-price">
            Sold for
          </label>
          <input
            id="sold-price"
            className="field mt-2"
            inputMode="numeric"
            value={soldText}
            onChange={(event) => setSoldText(event.target.value.replace(/[^\d]/g, "").slice(0, 5))}
          />
          <Button
            className="mt-3 w-full"
            onClick={() => {
              const amount = Math.round(Number(soldText));
              if (!Number.isFinite(amount) || amount < 0) return;
              commit({ status: "sold", soldPrice: amount });
              setSoldOpen(false);
            }}
          >
            Save sale
          </Button>
        </div>
      ) : null}

      <div className="mt-4 border border-line bg-elevated">
        <img src={listing.imageDataUrl} alt={draft.whatItIs} className="max-h-80 w-full object-contain" />
      </div>

      <p className="mt-4 text-sm text-muted">{draft.whatItIs}</p>
      <div className="mt-3 grid gap-2">
        <label className="block">
          <span className="text-sm text-muted">Brand</span>
          <input
            className="field mt-1"
            value={draft.brand}
            onChange={(event) =>
              updateDraft({ brand: event.target.value.slice(0, 60), brandConfidence: 1 })
            }
          />
        </label>
        {draft.brandConfidence < 0.55 ? (
          <p className="text-sm text-faint">Brand is a guess. Check the tag before you list.</p>
        ) : null}
        <label className="block">
          <span className="text-sm text-muted">Item</span>
          <input
            className="field mt-1"
            value={draft.itemType}
            onChange={(event) => updateDraft({ itemType: event.target.value.slice(0, 80) })}
          />
        </label>
      </div>

      <section className="mt-6">
        <h2 className="text-sm text-muted">Price</h2>
        <div className="mt-1 flex items-end gap-1">
          <span className="font-display text-4xl leading-none text-accent">$</span>
          <input
            className="price-input"
            inputMode="numeric"
            aria-label="Asking price"
            value={priceText}
            onChange={(event) => {
              const raw = event.target.value.replace(/[^\d]/g, "").slice(0, 5);
              setPriceText(raw);
              commit({ askPrice: raw ? Number(raw) : 0 });
            }}
          />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {tiers.map((tier) => (
            <button
              key={tier.id}
              type="button"
              disabled={!tier.amount}
              aria-pressed={tier.amount > 0 && listing.askPrice === tier.amount}
              className={cn(
                "press min-h-11 rounded-lg px-2 py-2 text-sm",
                tier.amount > 0 && listing.askPrice === tier.amount
                  ? "bg-fg text-bg"
                  : "bg-subtle text-muted",
              )}
              onClick={() => applyPrice(tier.amount)}
            >
              <span className="block">{tier.label}</span>
              <span className="block tabular-nums">{tier.amount ? usd(tier.amount) : "—"}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted tabular-nums">
          {listing.askPrice > 0
            ? `About ${usd(posh.net)} after the Poshmark fee. ${posh.label}.`
            : "Set a price before filling the listing."}
        </p>
        {draft.priceRationale ? <p className="mt-2 text-sm text-faint">{draft.priceRationale}</p> : null}
        {draft.comps.length > 0 ? (
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {draft.comps.map((comp) => (
              <li key={`${comp.label}-${comp.range}`} className="py-3">
                <p className="text-sm text-fg">{comp.label}</p>
                {comp.range ? <p className="text-sm text-muted tabular-nums">{comp.range}</p> : null}
                {comp.note ? <p className="text-sm text-faint">{comp.note}</p> : null}
              </li>
            ))}
          </ul>
        ) : null}
        {listing.citations.length > 0 ? (
          <ul className="mt-3 grid gap-1">
            {listing.citations.map((citation) => (
              <li key={citation.url}>
                <a className="text-sm text-fg underline decoration-line underline-offset-2" href={citation.url} target="_blank" rel="noreferrer">
                  {citation.title}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        <Button className="mt-3" variant="secondary" disabled={busy} onClick={() => void refreshPrice()}>
          {busy ? "Checking sold prices" : "Update the price"}
        </Button>
      </section>

      {draft.notesForSeller ? (
        <p className="mt-4 border-t border-line pt-4 text-sm text-muted">{draft.notesForSeller}</p>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm text-fg" role="alert">
          {error}
        </p>
      ) : null}

      <section className="mt-6 grid gap-3">
        <h2 className="text-sm text-muted">Details</h2>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-sm text-muted">Size</span>
            <input
              className="field mt-1"
              value={draft.size}
              placeholder={draft.sizeConfidence < 0.5 ? "Not on the tag" : ""}
              onChange={(event) => updateDraft({ size: event.target.value.slice(0, 24), sizeConfidence: 1 })}
            />
          </label>
          <label className="block">
            <span className="text-sm text-muted">Color</span>
            <input
              className="field mt-1"
              value={draft.color}
              onChange={(event) => updateDraft({ color: event.target.value.slice(0, 40) })}
            />
          </label>
        </div>
        <label className="block">
          <span className="text-sm text-muted">Material</span>
          <input
            className="field mt-1"
            value={draft.material}
            onChange={(event) => updateDraft({ material: event.target.value.slice(0, 40) })}
          />
        </label>
        <div>
          <p className="text-sm text-muted">Condition</p>
          <div className="mt-2 flex gap-2 overflow-x-auto">
            {CONDITIONS.map((condition) => (
              <button
                key={condition}
                type="button"
                aria-pressed={draft.condition === condition}
                className={cn(
                  "press h-11 shrink-0 rounded-full px-4 text-sm",
                  draft.condition === condition ? "bg-fg text-bg" : "bg-subtle text-muted",
                )}
                onClick={() => updateDraft({ condition: condition as Condition })}
              >
                {condition}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="text-sm text-muted">Measurements</span>
          <input
            className="field mt-1"
            value={draft.measurements}
            placeholder="Pit to pit, length"
            onChange={(event) => updateDraft({ measurements: event.target.value.slice(0, 160) })}
          />
        </label>
        <label className="block">
          <span className="text-sm text-muted">Flaws</span>
          <input
            className="field mt-1"
            value={draft.flaws}
            placeholder="Leave blank if you don’t see any"
            onChange={(event) => updateDraft({ flaws: event.target.value.slice(0, 240) })}
          />
        </label>
        <p className="text-sm text-faint">
          {draft.department}
          {draft.categoryPath ? ` · ${draft.categoryPath}` : ""}
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-sm text-muted">Listing copy</h2>
        <p className="mt-2 text-fg">{title}</p>
        <details className="mt-3 border-t border-line pt-3">
          <summary className="text-sm font-medium text-fg">Description buyers will search</summary>
          <p className="mt-3 whitespace-pre-wrap text-sm text-muted">{description}</p>
        </details>
        {draft.searchPhrases.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
            {draft.searchPhrases.map((phrase) => (
              <li key={phrase} className="text-sm text-muted">
                {phrase}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <div className="mt-8 mb-6">
        {confirmDelete ? (
          <div className="grid gap-2">
            <p className="text-sm text-muted">Remove this from your closet? The photo stays only on this device until you do.</p>
            <Button
              variant="secondary"
              onClick={() => {
                void remove();
              }}
            >
              Remove
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Keep it
            </Button>
          </div>
        ) : (
          <Button variant="quiet" onClick={() => setConfirmDelete(true)}>
            Remove from closet
          </Button>
        )}
      </div>
    </Shell>
  );
}
