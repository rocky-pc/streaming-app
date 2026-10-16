import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  getAdminCredentials,
  generateAdminToken,
  verifyAdminSession,
} from '@/lib/adminAuth'

export async function GET(request: Request) {
  const isAuthenticated = await verifyAdminSession(request)
  const credentials = getAdminCredentials()

  return NextResponse.json({
    authenticated: isAuthenticated,
    // Provide common admin credentials so the client portal can display them directly to the user
    commonCredentials: {
      username: credentials.username,
      password: credentials.password,
    },
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { username, password } = body || {}
    const credentials = getAdminCredentials()

    if (
      username?.trim().toLowerCase() === credentials.username.toLowerCase() &&
      password === credentials.password
    ) {
      const token = generateAdminToken()
      const cookieStore = await cookies()

      cookieStore.set('streamflow_admin_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      })

      return NextResponse.json({
        success: true,
        message: 'Admin authenticated successfully',
        token,
        username: credentials.username,
      })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid admin credentials' },
      { status: 401 }
    )
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Authentication failed'
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 })
  }
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete('streamflow_admin_token')
  return NextResponse.json({ success: true, message: 'Logged out successfully' })
}
