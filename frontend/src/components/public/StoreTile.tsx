import { Store } from "lucide-react";
import { Link } from "react-router-dom";
import { formatKm } from "@/lib/discovery/distance";
import { photoService } from "@/services/photos";
import type { CatalogStore } from "@/types";

const count = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

export function StoreTile({ store, distanceKm }: { store: CatalogStore; distanceKm?: number | null }) {
  const { cover } = store;
  return (
    <Link to={`/stores/${store.slug}`} className="group block min-w-0">
      <div className="overflow-hidden rounded-md border border-line bg-chalk">
        {cover ? (
          <img
            src={photoService.url(cover.public_id, "thumb")}
            alt=""
            width={cover.width}
            height={cover.height}
            loading="lazy"
            decoding="async"
            className="aspect-[4/3] w-full object-cover transition-transform duration-500 ease-out-soft group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid aspect-[4/3] place-items-center text-muted">
            <Store className="size-6" strokeWidth={1.5} aria-hidden />
          </div>
        )}
      </div>
      <p className="mt-2 truncate text-[15px] font-medium text-ink group-hover:underline">{store.name}</p>
      <p className="truncate text-[13px] text-muted">
        {store.area}, {store.city}
      </p>
      <p className="text-[13px] text-muted">
        {count(store.piece_count, "piece")}
        {store.design_count > 0 && ` · ${count(store.design_count, "design")}`}
        {distanceKm != null && ` · ${formatKm(distanceKm)}`}
      </p>
    </Link>
  );
}
