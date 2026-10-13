import { ImageOff } from "lucide-react";
import { Link } from "react-router-dom";
import { formatKm } from "@/lib/discovery/distance";
import { photoService } from "@/services/photos";
import { STOCK_LABEL, type PieceCard } from "@/types";
import { formatINRRange, formatWeight } from "@/utils/format";

/** A piece in a list. Links by Jewellery ID, so the QR token never appears in a list. */
export function PieceTile({ piece, distanceKm }: { piece: PieceCard; distanceKm?: number | null }) {
  const { cover, price } = piece;
  return (
    <Link to={`/verify/${piece.jewellery_id}`} className="group block min-w-0">
      <div className="relative overflow-hidden rounded-md border border-line bg-canvas">
        {cover ? (
          <img
            src={photoService.url(cover.public_id, "thumb")}
            alt={cover.alt}
            width={cover.width}
            height={cover.height}
            loading="lazy"
            decoding="async"
            className="aspect-[3/4] w-full object-cover transition-transform duration-500 ease-out-soft group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid aspect-[3/4] place-items-center text-muted">
            <ImageOff className="size-6" strokeWidth={1.5} aria-hidden />
          </div>
        )}
        {piece.stock_status !== "in_stock" && (
          <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-xs font-semibold text-ink">
            {STOCK_LABEL[piece.stock_status]}
          </span>
        )}
      </div>
      <p className="mt-2 truncate text-[15px] font-medium text-ink group-hover:underline">{piece.title}</p>
      <p className="text-[13px] text-muted">
        {piece.purity} · {formatWeight(piece.net_weight)}
      </p>
      {distanceKm != null && <p className="text-[13px] text-muted">{formatKm(distanceKm)} away</p>}
      <p className="tabular mt-1 text-[15px] font-semibold text-ink">{formatINRRange(price.final_min, price.final_max)}</p>
      {price.discount_label && (
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px]">
          <s className="tabular text-muted">{formatINRRange(price.original_min, price.original_max)}</s>
          <span className="rounded-full bg-gold-bright/20 px-1.5 text-[11px] font-semibold text-gold-deep">{price.discount_label}</span>
        </p>
      )}
    </Link>
  );
}
