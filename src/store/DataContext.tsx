import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as db from '../db/db'
import type { CustomList, Show } from '../types/schema'
import { DataContext } from './dataContextBase'
import { isLegacyShow, migrateShow } from '../lib/legacyMigration'

export function DataProvider({ children }: { children: ReactNode }) {
  const [shows, setShows] = useState<Show[]>([])
  const [customLists, setCustomLists] = useState<CustomList[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const [rawShows, l] = await Promise.all([db.getAllShows(), db.getAllCustomLists()])

    // One-time migration for shows already sitting in IndexedDB from before
    // the watchCount schema change (v2) — db.ts's migrate() only runs on
    // JSON import, not on data already stored locally.
    let s = rawShows
    if (rawShows.some(isLegacyShow)) {
      await db.exportSnapshot('pre-watchcount-migration')
      s = rawShows.map(migrateShow)
      await db.putShows(s)
    }

    setShows(s)
    setCustomLists(l)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const saveShow = useCallback(async (show: Show) => {
    await db.putShow(show)
    setShows((prev) => {
      const idx = prev.findIndex((s) => s.id === show.id)
      if (idx === -1) return [...prev, show]
      const next = [...prev]
      next[idx] = show
      return next
    })
  }, [])

  const removeShow = useCallback(async (id: string) => {
    await db.deleteShow(id)
    setShows((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const saveCustomList = useCallback(async (list: CustomList) => {
    await db.putCustomList(list)
    setCustomLists((prev) => {
      const idx = prev.findIndex((l) => l.id === list.id)
      if (idx === -1) return [...prev, list]
      const next = [...prev]
      next[idx] = list
      return next
    })
  }, [])

  const removeCustomList = useCallback(async (id: string) => {
    await db.deleteCustomList(id)
    setCustomLists((prev) => prev.filter((l) => l.id !== id))
  }, [])

  const commitImportPlan = useCallback(async (newShows: Show[], newLists: CustomList[]) => {
    await db.mergeImport(newShows, newLists)
    await refresh()
  }, [refresh])

  const value = useMemo(
    () => ({
      shows,
      customLists,
      loading,
      refresh,
      saveShow,
      removeShow,
      saveCustomList,
      removeCustomList,
      commitImportPlan,
    }),
    [shows, customLists, loading, refresh, saveShow, removeShow, saveCustomList, removeCustomList, commitImportPlan],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
