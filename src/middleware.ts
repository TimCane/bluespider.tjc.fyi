import { defineMiddleware } from 'astro:middleware'
import { isAuthed } from '@/lib/auth'

// Guard the authoring surface. /admin (the login page) and /api/login stay open;
// everything deeper requires a valid session.
export const onRequest = defineMiddleware((context, next) => {
  const path = context.url.pathname

  if (path === '/api/commit' && !isAuthed(context.cookies)) {
    return new Response('Unauthorized', { status: 401 })
  }

  if ((path.startsWith('/admin/') || path === '/api/logout') && !isAuthed(context.cookies)) {
    return context.redirect('/admin')
  }

  return next()
})
