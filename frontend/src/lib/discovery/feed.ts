import type { Catalog, Photo } from "@/types";
import type { SavedKind } from "@/hooks/useSaved";
import { formatINRRange } from "@/utils/format";

export interface FeedTile {
  /** Unique per photo. */
  key: string;
  kind: SavedKind;
  /** Jewellery ID or design public id. */
  id: string;
  title: string;
  href: string;
  price: string;
  photo: Photo;
}

/** One tile per photo of every piece and design, newest item first, each item's photos in their own order. */
export function feedTiles(catalog: Catalog): FeedTile[] {
  const items = [
    ...catalog.pieces.map((p) => ({
      kind: "piece" as const,
      id: p.jewellery_id,
      title: p.title,
      href: `/verify/${p.jewellery_id}`,
      price: formatINRRange(p.price.final_min, p.price.final_max),
      photos: p.photos,
      created_at: p.created_at,
    })),
    ...catalog.designs.map((d) => ({
      kind: "design" as const,
      id: d.public_id,
      title: d.title,
      href: `/designs/${d.public_id}`,
      price: `approx ${formatINRRange(d.price_min, d.price_max)}`,
      photos: d.photos,
      created_at: d.created_at,
    })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return items.flatMap((item) =>
    item.photos.map((photo) => ({
      key: photo.public_id,
      kind: item.kind,
      id: item.id,
      title: item.title,
      href: item.href,
      price: item.price,
      photo,
    })),
  );
}
