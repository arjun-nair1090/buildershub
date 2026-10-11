import { Clock, MapPin, MessageCircle, Navigation, Phone } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { DesignTile } from "@/components/public/DesignTile";
import { Gallery } from "@/components/public/Gallery";
import { PieceTile } from "@/components/public/PieceTile";
import { Unavailable } from "@/components/public/Unavailable";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicRecord } from "@/hooks/usePublicRecord";
import { publicService } from "@/services/public";
import type { PublicStore } from "@/types";
import { cn } from "@/utils/cn";

const directionsUrl = (s: PublicStore) =>
  `https://www.google.com/maps/dir/?api=1&destination=${Number(s.latitude)},${Number(s.longitude)}`;

/** OpenStreetMap's own embed: free, no key. The box is about 1 km across, centred on the pin. */
function mapEmbedUrl(s: PublicStore): string {
  const lat = Number(s.latitude);
  const lng = Number(s.longitude);
  const bbox = [lng - 0.006, lat - 0.004, lng + 0.006, lat + 0.004].map((n) => n.toFixed(6)).join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
}

function ContactLink({ href, icon, children, primary }: { href: string; icon: ReactNode; children: ReactNode; primary?: boolean }) {
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className={cn(buttonVariants({ variant: primary ? "primary" : "secondary", size: "md" }), "flex-1")}
    >
      {icon}
      {children}
    </a>
  );
}

function VisitPanel({ store }: { store: PublicStore }) {
  return (
    <div className="rounded-lg border border-line bg-white p-5 sm:p-6">
      <h2 className="text-[13px] font-semibold text-gold-deep">Visit the store</h2>
      <p className="mt-3 flex gap-2.5 text-[15px] leading-relaxed text-ink">
        <MapPin className="mt-1 size-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
        {store.address}
      </p>
      <p className="mt-2 flex gap-2.5 text-[15px] leading-relaxed text-ink">
        <Clock className="mt-1 size-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
        {store.hours}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {store.phone && (
          <ContactLink href={`tel:${store.phone}`} icon={<Phone />} primary>
            Call
          </ContactLink>
        )}
        {store.whatsapp && (
          <ContactLink href={`https://wa.me/${store.whatsapp.replace(/\D/g, "")}`} icon={<MessageCircle />}>
            WhatsApp
          </ContactLink>
        )}
        <ContactLink href={directionsUrl(store)} icon={<Navigation />} primary={!store.phone}>
          Directions
        </ContactLink>
      </div>
      <div className="mt-5 overflow-hidden rounded-md border border-line">
        <iframe
          title={`Map showing ${store.name}`}
          src={mapEmbedUrl(store)}
          loading="lazy"
          className="block aspect-[4/3] w-full"
        />
      </div>
    </div>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">{children}</div>;
}

function StoreView({ store }: { store: PublicStore }) {
  const hasPhotos = store.photos.length > 0;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="rise">
        <p className="text-[13px] font-semibold text-gold-deep">Jewellery store</p>
        <h1 className="mt-1 break-words font-display text-[34px] leading-tight text-ink sm:text-[44px]">{store.name}</h1>
        <p className="mt-1 text-[15px] text-muted">
          {store.area}, {store.city}
        </p>
      </header>

      <div className={cn("rise mt-6 grid gap-6", hasPhotos ? "lg:grid-cols-[1fr_400px] lg:items-start" : "max-w-xl")}>
        {hasPhotos && <Gallery photos={store.photos} sizes="(min-width: 1024px) 680px, 100vw" />}
        <VisitPanel store={store} />
      </div>

      {store.pieces.length > 0 && (
        <section className="mt-12" aria-labelledby="pieces-heading">
          <h2 id="pieces-heading" className="font-display text-[26px] leading-tight text-ink">Pieces</h2>
          <Grid>
            {store.pieces.map((piece) => (
              <PieceTile key={piece.jewellery_id} piece={piece} />
            ))}
          </Grid>
        </section>
      )}

      {store.designs.length > 0 && (
        <section className="mt-12" aria-labelledby="designs-heading">
          <h2 id="designs-heading" className="font-display text-[26px] leading-tight text-ink">Made to order</h2>
          <p className="mt-1 text-sm text-muted">Approximate prices. Final price agreed with the store.</p>
          <Grid>
            {store.designs.map((design) => (
              <DesignTile key={design.public_id} design={design} />
            ))}
          </Grid>
        </section>
      )}

      {store.pieces.length === 0 && store.designs.length === 0 && (
        <p className="mt-12 text-[15px] text-muted">No pieces listed yet.</p>
      )}
    </div>
  );
}

function StoreSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-8 sm:px-6 sm:py-12" role="status" aria-label="Loading the store">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-6 h-64 w-full max-w-xl" />
    </div>
  );
}

export function StorePage() {
  const { slug = "" } = useParams();
  const { state, retry } = usePublicRecord(slug, (signal) => publicService.store(slug, signal));

  useEffect(() => {
    document.title = state.kind === "found" ? `${state.data.name}, ${state.data.area}` : "Store";
  }, [state]);

  switch (state.kind) {
    case "loading":
      return <StoreSkeleton />;
    case "found":
      return <StoreView store={state.data} />;
    case "not-found":
      return <Unavailable title="Store not found" body="There's no store at this address. Check the link and try again." />;
    case "gone":
      return <Unavailable title="This store is no longer listed" body="The store has been taken off Jewlerify, so its details aren't shown." />;
    case "error":
      return <Unavailable title="The store could not be loaded" body={state.message} onRetry={retry} />;
  }
}
