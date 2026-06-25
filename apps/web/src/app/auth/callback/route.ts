import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // If "next" is in params, use it as the redirect URL
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Fetch user profile to determine role-based redirect
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        // If the profile is missing in the database, fallback to the role from user metadata or 'customer'
        let role = user.user_metadata?.role || 'customer';
        if (!profileErr && profile) {
          role = profile.role;
        }

        if (role === 'seller') {
          return NextResponse.redirect(`${origin}/seller/dashboard`);
        } else if (role === 'delivery') {
          return NextResponse.redirect(`${origin}/delivery/dashboard`);
        } else {
          return NextResponse.redirect(`${origin}/customer/dashboard`);
        }
      }

      // Fallback if no profile found
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/signin?error=Could+not+verify+email.+Please+try+again.`);
}
