import type { CSSProperties, ImgHTMLAttributes } from 'react';
import { cx } from '@/lib/utils';
import imageManifest from '../../data/imageManifest.json';

type AssetName = keyof typeof imageManifest;
type AssetPaths = (typeof imageManifest)[AssetName]['paths'];
type WidthKey = keyof AssetPaths;
type SourceFormat = keyof AssetPaths[WidthKey];

const WIDTHS = ['480', '960', '1440', '2400'] as const satisfies readonly WidthKey[];
const FALLBACK_WIDTH: WidthKey = '960';

type SharedPictureProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'alt' | 'src' | 'srcSet' | 'width' | 'height' | 'decoding'
> & {
  asset: AssetName;
  sizes?: string;
  pictureClassName?: string;
  imageClassName?: string;
};

export type PictureProps = SharedPictureProps &
  (
    | { alt: string; decorative?: false }
    | { decorative: true; alt?: never }
  );

function srcSetFor(paths: AssetPaths, format: SourceFormat): string {
  return WIDTHS.map((width) => `${paths[width][format]} ${width}w`).join(', ');
}

/** Accessible responsive artwork backed by the generated offline image manifest. */
export function Picture({
  asset: assetName,
  alt,
  decorative = false,
  sizes = '(max-width: 720px) 100vw, 720px',
  loading = 'lazy',
  pictureClassName,
  imageClassName,
  style,
  ...imgProps
}: PictureProps) {
  const asset = imageManifest[assetName];
  const placeholderStyle: CSSProperties = {
    backgroundImage: `url("${asset.blurDataURL}")`,
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'cover',
  };

  return (
    <picture
      className={cx('responsive-picture', pictureClassName)}
      aria-hidden={decorative || undefined}
    >
      <source type="image/avif" srcSet={srcSetFor(asset.paths, 'avif')} sizes={sizes} />
      <source type="image/webp" srcSet={srcSetFor(asset.paths, 'webp')} sizes={sizes} />
      <img
        {...imgProps}
        className={cx('responsive-picture__image', imageClassName)}
        src={asset.paths[FALLBACK_WIDTH].jpeg}
        srcSet={srcSetFor(asset.paths, 'jpeg')}
        sizes={sizes}
        width={asset.width}
        height={asset.height}
        alt={decorative ? '' : alt}
        loading={loading}
        decoding="async"
        style={{ ...placeholderStyle, ...style }}
      />
    </picture>
  );
}
