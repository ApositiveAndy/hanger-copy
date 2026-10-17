export const CONDITIONS = [
  "New with tags",
  "New without tags",
  "Excellent",
  "Good",
  "Fair",
] as const;

export type Condition = (typeof CONDITIONS)[number];

export type PlatformId =
  | "poshmark"
  | "ebay"
  | "mercari"
  | "depop"
  | "vinted"
  | "facebook"
  | "grailed";

export type Comp = { label: string; range: string; note: string };

export type Citation = { title: string; url: string };

export type ListingDraft = {
  whatItIs: string;
  itemType: string;
  brand: string;
  brandConfidence: number;
  department: string;
  categoryPath: string;
  color: string;
  material: string;
  pattern: string;
  size: string;
  sizeConfidence: number;
  condition: Condition;
  flaws: string;
  measurements: string;
  era: string;
  retailEstimate: number | null;
  priceQuick: number;
  priceMarket: number;
  pricePatient: number;
  priceRationale: string;
  comps: Comp[];
  confidence: number;
  searchPhrases: string[];
  styleTags: string[];
  details: string;
  hashtags: string[];
  notesForSeller: string;
};

export type FeeQuote = { fee: number; net: number; label: string };

export type PacketField = {
  id: string;
  label: string;
  value: string;
  hint?: string;
  limit?: number;
};

export type Packet = {
  id: PlatformId;
  name: string;
  sellUrl: string;
  fee: FeeQuote;
  fields: PacketField[];
};

export type PlatformMeta = {
  id: PlatformId;
  name: string;
  sellUrl: string;
  titleLimit: number;
  descriptionLimit: number;
};

export const PLATFORMS: PlatformMeta[] = [
  {
    id: "poshmark",
    name: "Poshmark",
    sellUrl: "https://poshmark.com/create-listing",
    titleLimit: 80,
    descriptionLimit: 1500,
  },
  {
    id: "ebay",
    name: "eBay",
    sellUrl: "https://www.ebay.com/sl/sell",
    titleLimit: 80,
    descriptionLimit: 3500,
  },
  {
    id: "mercari",
    name: "Mercari",
    sellUrl: "https://www.mercari.com/sell/",
    titleLimit: 40,
    descriptionLimit: 1000,
  },
  {
    id: "depop",
    name: "Depop",
    sellUrl: "https://www.depop.com/products/create/",
    titleLimit: 80,
    descriptionLimit: 1000,
  },
  {
    id: "vinted",
    name: "Vinted",
    sellUrl: "https://www.vinted.com/items/new",
    titleLimit: 100,
    descriptionLimit: 1500,
  },
  {
    id: "facebook",
    name: "Facebook",
    sellUrl: "https://www.facebook.com/marketplace/create/item",
    titleLimit: 100,
    descriptionLimit: 900,
  },
  {
    id: "grailed",
    name: "Grailed",
    sellUrl: "https://www.grailed.com/sell/new",
    titleLimit: 80,
    descriptionLimit: 2000,
  },
];

const PLATFORM_BY_ID = new Map(PLATFORMS.map((platform) => [platform.id, platform]));

export function platformMeta(id: PlatformId): PlatformMeta {
  const meta = PLATFORM_BY_ID.get(id);
  if (!meta) throw new Error("Unknown marketplace");
  return meta;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function usd(n: number, cents = !Number.isInteger(n)): string {
  const abs = Math.abs(n);
  const body = cents ? abs.toFixed(2) : String(Math.round(abs));
  return `${n < 0 ? "-" : ""}$${body}`;
}

/** Typical US personal-seller fees on the item price only. Shipping, ads, and tax can change the payout. */
export function sellerFee(
  platform: PlatformId,
  price: number,
  opts?: { shipped?: boolean },
): FeeQuote {
  const p = Number.isFinite(price) ? Math.max(0, price) : 0;
  switch (platform) {
    case "poshmark": {
      const fee = p <= 0 ? 0 : p < 15 ? 2.95 : round2(p * 0.2);
      return {
        fee,
        net: round2(p - fee),
        label: p < 15 ? "$2.95 flat under $15" : "20% at $15 and up",
      };
    }
    case "ebay": {
      const perOrder = p <= 10 ? 0.3 : 0.4;
      const fee = round2(p * 0.136 + (p > 0 ? perOrder : 0));
      return {
        fee,
        net: round2(p - fee),
        label: "About 13.6% + $0.40 on the item price",
      };
    }
    case "mercari": {
      const fee = round2(p * 0.1);
      return { fee, net: round2(p - fee), label: "10% of the item price" };
    }
    case "depop": {
      const fee = round2(p * 0.033 + (p > 0 ? 0.45 : 0));
      return {
        fee,
        net: round2(p - fee),
        label: "No selling fee. About 3.3% + $0.45 processing",
      };
    }
    case "vinted":
      return { fee: 0, net: round2(p), label: "No seller fee. Buyer pays protection" };
    case "facebook": {
      if (!opts?.shipped) {
        return { fee: 0, net: round2(p), label: "No fee on local pickup" };
      }
      const fee = p > 0 ? round2(Math.max(0.8, p * 0.1)) : 0;
      return {
        fee,
        net: round2(p - fee),
        label: "About 10% on shipped checkout, $0.80 minimum",
      };
    }
    case "grailed": {
      const fee = round2(p * 0.09 + p * 0.0349 + (p > 0 ? 0.49 : 0));
      return {
        fee,
        net: round2(p - fee),
        label: "About 9% + 3.49% + $0.49",
      };
    }
  }
}

export function bestNetPlatform(
  price: number,
  opts?: { shipped?: boolean },
): PlatformId {
  let best: PlatformId = "vinted";
  let bestNet = -Infinity;
  for (const platform of PLATFORMS) {
    const net = sellerFee(platform.id, price, opts).net;
    if (net > bestNet) {
      bestNet = net;
      best = platform.id;
    }
  }
  return best;
}

function str(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function textBlock(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\r/g, "").trim().slice(0, max);
}

function clamp01(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

function dollars(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  const rounded = Math.round(n);
  if (rounded < 1 || rounded > 20000) return 0;
  return rounded;
}

function conditionOf(value: unknown): Condition {
  const s = str(value, 40).toLowerCase();
  if ((s.includes("new") && s.includes("without")) || s.includes("nwot")) {
    return "New without tags";
  }
  if (s.includes("nwt") || (s.includes("new") && s.includes("tag"))) return "New with tags";
  if (s.includes("excellent") || s.includes("like new") || s.includes("euc")) return "Excellent";
  if (s.includes("fair") || s.includes("poor") || s.includes("worn")) return "Fair";
  if (s.includes("new")) return "New without tags";
  if (s.includes("good")) return "Good";
  return "Good";
}

function phraseList(value: unknown, maxItems: number, maxLen: number): string[] {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,|]/)
      : [];
  const out: string[] = [];
  for (const item of source) {
    const phrase = str(item, maxLen);
    if (phrase.length < 2) continue;
    if (out.some((existing) => existing.toLowerCase() === phrase.toLowerCase())) continue;
    out.push(phrase);
    if (out.length === maxItems) break;
  }
  return out;
}

function hashtagList(value: unknown): string[] {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\s,]+/)
      : [];
  const out: string[] = [];
  for (const item of source) {
    const tag = String(item)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    if (tag.length < 3 || tag.length > 28) continue;
    const hash = `#${tag}`;
    if (out.includes(hash)) continue;
    out.push(hash);
    if (out.length === 12) break;
  }
  return out;
}

export function parseModelJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced?.[1] ?? trimmed).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("The research didn’t come back in a usable form. Try the photo again.");
  }
  try {
    return JSON.parse(body.slice(start, end + 1)) as unknown;
  } catch {
    throw new Error("The research didn’t come back in a usable form. Try the photo again.");
  }
}

export function parseDraft(raw: unknown): ListingDraft {
  if (!raw || typeof raw !== "object") {
    throw new Error("The research didn’t come back in a usable form. Try the photo again.");
  }
  const row = raw as Record<string, unknown>;
  const itemType = str(row.itemType, 80) || str(row.whatItIs, 80);
  if (!itemType) {
    throw new Error("Couldn’t tell what this is. Try a clearer photo of the whole piece.");
  }

  let priceQuick = dollars(row.priceQuick);
  let priceMarket = dollars(row.priceMarket);
  let pricePatient = dollars(row.pricePatient);
  const priced = [priceQuick, priceMarket, pricePatient].filter((n) => n > 0).sort((a, b) => a - b);
  if (priced.length === 3) {
    priceQuick = priced[0] ?? priceQuick;
    priceMarket = priced[1] ?? priceMarket;
    pricePatient = priced[2] ?? pricePatient;
  } else if (priced.length === 1) {
    const only = priced[0] ?? 0;
    priceQuick = Math.max(1, Math.round(only * 0.85));
    priceMarket = only;
    pricePatient = Math.max(only, Math.round(only * 1.15));
  } else if (priced.length === 2) {
    priceQuick = priced[0] ?? priceQuick;
    priceMarket = priced[1] ?? priceMarket;
    pricePatient = Math.max(priceMarket, Math.round(priceMarket * 1.12));
  }

  const compsIn = Array.isArray(row.comps) ? row.comps : [];
  const comps: Comp[] = [];
  for (const comp of compsIn) {
    if (!comp || typeof comp !== "object") continue;
    const c = comp as Record<string, unknown>;
    const label = str(c.label, 80);
    const range = str(c.range, 40);
    if (!label && !range) continue;
    comps.push({ label: label || "Similar pieces", range, note: str(c.note, 120) });
    if (comps.length === 3) break;
  }

  const retail = dollars(row.retailEstimate);
  const brand = str(row.brand, 60) || "Unbranded";
  const notes = textBlock(row.notesForSeller, 320);
  const priceNote =
    priceMarket > 0
      ? ""
      : "Set a price before listing. Similar sold prices weren’t clear from this photo.";

  return {
    whatItIs: str(row.whatItIs, 140) || itemType,
    itemType,
    brand,
    brandConfidence: clamp01(row.brandConfidence, brand.toLowerCase() === "unbranded" ? 0.2 : 0.5),
    department: str(row.department, 24) || "Unisex",
    categoryPath: str(row.categoryPath, 80) || itemType,
    color: str(row.color, 40),
    material: str(row.material, 40),
    pattern: str(row.pattern, 40) || "Solid",
    size: str(row.size, 24),
    sizeConfidence: clamp01(row.sizeConfidence, 0.2),
    condition: conditionOf(row.conditionGuess ?? row.condition),
    flaws: textBlock(row.flaws, 240),
    measurements: str(row.measurements, 160),
    era: str(row.era, 40),
    retailEstimate: retail > 0 ? retail : null,
    priceQuick,
    priceMarket,
    pricePatient,
    priceRationale: textBlock(row.priceRationale, 420),
    comps,
    confidence: clamp01(row.confidence, 0.45),
    searchPhrases: phraseList(row.searchPhrases, 8, 42),
    styleTags: phraseList(row.styleTags, 3, 28),
    details: textBlock(row.details, 700),
    hashtags: hashtagList(row.hashtags),
    notesForSeller: [notes, priceNote].filter(Boolean).join(" "),
  };
}

export function mergeResearch(previous: ListingDraft, next: ListingDraft): ListingDraft {
  return {
    ...next,
    brand: previous.brand,
    brandConfidence: previous.brandConfidence,
    size: previous.size,
    sizeConfidence: previous.size ? 1 : next.sizeConfidence,
    condition: previous.condition,
    color: previous.color || next.color,
    material: previous.material || next.material,
    measurements: previous.measurements,
    flaws: previous.flaws,
  };
}

export function fitTitle(draft: ListingDraft, limit: number): string {
  const brand = draft.brand && draft.brand.toLowerCase() !== "unbranded" ? draft.brand : "";
  const size = draft.size ? `Sz ${draft.size}` : "";
  const pattern = draft.pattern && draft.pattern.toLowerCase() !== "solid" ? draft.pattern : "";
  const chunks = [brand, draft.color, draft.itemType, size, draft.material, pattern];
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const chunk of chunks) {
    if (!chunk) continue;
    const fresh: string[] = [];
    for (const word of chunk.split(/\s+/)) {
      const key = word.toLowerCase().replace(/[^a-z0-9]+/g, "");
      if (!key || seen.has(key)) continue;
      if (key.length < 3 && key !== "sz" && !/^\d/.test(key)) continue;
      seen.add(key);
      fresh.push(word);
    }
    if (fresh.length === 0) continue;
    const next = parts.length ? `${parts.join(" ")} ${fresh.join(" ")}` : fresh.join(" ");
    if (next.length <= limit) parts.push(fresh.join(" "));
  }
  let title = parts.join(" ").replace(/\s+/g, " ").trim();
  if (!title) title = draft.itemType || "Clothing";
  if (title.length <= limit) return title;
  const cut = title.slice(0, limit + 1);
  const space = cut.lastIndexOf(" ");
  return (space > 12 ? cut.slice(0, space) : title.slice(0, limit)).trim();
}

function clip(text: string, max: number): string {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, Math.max(0, max - 1));
  const breakAt = Math.max(slice.lastIndexOf("\n"), slice.lastIndexOf(" "));
  const base = breakAt > max * 0.6 ? slice.slice(0, breakAt) : slice;
  return `${base.trimEnd()}…`;
}

function leadLine(draft: ListingDraft): string {
  const brand =
    draft.brand && draft.brand.toLowerCase() !== "unbranded" ? `${draft.brand} ` : "";
  const bits = [`${brand}${draft.itemType}`.trim()];
  if (draft.color) bits.push(draft.color.toLowerCase());
  if (draft.material && !draft.itemType.toLowerCase().includes(draft.material.toLowerCase())) {
    bits.push(draft.material.toLowerCase());
  }
  let line = bits.join(", ");
  if (draft.size) line += `, size ${draft.size}`;
  line = line.replace(/\s+/g, " ").trim();
  if (!line.endsWith(".")) line += ".";
  return `${line} ${draft.condition}.`;
}

export function buildDescription(draft: ListingDraft, platform: PlatformId): string {
  const meta = platformMeta(platform);
  const lines: string[] = [leadLine(draft)];
  if (draft.details) lines.push("", draft.details);
  if (
    draft.retailEstimate &&
    draft.brandConfidence >= 0.6 &&
    draft.retailEstimate > (draft.pricePatient || draft.priceMarket || 0)
  ) {
    lines.push("", `Similar styles have retailed around ${usd(draft.retailEstimate)}.`);
  }
  lines.push("", "Details");
  const facts: [string, string][] = [
    ["Brand", draft.brand || "Unbranded"],
    ["Size", draft.size || "See photos"],
    ["Color", draft.color],
    ["Material", draft.material],
    ["Pattern", draft.pattern && draft.pattern.toLowerCase() !== "solid" ? draft.pattern : ""],
    ["Department", draft.department],
    ["Condition", conditionLabel(platform, draft.condition)],
  ];
  if (draft.measurements) facts.push(["Measurements", draft.measurements]);
  if (draft.era) facts.push(["Era", draft.era]);
  for (const [label, value] of facts) {
    if (value) lines.push(`${label}: ${value}`);
  }
  if (draft.flaws) lines.push("", `Notes: ${draft.flaws}`);
  else lines.push("", "No flaws called out. The photos show the actual item.");
  if (draft.searchPhrases.length > 0) lines.push("", draft.searchPhrases.join(" · "));
  const withTags = platform === "poshmark" || platform === "depop";
  if (withTags && draft.hashtags.length > 0) {
    const count = platform === "depop" ? 5 : 10;
    lines.push("", draft.hashtags.slice(0, count).join(" "));
  }
  return clip(lines.join("\n"), meta.descriptionLimit);
}

export function conditionLabel(platform: PlatformId, condition: Condition): string {
  if (platform === "ebay") {
    if (condition === "New with tags") return "New with tags";
    if (condition === "New without tags") return "New without tags";
    return `Pre-owned — ${condition}`;
  }
  if (platform === "mercari") {
    if (condition === "New with tags" || condition === "New without tags") return "New";
    if (condition === "Excellent") return "Like new";
    return condition;
  }
  if (platform === "poshmark") {
    if (condition === "New with tags") return "NWT";
    if (condition === "New without tags") return "NWOT";
    return condition;
  }
  if (platform === "depop") {
    if (condition === "New with tags") return "Brand new";
    if (condition === "New without tags") return "Like new";
    if (condition === "Excellent") return "Used — excellent";
    if (condition === "Good") return "Used — good";
    return "Used — fair";
  }
  return condition;
}

function specifics(draft: ListingDraft, platform: PlatformId): string {
  const rows: [string, string][] = [
    ["Brand", draft.brand],
    ["Size", draft.size || "See photos"],
    ["Color", draft.color],
    ["Material", draft.material],
    ["Department", draft.department],
    ["Condition", conditionLabel(platform, draft.condition)],
  ];
  if (draft.measurements) rows.push(["Measurements", draft.measurements]);
  return rows
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}

function field(
  id: string,
  label: string,
  value: string,
  extra?: { hint?: string; limit?: number },
): PacketField {
  return { id, label, value: value.trim(), hint: extra?.hint, limit: extra?.limit };
}

export function buildPacket(
  platform: PlatformId,
  draft: ListingDraft,
  price: number,
  opts?: { shipped?: boolean },
): Packet {
  const meta = platformMeta(platform);
  const title = fitTitle(draft, meta.titleLimit);
  const description = buildDescription(draft, platform);
  const priceValue = usd(Math.max(0, Math.round(price)));
  const condition = conditionLabel(platform, draft.condition);
  const categoryHint = "Match the closest category in their list.";
  const conditionHint = "Match this in their condition menu.";
  const fee = sellerFee(platform, price, opts);

  let fields: PacketField[] = [];
  if (platform === "poshmark") {
    fields = [
      field("title", "Title", title, { limit: meta.titleLimit }),
      field("description", "Description", description, { limit: meta.descriptionLimit }),
      field("brand", "Brand", draft.brand),
      field("size", "Size", draft.size || "See photos"),
      field("color", "Color", draft.color),
      field("condition", "Condition", condition, { hint: conditionHint }),
      field("category", "Category", draft.categoryPath, { hint: categoryHint }),
      field("price", "Price", priceValue),
      field("tags", "Style tags", draft.styleTags.join("\n") || draft.searchPhrases.slice(0, 3).join("\n"), {
        hint: "Poshmark uses its own tag list. Pick the closest three.",
      }),
    ];
  } else if (platform === "ebay") {
    fields = [
      field("title", "Title", title, { limit: meta.titleLimit, hint: "80 characters. Keywords first." }),
      field("condition", "Condition", condition, { hint: conditionHint }),
      field("category", "Category", draft.categoryPath, { hint: categoryHint }),
      field("specifics", "Item specifics", specifics(draft, platform)),
      field("description", "Description", description, { limit: meta.descriptionLimit }),
      field("price", "Price", priceValue),
    ];
  } else if (platform === "mercari") {
    fields = [
      field("title", "Title", title, { limit: meta.titleLimit, hint: "Mercari titles stay short." }),
      field("description", "Description", description, { limit: meta.descriptionLimit }),
      field("brand", "Brand", draft.brand),
      field("size", "Size", draft.size || "See photos"),
      field("condition", "Condition", condition, { hint: conditionHint }),
      field("price", "Price", priceValue),
    ];
  } else if (platform === "depop") {
    fields = [
      field("description", "Description", description, {
        limit: meta.descriptionLimit,
        hint: "Depop search reads the description. Hashtags are at the bottom.",
      }),
      field("price", "Price", priceValue),
      field("brand", "Brand", draft.brand),
      field("size", "Size", draft.size || "See photos"),
      field("condition", "Condition", condition, { hint: conditionHint }),
    ];
  } else if (platform === "vinted") {
    fields = [
      field("title", "Title", title, { limit: meta.titleLimit }),
      field("description", "Description", description, { limit: meta.descriptionLimit }),
      field("brand", "Brand", draft.brand),
      field("size", "Size", draft.size || "See photos"),
      field("category", "Category", draft.categoryPath, { hint: categoryHint }),
      field("condition", "Condition", condition, { hint: conditionHint }),
      field("price", "Price", priceValue),
    ];
  } else if (platform === "facebook") {
    fields = [
      field("title", "Title", title, { limit: meta.titleLimit }),
      field("price", "Price", priceValue),
      field("description", "Description", description, { limit: meta.descriptionLimit }),
      field("condition", "Condition", condition, { hint: conditionHint }),
      field("category", "Category", draft.categoryPath, { hint: categoryHint }),
    ];
  } else {
    fields = [
      field("designer", "Designer", draft.brand),
      field("category", "Category", draft.categoryPath, { hint: categoryHint }),
      field("size", "Size", draft.size || "See photos"),
      field("condition", "Condition", condition, { hint: conditionHint }),
      field("description", "Description", description, { limit: meta.descriptionLimit }),
      field("price", "Price", priceValue),
    ];
  }

  return {
    id: platform,
    name: meta.name,
    sellUrl: meta.sellUrl,
    fee,
    fields: fields.filter((item) => item.value.length > 0),
  };
}

export function packetPlainText(packet: Packet): string {
  return packet.fields.map((item) => `${item.label.toUpperCase()}\n${item.value}`).join("\n\n");
}
