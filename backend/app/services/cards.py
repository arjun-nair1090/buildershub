"""The shapes buyers see in lists: a store's pieces and designs, similar pieces, and later search."""
from app.models import Design, Jewellery
from app.schemas import CardPrice, DesignCard, PieceCard, PiecePrice
from app.services.photos import photo_out
from app.services.pricing import PricingContext, piece_price


def price_now(piece: Jewellery, ctx: PricingContext) -> PiecePrice:
    return piece_price(piece, ctx.rate, ctx.gst_percent, ctx.today)


def piece_card(piece: Jewellery, price: PiecePrice) -> PieceCard:
    return PieceCard(
        jewellery_id=piece.jewellery_id,
        title=piece.title,
        type=piece.type,
        purity=piece.purity,
        net_weight=piece.net_weight,
        stock_status=piece.stock_status,
        cover=photo_out(piece.photos[0], piece.title) if piece.photos else None,
        price=CardPrice(
            final_min=price.final_min,
            final_max=price.final_max,
            original_min=price.original_min,
            original_max=price.original_max,
            discount_label=price.discount.label if price.discount else None,
        ),
    )


def design_card(design: Design) -> DesignCard:
    return DesignCard(
        public_id=design.public_id,
        title=design.title,
        category=design.category,
        purity_options=design.purities,
        weight_min=design.weight_min,
        weight_max=design.weight_max,
        price_min=design.price_min,
        price_max=design.price_max,
        cover=photo_out(design.photos[0], design.title) if design.photos else None,
    )
