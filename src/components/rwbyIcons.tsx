import type { SVGProps } from 'react'

// Decorative RWBY icon(s), same flat line-icon style as components/icons.tsx
// — used only on the bespoke RwbyShowPage. The 4 team emblems themselves are
// real official artwork (src/lib/rwbyData.ts's RWBY_TEAM_EMBLEMS), not
// hand-drawn, since Kelly supplied the actual asset URLs.
type IconProps = SVGProps<SVGSVGElement>

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/** Bumblebee — decorative, for scattered background accents (Blake x Yang,
 * canon as of Volume 9). */
export function BeeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <ellipse cx="12" cy="13" rx="3.6" ry="4.6" />
      <path d="M8.6 10.6 h6.8 M8.2 13 h7.6 M8.6 15.4 h6.8" strokeWidth={1.3} />
      <path d="M10.5 8.6 c0 -2.4 -1.4 -3.6 -2.4 -3.6 c-0.9 0 0 2.2 1 3" strokeLinejoin="round" />
      <path d="M13.5 8.6 c0 -2.4 1.4 -3.6 2.4 -3.6 c0.9 0 0 2.2 -1 3" strokeLinejoin="round" />
      <path d="M9.4 9 c-3 -1.6 -5.4 -0.6 -5.8 0.4 c-0.4 1 2.6 1.4 4 0.4" strokeWidth={1.3} />
      <path d="M14.6 9 c3 -1.6 5.4 -0.6 5.8 0.4 c0.4 1 -2.6 1.4 -4 0.4" strokeWidth={1.3} />
      <circle cx="10.4" cy="12" r="0.55" fill="currentColor" stroke="none" />
      <circle cx="13.6" cy="12" r="0.55" fill="currentColor" stroke="none" />
    </svg>
  )
}
