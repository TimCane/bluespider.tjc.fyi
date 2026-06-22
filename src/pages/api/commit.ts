import type { APIRoute } from 'astro'
import { commitChangeset, type FileWrite as BinaryWrite } from '@/lib/github'
import {
  loadCatalogue,
  currentSetForWall,
  loadSetRoutes,
  pathsForSet,
  type Catalogue,
} from '@/lib/content-repo'
import {
  areaFile,
  wallFile,
  setIndexFile,
  routeFile,
  setId as makeSetId,
  wallId as makeWallId,
  routeId as makeRouteId,
  setImagePath,
  slugify,
  areaPath,
  wallPath,
  type Discipline,
} from '@/lib/content-model'
import { GRADES, type Grade } from '@/lib/grades'
import { COLOURS, type Colour } from '@/lib/colours'
import { todayInGym } from '@/lib/dates'

export const prerender = false

const isGrade = (v: string): v is Grade => (GRADES as readonly string[]).includes(v)
const isColour = (v: string): v is Colour => (COLOURS as readonly string[]).includes(v)
const isDiscipline = (v: string): v is Discipline => ['lead', 'top-rope', 'both'].includes(v)
const isDate = (v: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(v)

class InputError extends Error {}

const str = (form: FormData, key: string): string => String(form.get(key) ?? '').trim()
const splitList = (raw: string): string[] =>
  raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)

type RouteInput = { colour: Colour; initialGrade: Grade; finalGrade?: Grade; notes?: string }

const parseRoutes = (form: FormData, rows = 11): RouteInput[] => {
  const out: RouteInput[] = []
  const seen = new Set<string>()
  for (let i = 0; i < rows; i++) {
    const colour = str(form, `route-colour-${i}`)
    if (!colour) continue
    if (!isColour(colour)) throw new InputError(`Unknown colour "${colour}"`)
    if (seen.has(colour)) throw new InputError(`Colour ${colour} is used twice in this set`)
    seen.add(colour)
    const initialGrade = str(form, `route-initial-${i}`)
    if (!isGrade(initialGrade))
      throw new InputError(`Pick an initial grade for the ${colour} route`)
    const final = str(form, `route-final-${i}`)
    if (final && !isGrade(final)) throw new InputError(`Unknown final grade "${final}"`)
    out.push({
      colour,
      initialGrade,
      finalGrade: final ? (final as Grade) : undefined,
      notes: str(form, `route-notes-${i}`) || undefined,
    })
  }
  return out
}

const imageExt = (file: File): string => {
  const m = file.name.match(/\.([a-z0-9]+)$/i)
  if (m) return m[1].toLowerCase()
  return file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
}

const readImage = async (
  form: FormData,
  setIdValue: string,
): Promise<{ write: BinaryWrite; ref: string } | null> => {
  const file = form.get('image')
  if (!(file instanceof File) || file.size === 0) return null
  const ext = imageExt(file)
  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')
  return {
    write: { path: setImagePath(setIdValue, ext), base64 },
    ref: `./image.${ext}`,
  }
}

// Re-stamp an existing set's index with a strip date, preserving its other
// frontmatter and notes.
const stripIndexWrite = (catalogue: Catalogue, setIdValue: string, stripDate: string) => {
  const set = catalogue.sets.find((s) => s.id === setIdValue)
  if (!set) throw new InputError(`Set ${setIdValue} not found`)
  return setIndexFile({
    id: set.id,
    wall: set.wall,
    setDate: set.setDate,
    stripDate,
    setters: set.setters,
    discipline: set.discipline,
    image: set.image,
    notes: set.notes,
  })
}

const saveArea = (form: FormData, catalogue: Catalogue) => {
  const name = str(form, 'name')
  if (!name) throw new InputError('Area name is required')
  const original = str(form, 'originalId')
  const id = original || slugify(name)
  const orderRaw = str(form, 'order')
  const order = orderRaw
    ? Number(orderRaw)
    : Math.max(0, ...catalogue.areas.map((a) => a.order)) + 1
  if (!Number.isInteger(order)) throw new InputError('Order must be a whole number')
  if (!original && catalogue.areas.some((a) => a.id === id)) {
    throw new InputError(`Area "${id}" already exists`)
  }
  return {
    message: `content: ${original ? 'update' : 'add'} area ${name}`,
    writes: [areaFile({ id, name, order })],
  }
}

const saveWall = (form: FormData, catalogue: Catalogue) => {
  const original = str(form, 'originalId')
  const features = splitList(str(form, 'features'))
  if (original) {
    const wall = catalogue.walls.find((w) => w.id === original)
    if (!wall) throw new InputError(`Wall ${original} not found`)
    return {
      message: `content: update wall ${wall.number}`,
      writes: [wallFile({ id: original, number: wall.number, area: wall.area, features })],
    }
  }
  const area = str(form, 'area')
  if (!catalogue.areas.some((a) => a.id === area)) throw new InputError('Pick an existing area')
  const number = Number(str(form, 'number'))
  if (!Number.isInteger(number)) throw new InputError('Wall number must be a whole number')
  const id = makeWallId(area, number)
  if (catalogue.walls.some((w) => w.id === id)) {
    throw new InputError(`Wall ${number} already exists in this area`)
  }
  return {
    message: `content: add wall ${number}`,
    writes: [wallFile({ id, number, area, features })],
  }
}

const saveSet = async (form: FormData, catalogue: Catalogue) => {
  const original = str(form, 'originalId')
  const setters = splitList(str(form, 'setters'))
  if (setters.length === 0) throw new InputError('At least one setter is required')
  const discipline = str(form, 'discipline')
  if (!isDiscipline(discipline)) throw new InputError('Pick a discipline')
  const notes = str(form, 'notes') || undefined
  const routes = parseRoutes(form)
  if (routes.length === 0) throw new InputError('Add at least one route')

  const writes: { path: string; text: string }[] = []
  const binaryWrites: BinaryWrite[] = []
  const deletes: string[] = []

  if (original) {
    const set = catalogue.sets.find((s) => s.id === original)
    if (!set) throw new InputError(`Set ${original} not found`)
    const image = await readImage(form, set.id)
    let imageRef = set.image
    if (image) {
      binaryWrites.push(image.write)
      if (set.imagePath && set.imagePath !== image.write.path) deletes.push(set.imagePath)
      imageRef = image.ref
    }
    writes.push(
      setIndexFile({
        id: set.id,
        wall: set.wall,
        setDate: set.setDate,
        stripDate: set.stripDate,
        setters,
        discipline,
        image: imageRef,
        notes,
      }),
    )
    const existing = await loadSetRoutes(catalogue, set.id)
    const keep = new Set(routes.map((r) => r.colour))
    for (const route of routes) {
      writes.push(routeFile({ id: makeRouteId(set.id, route.colour), set: set.id, ...route }))
    }
    for (const route of existing) {
      if (!keep.has(route.colour)) deletes.push(`src/content/routes/${route.id}.md`)
    }
    return { message: `content: edit set ${set.id}`, writes, binaryWrites, deletes }
  }

  // Create: resolve (or mint) the area and wall, then the set folder.
  let area = str(form, 'area')
  if (area === '__new') {
    const name = str(form, 'newAreaName')
    if (!name) throw new InputError('New area needs a name')
    area = slugify(name)
    if (!catalogue.areas.some((a) => a.id === area)) {
      const order = Math.max(0, ...catalogue.areas.map((a) => a.order)) + 1
      writes.push(areaFile({ id: area, name, order }))
    }
  } else if (!catalogue.areas.some((a) => a.id === area)) {
    throw new InputError('Pick an area')
  }

  let wall = str(form, 'wall')
  if (wall === '__new') {
    const number = Number(str(form, 'newWallNumber'))
    if (!Number.isInteger(number)) throw new InputError('New wall needs a number')
    wall = makeWallId(area, number)
    if (!catalogue.walls.some((w) => w.id === wall)) {
      writes.push(
        wallFile({ id: wall, number, area, features: splitList(str(form, 'newWallFeatures')) }),
      )
    }
  } else if (!catalogue.walls.some((w) => w.id === wall)) {
    throw new InputError('Pick a wall')
  }

  const setDate = str(form, 'setDate')
  if (!isDate(setDate)) throw new InputError('Set date must be YYYY-MM-DD')
  const id = makeSetId(setDate, wall)
  if (catalogue.sets.some((s) => s.id === id)) {
    throw new InputError('That wall already has a set on that date')
  }

  const image = await readImage(form, id)
  if (image) binaryWrites.push(image.write)

  writes.push(
    setIndexFile({
      id,
      wall,
      setDate,
      setters,
      discipline,
      image: image?.ref,
      notes,
    }),
  )
  for (const route of routes) {
    writes.push(routeFile({ id: makeRouteId(id, route.colour), set: id, ...route }))
  }

  // Auto-stamp the wall's outgoing current set so only one is ever live.
  const previous = currentSetForWall(catalogue, wall)
  if (previous && previous.id !== id) {
    writes.push(stripIndexWrite(catalogue, previous.id, setDate))
  }

  return { message: `content: set wall ${wall} on ${setDate}`, writes, binaryWrites, deletes }
}

const strip = (form: FormData, catalogue: Catalogue) => {
  const setIdValue = str(form, 'setId')
  const stripDate = str(form, 'stripDate') || todayInGym()
  if (!isDate(stripDate)) throw new InputError('Strip date must be YYYY-MM-DD')
  return {
    message: `content: strip set ${setIdValue}`,
    writes: [stripIndexWrite(catalogue, setIdValue, stripDate)],
  }
}

const remove = (form: FormData, catalogue: Catalogue) => {
  const kind = str(form, 'kind')
  const id = str(form, 'id')
  if (str(form, 'confirm') !== id) throw new InputError('Type the id exactly to confirm deletion')

  if (kind === 'set') {
    return { message: `content: delete set ${id}`, deletes: pathsForSet(catalogue, id) }
  }
  if (kind === 'wall') {
    const deletes = [wallPath(id)]
    for (const set of catalogue.sets.filter((s) => s.wall === id)) {
      deletes.push(...pathsForSet(catalogue, set.id))
    }
    return { message: `content: delete wall ${id}`, deletes }
  }
  if (kind === 'area') {
    const deletes = [areaPath(id)]
    for (const wall of catalogue.walls.filter((w) => w.area === id)) {
      deletes.push(wallPath(wall.id))
      for (const set of catalogue.sets.filter((s) => s.wall === wall.id)) {
        deletes.push(...pathsForSet(catalogue, set.id))
      }
    }
    return { message: `content: delete area ${id}`, deletes }
  }
  throw new InputError('Unknown delete target')
}

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData()
  const action = str(form, 'action')
  const returnTo = str(form, 'return') || '/admin'

  try {
    const catalogue = await loadCatalogue()
    const result =
      action === 'saveArea'
        ? saveArea(form, catalogue)
        : action === 'saveWall'
          ? saveWall(form, catalogue)
          : action === 'saveSet'
            ? await saveSet(form, catalogue)
            : action === 'strip'
              ? strip(form, catalogue)
              : action === 'delete'
                ? remove(form, catalogue)
                : null
    if (!result) throw new InputError(`Unknown action "${action}"`)

    const writes = [
      ...((result as { writes?: { path: string; text: string }[] }).writes ?? []),
      ...((result as { binaryWrites?: BinaryWrite[] }).binaryWrites ?? []),
    ]
    await commitChangeset({
      message: result.message,
      writes,
      deletes: (result as { deletes?: string[] }).deletes,
    })
    return redirect(`${returnTo}?ok=1`, 303)
  } catch (err) {
    const message = err instanceof InputError ? err.message : 'Commit failed, please retry'
    if (!(err instanceof InputError)) console.error('commit failed', err)
    return redirect(`${returnTo}?error=${encodeURIComponent(message)}`, 303)
  }
}
