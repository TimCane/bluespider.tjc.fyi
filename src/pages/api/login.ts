import type { APIRoute } from 'astro'
import { checkPassword, startSession } from '@/lib/auth'

export const prerender = false

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData()
  if (!checkPassword(String(form.get('password') ?? ''))) {
    return redirect(`/admin?error=${encodeURIComponent('Wrong password')}`, 303)
  }
  startSession(cookies)
  return redirect('/admin', 303)
}
