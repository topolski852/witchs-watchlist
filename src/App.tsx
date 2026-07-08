import { Route, Routes, useParams } from 'react-router-dom'
import { NavBar } from './components/NavBar'
import { HomePage } from './pages/HomePage'
import { ShowsPage } from './pages/ShowsPage'
import { SearchPage } from './pages/SearchPage'
import { ShowDetailPage } from './pages/ShowDetailPage'
import { RwbyShowPage } from './pages/RwbyShowPage'
import { ListsPage } from './pages/ListsPage'
import { StatsPage } from './pages/StatsPage'
import { DataPage } from './pages/DataPage'
import { WitchHatMoonIcon } from './components/icons'
import { useData } from './store/useData'
import { isRwbyShow } from './lib/rwbyData'

// RWBY gets its own bespoke page; every other show renders the standard one.
// Dispatches purely on title match — no manual toggle needed.
function ShowDetailRoute() {
  const { id } = useParams<{ id: string }>()
  const { shows } = useData()
  const show = shows.find((s) => s.id === id)
  return show && isRwbyShow(show.title) ? <RwbyShowPage /> : <ShowDetailPage />
}

function App() {
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col md:flex-row">
      <NavBar />
      <div className="flex-1 pb-16 md:pb-0">
        <header className="flex items-center gap-2 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 md:pt-6">
          <WitchHatMoonIcon aria-hidden className="h-6 w-6 text-accent" />
          <h1 className="font-display text-lg tracking-wide text-text md:text-xl">
            The Witch's Watchlist
          </h1>
        </header>
        <main className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/shows" element={<ShowsPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/show/:id" element={<ShowDetailRoute />} />
            <Route path="/lists" element={<ListsPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/data" element={<DataPage />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default App
