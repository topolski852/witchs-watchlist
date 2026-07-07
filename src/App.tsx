import { Route, Routes } from 'react-router-dom'
import { NavBar } from './components/NavBar'
import { HomePage } from './pages/HomePage'
import { ShowsPage } from './pages/ShowsPage'
import { ShowDetailPage } from './pages/ShowDetailPage'
import { ListsPage } from './pages/ListsPage'
import { StatsPage } from './pages/StatsPage'
import { DataPage } from './pages/DataPage'

function App() {
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col md:flex-row">
      <NavBar />
      <div className="flex-1 pb-16 md:pb-0">
        <header className="flex items-center gap-2 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 md:pt-6">
          <span aria-hidden className="text-xl">
            🌙
          </span>
          <h1 className="font-display text-lg tracking-wide text-text md:text-xl">
            The Witch's Watchlist
          </h1>
        </header>
        <main className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/shows" element={<ShowsPage />} />
            <Route path="/show/:id" element={<ShowDetailPage />} />
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
