import type { SVGProps } from 'react'

// Shared line-icon set for the app's witch/purple aesthetic — flat outline
// style, currentColor throughout so each icon inherits whatever text-color
// class its wrapper already uses (e.g. active/inactive nav states).
type IconProps = SVGProps<SVGSVGElement>

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/** Home nav icon — the witch's fox familiar. */
export function FoxIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 8.5 L8 2.5 L10.5 8.8 Z" strokeLinejoin="round" />
      <path d="M18 8.5 L16 2.5 L13.5 8.8 Z" strokeLinejoin="round" />
      <path d="M7 8 Q12 5.7 17 8 Q17.6 14 12 19 Q6.4 14 7 8 Z" strokeLinejoin="round" />
      <circle cx="9.8" cy="11.3" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="14.2" cy="11.3" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Lists/Favorites nav icon — a four-point magic sparkle. */
export function SparkleIcon(props: IconProps) {
  return (
    <svg {...base} strokeWidth={1.3} {...props}>
      <path
        d="M12 2.5 L14 10 L21.5 12 L14 14 L12 21.5 L10 14 L2.5 12 L10 10 Z"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Stats nav icon — hourglass with a small sparkle accent. */
export function HourglassIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 3 h12" />
      <path d="M6 21 h12" />
      <path d="M7 3 c0 5 4 6 5 8 c1 -2 5 -3 5 -8" />
      <path d="M7 21 c0 -5 4 -6 5 -8 c1 2 5 3 5 8" />
    </svg>
  )
}

/** Data nav icon — a witch's cauldron. */
export function CauldronIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 10 h16" />
      <path d="M4 10 c0 6 3.5 10 8 10 s8 -4 8 -10" />
      <path d="M8 10 l-2 -4" />
      <path d="M16 10 l2 -4" />
      <path d="M9 4 c1 1.2 1 2.2 0 3.2 M12 3.4 c1 1.2 1 2.4 0 3.6 M15 4 c1 1.2 1 2.2 0 3.2" strokeWidth={1.2} />
    </svg>
  )
}

/** Header/app mark — witch hat + crescent moon. */
export function WitchHatMoonIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <g transform="translate(12.5, 1.4) scale(0.34)">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </g>
      <path d="M9 5 L14 17.5 L4 17.5 Z" strokeLinejoin="round" />
      <ellipse cx="9" cy="17.5" rx="5.5" ry="1.5" />
      <circle cx="9" cy="17.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Search nav icon — a scrying crystal ball. */
export function CrystalBallIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="10" r="7.2" />
      <path d="M7.5 19 h9" />
      <path d="M9.2 16.8 L8.3 19 M14.8 16.8 L15.7 19" />
      <path
        d="M12 6.5 L12.9 9.1 L15.5 10 L12.9 10.9 L12 13.5 L11.1 10.9 L8.5 10 L11.1 9.1 Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base} strokeWidth={1.8} {...props}>
      <path d="M6 6 L18 18 M18 6 L6 18" />
    </svg>
  )
}

/** Needs-review flag. */
export function FlagIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 3 v18" />
      <path d="M6 4.5 h12 l-3 3.5 l3 3.5 h-12" />
    </svg>
  )
}

/** Small edit-details toggle — a wand tip standing in for a pencil. */
export function PencilIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M14.5 4.5 L19.5 9.5 L8 21 L3.5 21 L3.5 16.5 Z" strokeLinejoin="round" />
      <path d="M12.5 6.5 L17.5 11.5" />
      <circle cx="18.5" cy="5.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

const CHEVRON_ROTATION = { down: undefined, up: 'rotate(180deg)', right: 'rotate(-90deg)' } as const

export function ChevronIcon({
  direction = 'down',
  ...props
}: IconProps & { direction?: 'up' | 'down' | 'right' }) {
  return (
    <svg {...base} strokeWidth={1.8} style={{ transform: CHEVRON_ROTATION[direction] }} {...props}>
      <path d="M6 9 L12 15 L18 9" />
    </svg>
  )
}
