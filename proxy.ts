import { NextResponse, type NextRequest } from "next/server"

function unauthorized(message = "Authentication required") {
  return new NextResponse(message, {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Arc Networth", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  })
}

function getBasicPassword(request: NextRequest) {
  const authorization = request.headers.get("authorization")

  if (!authorization?.startsWith("Basic ")) {
    return null
  }

  try {
    const decoded = atob(authorization.slice("Basic ".length))
    const separatorIndex = decoded.indexOf(":")

    return separatorIndex === -1 ? null : decoded.slice(separatorIndex + 1)
  } catch {
    return null
  }
}

export function proxy(request: NextRequest) {
  const password = process.env.APP_PASSWORD

  if (!password) {
    return unauthorized("APP_PASSWORD is not set")
  }

  if (getBasicPassword(request) !== password) {
    return unauthorized()
  }

  const response = NextResponse.next()
  response.headers.set("Cache-Control", "no-store")
  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
}
