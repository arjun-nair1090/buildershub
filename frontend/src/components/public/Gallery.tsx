import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { photoService } from "@/services/photos";
import type { Photo } from "@/types";
import { cn } from "@/utils/cn";

interface GalleryProps {
  photos: Photo[];
  /** How wide a slide is on screen, so the browser picks the 600 or 1600 px image. */
  sizes?: string;
  className?: string;
}

/** Swipeable photos. CSS scroll-snap does the swiping; buttons, dots and arrow keys step through on desktop. */
export function Gallery({ photos, sizes = "(min-width: 1024px) 560px, 100vw", className }: GalleryProps) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  if (photos.length === 0) return null;
  const many = photos.length > 1;

  const go = (i: number) => {
    const el = track.current;
    if (!el) return;
    const next = Math.max(0, Math.min(photos.length - 1, i));
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  };
  const onScroll = () => {
    const el = track.current;
    if (el && el.clientWidth) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      go(index + (e.key === "ArrowRight" ? 1 : -1));
    }
  };

  return (
    <div className={cn("relative", className)} role="region" aria-roledescription="carousel" aria-label="Photos">
      <div
        ref={track}
        onScroll={onScroll}
        onKeyDown={many ? onKeyDown : undefined}
        tabIndex={many ? 0 : undefined}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-md border border-line bg-chalk [scrollbar-width:none] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold [&::-webkit-scrollbar]:hidden"
      >
        {photos.map((photo, i) => (
          <div
            key={photo.public_id}
            className="w-full shrink-0 snap-center"
            role="group"
            aria-roledescription="slide"
            aria-label={`Photo ${i + 1} of ${photos.length}`}
          >
            <img
              src={photoService.url(photo.public_id, "thumb")}
              srcSet={`${photoService.url(photo.public_id, "thumb")} 600w, ${photoService.url(photo.public_id, "full")} 1600w`}
              sizes={sizes}
              alt={photo.alt}
              width={photo.width}
              height={photo.height}
              loading={i === 0 ? "eager" : "lazy"}
              decoding="async"
              draggable={false}
              className="aspect-[4/5] w-full object-contain"
            />
          </div>
        ))}
      </div>

      {many && (
        <>
          {(["prev", "next"] as const).map((dir) => {
            const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
            const disabled = dir === "prev" ? index === 0 : index === photos.length - 1;
            return (
              <button
                key={dir}
                type="button"
                onClick={() => go(index + (dir === "prev" ? -1 : 1))}
                disabled={disabled}
                aria-label={dir === "prev" ? "Previous photo" : "Next photo"}
                className={cn(
                  "absolute top-1/2 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow-md transition-opacity hover:bg-white disabled:opacity-0 sm:grid",
                  dir === "prev" ? "left-3" : "right-3",
                )}
              >
                <Icon className="size-5" strokeWidth={1.75} />
              </button>
            );
          })}
          <div className="mt-1.5 flex justify-center">
            {photos.map((photo, i) => (
              <button
                key={photo.public_id}
                type="button"
                onClick={() => go(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === index}
                className="grid h-6 min-w-6 place-items-center px-0.5"
              >
                {/* the visible dot is small; the button around it is a full 24 px target */}
                <span className={cn("h-1.5 rounded-full transition-all", i === index ? "w-5 bg-gold-deep" : "w-1.5 bg-line-strong")} />
              </button>
            ))}
          </div>
          <p className="sr-only" aria-live="polite">
            Photo {index + 1} of {photos.length}
          </p>
        </>
      )}
    </div>
  );
}
