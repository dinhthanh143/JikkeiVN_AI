import { useQuery, useMutation } from '@tanstack/react-query'
import { getCharacter, updateCharacter, createCharacter } from '@/services/characterService'
import type { CharacterCard } from '@/types/character'

export function useCharacter(characterId: string) {
  return useQuery({
    queryKey: ['character', characterId],
    queryFn: () => getCharacter(characterId),
    enabled: !!characterId,
  })
}

export function useCreateCharacter() {
  return useMutation({
    mutationFn: (character: Partial<CharacterCard>) => createCharacter(character),
  })
}

export function useUpdateCharacter() {
  return useMutation({
    mutationFn: ({ id, ...character }: Partial<CharacterCard> & { id: string }) =>
      updateCharacter(id, character),
  })
}
