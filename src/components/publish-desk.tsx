import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, Copy, ExternalLink, Share2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Shell } from "@/components/shell";
import { copyText } from "@/lib/clipboard";
import type { SavedListing } from "@/lib/closet";
import { dataUrlToFile } from "@/lib/image";
import {
  PLATFORMS,
  bestNetPlatform,
  buildPacket,
  packetPlainText,
  usd,
  type PlatformId,
} from "@/lib/listing";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "hanger-platform";

export function PublishDesk({
  listing,
  onBack,
  onPrice,
  onListed,
}: {
  listing: SavedListing;
  onBack: () => void;
  onPrice: (amount: number) => void;
  onListed: (platform: PlatformId) => void;
}) {
  const [platform, setPlatform] = useState<PlatformId>("poshmark");
  const [shipped, setShipped] = useState(false);
  const [step, setStep] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [priceText, setPriceText] = useState(String(listing.askPrice || ""));

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (PLATFORMS.some((item) => item.id === saved)) setPlatform(saved as PlatformId);
  }, []);

  useEffect(() => {
    setPriceText(String(listing.askPrice || ""));
  }, [listing.askPrice]);

  const packet = useMemo(
    () => buildPacket(platform, listing.draft, listing.askPrice, { shipped }),
    [platform, listing.draft, listing.askPrice, shipped],
  );
  const best = bestNetPlatform(listing.askPrice, { shipped: platform === "facebook" ? shipped : false });
  const safeStep = Math.min(step, Math.max(0, packet.fields.length - 1));
  const current = packet.fields[safeStep];

  function choosePlatform(id: PlatformId) {
    setPlatform(id);
    setStep(0);
    setCopiedId(null);
    localStorage.setItem(STORAGE_KEY, id);
  }

  async function copyField(id: string, label: string, value: string, index: number) {
    const ok = await copyText(value);
    if (!ok) {
      toast("Couldn’t copy. Select the text and copy it.");
      return;
    }
    setCopiedId(id);
    toast(`${label} copied`);
    if (index < packet.fields.length - 1) setStep(index + 1);
  }

  async function copyAll() {
    const ok = await copyText(packetPlainText(packet));
    toast(ok ? "Every field copied" : "Couldn’t copy. Try one field at a time.");
  }

  function openSite() {
    window.open(packet.sellUrl, "_blank", "noopener,noreferrer");
  }

  async function shareListing() {
    const title = packet.fields.find((item) => item.id === "title" || item.id === "description")?.value ?? listing.draft.itemType;
    const text = packetPlainText(packet);
    try {
      const file = await dataUrlToFile(listing.imageDataUrl, "hanger-listing.jpg");
      const payload: ShareData = { title: title.slice(0, 80), text, files: [file] };
      if (navigator.canShare?.(payload)) {
        await navigator.share(payload);
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: title.slice(0, 80), text });
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
    await copyAll();
  }

  return (
    <Shell
      footer={
        <div className="grid gap-2">
          {current ? (
            <Button onClick={() => void copyField(current.id, current.label, current.value, safeStep)}>
              {copiedId === current.id ? <Check aria-hidden="true" className="size-5" /> : <Copy aria-hidden="true" className="size-5" />}
              {copiedId === current.id ? `${current.label} copied` : `Copy ${current.label.toLowerCase()}`}
            </Button>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={openSite}>
              <ExternalLink aria-hidden="true" className="size-4" />
              Open {packet.name}
            </Button>
            <Button variant="secondary" onClick={() => void shareListing()}>
              <Share2 aria-hidden="true" className="size-4" />
              Share
            </Button>
          </div>
        </div>
      }
    >
      <header className="pt-safe flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back to listing">
          <ArrowLeft aria-hidden="true" className="size-5" />
          Listing
        </Button>
      </header>

      <h1 className="mt-2 font-display text-3xl tracking-tight text-fg">Fill on {packet.name}</h1>
      <p className="mt-2 text-sm text-muted">
        {packet.name} won’t take a listing from another app. Copy each field, in order, into their form. The photo
        stays on this screen so you can upload it there.
      </p>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {PLATFORMS.map((item) => {
          const selected = item.id === platform;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={selected}
              onClick={() => choosePlatform(item.id)}
              className={cn(
                "press h-11 shrink-0 rounded-full px-4 text-sm",
                selected ? "bg-fg text-bg" : "bg-subtle text-muted",
              )}
            >
              {item.name}
            </button>
          );
        })}
      </div>

      <div className="mt-4 border-y border-line py-4">
        <div className="flex items-end justify-between gap-3">
          <label className="block">
            <span className="text-sm text-muted">Asking price</span>
            <span className="mt-1 flex items-center gap-2">
              <span className="text-fg">$</span>
              <input
                className="field"
                inputMode="numeric"
                aria-label="Asking price"
                value={priceText}
                onChange={(event) => {
                  const raw = event.target.value.replace(/[^\d]/g, "").slice(0, 5);
                  setPriceText(raw);
                  onPrice(raw ? Number(raw) : 0);
                }}
              />
            </span>
          </label>
          <p className="text-right">
            <span className="block text-sm text-muted">You keep</span>
            <span className="font-display text-2xl text-fg tabular-nums">{usd(packet.fee.net)}</span>
          </p>
        </div>
        <p className="mt-2 text-sm text-faint">
          {packet.fee.label}
          {best === platform && listing.askPrice > 0 ? " · Keeps the most of these sites" : ""}
        </p>
        {platform === "facebook" ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={!shipped}
              className={cn("press h-11 rounded-lg text-sm", !shipped ? "bg-fg text-bg" : "bg-subtle text-muted")}
              onClick={() => setShipped(false)}
            >
              Local pickup
            </button>
            <button
              type="button"
              aria-pressed={shipped}
              className={cn("press h-11 rounded-lg text-sm", shipped ? "bg-fg text-bg" : "bg-subtle text-muted")}
              onClick={() => setShipped(true)}
            >
              Shipped
            </button>
          </div>
        ) : null}
      </div>

      <p className="mt-3 text-sm text-faint">
        Fees are typical US personal-seller rates on the item price. Shipping you pay, ads, and tax can change the
        payout.
      </p>

      <img
        src={listing.imageDataUrl}
        alt=""
        className="mt-4 max-h-64 w-full border border-line bg-elevated object-contain"
      />
      <a className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mt-2 w-full")} href={listing.imageDataUrl} download="hanger-listing.jpg">
        Save photo
      </a>

      <ol className="mt-5 grid gap-2 pb-4">
        {packet.fields.map((item, index) => {
          const active = index === safeStep;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => void copyField(item.id, item.label, item.value, index)}
                className={cn(
                  "press w-full rounded-xl border px-3 py-3 text-left",
                  active ? "border-fg bg-subtle" : "border-line bg-elevated",
                )}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-sm text-muted">
                      {index + 1}. {item.label}
                      {item.limit ? <span className="tabular-nums"> · {item.value.length}/{item.limit}</span> : null}
                    </span>
                    <span className="mt-1 block whitespace-pre-wrap text-sm text-fg line-clamp-3">{item.value}</span>
                  </span>
                  {copiedId === item.id ? (
                    <Check aria-hidden="true" className="mt-1 size-4 shrink-0" />
                  ) : (
                    <Copy aria-hidden="true" className="mt-1 size-4 shrink-0 text-muted" />
                  )}
                </span>
              </button>
              {item.hint ? <p className="px-3 pt-1 text-sm text-faint">{item.hint}</p> : null}
            </li>
          );
        })}
      </ol>

      <div className="mb-4 grid gap-2">
        <Button variant="ghost" onClick={() => void copyAll()}>
          Copy every field
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            onListed(platform);
            toast(`Marked listed on ${packet.name}`);
          }}
        >
          Mark listed on {packet.name}
        </Button>
      </div>
    </Shell>
  );
}
