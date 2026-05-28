import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { usePlayerStore } from '@/store/usePlayerStore'

interface NavbarProps {
  title?: string
}

export default function Navbar({ title = 'JIKKEI' }: NavbarProps) {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const { user, isInitialized } = usePlayerStore()

  return (
    <nav className="fixed top-0 w-full z-50 bg-[rgba(10,10,15,0.85)] backdrop-blur-md border-b border-[#e91e8c]">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <span className="text-xl font-black text-white">{title}</span>
          <span className="text-[#e91e8c] text-xl">•</span>
        </Link>

        {/* Center Navigation Links */}
        <div className="hidden md:flex items-center gap-8">
          <a
            href="/explore"
            className="text-xs uppercase font-semibold text-white tracking-widest hover:text-[#e91e8c] transition"
          >
            Explore
          </a>
          <a
            href="/create"
            className="text-xs uppercase font-semibold text-white tracking-widest hover:text-[#e91e8c] transition"
          >
            Create
          </a>
          <a
            href="#community"
            className="text-xs uppercase font-semibold text-white tracking-widest hover:text-[#e91e8c] transition"
          >
            Community
          </a>
        </div>

        {/* Right Side Buttons */}
        <div className="flex items-center gap-3">
          {isInitialized ? (
            user ? (
              <>
                <button
                  type="button"
                  onClick={() => navigate('/profile/' + user.id)}
                  className="px-3 py-2 text-xs uppercase font-bold text-[#ffffff] border border-[#e91e8c] hover:bg-[#e91e8c] hover:text-[#0a0a0f] transition"
                >
                  ◈
                </button>
                <button
                  type="button"
                  className="px-3 py-2 text-xs uppercase font-bold text-[#ffffff] border border-[#e91e8c] hover:bg-[#e91e8c] hover:text-[#0a0a0f] transition"
                >
                  ◉
                </button>
                <button
                  type="button"
                  className="px-4 py-2 text-xs uppercase font-bold text-[#e91e8c] border border-[#e91e8c] hover:bg-[#e91e8c] hover:text-[#0a0a0f] transition"
                >
                  {user.username}
                  {user.role === 'admin' ? ' · ADMIN' : ''}
                </button>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="px-4 py-2 text-xs uppercase font-bold text-[#0a0a0f] bg-[#e91e8c] hover:bg-[#ff2d78] transition"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => navigate('/auth')}
                  className="px-4 py-2 text-xs uppercase font-bold text-[#e91e8c] border border-[#e91e8c] hover:bg-[#e91e8c] hover:text-[#0a0a0f] transition"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/auth')}
                  className="px-4 py-2 text-xs uppercase font-bold text-[#0a0a0f] bg-[#e91e8c] hover:bg-[#ff2d78] transition"
                >
                  Play Free
                </button>
              </>
            )
          ) : null}
        </div>
      </div>
    </nav>
  )
}
