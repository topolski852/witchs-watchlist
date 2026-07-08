import type { Episode, Show } from '../types/schema'
import { buildCustomShow } from './customShow'

/** Real per-volume episode counts, confirmed against Hulu's "116 total
 * episodes" and Kelly's pasted runtime-thread breakdown (which lists 10
 * Volume 9 chapters, not the 11 an earlier Wikidata/infobox check implied). */
const RWBY_SEASON_EPISODE_COUNTS = [16, 12, 12, 12, 14, 13, 13, 14, 10]

/** Title + "actual length" (ads/OP/ED stripped) runtime in decimal minutes,
 * per episode, globally sequential across all 9 volumes — sourced from the
 * Reddit runtime thread Kelly pasted directly into chat (a legitimate
 * first-party source, not scraped or guessed). Volume 1's combined-airing
 * chapters are split back into their individual halves so the count matches
 * the real 16 episodes. */
const RWBY_EPISODE_META: { title: string; durationMin: number }[] = [
  // Volume 1
  { title: 'Ruby Rose', durationMin: 11.1 },
  { title: 'The Shining Beacon (Part 1)', durationMin: 5.5 },
  { title: 'The Shining Beacon (Part 2)', durationMin: 5.8 },
  { title: 'The First Step (Part 1)', durationMin: 6.8 },
  { title: 'The First Step (Part 2)', durationMin: 3.7 },
  { title: 'The Emerald Forest (Part 1)', durationMin: 6.4 },
  { title: 'The Emerald Forest (Part 2)', durationMin: 4.0 },
  { title: 'Players and Pieces', durationMin: 12.9 },
  { title: 'The Badge and The Burden (Part 1)', durationMin: 4.7 },
  { title: 'The Badge and The Burden (Part 2)', durationMin: 6.1 },
  { title: 'Jaundice (Part 1)', durationMin: 3.7 },
  { title: 'Jaundice (Part 2)', durationMin: 6.6 },
  { title: 'Forever Fall (Part 1)', durationMin: 5.3 },
  { title: 'Forever Fall (Part 2)', durationMin: 5.2 },
  { title: 'The Stray', durationMin: 9.5 },
  { title: 'Black and White', durationMin: 11.8 },
  // Volume 2
  { title: 'Best Day Ever', durationMin: 13.6 },
  { title: 'Welcome to Beacon', durationMin: 11.7 },
  { title: 'A Minor Hiccup', durationMin: 11.0 },
  { title: 'Painting The Town…', durationMin: 14.7 },
  { title: 'Extracurricular', durationMin: 11.0 },
  { title: 'Burning The Candle', durationMin: 11.5 },
  { title: 'Dance Dance Infiltration', durationMin: 13.1 },
  { title: 'Field Trip', durationMin: 10.4 },
  { title: 'Search and Destroy', durationMin: 13.6 },
  { title: 'Mountain Glenn', durationMin: 10.6 },
  { title: 'No Brakes', durationMin: 14.4 },
  { title: 'Breach', durationMin: 13.4 },
  // Volume 3
  { title: 'Round One', durationMin: 15.4 },
  { title: 'New Challengers…', durationMin: 12.2 },
  { title: "It's Brawl In The Family", durationMin: 14.6 },
  { title: 'Lessons Learned', durationMin: 12.2 },
  { title: 'Never Miss A Beat', durationMin: 10.5 },
  { title: 'Fall', durationMin: 15.6 },
  { title: 'Beginning of the End', durationMin: 14.2 },
  { title: 'Destiny', durationMin: 14.8 },
  { title: 'PvP', durationMin: 9.7 },
  { title: 'Battle of Beacon', durationMin: 14.7 },
  { title: 'Heroes and Monsters', durationMin: 15.2 },
  { title: 'End of the Beginning', durationMin: 20.9 },
  // Volume 4
  { title: 'The Next Step', durationMin: 18.2 },
  { title: 'Remembrance', durationMin: 12.1 },
  { title: 'Of Runaways and Stowaways', durationMin: 16.1 },
  { title: 'Family', durationMin: 14.3 },
  { title: 'Menagerie', durationMin: 10.4 },
  { title: 'Tipping Point', durationMin: 14.2 },
  { title: 'Punished', durationMin: 14.6 },
  { title: 'A Much Needed Talk', durationMin: 18.5 },
  { title: 'Two Steps Forward, Two Steps Back', durationMin: 13.2 },
  { title: 'Kuroyuri', durationMin: 16.7 },
  { title: 'Taking Control', durationMin: 13.4 },
  { title: 'No Safe Haven', durationMin: 19.6 },
  // Volume 5
  { title: 'Welcome to Haven', durationMin: 20.8 },
  { title: 'Dread in the Air', durationMin: 18.9 },
  { title: 'Unforeseen Complications', durationMin: 16.4 },
  { title: 'Lighting The Fire', durationMin: 14.1 },
  { title: 'Necessary Sacrifice', durationMin: 14.8 },
  { title: 'Known By Its Song', durationMin: 15.4 },
  { title: 'Rest and Resolutions', durationMin: 10.7 },
  { title: 'Alone Together', durationMin: 13.1 },
  { title: 'A Perfect Storm', durationMin: 13.0 },
  { title: 'True Colors', durationMin: 17.3 },
  { title: 'The More The Merrier', durationMin: 13.9 },
  { title: 'The Vault of the Spring Maiden', durationMin: 12.6 },
  { title: 'Downfall', durationMin: 13.3 },
  { title: "Haven's Fate", durationMin: 16.9 },
  // Volume 6
  { title: 'Argus Limited', durationMin: 19.9 },
  { title: 'Uncovered', durationMin: 14.1 },
  { title: 'The Lost Fable', durationMin: 23.9 },
  { title: "So That's How It Is", durationMin: 11.0 },
  { title: 'The Coming Storm', durationMin: 12.2 },
  { title: 'Alone in the Woods', durationMin: 17.5 },
  { title: 'The Grimm Reaper', durationMin: 13.2 },
  { title: 'Dead End', durationMin: 13.8 },
  { title: 'Lost', durationMin: 15.5 },
  { title: 'Stealing from the Elderly', durationMin: 10.8 },
  { title: 'The Lady in the Shoe', durationMin: 12.8 },
  { title: 'Seeing Red', durationMin: 11.0 },
  { title: 'Our Way', durationMin: 16.6 },
  // Volume 7
  { title: 'The Greatest Kingdom', durationMin: 15.5 },
  { title: 'A New Approach', durationMin: 15.6 },
  { title: 'Ace Operatives', durationMin: 14.9 },
  { title: 'Pomp and Circumstance', durationMin: 15.1 },
  { title: 'Sparks', durationMin: 17.3 },
  { title: 'A Night Off', durationMin: 13.6 },
  { title: 'Worst Case Scenario', durationMin: 16.1 },
  { title: 'Cordially Invited', durationMin: 12.9 },
  { title: 'As Above, So Below', durationMin: 15.6 },
  { title: 'Out In The Open', durationMin: 13.0 },
  { title: 'Gravity', durationMin: 17.7 },
  { title: 'With Friends Like These', durationMin: 15.4 },
  { title: 'The Enemy of Trust', durationMin: 16.9 },
  // Volume 8
  { title: 'Divide', durationMin: 16.3 },
  { title: 'Refuge', durationMin: 15.0 },
  { title: 'Strings', durationMin: 15.2 },
  { title: 'Fault', durationMin: 16.5 },
  { title: 'Amity', durationMin: 16.3 },
  { title: 'Midnight', durationMin: 17.0 },
  { title: 'War', durationMin: 16.2 },
  { title: 'Dark', durationMin: 15.2 },
  { title: 'Witch', durationMin: 15.8 },
  { title: 'Ultimatum', durationMin: 16.1 },
  { title: 'Risk', durationMin: 16.8 },
  { title: 'Creation', durationMin: 15.6 },
  { title: 'Worthy', durationMin: 16.2 },
  { title: 'The Final Word', durationMin: 16.5 },
  // Volume 9
  { title: 'A Place of Particular Concern', durationMin: 15.0 },
  { title: 'Altercation at the Auspicious Auction', durationMin: 14.9 },
  { title: 'Rude, Red and Royal', durationMin: 17.6 },
  { title: 'A Cat Most Curious', durationMin: 16.0 },
  { title: 'The Parfait Predicament', durationMin: 13.8 },
  { title: 'Confessions Within Cumulonimbus Clouds', durationMin: 17.8 },
  { title: 'The Perils of Paper Houses', durationMin: 15.5 },
  { title: 'Tea Amidst Terrible Trouble', durationMin: 13.4 },
  { title: 'A Tale Involving A Tree', durationMin: 12.8 },
  { title: 'Of Solitude and Self', durationMin: 19.8 },
]

/** Real official artwork found while researching: Hulu's series poster and
 * the RWBY logo (Wikimedia Commons). No per-episode/per-season art is
 * reachable without JavaScript execution or platform login, so those stay
 * blank for Kelly to fill in via the episode/season editing UI. */
export const RWBY_COVER_URL =
  'https://img4.hulu.com/user/v3/artwork/d1946557-ad8b-4580-9b24-fbc2614b08bf?base_image_bucket_name=image_manager&base_image=1f66d819-dc75-4148-a642-78e115a33a7b&size=458x687&format=webp'
export const RWBY_LOGO_URL =
  '//upload.wikimedia.org/wikipedia/commons/thumb/d/d2/RWBY_logo.svg/250px-RWBY_logo.svg.png'

/** Official team-member emblem SVGs (Kelly-supplied, from the RWBY wiki's
 * static asset host) — real artwork, not hand-drawn approximations. */
export const RWBY_TEAM_EMBLEMS = [
  {
    name: 'Ruby',
    color: '#e0344c',
    url: 'https://static.wikia.nocookie.net/rwby/images/3/34/Ruby_Rose_Emblem.svg/revision/latest?cb=20150103071935',
  },
  {
    name: 'Weiss',
    color: '#eef1f5',
    url: 'https://static.wikia.nocookie.net/rwby/images/f/fc/Weiss_White_Emblem.svg/revision/latest?cb=20170126205015',
  },
  {
    name: 'Blake',
    color: '#8a5cf5',
    url: 'https://static.wikia.nocookie.net/rwby/images/3/34/Blake_Belladonna_Emblem.svg/revision/latest?cb=20150103071936',
  },
  {
    name: 'Yang',
    color: '#f2b90c',
    url: 'https://static.wikia.nocookie.net/rwby/images/0/03/Yang_Xiao_Long_Emblem.svg/revision/latest?cb=20150103071937',
  },
]

/** Volume/season display names — used to seed Show.seasons. */
const RWBY_SEASON_NAMES = [
  'Volume 1',
  'Volume 2',
  'Volume 3',
  'Volume 4',
  'Volume 5',
  'Volume 6',
  'Volume 7',
  'Volume 8',
  'Volume 9',
]

/** Builds a brand-new RWBY custom show, pre-seeded with real season/episode
 * counts, titles, and runtimes. Artwork/descriptions are left for Kelly to
 * add later. */
export function buildRwbyShow(): Show {
  const show = buildCustomShow({
    title: 'RWBY',
    coverUrl: RWBY_COVER_URL,
    format: 'ONA',
    episodeDurationMin: null,
    seasons: RWBY_SEASON_EPISODE_COUNTS.map((episodeCount) => ({ episodeCount })),
  })
  return applyRwbySeedData(show)
}

/** Idempotent — fills in title/durationMin (and season names) for whichever
 * episodes/seasons exist, without touching anything Kelly has already
 * customized (only patches fields that are still null) or restructuring an
 * existing show's episode/season counts. Safe to call on every RWBY page
 * load. */
export function applyRwbySeedData(show: Show): Show {
  const episodes: Episode[] = show.episodes.map((ep, i) => {
    const seed = RWBY_EPISODE_META[i]
    if (!seed) return ep
    return {
      ...ep,
      title: ep.title ?? seed.title,
      durationMin: ep.durationMin ?? seed.durationMin,
    }
  })
  const seasons = (show.seasons ?? RWBY_SEASON_EPISODE_COUNTS.map((_, i) => ({ number: i + 1, name: null, bannerUrl: null }))).map(
    (season, i) => ({ ...season, name: season.name ?? RWBY_SEASON_NAMES[i] ?? season.name }),
  )
  return { ...show, episodes, seasons }
}

export function isRwbyShow(title: string): boolean {
  return title.trim().toLowerCase() === 'rwby'
}

/** True if any episode still lacks its seeded title — used to decide
 * whether applyRwbySeedData needs to run at all (it's idempotent, but this
 * avoids an unnecessary saveShow call on every render once already seeded). */
export function rwbyNeedsSeed(show: Show): boolean {
  return show.episodes.some((ep, i) => ep.title == null && RWBY_EPISODE_META[i])
}
