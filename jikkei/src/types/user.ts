export interface User {
  id: string
  email: string
  username: string
  display_name: string | null
  role: 'user' | 'admin'
  avatar_url: string | null
  created_at: string
  is_active: boolean
  tier: 'free' | 'premium'
}

export type UserRole = User['role']
