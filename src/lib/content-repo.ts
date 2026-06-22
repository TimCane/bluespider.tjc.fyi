import { listTree, readTextFile, type TreeEntry } from '@/lib/github'
import { parseMarkdown, CONTENT_ROOT, type Discipline } from '@/lib/content-model'
import type { Grade } from '@/lib/grades'
import type { Colour } from '@/lib/colours'

export type RepoArea = { id: string; name: string; order: number }
export type RepoWall = { id: string; number: number; area: string; features: string[] }
export type RepoSet = {
  id: string
  wall: string
  setDate: string
  stripDate?: string
  setters: string[]
  discipline: Discipline
  notes: string
  // The `image:` frontmatter value (e.g. "./image.jpg"), and the resolved repo
  // path of the committed image, when the set has one.
  image?: string
  imagePath?: string
}
export type RepoRoute = {
  id: string
  set: string
  colour: Colour
  initialGrade: Grade
  finalGrade?: Grade
  notes: string
}

export type Catalogue = {
  tree: TreeEntry[]
  areas: RepoArea[]
  walls: RepoWall[]
  sets: RepoSet[]
}

const AREAS = `${CONTENT_ROOT}/areas/`
const WALLS = `${CONTENT_ROOT}/walls/`
const SETS = `${CONTENT_ROOT}/sets/`
const ROUTES = `${CONTENT_ROOT}/routes/`

const basename = (path: string): string =>
  path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, '')

const read = async (path: string) => {
  const raw = await readTextFile(path)
  return raw ? parseMarkdown(raw) : null
}

export const loadCatalogue = async (): Promise<Catalogue> => {
  const tree = await listTree()
  const blobs = (test: (path: string) => boolean) =>
    tree.filter((e) => e.type === 'blob' && test(e.path))

  const areaEntries = blobs((p) => p.startsWith(AREAS) && p.endsWith('.md'))
  const wallEntries = blobs((p) => p.startsWith(WALLS) && p.endsWith('.md'))
  const setEntries = blobs((p) => p.startsWith(SETS) && p.endsWith('/index.md'))

  const areas = (
    await Promise.all(
      areaEntries.map(async (e): Promise<RepoArea | null> => {
        const parsed = await read(e.path)
        if (!parsed) return null
        return {
          id: basename(e.path),
          name: String(parsed.data.name ?? ''),
          order: Number(parsed.data.order ?? 0),
        }
      }),
    )
  ).filter((a): a is RepoArea => a !== null)

  const walls = (
    await Promise.all(
      wallEntries.map(async (e): Promise<RepoWall | null> => {
        const parsed = await read(e.path)
        if (!parsed) return null
        return {
          id: basename(e.path),
          number: Number(parsed.data.number ?? 0),
          area: String(parsed.data.area ?? ''),
          features: (parsed.data.features as string[]) ?? [],
        }
      }),
    )
  ).filter((w): w is RepoWall => w !== null)

  const sets = (
    await Promise.all(
      setEntries.map(async (e): Promise<RepoSet | null> => {
        const id = e.path.slice(SETS.length, e.path.length - '/index.md'.length)
        const parsed = await read(e.path)
        if (!parsed) return null
        const imagePath = tree.find(
          (t) => t.type === 'blob' && t.path.startsWith(`${SETS}${id}/image.`),
        )?.path
        return {
          id,
          wall: String(parsed.data.wall ?? ''),
          setDate: String(parsed.data.setDate ?? ''),
          stripDate: parsed.data.stripDate ? String(parsed.data.stripDate) : undefined,
          setters: (parsed.data.setters as string[]) ?? [],
          discipline: (parsed.data.discipline as Discipline) ?? 'both',
          notes: parsed.body.trim(),
          image: parsed.data.image ? String(parsed.data.image) : undefined,
          imagePath,
        }
      }),
    )
  ).filter((s): s is RepoSet => s !== null)

  return { tree, areas, walls, sets }
}

export const currentSetForWall = (catalogue: Catalogue, wall: string): RepoSet | undefined =>
  catalogue.sets.find((s) => s.wall === wall && !s.stripDate)

export const loadSetRoutes = async (catalogue: Catalogue, set: string): Promise<RepoRoute[]> => {
  const prefix = `${ROUTES}${set}_`
  const entries = catalogue.tree.filter(
    (e) => e.type === 'blob' && e.path.startsWith(prefix) && e.path.endsWith('.md'),
  )
  const routes = await Promise.all(
    entries.map(async (e): Promise<RepoRoute | null> => {
      const parsed = await read(e.path)
      if (!parsed) return null
      return {
        id: basename(e.path),
        set,
        colour: parsed.data.colour as Colour,
        initialGrade: parsed.data.initialGrade as Grade,
        finalGrade: parsed.data.finalGrade as Grade | undefined,
        notes: parsed.body.trim(),
      }
    }),
  )
  return routes.filter((r): r is RepoRoute => r !== null)
}

// Every blob path belonging to a set: its folder (index + image) and its route
// files. Used to expand a cascade delete.
export const pathsForSet = (catalogue: Catalogue, set: string): string[] =>
  catalogue.tree
    .filter(
      (e) =>
        e.type === 'blob' &&
        (e.path.startsWith(`${SETS}${set}/`) || e.path.startsWith(`${ROUTES}${set}_`)),
    )
    .map((e) => e.path)
