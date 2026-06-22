import { defineCollection, reference } from 'astro:content'
import { z } from 'astro:schema'
import { glob } from 'astro/loaders'
import { GRADES } from '@/lib/grades'
import { COLOURS } from '@/lib/colours'

// Calendar-day string, gym-local. Stored as a plain string (not a Date) so
// "the day it was set" never drifts across timezones. YAML silently parses an
// unquoted `2026-06-01` into a Date, so fold that back to the ISO day.
const dateString = z.preprocess(
  (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD'),
)

const grade = z.enum(GRADES)
const colour = z.enum(COLOURS)

const areas = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/areas' }),
  schema: z.object({
    name: z.string(),
    order: z.number().int(),
  }),
})

const walls = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/walls' }),
  schema: z.object({
    number: z.number().int(),
    area: reference('areas'),
    features: z.array(z.string()).default([]),
  }),
})

const sets = defineCollection({
  loader: glob({
    pattern: '**/index.md',
    base: './src/content/sets',
    generateId: ({ entry }) => entry.replace(/\/index\.md$/, ''),
  }),
  schema: ({ image }) =>
    z.object({
      wall: reference('walls'),
      setDate: dateString,
      stripDate: dateString.optional(),
      setters: z.array(z.string()).min(1),
      discipline: z.enum(['lead', 'top-rope', 'both']),
      image: image().optional(),
    }),
})

const routes = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/routes' }),
  schema: z.object({
    set: reference('sets'),
    colour,
    initialGrade: grade,
    finalGrade: grade.optional(),
  }),
})

export const collections = { areas, walls, sets, routes }
