import api from './api'
import type { Story } from '@/types/story'
import type { PaginatedResponse } from '@/types/api'

export async function getStory(id: string): Promise<Story> {
  const response = await api.get<Story>(`/stories/${id}`)
  return response.data
}

export async function getStories(page = 1, limit = 20): Promise<PaginatedResponse<Story>> {
  const response = await api.get<PaginatedResponse<Story>>('/stories', {
    params: { page, limit },
  })
  return response.data
}

export async function createStory(story: Partial<Story>): Promise<Story> {
  const response = await api.post<Story>('/stories', story)
  return response.data
}

export async function updateStory(id: string, story: Partial<Story>): Promise<Story> {
  const response = await api.put<Story>(`/stories/${id}`, story)
  return response.data
}

export async function deleteStory(id: string): Promise<void> {
  await api.delete(`/stories/${id}`)
}
