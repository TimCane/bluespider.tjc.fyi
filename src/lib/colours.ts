// Hold colours, unique within a set (a route's natural key). Single colours
// plus the gym's two-tone tape combos. Pale chips need a border and dark text.
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
  'mint',
  'beige',
  'fluro-yellow',
  'orange-black',
  'purple-white',
  'red-white',
  'yellow-blue',
] as const

export type Colour = (typeof COLOURS)[number]

type Chip = {
  hex: string
  // Second colour for two-tone tape; the chip renders as a diagonal split.
  hex2?: string
  // Pale chips get a hairline border so they read against the card.
  border: boolean
  // Dark label text instead of white.
  dark: boolean
}

export const COLOUR_CHIP: Record<Colour, Chip> = {
  red: { hex: '#d22d2d', border: false, dark: false },
  orange: { hex: '#e07b1a', border: false, dark: false },
  yellow: { hex: '#f2c400', border: true, dark: true },
  green: { hex: '#2e9e4f', border: false, dark: false },
  blue: { hex: '#2563c9', border: false, dark: false },
  purple: { hex: '#7a3ec0', border: false, dark: false },
  pink: { hex: '#e0559b', border: false, dark: false },
  black: { hex: '#1a1a1a', border: false, dark: false },
  white: { hex: '#ffffff', border: true, dark: true },
  grey: { hex: '#9aa0a6', border: false, dark: false },
  teal: { hex: '#1aa1a1', border: false, dark: false },
  mint: { hex: '#4cc79a', border: false, dark: false },
  beige: { hex: '#cbb083', border: true, dark: true },
  'fluro-yellow': { hex: '#d6f520', border: true, dark: true },
  'orange-black': { hex: '#e07b1a', hex2: '#1a1a1a', border: false, dark: false },
  'purple-white': { hex: '#7a3ec0', hex2: '#ffffff', border: true, dark: false },
  'red-white': { hex: '#d22d2d', hex2: '#ffffff', border: true, dark: false },
  'yellow-blue': { hex: '#f2c400', hex2: '#2563c9', border: false, dark: false },
}

// Human label, e.g. "fluro-yellow" -> "Fluro yellow", "orange-black" -> "Orange & black".
export const colourLabel = (colour: Colour): string => {
  const words = colour.replace('-', ' & ').replace('fluro & ', 'fluro ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

// CSS background for a chip or swatch: a diagonal split for two-tone.
export const chipBackground = (colour: Colour): string => {
  const chip = COLOUR_CHIP[colour]
  return chip.hex2 ? `linear-gradient(135deg, ${chip.hex} 0 50%, ${chip.hex2} 50% 100%)` : chip.hex
}

export const chipTextColour = (colour: Colour): string =>
  COLOUR_CHIP[colour].dark ? '#1a1a1a' : '#ffffff'
