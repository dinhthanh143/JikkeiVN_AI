-- Production-grade admin user search + pagination support
-- Run in SQL editor before enabling frontend admin user directory queries.

BEGIN;

-- Trigram extension supports fast ILIKE search on username/email.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Indexes for common admin users query patterns.
CREATE INDEX IF NOT EXISTS idx_users_created_at_desc
  ON public.users (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_role_is_active_created_at
  ON public.users (role, is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_username_trgm
  ON public.users USING gin (username gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_email_trgm
  ON public.users USING gin (email gin_trgm_ops);

-- SQL function for server-side filtering and pagination with total count.
CREATE OR REPLACE FUNCTION public.admin_list_users_paginated(
  p_search text DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_is_active boolean DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  email text,
  username text,
  role text,
  avatar_url text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
LANGUAGE sql
STABLE
AS $$
  WITH filtered AS (
    SELECT u.id, u.email, u.username, u.role, u.avatar_url, u.is_active, u.created_at, u.updated_at
    FROM public.users u
    WHERE (
      p_search IS NULL
      OR p_search = ''
      OR u.username ILIKE ('%' || p_search || '%')
      OR u.email ILIKE ('%' || p_search || '%')
    )
      AND (p_role IS NULL OR p_role = '' OR u.role = p_role)
      AND (p_is_active IS NULL OR u.is_active = p_is_active)
  ),
  counted AS (
    SELECT COUNT(*)::bigint AS total_count FROM filtered
  )
  SELECT
    f.id,
    f.email,
    f.username,
    f.role,
    f.avatar_url,
    f.is_active,
    f.created_at,
    f.updated_at,
    c.total_count
  FROM filtered f
  CROSS JOIN counted c
  ORDER BY f.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 100))
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

COMMIT;
