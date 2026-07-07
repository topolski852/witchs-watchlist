import { useState } from 'react'
import { WitchHatMoonIcon } from './icons'

export function CoverImage({
  src,
  alt,
  className = '',
}: {
  src: string | null
  alt: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-surface-raised ${className}`} aria-hidden>
        <WitchHatMoonIcon className="h-2/5 w-2/5 text-text-faint" />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  )
}
