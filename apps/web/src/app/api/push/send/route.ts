import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// Setup VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:support@kdlgoods.shop',
    vapidPublicKey,
    vapidPrivateKey
  );
}

export async function POST(request: Request) {
  try {
    const { userId, title, body, url } = await request.json();

    if (!userId || !title || !body) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, title, body' },
        { status: 400 }
      );
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error('VAPID keys are missing');
      return NextResponse.json(
        { error: 'Push notifications are not configured on the server (missing VAPID keys)' },
        { status: 500 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Supabase configuration is missing' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    });

    // Fetch all active subscriptions for the target user via RPC to bypass RLS
    const { data: subscriptions, error } = await supabaseAdmin
      .rpc('get_user_push_subscriptions', { target_user_id: userId });

    if (error) {
      console.error('Error fetching subscriptions:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ success: true, sentCount: 0, message: 'No subscriptions found for user' });
    }

    const payload = JSON.stringify({
      title,
      body,
      url: url || '/'
    });

    const sendPromises = (subscriptions as any[]).map(async (sub: any) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      try {
        await webpush.sendNotification(pushSubscription, payload);
        return { success: true, id: sub.id };
      } catch (err: any) {
        console.error(`Error sending push notification to subscription ${sub.id}:`, err);
        // If the subscription is no longer active (410 Gone / 404 Not Found), delete it from the database
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabaseAdmin
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id);
          console.log(`Deleted inactive subscription: ${sub.id}`);
        }
        return { success: false, id: sub.id, error: err.message };
      }
    });

    const results = await Promise.all(sendPromises);
    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: true,
      sentCount: successCount,
      totalCount: subscriptions.length
    });
  } catch (err: any) {
    console.error('Push notification handler failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
