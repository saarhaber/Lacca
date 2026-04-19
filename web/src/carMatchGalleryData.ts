/**
 * Nail polish + car **exterior** in the same frame: hood, door, fender, bumper, roof,
 * or wrap/bodywork clearly readable (including side-mirror reflections of the body).
 * No cabin-primary shots (dashboard, steering wheel, interior window sill as the main car context).
 * Multi-panel stories are OK only if the car panel shows exterior, not interior.
 *
 * `CAR_MATCH_GALLERY` is ordered roughly by dominant manicure / body hue (ROY → … → neutrals → mixed).
 */

export type CarMatchGalleryItem = {
  src: string;
  caption: string;
};

const item = (src: string, caption: string): CarMatchGalleryItem => ({ src, caption });

export const CAR_MATCH_GALLERY: CarMatchGalleryItem[] = [
  item(
    "https://preview.redd.it/9qbkkgbq5c1f1.jpg?width=960&crop=smart&auto=webp&s=275e74a336923d07e3f59895a4fbd443ed2279c6",
    "Cherry metallic mani · matching red VW · hatch & cobblestone · r/Nails"
  ),
  item(
    "https://i.imgur.com/24kFYJR.jpg",
    "Matte accent nail · car paint twin"
  ),
  item(
    "https://preview.redd.it/xhu54x2b6jrf1.jpg?width=1170&format=pjpg&auto=webp&s=5e08da04a91a76a4cfa72803690a02917c3cd449",
    "Rose-gold satin · McLaren 720S"
  ),
  item(
    "https://preview.redd.it/fbqe2w2b6jrf1.jpg?width=1170&format=pjpg&auto=webp&s=66d0ef95ef3348a757fa773da9b11d02ccc42255",
    "Orange-red · Essie · VW Jetta"
  ),
  item(
    "https://i.redd.it/n58crky1hbef1.jpeg",
    "Orange creme · Jeep Renegade"
  ),
  item(
    "https://i.redd.it/9zrm9bj4yypf1.jpeg",
    "Couple brief · mani keyed to his car color"
  ),
  item(
    "https://preview.redd.it/itm67w2b6jrf1.jpg?width=1170&format=pjpg&auto=webp&s=f1d3187a6a8f8dbf1df2f0821b34fc3a2884a060",
    "Butter yellow creme · yellow taxi"
  ),
  item(
    "https://images.unsplash.com/photo-1758229457602-597d7ec290cf?auto=format&fit=crop&w=1200&q=85",
    "French manicure · champagne paint · hood line"
  ),
  item(
    "https://preview.redd.it/ggrm0x2b6jrf1.jpg?width=1170&format=pjpg&auto=webp&s=ce565a54bfec63e90d90407b4532a869ef4313e3",
    "Lime green creme · compact hatchback"
  ),
  item(
    "https://images.unsplash.com/photo-1658199568071-e7821719c035?auto=format&fit=crop&w=1200&q=85",
    "Lime & pink art · mirror · white coupe"
  ),
  item(
    "https://preview.redd.it/lo2v993b6jrf1.jpg?width=1170&format=pjpg&auto=webp&s=3de4c498dec932de7618e8d04176c538a3d83cdc",
    "Olive-lime polish · Jeep Renegade · bottle match"
  ),
  item(
    "https://i.redd.it/ufafv1qf5am81.jpg",
    "Olive green mani · stranger’s car · curb moment"
  ),
  item(
    "https://preview.redd.it/kndo7w2b6jrf1.jpg?width=1170&format=pjpg&auto=webp&s=62cc1177e9e47d90bf770e345fe6965c5bf3f107",
    "Sage green · Subaru Forester · autumn leaves"
  ),
  item(
    "https://i.redd.it/ph5amdluyfo61.jpg",
    "New-car mani · matched exterior paint · Reddit"
  ),
  item(
    "https://preview.redd.it/c4nnfx2b6jrf1.jpg?width=1170&format=pjpg&auto=webp&s=b7fe994999cb2c751f1157a7c4898c99361d5f11",
    "Deep teal shimmer · China Glaze · classic BMW 2002"
  ),
  item(
    "https://preview.redd.it/kmpmry2b6jrf1.jpg?width=1170&format=pjpg&auto=webp&s=cffc793679c768948a12c2b68a0cbc2d5720575a",
    "Dusty blue shimmer · VW Beetle convertible"
  ),
  item(
    "https://i.imgur.com/R68xo.jpg",
    "Sentimental match · Geo-era paint · manicure"
  ),
  item(
    "https://preview.redd.it/lyb7wx2b6jrf1.jpg?width=1170&format=pjpg&auto=webp&s=8a5bc2e7b33ae27d726367c76b1784e679bd7b80",
    "Metallic blue · Tesla Model 3 · sun flare"
  ),
  item(
    "https://i.pinimg.com/736x/f8/e1/c2/f8e1c29418544cdbba31e272d6586960.jpg",
    "Two-tone blue nails · McLaren · lot · Pinterest"
  ),
  item(
    "https://i.redd.it/0xp4oq18ej9d1.jpeg",
    "Tried to match my new car · r/Nails"
  ),
  item(
    "https://i.pinimg.com/736x/e5/0f/ab/e50fab1831dd85bb3ea767ab0f0c588c.jpg",
    "Mani & body color · Pinterest"
  ),
  item(
    "https://external-preview.redd.it/7rYZrqZNPNV-qAIe70vL7Li_RxW-DmZBPGnsbPZ84iE.jpg?auto=webp&s=b73508619fc6ef7eaf0280e340c6e64085ad54ca",
    "Royal blue polka dots · Mini Cooper · two-panel story"
  ),
  item(
    "https://preview.redd.it/yt80ay2b6jrf1.jpg?width=3464&format=pjpg&auto=webp&s=322eb7c9329db4c0b761a85173a6a5ab313054f8",
    "Lavender iridescent wrap · matching shimmer manicure"
  ),
  item(
    "https://images.unsplash.com/photo-1696106559128-698607eddb61?auto=format&fit=crop&w=1200&q=85",
    "Magenta polish · black hood · golden hour reflection"
  ),
  item(
    "https://i.pinimg.com/736x/16/f4/89/16f4893399ef6c9a18e3918853412704.jpg",
    "Exterior match · Pinterest"
  ),
  item(
    "https://i.redd.it/ip2wrnllqbha1.jpg",
    "Coordinated polish · body color · Reddit"
  ),
  item(
    "https://i.redd.it/vtz3lnkicnza1.jpg",
    "Spring detail · storage-season car · matching tips"
  ),
  item(
    "https://i.redd.it/trgvf34o0hs71.jpg",
    "Street find · polish met paint in the wild"
  ),
  item(
    "https://i.redd.it/9su8zq41f2tb1.jpg",
    "Family flex · kid mani · parent’s car panels"
  ),
  item(
    "https://i.redd.it/vvv3bqg7klrg1.jpg",
    "Two-tone car · coordinated accent nails"
  ),
  item(
    "https://i.redd.it/526bb8shzfw21.jpg",
    "Happy accident · nails echoed the body color"
  ),
  item(
    "https://i.redd.it/4y8hjio8q80f1.png",
    "Unplanned twin · polish & exterior"
  ),
  item(
    "https://i.redd.it/ppy8dtg41v6f1.jpeg",
    "Straightforward match · mani & daily driver"
  ),
  item(
    "https://i.redd.it/o79g3rq2jxm91.jpg",
    "Truck paint · surprise mani · Reddit"
  ),
  item(
    "https://i.redd.it/j39j73110zud1.jpeg",
    "Partner’s car · coordinated tips"
  ),
  item(
    "https://i.pinimg.com/736x/8e/3b/76/8e3b762b45fd7066fca41a3c79a08ab9.jpg",
    "Saved pin · nails & car · Pinterest"
  ),
  item(
    "https://i.pinimg.com/736x/3b/f1/d8/3bf1d89658f8f6139b978c85ead107f8.jpg",
    "Color-coordinated set · Pinterest"
  ),
];
