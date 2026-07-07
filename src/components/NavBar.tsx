import { NavLink } from 'react-router-dom'
import { CauldronIcon, CrystalBallIcon, FoxIcon, HourglassIcon, SparkleIcon } from './icons'

const links = [
  { to: '/', label: 'Home', Icon: FoxIcon },
  { to: '/search', label: 'Search', Icon: CrystalBallIcon },
  { to: '/lists', label: 'Lists', Icon: SparkleIcon },
  { to: '/stats', label: 'Stats', Icon: HourglassIcon },
  { to: '/data', label: 'Data', Icon: CauldronIcon },
]

const linkBase =
  'flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors md:flex-row md:justify-start md:gap-2 md:rounded-lg md:px-3 md:py-2 md:text-sm'

export function NavBar() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-surface/95 backdrop-blur
        md:sticky md:top-0 md:inset-auto md:max-h-screen md:w-56 md:flex-col md:gap-1
        md:border-t-0 md:border-r md:bg-transparent md:p-4"
    >
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.to === '/'}
          className={({ isActive }) =>
            `${linkBase} flex-1 py-2 ${
              isActive ? 'text-accent md:bg-surface-raised' : 'text-text-faint hover:text-text-muted'
            }`
          }
        >
          <link.Icon aria-hidden className="h-5 w-5 md:h-4 md:w-4" />
          <span>{link.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
