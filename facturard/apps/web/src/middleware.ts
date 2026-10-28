import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// El panel DMAIA vive en su propio dominio (adminfacturard.dmaia.io) pero se sirve
// desde esta misma app: en ese dominio todo se resuelve bajo /admin, y en el dominio
// de los clientes /admin no existe (salvo en localhost, para desarrollo).

const PREFIJO_HOST_ADMIN = process.env['ADMIN_HOST_PREFIX'] ?? 'adminfacturard.'

export function middleware(req: NextRequest): NextResponse {
  const host = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '').toLowerCase()
  const { pathname } = req.nextUrl
  const esPanel = host.startsWith(PREFIJO_HOST_ADMIN)
  const esLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)

  if (esPanel) {
    if (pathname === '/admin' || pathname.startsWith('/admin/')) return NextResponse.next()
    const url = req.nextUrl.clone()
    url.pathname = pathname === '/' ? '/admin' : `/admin${pathname}`
    return NextResponse.rewrite(url)
  }

  if ((pathname === '/admin' || pathname.startsWith('/admin/')) && !esLocal) {
    return new NextResponse('Not Found', { status: 404 })
  }
  return NextResponse.next()
}

export const config = {
  // Todo menos los recursos estáticos de Next y los archivos públicos.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|woff2?)$).*)'],
}
