import { createContext } from 'react'
import type { CustomList, Show } from '../types/schema'

export interface DataContextValue {
  shows: Show[]
  customLists: CustomList[]
  loading: boolean
  refresh: () => Promise<void>
  saveShow: (show: Show) => Promise<void>
  removeShow: (id: string) => Promise<void>
  saveCustomList: (list: CustomList) => Promise<void>
  removeCustomList: (id: string) => Promise<void>
  commitImportPlan: (shows: Show[], lists: CustomList[]) => Promise<void>
}

export const DataContext = createContext<DataContextValue | null>(null)
