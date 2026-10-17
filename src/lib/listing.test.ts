import assert from "node:assert/strict";
import {
  buildPacket,
  fitTitle,
  parseDraft,
  parseModelJson,
  sellerFee,
  usd,
  type ListingDraft,
} from "./listing.ts";

assert.equal(sellerFee("poshmark", 50).net, 40);
assert.equal(sellerFee("poshmark", 10).fee, 2.95);
assert.equal(sellerFee("ebay", 50).net, 42.8);
assert.equal(sellerFee("depop", 50).net, 47.9);
assert.equal(sellerFee("mercari", 50).net, 45);
assert.equal(sellerFee("vinted", 50).net, 50);
assert.equal(sellerFee("facebook", 50).net, 50);
assert.equal(sellerFee("facebook", 50, { shipped: true }).fee, 5);
assert.equal(usd(sellerFee("poshmark", 10).net), "$7.05");

const parsed = parseDraft(
  parseModelJson(
    "```json\n" +
      JSON.stringify({
        itemType: "wool coat",
        brand: "Unbranded",
        priceQuick: 90,
        priceMarket: 40,
        pricePatient: 70,
        conditionGuess: "like new",
        searchPhrases: ["camel coat", "camel coat"],
        hashtags: ["#WoolCoat", "wool coat"],
      }) +
      "\n```",
  ),
);

assert.equal(parsed.priceQuick, 40);
assert.equal(parsed.priceMarket, 70);
assert.equal(parsed.pricePatient, 90);
assert.equal(parsed.condition, "Excellent");
assert.deepEqual(parsed.searchPhrases, ["camel coat"]);
assert.deepEqual(parsed.hashtags, ["#woolcoat"]);

const titled = fitTitle(
  {
    ...parsed,
    brand: "J.Crew",
    itemType: "camel wool coat",
    color: "Camel",
    material: "Wool",
    size: "8",
  } as ListingDraft,
  40,
);
assert.ok(titled.length <= 40, titled);
assert.ok(!/wool wool/i.test(titled), titled);

const packet = buildPacket("mercari", { ...parsed, brand: "J.Crew", size: "M" }, 48);
assert.ok(packet.fields.find((field) => field.id === "title")!.value.length <= 40);
assert.equal(packet.fee.net, 43.2);

console.log("listing checks ok");
