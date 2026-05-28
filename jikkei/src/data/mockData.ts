export interface Story {
  id: number
  title: string
  subtitle: string
  genre: string
  status: string
  chapter: string
  color: string
  thumb: string
}

export interface Character {
  id: number
  name: string
  archetype: string
  affinity: number
  color: string
}

export const STORIES: Story[] = [
  { id: 1, title: 'NEON SHATTER', subtitle: 'Only those who can see through the signal will survive the final reboot.', genre: 'SCI-FI · AI', status: 'TRENDING', chapter: 'CH.04', color: '#e91e8c', thumb: '' },
  { id: 2, title: 'NULL POINTER', subtitle: 'She remembers everything. You remember nothing. This is not a coincidence.', genre: 'THRILLER · MYSTERY', status: 'NEW', chapter: 'CH.01', color: '#ff2d78', thumb: '' },
  { id: 3, title: 'ANALOG DREAMS', subtitle: 'In a city where emotions are currency, yours are worth more than you know.', genre: 'ROMANCE · CYBERPUNK', status: 'POPULAR', chapter: 'CH.07', color: '#c2185b', thumb: '' },
  { id: 4, title: 'GHOST PROTOCOL', subtitle: 'The last message she ever sent was to you. Three years after her death.', genre: 'HORROR · DRAMA', status: 'HOT', chapter: 'CH.02', color: '#e91e8c', thumb: '' },
]

export const CHARACTERS: Character[] = [
  { id: 1, name: 'YUKI_01', archetype: 'The Strategist', affinity: 87, color: '#e91e8c' },
  { id: 2, name: 'REI_X', archetype: 'The Phantom', affinity: 62, color: '#ff2d78' },
  { id: 3, name: 'ATLAS', archetype: 'The Warden', affinity: 44, color: '#c2185b' },
  { id: 4, name: 'MIRA_9', archetype: 'The Oracle', affinity: 91, color: '#ff85b3' },
  { id: 5, name: 'ZERO', archetype: 'The Ghost', affinity: 33, color: '#e91e8c' },
  { id: 6, name: 'SABLE', archetype: 'The Heir', affinity: 75, color: '#ff2d78' },
]