// Hold colours, unique within a set (a route's natural key). Sets run 3-5
// routes, so the 11-colour ceiling never bites.
export const COLOURS = [
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
  'black',
  'white',
  'grey',
  'teal',
] as const

export type Colour = (typeof COLOURS)[number]

type Chip = {
  hex: string
  // Pale chips need a border to read against the page and dark label text.
  border: boolean
}

export const COLOUR_CHIP: Record<Colour, Chip> = {
  red: { hex: '#d22d2d', border: false },
  orange: { hex: '#e07b1a', border: false },
  yellow: { hex: '#f2c400', border: true },
  green: { hex: '#2e9e4f', border: false },
  blue: { hex: '#2563c9', border: false },
  purple: { hex: '#7a3ec0', border: false },
  pink: { hex: '#e0559b', border: false },
  black: { hex: '#1a1a1a', border: false },
  white: { hex: '#ffffff', border: true },
  grey: { hex: '#9aa0a6', border: false },
  teal: { hex: '#1aa1a1', border: false },
}

// Dark label text for pale chips, light text for the rest.
export const chipTextColour = (colour: Colour): string =>
  COLOUR_CHIP[colour].border ? '#1a1a1a' : '#ffffff'
