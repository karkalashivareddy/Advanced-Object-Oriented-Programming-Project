# Image assets (offline pipeline)

All imagery in this frontend is **original vector artwork** generated locally from SVG
sources in `public/images/source/`. There is no third-party photography, no stock
imagery, and no network access at build or runtime.

## Source and license

- **License:** original work created for this project by the project team. No external
  license is required, and no attribution to a third party applies.
- **Sources:** hand-authored SVG files only (`public/images/source/*.svg`). The approved
  brand palette from `src/styles/tokens.css` is used throughout: crimson (`#df1b3b`,
  `#c8102e`, `#8b0018`, `#ff5263`, `#fff5f7`, `#ffe8ed`), paper (`#ffffff`, `#faf8f9`,
  `#f3eff1`, `#e8dce0`) and ink (`#10070c`, `#180d13`, `#24151c`, `#47363d`).
- **Content:** abstract motifs only — no invented statistics, names, testimonials,
  contact details, donor identities, patient identities, or clinical claims. The only
  wordmark is the existing product name **LifeLink** and the existing tagline from
  `index.html`.

### Why no photography

No verified, licensed photography was available for this build. Donor and patient
imagery also carries consent and privacy implications that cannot be assumed for a
demo application, and photographs could imply real people, places, or clinical
outcomes. Original vector artwork keeps the repository self-contained, deterministic,
and safe to ship offline. The illustrations are deliberately generic and do not
depict real individuals or facilities.

## Generated files

Run `npm run build:images` (or `node scripts/build-images.mjs`) to regenerate. The
script uses the already-installed `sharp` devDependency and writes generated files
into `public/images/` and `public/` as listed below. It is idempotent: re-running
overwrites generated files with identical content. Directories are created
automatically, errors from `sharp` fail the command loudly, and no requests are made.

### Responsive illustrations

Five source illustrations are rasterized:

| Asset | Source SVG | Intrinsic size | Meaning |
| --- | --- | --- | --- |
| `vessel` | `source/vessel.svg` | 1200 x 800 | donor-to-delivery vessel motif |
| `compatibility-orbs` | `source/compatibility-orbs.svg` | 1200 x 1200 | compatibility orbs |
| `privacy-rings` | `source/privacy-rings.svg` | 1200 x 1200 | privacy rings / approximate location |
| `emergency-handoff` | `source/emergency-handoff.svg` | 1200 x 800 | emergency handoff |
| `social-og` | `source/social-og.svg` | 1200 x 630 | social OG composition |

Each asset is emitted at **480, 960, 1440 and 2400 px wide**, preserving the source
aspect ratio, in **AVIF, WebP and JPEG**. Naming is predictable:
`public/images/<asset>-<width>.<ext>`, where `<ext>` is `avif`, `webp` or `jpg`
(the JPEG extension is `.jpg`; the manifest key is `jpeg`).

| Width | `vessel` / `emergency-handoff` | `compatibility-orbs` | `social-og` |
| --- | --- | --- | --- |
| 480 | 480 x 320 | 480 x 480 | 480 x 252 |
| 960 | 960 x 640 | 960 x 960 | 960 x 504 |
| 1440 | 1440 x 960 | 1440 x 1440 | 1440 x 756 |
| 2400 | 2400 x 1600 | 2400 x 2400 | 2400 x 1260 |

That is 5 assets x 4 widths x 3 formats = **60 responsive image files**.

### Favicons and social preview

- `public/favicon-16.png`, `favicon-32.png`, `favicon-48.png`, `favicon-180.png`,
  `favicon-192.png`, `favicon-512.png` — rendered from `source/favicon-drop.svg`
  (original blood-drop/lifeline mark). The pre-existing `public/favicon.svg` is
  untouched.
- `public/og-image.png` and `public/og-image.webp` — 1200 x 630 compositions rendered
  from `source/social-og.svg`.

### Manifests

- `public/images/manifest.json` maps each asset name to its intrinsic `width` and
  `height`, `paths[width] = { avif, webp, jpeg }` (root-relative URLs), and a
  `blurDataURL`.
- `src/data/imageManifest.json` is the identical generated copy that Vite imports
  at build time; importing from `public/` directly is rejected by Vite.
- `public/manifest.webmanifest` declares name/short name `LifeLink`,
  `theme_color: #10070c`, `background_color: #ffffff`, `start_url: "/"`,
  `display: "standalone"` and all six generated PNG icons. The pipeline intentionally
  does not modify `index.html`; the app now wires
  `<link rel="manifest" href="/manifest.webmanifest">` as a separate change.

## Blur placeholders

Each entry in `public/images/manifest.json` includes a `blurDataURL`: a base64 WebP
data URI rendered from the same SVG at **24 px wide** with a slight blur. Use it as a
low-cost placeholder while the full-size image loads:

```tsx
const asset = manifest.vessel;
const small = asset.paths['480'].webp;
const large = asset.paths['1440'];

<img
  src={small}
  srcSet={`${asset.paths['480'].webp} 480w, ${asset.paths['960'].webp} 960w, ${asset.paths['1440'].webp} 1440w`}
  sizes="(max-width: 720px) 480px, 1440px"
  style={{
    backgroundImage: `url(${asset.blurDataURL})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    aspectRatio: `${asset.width} / ${asset.height}`,
  }}
  alt=""
/>
```

Prefer AVIF/WebP sources with a JPEG fallback; the placeholder is only decorative and
should not be used as the final visible image.

## Future verified photography: empty / slot guidance

- Keep the existing neutral paper/ink surfaces as the **empty state** for galleries and
  slots. Do not substitute stock photos or generated photorealistic people.
- New imagery must be either (a) newly authored vectors in `public/images/source/`
  using the approved tokens, or (b) photography with documented consent, a verified
  license, and a provenance note added to this file before it is committed.
- To add a vector slot, author `public/images/source/<new-name>.svg` with a `viewBox`,
  add the asset name to `ILLUSTRATIONS` in `scripts/build-images.mjs`, regenerate, and
  document it in the table above.
- Unverified or unlicensed files should stay out of `public/` entirely. Slots with no
  approved source should render a blank paper surface with the existing border/hairline
  tokens rather than an illustrative stand-in that could be mistaken for real content.
- Never edit generated files by hand; regenerate them so the manifest stays in sync.

## Integration summary

- `src/components/ui/Picture.tsx` statically imports `src/data/imageManifest.json` at
  build time and renders a responsive `<picture>` with AVIF/WebP `<source>` elements, a
  JPEG `<img>` fallback, intrinsic `width`/`height`, `sizes`, `loading="lazy"` by
  default, `decoding="async"`, and the generated 24 px WebP `blurDataURL` as a CSS
  placeholder. It is exported from `src/components/ui/index.ts` and uses strict
  TypeScript types (no `any` or `@ts-ignore`). Decorative use sets `alt=""` and
  `aria-hidden`; informative use requires meaningful `alt`.
- `src/pages/public/LandingPage.tsx` uses `Picture` in exactly two secondary slots:
  the emergency coordination card (`emergency-handoff`) and the privacy visual
  (`privacy-rings`). Both are decorative, preserve the required vector/canvas hero,
  and introduce no statistics or example values.
- `index.html` keeps all five local font preloads and now includes the web app
  manifest link, Apple touch icon, SVG plus PNG icon links, Open Graph metadata
  (`og:type`, `og:title`, `og:description`, `og:image`, `og:image:alt`) and Twitter
  card metadata pointing at `/og-image.png`. The product name/tagline use a proper
  em dash (`LifeLink — The living blood network`).
- `src/styles/pictures.css` provides minimal `.responsive-picture` sizing and
  placeholder styles and is imported once via `@import './pictures.css' layer(utilities);`
  in `src/styles/index.css`. No layout properties are animated.
- **No third-party or licensed photography is used.** Every raster file remains a
  locally generated rendition of the original vectors in `public/images/source/`;
  no external assets, CDNs or new dependencies were added.

## Regenerate

```sh
cd project/frontend
npm run build:images
# or: node scripts/build-images.mjs
```

The script prints a short summary (number of sources, images, favicons, social images
and manifests written). No `npm install` step is needed beyond the existing dev
dependencies, and nothing is fetched from the network.
