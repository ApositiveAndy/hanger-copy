import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Camera, ImagePlus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Shell } from "@/components/shell";
import { listListings, saveListing, subscribeCloset, type SavedListing } from "@/lib/closet";
import { identifyItem } from "@/lib/identify.functions";
import { preparePhoto, type PreparedPhoto } from "@/lib/image";
import { usd } from "@/lib/listing";

type Phase = "idle" | "research" | "error";

export function HomeScreen() {
  const navigate = useNavigate();
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [listings, setListings] = useState<SavedListing[] | null>(null);
  const [hint, setHint] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    let live = true;
    const refresh = () => {
      listListings()
        .then((rows) => {
          if (live) setListings(rows);
        })
        .catch(() => {
          if (live) setListings([]);
        });
    };
    refresh();
    const unsub = subscribeCloset(refresh);
    return () => {
      live = false;
      unsub();
    };
  }, []);

  async function research(nextPhoto: PreparedPhoto, note: string) {
    setPhase("research");
    setError("");
    try {
      const result = await identifyItem({
        data: { imageBase64: nextPhoto.base64, mime: nextPhoto.mime, hint: note },
      });
      if (!result.ok) {
        setError(result.error);
        setPhase("error");
        return;
      }
      const now = Date.now();
      const ask = result.draft.priceMarket || result.draft.priceQuick || result.draft.pricePatient || 0;
      const listing: SavedListing = {
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        imageDataUrl: nextPhoto.dataUrl,
        status: "ready",
        askPrice: ask,
        draft: result.draft,
        citations: result.citations,
      };
      await saveListing(listing);
      setPhase("idle");
      setPhoto(null);
      await navigate({ to: "/listing/$id", params: { id: listing.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try the photo again.");
      setPhase("error");
    }
  }

  async function onFile(file: File | undefined) {
    if (!file || phase === "research") return;
    try {
      const prepared = await preparePhoto(file);
      setPhoto(prepared);
      await research(prepared, hint.trim());
    } catch (err) {
      setPhoto(null);
      setError(err instanceof Error ? err.message : "Couldn’t read that photo.");
      setPhase("error");
    }
  }

  const asking = (listings ?? [])
    .filter((row) => row.status !== "sold")
    .reduce((sum, row) => sum + (row.askPrice || 0), 0);
  const sold = (listings ?? [])
    .filter((row) => row.status === "sold")
    .reduce((sum, row) => sum + (row.soldPrice ?? 0), 0);
  const busy = phase === "research";

  return (
    <Shell>
      <header className="pt-safe flex items-baseline gap-3 border-b border-line pb-5">
        <h1 className="shrink-0 font-display text-4xl leading-none tracking-tight text-fg">Hanger</h1>
        <p className="text-sm text-muted">Sell from a photo.</p>
      </header>

      <section
        className="mt-6"
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          void onFile(event.dataTransfer.files?.[0]);
        }}
      >
        <label className="mb-2 block text-sm text-muted" htmlFor="seller-note">
          Anything the photo might miss
        </label>
        <input
          id="seller-note"
          className="field"
          value={hint}
          maxLength={280}
          disabled={busy}
          placeholder="Size, brand, a stain, men’s"
          onChange={(event) => setHint(event.target.value)}
        />
        <div className={`mt-4 grid gap-2 ${dragOver ? "rounded-2xl outline outline-2 outline-offset-4 outline-fg" : ""}`}>
          <Button disabled={busy} onClick={() => cameraRef.current?.click()}>
            <Camera aria-hidden="true" className="size-5" />
            Take a photo
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => libraryRef.current?.click()}>
            <ImagePlus aria-hidden="true" className="size-5" />
            Choose a photo
          </Button>
        </div>

        {photo ? (
          <img
            src={photo.dataUrl}
            alt="Piece being researched"
            className="mt-4 max-h-80 w-full border border-line bg-elevated object-contain"
          />
        ) : null}

        {busy ? (
          <div className="mt-4" aria-live="polite">
            <div className="research-bar" aria-hidden="true">
              <span />
            </div>
            <p className="mt-3 text-sm text-fg">Researching this piece</p>
            <p className="text-sm text-muted">Checking what similar items sell for. This can take a little while.</p>
          </div>
        ) : null}

        {phase === "error" && error ? (
          <p className="mt-4 text-sm text-fg" role="alert">
            {error}
          </p>
        ) : null}

        {phase === "error" && photo ? (
          <Button className="mt-3 w-full" variant="ghost" onClick={() => void research(photo, hint.trim())}>
            Try this photo again
          </Button>
        ) : null}

        <input
          ref={cameraRef}
          className="sr-only"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => {
            void onFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <input
          ref={libraryRef}
          className="sr-only"
          type="file"
          accept="image/*"
          onChange={(event) => {
            void onFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </section>

      <p className="mt-4 text-sm text-faint">
        Poshmark, eBay, Mercari, Depop, Vinted, Facebook Marketplace, and Grailed. Hanger fills their fields.
        They don’t let another app post into your account, so you paste once.
      </p>

      {listings && listings.length > 0 ? (
        <section className="mt-8 pb-8">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-2xl text-fg">Closet</h2>
            <p className="text-right text-sm text-muted tabular-nums">
              {asking > 0 ? `${usd(asking)} asking` : null}
              {asking > 0 && sold > 0 ? " · " : null}
              {sold > 0 ? `${usd(sold)} sold` : null}
            </p>
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3">
            {listings.map((row) => (
              <li key={row.id} className="min-w-0">
                <Link to="/listing/$id" params={{ id: row.id }} className="block min-w-0">
                  <div className="overflow-hidden border border-line bg-elevated">
                    <img
                      src={row.imageDataUrl}
                      alt=""
                      className="aspect-garment w-full object-cover"
                    />
                  </div>
                  <p className="mt-2 truncate text-sm text-fg">{row.draft.brand}</p>
                  <p className="truncate text-sm text-muted">{row.draft.itemType}</p>
                  <p className="font-display text-xl text-fg tabular-nums">
                    {row.status === "sold" ? usd(row.soldPrice ?? row.askPrice) : usd(row.askPrice)}
                  </p>
                  {row.status !== "ready" ? (
                    <p className="text-sm text-faint">{row.status === "sold" ? "Sold" : "Listed"}</p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="pb-8" />
      )}
    </Shell>
  );
}
