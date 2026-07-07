import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { useData } from '../store/useData'
import { CoverImage } from '../components/CoverImage'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type { CustomList, ListEntry, ListEntryType } from '../types/schema'

function AddEntryForm({ onAdd }: { onAdd: (entry: ListEntry) => void }) {
  const [title, setTitle] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [type, setType] = useState<ListEntryType>('other')
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-dashed border-border py-2 text-xs text-text-faint hover:border-accent-soft hover:text-text-muted"
      >
        + Add entry
      </button>
    )
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    onAdd({
      id: uuid(),
      title: title.trim(),
      coverUrl: coverUrl.trim() || null,
      anilistId: null,
      type,
      linkedShowId: null,
      createdAt: new Date().toISOString(),
    })
    setTitle('')
    setCoverUrl('')
    setOpen(false)
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-lg border border-border bg-surface p-3">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (e.g. RWBY, Your Name)"
        className="w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-text placeholder:text-text-faint"
      />
      <input
        value={coverUrl}
        onChange={(e) => setCoverUrl(e.target.value)}
        placeholder="Cover image URL (optional)"
        className="w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-text placeholder:text-text-faint"
      />
      <div className="flex items-center gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ListEntryType)}
          className="rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-text"
        >
          <option value="anime">Anime</option>
          <option value="movie">Movie</option>
          <option value="other">Other</option>
        </select>
        <button type="submit" className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover">
          Add
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="ml-auto text-xs text-text-faint hover:text-text-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function ListSection({ list }: { list: CustomList }) {
  const { saveCustomList, removeCustomList } = useData()
  const [confirmDeleteList, setConfirmDeleteList] = useState(false)
  const [removingEntry, setRemovingEntry] = useState<ListEntry | null>(null)

  function addEntry(entry: ListEntry) {
    saveCustomList({ ...list, entries: [...list.entries, entry], updatedAt: new Date().toISOString() })
  }

  function removeEntry(entry: ListEntry) {
    saveCustomList({
      ...list,
      entries: list.entries.filter((e) => e.id !== entry.id),
      updatedAt: new Date().toISOString(),
    })
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text">
          {list.name} <span className="text-text-faint">({list.entries.length})</span>
        </h2>
        <button
          type="button"
          onClick={() => setConfirmDeleteList(true)}
          className="text-xs text-text-faint hover:text-status-stopped"
        >
          Delete list
        </button>
      </div>

      {list.entries.length > 0 && (
        <div className="mb-2 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {list.entries.map((entry) => (
            <div key={entry.id} className="group relative overflow-hidden rounded-lg border border-border bg-surface">
              <CoverImage src={entry.coverUrl} alt={entry.title} className="aspect-[2/3] w-full" />
              <p className="line-clamp-2 p-1.5 text-[11px] leading-tight text-text">{entry.title}</p>
              <button
                type="button"
                onClick={() => setRemovingEntry(entry)}
                className="absolute right-1 top-1 hidden rounded-full bg-surface/90 px-1.5 py-0.5 text-[10px] text-status-stopped group-hover:block"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <AddEntryForm onAdd={addEntry} />

      <ConfirmDialog
        open={!!removingEntry}
        title="Remove entry?"
        message={`Remove "${removingEntry?.title}" from ${list.name}?`}
        confirmLabel="Remove"
        danger
        onCancel={() => setRemovingEntry(null)}
        onConfirm={() => {
          if (removingEntry) removeEntry(removingEntry)
          setRemovingEntry(null)
        }}
      />
      <ConfirmDialog
        open={confirmDeleteList}
        title="Delete this list?"
        message={`"${list.name}" and its ${list.entries.length} entries will be removed. This doesn't affect your main watchlist.`}
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirmDeleteList(false)}
        onConfirm={() => {
          removeCustomList(list.id)
          setConfirmDeleteList(false)
        }}
      />
    </div>
  )
}

export function ListsPage() {
  const { customLists, saveCustomList } = useData()
  const [newListName, setNewListName] = useState('')

  function createList(e: React.FormEvent) {
    e.preventDefault()
    if (!newListName.trim()) return
    const now = new Date().toISOString()
    saveCustomList({ id: uuid(), name: newListName.trim(), entries: [], createdAt: now, updatedAt: now })
    setNewListName('')
  }

  return (
    <div className="space-y-6 pb-6">
      {customLists.map((list) => (
        <ListSection key={list.id} list={list} />
      ))}

      {customLists.length === 0 && (
        <p className="py-4 text-center text-sm text-text-faint">
          No custom lists yet — create one below, or import from TV Time on the Data tab.
        </p>
      )}

      <form onSubmit={createList} className="flex gap-2">
        <input
          value={newListName}
          onChange={(e) => setNewListName(e.target.value)}
          placeholder="New list name…"
          className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-faint"
        />
        <button type="submit" className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover">
          Create list
        </button>
      </form>
    </div>
  )
}
