import { ImageOff } from "lucide-react";
import { Link } from "react-router-dom";
import { photoService } from "@/services/photos";
import type { DesignCard } from "@/types";
import { formatINRRange, formatWeightRange } from "@/utils/format";

/** A made-to-order design in a list: always "approx", never a badge or a Jewellery ID. */
export function DesignTile({ design }: { design: DesignCard }) {
  const { cover } = design;
  return (
    <Link to={`/designs/${design.public_id}`} className="group block min-w-0">
      <div className="relative overflow-hidden rounded-md border border-line bg-chalk">
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
        <span className="absolute left-2 top-2 rounded-full bg-basalt/90 px-2 py-0.5 text-xs font-semibold text-chalk">
          Made to order
        </span>
      </div>
      <p className="mt-2 truncate text-[15px] font-medium text-ink group-hover:underline">{design.title}</p>
      <p className="text-[13px] text-muted">
        {design.purity_options.join(" / ")} · approx {formatWeightRange(design.weight_min, design.weight_max)}
      </p>
      <p className="tabular mt-1 text-[15px] font-semibold text-ink">
        approx {formatINRRange(design.price_min, design.price_max)}
      </p>
    </Link>
  );
}
