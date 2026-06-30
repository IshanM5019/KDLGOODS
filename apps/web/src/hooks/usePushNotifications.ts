'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';

const supabase = createClient();

// Helper to convert base64 to Uint8Array for VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(true);

  // Check current permission and subscription state
  const checkSubscription = useCallback(async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setLoading(false);
      return;
    }

    try {
      setPermission(Notification.permission);

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      
      if (sub) {
        setIsSubscribed(true);
      } else {
        setIsSubscribed(false);
      }
    } catch (err) {
      console.error('Error checking push subscription:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  const subscribeToPush = async (userId: string) => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push messaging is not supported in this browser.');
      return false;
    }

    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;

      // Request notification permission if not granted
      let currentPermission = Notification.permission;
      if (currentPermission === 'default') {
        currentPermission = await Notification.requestPermission();
        setPermission(currentPermission);
      }

      if (currentPermission !== 'granted') {
        throw new Error('Permission not granted for notifications');
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        throw new Error('VAPID public key is missing in environment variables');
      }

      const applicationServerKey = urlBase64ToUint8Array(vapidKey);

      // Subscribe to the push service
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });

      // Format keys for saving to DB
      const subJSON = subscription.toJSON();
      const endpoint = subJSON.endpoint;
      const p256dh = subJSON.keys?.p256dh;
      const auth = subJSON.keys?.auth;

      if (!endpoint || !p256dh || !auth) {
        throw new Error('Subscription details could not be parsed');
      }

      // Upsert subscription to Supabase push_subscriptions table
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: userId,
          endpoint,
          p256dh,
          auth
        }, {
          onConflict: 'endpoint'
        });

      if (error) {
        throw error;
      }

      setIsSubscribed(true);
      return true;
    } catch (err) {
      console.error('Failed to subscribe to push notifications:', err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const unsubscribeFromPush = async (userId: string) => {
    if (!('serviceWorker' in navigator)) return false;

    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();

      if (sub) {
        // Delete from database first
        const endpoint = sub.endpoint;
        const { error } = await supabase
          .from('push_subscriptions')
          .delete()
          .match({ user_id: userId, endpoint });

        if (error) {
          console.error('Failed to delete subscription from DB, but will attempt local unsubscribe:', error);
        }

        // Unsubscribe locally
        const success = await sub.unsubscribe();
        if (success) {
          setIsSubscribed(false);
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error('Failed to unsubscribe from push notifications:', err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    isSubscribed,
    permission,
    loading,
    subscribeToPush,
    unsubscribeFromPush,
    checkSubscription
  };
}
