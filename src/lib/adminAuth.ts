import { cookies } from 'next/headers'

export const ADMIN_DEFAULT_USERNAME = process.env.ADMIN_USERNAME || 'admin'
export const ADMIN_DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'

// Token signature constant
const ADMIN_SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY || 'streamflow_admin_secret_key_2026'

export function getAdminCredentials() {
  return {
    username: ADMIN_DEFAULT_USERNAME,
    password: ADMIN_DEFAULT_PASSWORD,
  }
}

export function generateAdminToken(): string {
  // Simple deterministic or timestamped session signature
  const raw = `${ADMIN_DEFAULT_USERNAME}:${ADMIN_SECRET}`
  return Buffer.from(raw).toString('base64')
}

export async function verifyAdminSession(req?: Request): Promise<boolean> {
  const expectedToken = generateAdminToken()

  // 1. Check Authorization header
  if (req) {
    const authHeader = req.headers.get('authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim()
      if (token === expectedToken) return true
    }
  }

  // 2. Check cookies
  try {
    const cookieStore = await cookies()
    const cookieToken = cookieStore.get('streamflow_admin_token')?.value
    if (cookieToken && cookieToken === expectedToken) {
      return true
    }
  } catch {
    // If called outside server request context
  }

  return false
}
