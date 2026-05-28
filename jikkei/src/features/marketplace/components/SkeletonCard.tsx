type SkeletonVariant = 'pack' | 'item' | 'night-box' | 'balance-chip'

export default function SkeletonCard({ variant }: { variant: SkeletonVariant }) {
  return <div className={`mkt-skeleton mkt-skeleton-${variant}`} />
}
