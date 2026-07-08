import { useEffect, useRef, useState } from 'react'
import { useData } from '../store/useData'
import { ConfirmDialog } from '../components/ConfirmDialog'
import * as db from '../db/db'
import { missingRequiredFiles, parseTvTimeFiles } from '../lib/tvtimeParse'
import { buildImportPlan, type ImportPlan, type ImportProgress } from '../lib/importTvTime'
import { deriveWatchStatus } from '../lib/statusRules'
import { relinkFavorites } from '../lib/relinkFavorites'
import { ImportReview } from './ImportReview'

type InputWithDirectory = HTMLInputElement & { webkitdirectory?: boolean }

export function DataPage() {
  const { shows, customLists, refresh, commitImportPlan, saveShow, saveCustomList } = useData()
  const [backups, setBackups] = useState<Awaited<ReturnType<typeof db.listBackups>>>([])
  const [confirmWipeImport, setConfirmWipeImport] = useState<File | null>(null)
  const [confirmRecalculate, setConfirmRecalculate] = useState(false)
  const [confirmRelink, setConfirmRelink] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [tvTimeFiles, setTvTimeFiles] = useState<File[] | null>(null)
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [importing, setImporting] = useState(false)

  const folderInputRef = useRef<InputWithDirectory>(null)
  const jsonInputRef = useRef<HTMLInputElement>(null)

  async function loadBackups() {
    setBackups(await db.listBackups())
  }

  useEffect(() => {
    loadBackups()
  }, [])

  async function handleExport() {
    const snapshot = await db.exportSnapshot('manual export')
    db.downloadExport(snapshot)
    setStatus(`Exported ${snapshot.data.shows.length} shows to a JSON file, and saved a local backup snapshot.`)
    loadBackups()
  }

  async function handleImportJsonFile(file: File) {
    setError(null)
    try {
      const parsed = await db.readExportFile(file)
      // stash the file until the user confirms the destructive replace
      setConfirmWipeImport(file)
      void parsed
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file.')
    }
  }

  async function confirmJsonImport() {
    if (!confirmWipeImport) return
    try {
      const parsed = await db.readExportFile(confirmWipeImport)
      const result = await db.importFullSnapshot(parsed)
      await refresh()
      setStatus(`Restored ${result.showCount} shows and ${result.listCount} lists from backup.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.')
    } finally {
      setConfirmWipeImport(null)
    }
  }

  async function recalculateStatuses() {
    setConfirmRecalculate(false)
    setError(null)
    await db.exportSnapshot('pre-recalculate snapshot')
    let changed = 0
    for (const show of shows) {
      const nextStatus = deriveWatchStatus(show.episodes, show.hasSequel ?? false, show.status)
      if (nextStatus !== show.status) {
        await saveShow({ ...show, status: nextStatus })
        changed++
      }
    }
    setStatus(
      changed > 0
        ? `Recalculated statuses — ${changed} show${changed === 1 ? '' : 's'} updated from episode progress.`
        : 'Recalculated statuses — everything already matched episode progress.',
    )
    loadBackups()
  }

  async function runRelinkFavorites() {
    setConfirmRelink(false)
    setError(null)
    await db.exportSnapshot('pre-relink-favorites snapshot')

    const { updatedLists, changedCount } = relinkFavorites(customLists, shows)
    for (const list of updatedLists) {
      await saveCustomList(list)
    }

    setStatus(
      changedCount > 0
        ? `Relinked ${changedCount} favorite entr${changedCount === 1 ? 'y' : 'ies'} to shows already in your watchlist.`
        : 'Relinked favorites — nothing needed fixing.',
    )
    loadBackups()
  }

  function handleFolderPicked(fileList: FileList | null) {
    setError(null)
    setPlan(null)
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)
    const missing = missingRequiredFiles(files)
    if (missing.length > 0) {
      setError(`Missing expected TV Time export files: ${missing.join(', ')}`)
      return
    }
    setTvTimeFiles(files)
  }

  async function runTvTimeImport() {
    if (!tvTimeFiles) return
    setError(null)
    setImporting(true)
    setProgress(null)
    try {
      const parsed = await parseTvTimeFiles(tvTimeFiles)
      const builtPlan = await buildImportPlan(parsed, setProgress, shows, customLists)
      setPlan(builtPlan)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'TV Time import failed.')
    } finally {
      setImporting(false)
      setProgress(null)
    }
  }

  async function confirmTvTimeImport() {
    if (!plan) return
    setImporting(true)
    try {
      await commitImportPlan(plan.shows, plan.customLists)
      setStatus(`Imported ${plan.shows.length} shows and ${plan.customLists.length} lists from TV Time.`)
      setPlan(null)
      setTvTimeFiles(null)
      loadBackups()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6 pb-6">
      {status && (
        <div className="rounded-lg border border-status-completed/50 bg-status-completed/10 p-3 text-sm text-text">
          {status}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-status-stopped/50 bg-status-stopped/10 p-3 text-sm text-status-stopped">
          {error}
        </div>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-text">Backup & restore</h2>
        <p className="mb-2 text-xs text-text-faint">
          Your {shows.length} shows and {customLists.length} lists live only in this browser's local storage.
          Export regularly — especially before switching devices.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Export to JSON
          </button>
          <button
            type="button"
            onClick={() => jsonInputRef.current?.click()}
            className="rounded-lg border border-border px-3 py-2 text-sm text-text-muted hover:bg-surface"
          >
            Import from JSON
          </button>
          <input
            ref={jsonInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleImportJsonFile(e.target.files[0])}
          />
        </div>

        {backups.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <p className="text-xs text-text-faint">Local auto-backups (last {backups.length}):</p>
            {backups.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-xs">
                <span className="text-text-muted">
                  {new Date(b.createdAt).toLocaleString()} · {b.reason} · {b.snapshot.data.shows.length} shows
                </span>
                <button
                  type="button"
                  onClick={() => db.downloadExport(b.snapshot)}
                  className="text-accent hover:underline"
                >
                  Download
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-text">Maintenance</h2>
        <p className="mb-2 text-xs text-text-faint">
          Re-derive every show's status from its actual episode progress (0 watched → Plan to Watch, all watched
          → Completed/Caught Up, otherwise Watching). Useful after this feature shipped, since shows imported or
          edited before it existed may have a stale status. "Stopped" shows are left alone.
        </p>
        <button
          type="button"
          onClick={() => setConfirmRecalculate(true)}
          className="rounded-lg border border-border px-3 py-2 text-sm text-text-muted hover:bg-surface"
        >
          Recalculate all statuses
        </button>

        <p className="mb-2 mt-4 text-xs text-text-faint">
          Re-link Favorite list entries to shows already in your watchlist. TV Time's title for a favorite doesn't
          always match AniList's resolved title, so some entries (e.g. "Frieren") may never have gotten linked even
          though the show is already tracked — this fixes those without touching entries that are correct.
        </p>
        <button
          type="button"
          onClick={() => setConfirmRelink(true)}
          className="rounded-lg border border-border px-3 py-2 text-sm text-text-muted hover:bg-surface"
        >
          Relink favorite entries
        </button>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-text">Import from TV Time</h2>
        <p className="mb-2 text-xs text-text-faint">
          Select your TV Time data export folder (the one with <code>user_tv_show_data.csv</code> etc. in it).
          AniList rate-limits searches, so matching a full library can take 15–25 minutes — you can leave this tab
          open in the background. Nothing is saved until you review and confirm.
        </p>
        {!plan && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (folderInputRef.current) folderInputRef.current.webkitdirectory = true
                folderInputRef.current?.click()
              }}
              className="rounded-lg border border-border px-3 py-2 text-sm text-text-muted hover:bg-surface"
            >
              Choose TV Time folder
            </button>
            <input
              ref={folderInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFolderPicked(e.target.files)}
            />
            {tvTimeFiles && (
              <span className="text-xs text-text-faint">{tvTimeFiles.length} files selected</span>
            )}
            {tvTimeFiles && !importing && (
              <button
                type="button"
                onClick={runTvTimeImport}
                className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover"
              >
                Start matching
              </button>
            )}
          </div>
        )}

        {importing && progress && (
          <div className="mt-3">
            <p className="text-xs text-text-faint">
              {progress.phase === 'shows' ? 'Matching shows' : 'Matching favorite entries'} — {progress.current}/
              {progress.total}: {progress.currentTitle}
            </p>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${(progress.current / Math.max(1, progress.total)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {plan && (
          <div className="mt-3">
            <ImportReview
              plan={plan}
              onChange={setPlan}
              onConfirm={confirmTvTimeImport}
              onCancel={() => setPlan(null)}
              importing={importing}
            />
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmRecalculate}
        title="Recalculate all statuses?"
        message="This updates the status of any show whose current status doesn't match its episode progress. A backup snapshot is taken first, and you can always change a status back manually afterward."
        confirmLabel="Recalculate"
        onCancel={() => setConfirmRecalculate(false)}
        onConfirm={recalculateStatuses}
      />

      <ConfirmDialog
        open={confirmRelink}
        title="Relink favorite entries?"
        message="Checks every Favorite list entry that isn't linked to a show yet, and links it if a matching show is already in your watchlist (by AniList id, then by title). A backup snapshot is taken first, and entries that are already linked or that don't match anything are left alone."
        confirmLabel="Relink"
        onCancel={() => setConfirmRelink(false)}
        onConfirm={runRelinkFavorites}
      />

      <ConfirmDialog
        open={!!confirmWipeImport}
        title="Replace all local data?"
        message="Importing a full JSON backup replaces every show and list currently stored on this device. A safety snapshot of your current data is taken first and kept in Local auto-backups."
        confirmLabel="Replace data"
        danger
        onCancel={() => setConfirmWipeImport(null)}
        onConfirm={confirmJsonImport}
      />
    </div>
  )
}
