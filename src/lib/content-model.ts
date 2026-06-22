import { stringify, parse } from 'yaml'
import type { Grade } from '@/lib/grades'
import type { Colour } from '@/lib/colours'

// Where each collection lives and how ids map to file paths. Ids match the
// schema's conventions so the committed files load cleanly on the next build.
export const CONTENT_ROOT = 'src/content'

export type Discipline = 'lead' | 'top-rope' | 'both'

export const slugify = (name: string): string =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const wallId = (areaId: string, number: number): string =>
  `${areaId}_${String(number).padStart(2, '0')}`

export const setId = (setDate: string, wall: string): string => `${setDate}_${wall}`

export const routeId = (set: string, colour: Colour): string => `${set}_${colour}`

export const areaPath = (id: string): string => `${CONTENT_ROOT}/areas/${id}.md`
export const wallPath = (id: string): string => `${CONTENT_ROOT}/walls/${id}.md`
export const setDir = (id: string): string => `${CONTENT_ROOT}/sets/${id}`
export const setIndexPath = (id: string): string => `${setDir(id)}/index.md`
export const setImagePath = (id: string, ext: string): string => `${setDir(id)}/image.${ext}`
export const routePath = (id: string): string => `${CONTENT_ROOT}/routes/${id}.md`

// yaml.stringify quotes numeric- and date-looking strings (grades like "5",
// dates like "2026-06-01"), so the written frontmatter round-trips intact.
export const toMarkdown = (frontmatter: Record<string, unknown>, body = ''): string => {
  const fm = stringify(frontmatter).trimEnd()
  const trimmed = body.trim()
  return `---\n${fm}\n---\n${trimmed ? `\n${trimmed}\n` : ''}`
}

export const parseMarkdown = (raw: string): { data: Record<string, unknown>; body: string } => {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) return { data: {}, body: raw }
  return { data: (parse(match[1]) as Record<string, unknown>) ?? {}, body: match[2] ?? '' }
}

export type FileWrite = { path: string; text: string }

export const areaFile = (input: { id: string; name: string; order: number }): FileWrite => ({
  path: areaPath(input.id),
  text: toMarkdown({ name: input.name, order: input.order }),
})

export const wallFile = (input: {
  id: string
  number: number
  area: string
  features: string[]
}): FileWrite => ({
  path: wallPath(input.id),
  text: toMarkdown({ number: input.number, area: input.area, features: input.features }),
})

export const setIndexFile = (input: {
  id: string
  wall: string
  setDate: string
  stripDate?: string
  setters: string[]
  discipline: Discipline
  // Relative path to the co-located image, e.g. "./image.jpg".
  image?: string
  notes?: string
}): FileWrite => {
  const frontmatter: Record<string, unknown> = {
    wall: input.wall,
    setDate: input.setDate,
    ...(input.stripDate ? { stripDate: input.stripDate } : {}),
    setters: input.setters,
    discipline: input.discipline,
    ...(input.image ? { image: input.image } : {}),
  }
  return { path: setIndexPath(input.id), text: toMarkdown(frontmatter, input.notes) }
}

export const routeFile = (input: {
  id: string
  set: string
  colour: Colour
  initialGrade: Grade
  finalGrade?: Grade
  notes?: string
}): FileWrite => {
  const frontmatter: Record<string, unknown> = {
    set: input.set,
    colour: input.colour,
    initialGrade: input.initialGrade,
    ...(input.finalGrade ? { finalGrade: input.finalGrade } : {}),
  }
  return { path: routePath(input.id), text: toMarkdown(frontmatter, input.notes) }
}
