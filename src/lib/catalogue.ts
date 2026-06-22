import { getCollection, type CollectionEntry } from 'astro:content'
import { officialGrade, gradeIndex } from '@/lib/grades'
import { daysBetween } from '@/lib/dates'

export type Area = CollectionEntry<'areas'>
export type Wall = CollectionEntry<'walls'>
export type Set = CollectionEntry<'sets'>
export type Route = CollectionEntry<'routes'>

// Routes order by official grade, easiest first.
const byGrade = (a: Route, b: Route): number =>
  gradeIndex(officialGrade(a.data)) - gradeIndex(officialGrade(b.data))

// Newest set first; setDate is a YYYY-MM-DD string so lexical order works.
const bySetDateDesc = (a: Set, b: Set): number => b.data.setDate.localeCompare(a.data.setDate)

export const getAreasSorted = async (): Promise<Area[]> =>
  (await getCollection('areas')).sort((a, b) => a.data.order - b.data.order)

export const getWallsForArea = async (areaId: string): Promise<Wall[]> =>
  (await getCollection('walls'))
    .filter((w) => w.data.area.id === areaId)
    .sort((a, b) => a.data.number - b.data.number)

export const getSetsForWall = async (wallId: string): Promise<Set[]> =>
  (await getCollection('sets')).filter((s) => s.data.wall.id === wallId).sort(bySetDateDesc)

// At most one set per wall has no stripDate: the current one. A stripped wall
// returns undefined.
export const currentSet = (sets: Set[]): Set | undefined => sets.find((s) => !s.data.stripDate)

export const getRoutesForSet = async (setId: string): Promise<Route[]> =>
  (await getCollection('routes')).filter((r) => r.data.set.id === setId).sort(byGrade)

// Routes due a regrade: on a current set at least 14 gym-days old, still
// missing finalGrade. `today` is YYYY-MM-DD in the gym timezone.
export type RegradeRow = { route: Route; set: Set; wall: Wall; area: Area }

export const getRegradeCandidates = async (today: string): Promise<RegradeRow[]> => {
  const [areas, walls, sets, routes] = await Promise.all([
    getCollection('areas'),
    getCollection('walls'),
    getCollection('sets'),
    getCollection('routes'),
  ])
  const areaById = new Map(areas.map((a) => [a.id, a]))
  const wallById = new Map(walls.map((w) => [w.id, w]))
  const setById = new Map(sets.map((s) => [s.id, s]))

  const rows: RegradeRow[] = []
  for (const route of routes) {
    if (route.data.finalGrade) continue
    const set = setById.get(route.data.set.id)
    if (!set || set.data.stripDate) continue
    if (daysBetween(set.data.setDate, today) < 14) continue
    const wall = wallById.get(set.data.wall.id)
    if (!wall) continue
    const area = areaById.get(wall.data.area.id)
    if (!area) continue
    rows.push({ route, set, wall, area })
  }
  // Oldest sets first, then by grade.
  return rows.sort(
    (a, b) =>
      a.set.data.setDate.localeCompare(b.set.data.setDate) ||
      gradeIndex(officialGrade(a.route.data)) - gradeIndex(officialGrade(b.route.data)),
  )
}
