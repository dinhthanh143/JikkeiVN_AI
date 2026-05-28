import api from './api'
import type { CharacterCard } from '@/types/character'
import type { PaginatedResponse } from '@/types/api'

export async function getCharacter(id: string): Promise<CharacterCard> {
  const response = await api.get<CharacterCard>(`/characters/${id}`)
  return response.data
}

export async function getCharacters(page = 1, limit = 20): Promise<PaginatedResponse<CharacterCard>> {
  const response = await api.get<PaginatedResponse<CharacterCard>>('/characters', {
    params: { page, limit },
  })
  return response.data
}

export async function createCharacter(character: Partial<CharacterCard>): Promise<CharacterCard> {
  const response = await api.post<CharacterCard>('/characters', character)
  return response.data
}

export async function updateCharacter(
  id: string,
  character: Partial<CharacterCard>
): Promise<CharacterCard> {
  const response = await api.put<CharacterCard>(`/characters/${id}`, character)
  return response.data
}

export async function deleteCharacter(id: string): Promise<void> {
  await api.delete(`/characters/${id}`)
}
