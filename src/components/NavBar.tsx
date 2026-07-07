import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Watchlist', icon: '📖' },
  { to: '/lists', label: 'Lists', icon: '⭐' },
  { to: '/stats', label: 'Stats', icon: '⏳' },
  { to: '/data', label: 'Data', icon: '🗃' },
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
          <span aria-hidden className="text-lg md:text-base">
            {link.icon}
          </span>
          <span>{link.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
