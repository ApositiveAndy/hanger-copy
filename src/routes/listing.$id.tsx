import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ListingScreen } from "@/components/listing-screen";
import { Shell } from "@/components/shell";
import { getListing, type SavedListing } from "@/lib/closet";

export const Route = createFileRoute("/listing/$id")({
  component: ListingRoute,
});

function ListingRoute() {
  const { id } = Route.useParams();
  const [listing, setListing] = useState<SavedListing | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    setListing(undefined);
    getListing(id)
      .then((row) => {
        if (live) setListing(row);
      })
      .catch(() => {
        if (live) setListing(null);
      });
    return () => {
      live = false;
    };
  }, [id]);

  if (listing === undefined) {
    return (
      <Shell>
        <p className="pt-safe text-muted">Opening the listing…</p>
      </Shell>
    );
  }

  if (!listing) {
    return (
      <Shell>
        <div className="pt-safe">
          <h1 className="font-display text-3xl text-fg">Not in your closet</h1>
          <p className="mt-2 text-muted">That listing isn’t on this device.</p>
          <Link to="/" className="mt-6 inline-flex h-12 items-center text-fg underline">
            Back to Hanger
          </Link>
        </div>
      </Shell>
    );
  }

  return <ListingScreen key={listing.id} initial={listing} />;
}
