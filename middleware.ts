// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data } = await supabase.auth.getUser();
  const isAuthed = !!data.user;

  const path = req.nextUrl.pathname;

  const isLoginOwner = path === "/login" || path.startsWith("/login/");
  const isLoginStaff = path === "/staff/login" || path.startsWith("/staff/login/");
  const isAuthApi = path.startsWith("/api/auth"); // callback, logout, dll (kalau ada)
  const isApi = path.startsWith("/api");
  const isPublicAsset = path.startsWith("/_next") || path === "/favicon.ico";

  // ✅ public routes
  const isPublicRoute = isLoginOwner || isLoginStaff || isApi || isAuthApi;

  if (isPublicAsset) return res;

  // ✅ kalau belum login, boleh akses /login dan /staff/login (dan /api)
  if (!isAuthed && !isPublicRoute) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // ✅ kalau sudah login, jangan balik ke halaman login manapun
  if (isAuthed && (isLoginOwner || isLoginStaff)) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};