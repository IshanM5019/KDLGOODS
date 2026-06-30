'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { Order, OrderStatus, DANTEWADA_CENTER, TOWN_NAME, formatINR } from '@kdlgoods/shared';
import {
  Navigation, Loader2, Award, Check, MapPin,
  ToggleLeft, ToggleRight, ShieldAlert, ArrowRight, RefreshCw,
  MessageSquare, DollarSign, LifeBuoy, CreditCard, ChevronRight,
  TrendingUp, Send, CheckCircle2, User, Landmark, HelpCircle, PhoneCall,
  ChevronDown, MessageCircle, AlertTriangle, History
} from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

// Programmatic chime using Web Audio API
function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();
    
    const notes = [
      { freq: 523.25, timeOffset: 0, duration: 0.15 }, // C5
      { freq: 659.25, timeOffset: 0.1, duration: 0.15 }, // E5
      { freq: 783.99, timeOffset: 0.2, duration: 0.3 }  // G5
    ];

    notes.forEach(note => {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.freq, audioCtx.currentTime + note.timeOffset);
      
      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime + note.timeOffset);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + note.timeOffset + note.duration);
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.start(audioCtx.currentTime + note.timeOffset);
      osc.stop(audioCtx.currentTime + note.timeOffset + note.duration);
    });
  } catch (err) {
    console.error('Failed to play notification sound:', err);
  }
}

function triggerBrowserNotification(title: string, body: string) {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/icon-192.png',
          silent: true
        });
      } catch (err) {
        console.error('Failed to show browser notification:', err);
      }
    }
  }
}



interface ChatMessage {
  id: string;
  sender: 'driver' | 'partner';
  text: string;
  timestamp: string;
}

interface Transaction {
  id: string;
  type: 'delivery' | 'cashout';
  amount: number;
  description: string;
  date: string;
}

export default function DeliveryDashboard() {
  const router = useRouter();
  const {
    isSubscribed: pushSubscribed,
    subscribeToPush,
    unsubscribeFromPush,
    loading: pushLoading
  } = usePushNotifications();
  const [activeTab, setActiveTab] = useState<'jobs' | 'earnings' | 'support' | 'profile'>('jobs');
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('kdlgoods_driver_online') === 'true';
    }
    return false;
  });
  const [driverId, setDriverId] = useState('driver-uuid-placeholder-123');
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('');
  const [profileAddress, setProfileAddress] = useState('');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securitySuccess, setSecuritySuccess] = useState<string | null>(null);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifPush, setNotifPush] = useState(true);
  const [loadingUser, setLoadingUser] = useState(true);
  const [dbConnected, setDbConnected] = useState(true);
  const [pastDeliveries, setPastDeliveries] = useState<any[]>([]);
  const [loadingPastDeliveries, setLoadingPastDeliveries] = useState(false);
  const [activeOrder, setActiveOrder] = useState<Order | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kdlgoods_driver_active_order');
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  });
  const [showAlert, setShowAlert] = useState(false);
 
  const [coords, setCoords] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kdlgoods_driver_coords');
      if (saved) return JSON.parse(saved);
    }
    return DANTEWADA_CENTER;
  });

  useEffect(() => {
    localStorage.setItem('kdlgoods_driver_online', String(isOnline));
  }, [isOnline]);

  useEffect(() => {
    localStorage.setItem('kdlgoods_driver_coords', JSON.stringify(coords));
  }, [coords]);

  // Real Geolocation Tracking
  useEffect(() => {
    if (!isOnline) return;

    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCoords({ latitude, longitude });
        },
        (error) => {
          console.warn('Initial geolocation error:', error);
        },
        { enableHighAccuracy: true }
      );

      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCoords({ latitude, longitude });
        },
        (error) => {
          console.warn('Geolocation watch error:', error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 10000,
          timeout: 5000,
        }
      );

      return () => {
        navigator.geolocation.clearWatch(watchId);
      };
    }
  }, [isOnline]);

  // Auto upload coordinates to database
  useEffect(() => {
    if (isOnline && coords && driverId && driverId !== 'driver-uuid-placeholder-123') {
      updateDriverLocation();
    }
  }, [coords, isOnline, driverId]);

  useEffect(() => {
    if (activeOrder) {
      localStorage.setItem('kdlgoods_driver_active_order', JSON.stringify(activeOrder));
    } else {
      localStorage.removeItem('kdlgoods_driver_active_order');
    }
  }, [activeOrder]);

  // Drag-to-Accept Slider State
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);

  // Chat Drawer State
  const [showChat, setShowChat] = useState(false);
  const [chatPartner, setChatPartner] = useState<'customer' | 'merchant'>('customer');
  const [chatInput, setChatInput] = useState('');
  const [dbMessages, setDbMessages] = useState<any[]>([]);

  const customerMessages = dbMessages
    .filter(m => (m.sender_role === 'customer' || m.recipient_role === 'customer' || !m.recipient_role))
    .map(m => ({
      id: m.id,
      sender: m.sender_role === 'delivery' ? 'driver' : 'partner',
      text: m.text,
      timestamp: new Date(m.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }));

  const merchantMessages = dbMessages
    .filter(m => (m.sender_role === 'seller' || m.recipient_role === 'seller' || !m.recipient_role))
    .map(m => ({
      id: m.id,
      sender: m.sender_role === 'delivery' ? 'driver' : 'partner',
      text: m.text,
      timestamp: new Date(m.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }));

  // Earnings & Cashout State
  const [balance, setBalance] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseFloat(localStorage.getItem('kdlgoods_rider_balance') || '950');
    }
    return 950;
  });
  const [showCashoutModal, setShowCashoutModal] = useState(false);
  const [cashoutProcessing, setCashoutProcessing] = useState(false);
  const [cashoutSuccess, setCashoutSuccess] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([
    { id: 'TXN-9982', type: 'delivery', amount: 55, description: 'Order #291A (Base + Tip)', date: 'Today, 08:30 PM' },
    { id: 'TXN-9981', type: 'delivery', amount: 75, description: 'Order #182B (Distance Bonus)', date: 'Today, 07:15 PM' },
    { id: 'TXN-9980', type: 'delivery', amount: 120, description: 'Order #884C (Rain Surge Pay)', date: 'Yesterday, 09:10 PM' }
  ]);

  // Driver Cash-to-UPI Submission State
  const [cashTxnId, setCashTxnId] = useState('');
  const [cashScreenshot, setCashScreenshot] = useState<string | null>(null);
  const [cashSubmitting, setCashSubmitting] = useState(false);

  // Contact States
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const [sellerPhone, setSellerPhone] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string>('Customer');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [sellerName, setSellerName] = useState<string>('Store Manager');

  useEffect(() => {
    if (!activeOrder) {
      setCustomerPhone(null);
      setSellerPhone(null);
      return;
    }

    const fetchContacts = async () => {
      try {
        const { data: customerData } = await supabase
          .from('profiles')
          .select('phone_number, full_name, address')
          .eq('id', activeOrder.customer_id)
          .single();
        if (customerData) {
          setCustomerPhone(customerData.phone_number || '+91 99999 12345');
          setCustomerName(customerData.full_name || 'Customer');
          setCustomerAddress(customerData.address || '');
        } else {
          setCustomerPhone('+91 99999 12345');
          setCustomerName('Customer');
          setCustomerAddress('');
        }

        const { data: sellerData } = await supabase
          .from('profiles')
          .select('phone_number, full_name')
          .eq('id', activeOrder.seller_id)
          .single();
        if (sellerData) {
          setSellerPhone(sellerData.phone_number || '+91 88888 54321');
          setSellerName(sellerData.full_name || 'Store Manager');
        } else {
          setSellerPhone('+91 88888 54321');
          setSellerName('Store Manager');
        }
      } catch (err) {
        console.warn('Real-time database fetch failed, setting simulation contact phone numbers:', err);
        setCustomerPhone('+91 99999 12345');
        setSellerPhone('+91 88888 54321');
      }
    };

    fetchContacts();
  }, [activeOrder?.id, activeOrder?.customer_id, activeOrder?.seller_id]);

  // Support Chatbot State
  const [supportMessages, setSupportMessages] = useState<ChatMessage[]>([
    { id: '1', sender: 'partner', text: 'Hello! I am your KDL Support Assistant. How can I help you today?', timestamp: '10:15 PM' }
  ]);
  const [supportInput, setSupportInput] = useState('');
  const [supportLoading, setSupportLoading] = useState(false);

  const checkActiveOrder = async (currentDriverId: string) => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('delivery_partner_id', currentDriverId)
        .in('status', ['accepted', 'preparing', 'awaiting_pickup', 'driver_accepted', 'picked_up', 'out_for_delivery'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error && data) {
        setActiveOrder(data as Order);
        if (['accepted', 'preparing', 'awaiting_pickup'].includes(data.status)) {
          setShowAlert(true);
        }
      }
      setDbConnected(true);
    } catch (err) {
      console.warn('Failed to fetch active driver order:', err);
      setDbConnected(false);
    }
  };

  useEffect(() => {
    // Request notification permission on mount
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        router.push('/auth/signin');
      }
    });

    const fetchUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        let user = session?.user;
        if (!user) {
          const { data: { user: apiUser } } = await supabase.auth.getUser();
          user = apiUser || undefined;
        }

        if (!user) {
          router.push('/auth/signin');
          return;
        }

        // Verify role
        let { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('role, phone_number, full_name, avatar_url, address')
          .eq('id', user.id)
          .single();

        if (profileErr || !profile) {
          // If the profile is missing in the database, insert it on the fly
          const { data: newProfile, error: insertErr } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              role: 'delivery',
              full_name: user.user_metadata?.full_name || user.user_metadata?.name || 'User',
              phone_number: user.phone || null,
            })
            .select()
            .single();
          if (!insertErr && newProfile) {
            profile = newProfile;
          }
        }

        const userRole = profile?.role || user.user_metadata?.role || 'customer';
        setUserPhone(profile?.phone_number || null);
        setProfileName(profile?.full_name || '');
        setProfileAvatarUrl(profile?.avatar_url || '');
        setProfileAddress(profile?.address || '');
        if (userRole !== 'delivery') {
          if (userRole === 'seller') {
            router.push('/seller/dashboard');
          } else {
            router.push('/customer/dashboard');
          }
          return;
        }

        setDriverId(user.id);
        const currentDriverId = user.id;

        // Fetch existing active order
        await checkActiveOrder(currentDriverId);

        // Ensure delivery_partner row exists to prevent error on balance fetch
        const { data: checkPartner } = await supabase
          .from('delivery_partners')
          .select('id')
          .eq('id', user.id)
          .maybeSingle();
        
        if (!checkPartner) {
          await supabase
            .from('delivery_partners')
            .insert({ id: user.id, is_online: false, balance: 0.00 });
        }

        // Fetch balance from delivery_partners
        const { data: partnerData } = await supabase
          .from('delivery_partners')
          .select('balance')
          .eq('id', user.id)
          .single();
        if (partnerData) {
          setBalance(Number(partnerData.balance) || 0);
          localStorage.setItem('kdlgoods_rider_balance', String(partnerData.balance || '0'));
        }

        // Fetch past deliveries for order history
        await fetchPastDeliveries(currentDriverId);

        // Sync coordinate to local storage on mount so customer & seller pages can read it immediately
        const partners = JSON.parse(localStorage.getItem('kdlgoods_delivery_partners') || '{}');
        partners[currentDriverId] = {
          id: currentDriverId,
          is_online: isOnline,
          location: { latitude: coords.latitude, longitude: coords.longitude },
          updated_at: new Date().toISOString()
        };
        localStorage.setItem('kdlgoods_delivery_partners', JSON.stringify(partners));
        window.dispatchEvent(new Event('storage'));
      } catch (err) {
        console.error('Failed to get delivery partner user/balance:', err);
        setDbConnected(false);
      } finally {
        setLoadingUser(false);
      }
    };
    fetchUser();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Real-time Chat Sync & Storage Sync for Offline mode
  useEffect(() => {
    if (!activeOrder) {
      setDbMessages([]);
      return;
    }

    const loadMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('order_messages')
          .select('*')
          .eq('order_id', activeOrder.id)
          .order('created_at', { ascending: true });
        if (!error && data) {
          setDbMessages(data);
        }
      } catch (err) {
        console.error('Failed to load db messages:', err);
      }
    };
    loadMessages();

    // Subscribe to database chat updates
    const channel = supabase
      .channel(`order-chat-delivery-${activeOrder.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'order_messages', 
        filter: `order_id=eq.${activeOrder.id}` 
      }, (payload) => {
        setDbMessages(prev => {
          if (prev.some(m => m.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });
        playNotificationSound();
      })
      .subscribe();

    const syncLocalChats = () => {
      const localChats = JSON.parse(localStorage.getItem('kdlgoods_chats') || '[]');
      const filtered = localChats.filter((m: any) => m.order_id === activeOrder.id);
      setDbMessages(filtered);
    };

    syncLocalChats();
    const interval = setInterval(syncLocalChats, 1000);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'kdlgoods_chats') {
        syncLocalChats();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [activeOrder?.id]);

  useEffect(() => {
    if (loadingUser) return;

    if (!isOnline) {
      setActiveOrder(null);
      setShowAlert(false);
      return;
    }

    updateDriverLocation();

    // Subscribe to order assignments where delivery_partner_id = driverId
    const orderSubscription = supabase
      .channel('driver-assignments-web')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload: any) => {
          const updatedOrder = payload.new as Order;
          const isAssignedToMe = updatedOrder.delivery_partner_id === driverId;
          
          if (isAssignedToMe) {
            // 1. Check if the order was cancelled
            if (updatedOrder.status === 'cancelled') {
              if (activeOrder && activeOrder.id === updatedOrder.id) {
                setActiveOrder(null);
                localStorage.removeItem('kdlgoods_driver_active_order');
                playNotificationSound();
                alert('⚠️ The active order has been cancelled by the customer.');
                triggerBrowserNotification(
                  '❌ Order Cancelled',
                  'The active order has been cancelled by the customer.'
                );
              }
              return;
            }

            // 2. Check if we already have this order active and its status changed
            if (activeOrder && activeOrder.id === updatedOrder.id) {
              const oldStatus = activeOrder.status;
              setActiveOrder(updatedOrder);
              localStorage.setItem('kdlgoods_driver_active_order', JSON.stringify(updatedOrder));
              
              // Notify driver if store marks it as ready/prepared
              if (oldStatus !== 'awaiting_pickup' && updatedOrder.status === 'awaiting_pickup') {
                playNotificationSound();
                triggerBrowserNotification(
                  '📦 Order Ready for Pickup!',
                  `The merchant has prepared the order. Please collect it.`
                );
              }
              return;
            }
            
            // 3. If we don't have an active order, show the dispatch alert for incoming orders
            const isAwaitingAction = ['accepted', 'preparing', 'awaiting_pickup'].includes(updatedOrder.status);
            if (!activeOrder && isAwaitingAction) {
              setActiveOrder(updatedOrder);
              localStorage.setItem('kdlgoods_driver_active_order', JSON.stringify(updatedOrder));
              setShowAlert(true);
              
              playNotificationSound();
              triggerBrowserNotification(
                '⚡ New Dispatch Request!',
                `Deliver to: ${updatedOrder.delivery_address}. Swipe to accept.`
              );
            }
          }
        }
      )
      .subscribe();

    // Local Storage Offline Poll Fallback
    const checkLocalInterval = setInterval(() => {
      if (!dbConnected) {
        const local = JSON.parse(localStorage.getItem('kdlgoods_orders') || '[]');
        
        // If our active order is cancelled in local storage, clear it
        if (activeOrder) {
          const currentLocalOrder = local.find((o: any) => o.id === activeOrder.id);
          if (currentLocalOrder && currentLocalOrder.status === 'cancelled') {
            setActiveOrder(null);
            localStorage.removeItem('kdlgoods_driver_active_order');
            alert('⚠️ The active order has been cancelled by the customer.');
            return;
          }
        }
        
        const ongoingOrder = local.find((o: any) => 
          o.delivery_partner_id === driverId && 
          ['driver_accepted', 'picked_up', 'out_for_delivery'].includes(o.status)
        );
        if (ongoingOrder && (!activeOrder || activeOrder.status !== ongoingOrder.status)) {
          setActiveOrder(ongoingOrder);
          setShowAlert(false);
          return;
        }

        const pendingIndex = local.findIndex((o: any) => 
          ['accepted', 'preparing', 'awaiting_pickup'].includes(o.status) && 
          (!o.delivery_partner_id || o.delivery_partner_id === driverId)
        );

        if (pendingIndex !== -1) {
          if (!local[pendingIndex].delivery_partner_id) {
            local[pendingIndex].delivery_partner_id = driverId;
            localStorage.setItem('kdlgoods_orders', JSON.stringify(local));
          }
          if (!activeOrder || activeOrder.id !== local[pendingIndex].id) {
            const matchedOrder = local[pendingIndex];
            setActiveOrder(matchedOrder);
            setShowAlert(true);
            
            // Trigger alerts
            playNotificationSound();
            triggerBrowserNotification(
              '⚡ New Dispatch Request!',
              `Deliver to: ${matchedOrder.delivery_address}. Swipe to accept.`
            );
          }
        }
      }

      // Poll local storage balance update
      const localBal = localStorage.getItem('kdlgoods_rider_balance');
      if (localBal) setBalance(parseFloat(localBal));
    }, 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && driverId) {
        checkActiveOrder(driverId);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      supabase.removeChannel(orderSubscription);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      clearInterval(checkLocalInterval);
    };
  }, [isOnline, activeOrder, driverId, loadingUser, dbConnected]);

  const updateDriverLocation = async () => {
    try {
      await supabase
        .from('delivery_partners')
        .upsert({
          id: driverId,
          is_online: isOnline,
          location: `POINT(${coords.longitude} ${coords.latitude})`,
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
    } catch (err) {
      console.warn('Failed to upsert delivery partner to DB:', err);
    }

    // Always update localStorage for cross-tab local simulation fallback
    const partners = JSON.parse(localStorage.getItem('kdlgoods_delivery_partners') || '{}');
    partners[driverId] = {
      id: driverId,
      is_online: isOnline,
      location: { latitude: coords.latitude, longitude: coords.longitude },
      updated_at: new Date().toISOString()
    };
    localStorage.setItem('kdlgoods_delivery_partners', JSON.stringify(partners));
    window.dispatchEvent(new Event('storage'));
  };

  const handleToggleOnline = async () => {
    const nextVal = !isOnline;
    setIsOnline(nextVal);

    if (nextVal) {
      checkActiveOrder(driverId);
    }

    try {
      await supabase
        .from('delivery_partners')
        .update({ is_online: nextVal })
        .eq('id', driverId);
    } catch (err) {
      console.warn('Failed to toggle online status in DB:', err);
    }

    // Update localStorage for local simulation
    const partners = JSON.parse(localStorage.getItem('kdlgoods_delivery_partners') || '{}');
    partners[driverId] = {
      id: driverId,
      is_online: nextVal,
      location: { latitude: coords.latitude, longitude: coords.longitude },
      updated_at: new Date().toISOString()
    };
    localStorage.setItem('kdlgoods_delivery_partners', JSON.stringify(partners));
    window.dispatchEvent(new Event('storage'));
  };

  const sendOrderStatusPush = (status: string, customerId: string) => {
    if (!customerId) return;
    let title = '';
    let body = '';
    switch(status) {
      case 'driver_accepted':
        title = '🛵 Driver Assigned!';
        body = 'A delivery partner has accepted your order and is heading to the store.';
        break;
      case 'picked_up':
        title = '📦 Order Picked Up!';
        body = 'Your order has been picked up from the merchant.';
        break;
      case 'out_for_delivery':
        title = '📍 Out for Delivery!';
        body = 'Your driver is on the way to your location.';
        break;
      case 'delivered':
        title = '✅ Order Delivered!';
        body = 'Your order has been successfully delivered. Enjoy!';
        break;
      default:
        return;
    }
    fetch('/api/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: customerId,
        title,
        body,
        url: '/customer/dashboard'
      })
    }).catch(err => console.error('Failed to send status push notification:', err));
  };

  const handleAcceptRequest = async () => {
    setShowAlert(false);
    if (!activeOrder) return;

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'driver_accepted' })
        .eq('id', activeOrder.id);
      if (error) throw error;
      sendOrderStatusPush('driver_accepted', activeOrder.customer_id);
    } catch (err) {
      // Mock transition in localStorage
      const local = JSON.parse(localStorage.getItem('kdlgoods_orders') || '[]');
      const updated = local.map((o: any) => {
        if (o.id === activeOrder.id) {
          return { ...o, status: 'driver_accepted' };
        }
        return o;
      });
      localStorage.setItem('kdlgoods_orders', JSON.stringify(updated));
    }

    // Write log
    await supabase
      .from('delivery_logs')
      .insert({
        order_id: activeOrder.id,
        delivery_partner_id: driverId,
        status: 'accepted',
        location: `POINT(${coords.longitude} ${coords.latitude})`,
      });

    setActiveOrder(prev => prev ? { ...prev, status: 'driver_accepted' } : null);
  };

  const handleMarkPickedUp = async () => {
    if (!activeOrder) return;

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'picked_up' })
        .eq('id', activeOrder.id);
      if (error) throw error;
      sendOrderStatusPush('picked_up', activeOrder.customer_id);
    } catch (err) {
      const local = JSON.parse(localStorage.getItem('kdlgoods_orders') || '[]');
      const updated = local.map((o: any) => {
        if (o.id === activeOrder.id) {
          return { ...o, status: 'picked_up' };
        }
        return o;
      });
      localStorage.setItem('kdlgoods_orders', JSON.stringify(updated));
    }

    // Write log
    await supabase
      .from('delivery_logs')
      .insert({
        order_id: activeOrder.id,
        delivery_partner_id: driverId,
        status: 'picked_up',
        location: `POINT(${coords.longitude} ${coords.latitude})`,
      });

    setActiveOrder(prev => prev ? { ...prev, status: 'picked_up' } : null);
  };

  const handleStartDelivery = async () => {
    if (!activeOrder) return;

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'out_for_delivery' })
        .eq('id', activeOrder.id);
      if (error) throw error;
      sendOrderStatusPush('out_for_delivery', activeOrder.customer_id);
    } catch (err) {
      const local = JSON.parse(localStorage.getItem('kdlgoods_orders') || '[]');
      const updated = local.map((o: any) => {
        if (o.id === activeOrder.id) {
          return { ...o, status: 'out_for_delivery' };
        }
        return o;
      });
      localStorage.setItem('kdlgoods_orders', JSON.stringify(updated));
    }

    // Write log
    await supabase
      .from('delivery_logs')
      .insert({
        order_id: activeOrder.id,
        delivery_partner_id: driverId,
        status: 'out_for_delivery',
        location: `POINT(${coords.longitude} ${coords.latitude})`,
      });

    setActiveOrder(prev => prev ? { ...prev, status: 'out_for_delivery' } : null);
  };

  const handleRejectRequest = () => {
    setShowAlert(false);
    setActiveOrder(null);
  };

  const handleMarkDelivered = async () => {
    if (!activeOrder) return;

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'delivered' })
        .eq('id', activeOrder.id);
      if (error) throw error;
      sendOrderStatusPush('delivered', activeOrder.customer_id);
    } catch (err) {
      const local = JSON.parse(localStorage.getItem('kdlgoods_orders') || '[]');
      const updated = local.map((o: any) => {
        if (o.id === activeOrder.id) {
          return { ...o, status: 'delivered' };
        }
        return o;
      });
      localStorage.setItem('kdlgoods_orders', JSON.stringify(updated));
    }

    // Log completion
    await supabase
      .from('delivery_logs')
      .insert({
        order_id: activeOrder.id,
        delivery_partner_id: driverId,
        status: 'delivered',
        location: `POINT(${coords.longitude} ${coords.latitude})`,
      });

    // Add completed job payout to earnings balance!
    const jobPayout = Number(activeOrder.delivery_partner_fee) || 25.00; 

    // Update local storage for delivery partner balance
    const currentRiderBal = parseFloat(localStorage.getItem('kdlgoods_rider_balance') || '0');
    const nextRiderBal = currentRiderBal + jobPayout;
    localStorage.setItem('kdlgoods_rider_balance', String(nextRiderBal));
    setBalance(nextRiderBal);

    // Also simulate depositing items_total to seller's local storage balance
    const sellerDeposit = Number(activeOrder.items_total) || (Number(activeOrder.total_amount) - jobPayout - 4 - (Number(activeOrder.total_amount) < 250 ? 25 : 0));
    const currentSellerBal = parseFloat(localStorage.getItem('kdlgoods_seller_balance') || '0');
    localStorage.setItem('kdlgoods_seller_balance', String(currentSellerBal + sellerDeposit));

    setTransactions(prev => [
      {
        id: `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
        type: 'delivery',
        amount: jobPayout,
        description: `Order #${activeOrder.id.slice(0, 4).toUpperCase()} Delivery Fare`,
        date: 'Just Now'
      },
      ...prev
    ]);

    setActiveOrder(prev => prev ? { ...prev, status: 'delivered' } : null);
    
    if (activeOrder.payment_method !== 'cod') {
      setTimeout(() => {
        setActiveOrder(null);
      }, 2000);
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    if (!profileName.trim() || !userPhone) {
      setProfileError('Name and phone number are required.');
      return;
    }
    if (userPhone.replace(/[^0-9]/g, '').length < 10) {
      setProfileError('Please enter a valid 10-digit mobile number.');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          role: 'delivery',
          full_name: profileName,
          phone_number: userPhone,
          avatar_url: profileAvatarUrl,
          address: profileAddress,
        }, { onConflict: 'id' });

      if (error) throw error;
      setProfileSuccess('Profile saved successfully!');
    } catch (err: any) {
      setProfileError(err.message || 'Failed to update profile.');
    }
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setUploadingAvatar(true);
    setProfileError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setProfileAvatarUrl(publicUrl);
      
      // Update DB directly
      await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      setProfileSuccess('Profile picture uploaded successfully!');
    } catch (err: any) {
      console.warn('Storage bucket uploads are offline/unconfigured. Simulating with local preview URL.', err);
      const mockUrl = URL.createObjectURL(file);
      setProfileAvatarUrl(mockUrl);
      setProfileSuccess('Preview updated (local view only).');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityError(null);
    setSecuritySuccess(null);

    if (!newPassword) {
      setSecurityError('New password cannot be empty.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setSecurityError('Passwords do not match.');
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      setSecuritySuccess('Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setSecurityError(err.message || 'Failed to update password.');
    }
  };

  const handleCashSubmit = async () => {
    if (!cashTxnId.trim() || !activeOrder) {
      alert('Please enter the UPI Transaction ID for your cash transfer.');
      return;
    }
    setCashSubmitting(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          driver_cash_submitted: true,
          driver_cash_txn_id: cashTxnId.trim(),
          driver_cash_screenshot_url: cashScreenshot || 'mock-receipt-url',
          payment_status: 'paid'
        })
        .eq('id', activeOrder.id);
      if (error) throw error;

      setActiveOrder(prev => prev ? { 
        ...prev, 
        driver_cash_submitted: true, 
        driver_cash_txn_id: cashTxnId.trim(),
        payment_status: 'paid'
      } : null);

      setTimeout(() => {
        setActiveOrder(null);
      }, 1500);
    } catch (err) {
      // Offline mock updates
      const local = JSON.parse(localStorage.getItem('kdlgoods_orders') || '[]');
      const updated = local.map((o: any) => {
        if (o.id === activeOrder.id) {
          return { 
            ...o, 
            driver_cash_submitted: true, 
            driver_cash_txn_id: cashTxnId.trim(),
            payment_status: 'paid'
          };
        }
        return o;
      });
      localStorage.setItem('kdlgoods_orders', JSON.stringify(updated));
      
      setActiveOrder(prev => prev ? { 
        ...prev, 
        driver_cash_submitted: true, 
        driver_cash_txn_id: cashTxnId.trim(),
        payment_status: 'paid'
      } : null);

      setTimeout(() => {
        setActiveOrder(null);
      }, 1500);
    } finally {
      setCashSubmitting(false);
      setCashTxnId('');
      setCashScreenshot(null);
    }
  };



  // Slider Drag Handlers
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    startXRef.current = clientX - dragOffset;
  };

  const handleDragMove = (e: any) => {
    if (!isDragging || !trackRef.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const maxOffset = trackRef.current.clientWidth - 52;
    let offset = clientX - startXRef.current;

    if (offset < 0) offset = 0;
    if (offset > maxOffset) offset = maxOffset;

    setDragOffset(offset);

    if (offset >= maxOffset * 0.85) {
      setIsDragging(false);
      setDragOffset(0);
      handleAcceptRequest();
    }
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    setDragOffset(0);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove);
      window.addEventListener('touchend', handleDragEnd);
    } else {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging]);

  // Chat Actions
  const sendMessage = async () => {
    if (!chatInput.trim() || !activeOrder) return;
    const text = chatInput.trim();
    setChatInput('');

    const targetRecipient = chatPartner === 'customer' ? 'customer' : 'seller';
    const messageId = Math.random().toString();
    const timestamp = new Date().toISOString();

    const dbPayload = {
      order_id: activeOrder.id,
      sender_id: driverId,
      sender_role: 'delivery',
      recipient_role: targetRecipient,
      text,
    };

    try {
      const { data, error } = await supabase
        .from('order_messages')
        .insert([dbPayload])
        .select('*')
        .single();
      if (error) throw error;
    } catch (err) {
      // LocalStorage fallback for offline/development testing
      const local = JSON.parse(localStorage.getItem('kdlgoods_chats') || '[]');
      const mockMsg = {
        id: messageId,
        order_id: activeOrder.id,
        sender_id: driverId,
        sender_role: 'delivery',
        recipient_role: targetRecipient,
        text,
        created_at: timestamp,
      };
      const updated = [...local, mockMsg];
      localStorage.setItem('kdlgoods_chats', JSON.stringify(updated));
      
      // Dispatch storage event to notify other local hooks/pages
      window.dispatchEvent(new Event('storage'));

      // Trigger automatic simulation replies when offline
      setTimeout(() => {
        const localCurrent = JSON.parse(localStorage.getItem('kdlgoods_chats') || '[]');
        const replyPayload = {
          id: Math.random().toString(),
          order_id: activeOrder.id,
          sender_id: targetRecipient === 'customer' ? activeOrder.customer_id : activeOrder.seller_id,
          sender_role: targetRecipient,
          recipient_role: 'delivery',
          text: targetRecipient === 'customer' 
            ? "Thank you driver! Safe travels." 
            : "Perfect! We've readied the package.",
          created_at: new Date().toISOString(),
        };
        localStorage.setItem('kdlgoods_chats', JSON.stringify([...localCurrent, replyPayload]));
        window.dispatchEvent(new Event('storage'));
        playNotificationSound();
      }, 3000);
    }
  };

  const fetchPastDeliveries = async (currentDriverId = driverId) => {
    if (!currentDriverId || currentDriverId === '00000000-0000-0000-0000-000000000000') return;
    setLoadingPastDeliveries(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          status,
          total_amount,
          delivery_partner_fee,
          created_at,
          sellers ( store_name )
        `)
        .eq('delivery_partner_id', currentDriverId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPastDeliveries(data || []);
    } catch (err) {
      console.error('Failed to fetch driver past deliveries:', err);
    } finally {
      setLoadingPastDeliveries(false);
    }
  };

  // Instant Cashout Action
  const triggerCashout = () => {
    if (balance <= 0) return;
    setCashoutProcessing(true);
    setShowCashoutModal(true);

    setTimeout(async () => {
      setCashoutProcessing(false);
      setCashoutSuccess(true);
      
      const cashoutAmt = balance;
      setBalance(0);
      localStorage.setItem('kdlgoods_rider_balance', '0');

      if (dbConnected) {
        // Insert into payout_logs
        await supabase
          .from('payout_logs')
          .insert({
            user_id: driverId,
            amount: cashoutAmt,
            account_details: 'UPI Transfer Request (Instant Cashout)',
            status: 'pending'
          });
          
        // Deduct driver's balance in delivery_partners
        await supabase
          .from('delivery_partners')
          .update({ balance: 0 })
          .eq('id', driverId);
      }

      setTransactions(prev => [
        {
          id: `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
          type: 'cashout',
          amount: -cashoutAmt,
          description: 'Instant Bank Cashout (Transfer)',
          date: 'Just Now'
        },
        ...prev
      ]);
    }, 2500);
  };

  const closeCashout = () => {
    setShowCashoutModal(false);
    setCashoutSuccess(false);
  };

  // Support Bot Actions
  const handleSupportSend = () => {
    if (!supportInput.trim()) return;
    const userMsg = supportInput;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    setSupportMessages(prev => [
      ...prev,
      { id: Math.random().toString(), sender: 'driver', text: userMsg, timestamp }
    ]);
    setSupportInput('');
    setSupportLoading(true);

    setTimeout(() => {
      let botResponse = "Thanks for the message. Let me look up your rider profile. Could you specify which order this is regarding?";
      const msgLower = userMsg.toLowerCase();

      if (msgLower.includes('tire') || msgLower.includes('breakdown') || msgLower.includes('accident')) {
        botResponse = "🚨 Emergency flagged! Please park safely. We have paused your order dispatching and will assign a backup driver immediately. Your safety is our priority; no penalty will apply.";
      } else if (msgLower.includes('not responding') || msgLower.includes('unreachable')) {
        botResponse = "📞 If the customer is unreachable, please call them twice. If they still do not respond after 5 minutes, use the Progress Panel to mark the delivery status accordingly.";
      } else if (msgLower.includes('payout') || msgLower.includes('cashout') || msgLower.includes('money')) {
        botResponse = "💰 Flexible Pay allows you to cash out your earnings instantly to your linked bank account. Simply go to the 'Earnings' tab and click 'Cash Out Instantly'.";
      } else if (msgLower.includes('store') || msgLower.includes('merchant') || msgLower.includes('closed')) {
        botResponse = "🏪 If the merchant store is closed, please take a photo of the store entrance and upload it in the support menu. We will cancel the order and issue you a compensation fare.";
      }

      setSupportMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: 'partner',
          text: botResponse,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      setSupportLoading(false);
      playNotificationSound();
    }, 1500);
  };

  return (
    <div className="min-h-screen text-white flex flex-col justify-between pb-20 md:pb-6" style={{ backgroundColor: '#121212', fontFamily: 'sans-serif' }}>
      
      {/* Top Header */}
      <div className="w-full max-w-lg mx-auto px-4 pt-4">
        {/* Compulsory Mobile Number Warning Banner */}
        {!userPhone && (
          <div className="mb-4 p-4 rounded-xl flex items-center justify-between text-xs font-semibold animate-pulse" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>Compulsory Mobile Contact Required! Please update your settings with a contact number.</span>
            </div>
          </div>
        )}

        {/* Offline/Database Error Warning Banner */}
        {!dbConnected && (
          <div className="mb-4 p-4 rounded-xl flex items-center justify-between text-xs font-semibold animate-pulse" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24' }}>
            <div className="flex items-center gap-2">
              <ShieldAlert size={16} />
              <span>Running in Offline Simulation Mode (Database Schema mismatch or connection error). Please apply your Supabase migrations.</span>
            </div>
          </div>
        )}

        <header className="flex justify-between items-center p-4 rounded-2xl" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-yellow-500/10 border border-yellow-500/20">
              <Navigation size={22} style={{ color: '#F7D108' }} className={isOnline ? "animate-pulse" : ""} />
            </div>
            <div>
              <h1 className="text-sm font-extrabold tracking-wide" style={{ color: '#F7D108' }}>KDL RIDER HUD</h1>
              <p className="text-[10px]" style={{ color: '#8A8A8A' }}>Kirandul Zone · Chhattisgarh</p>
            </div>
          </div>
          <button 
            onClick={handleToggleOnline}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold text-xs transition"
            style={{
              borderColor: isOnline ? '#22C55E' : '#444',
              backgroundColor: isOnline ? 'rgba(34,197,94,0.06)' : 'transparent',
              color: isOnline ? '#22C55E' : '#8A8A8A'
            }}
          >
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-ping' : 'bg-zinc-600'}`} />
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </button>
        </header>
      </div>

      {/* Main Container */}
      <main className="w-full max-w-lg mx-auto px-4 py-4 flex-1 flex flex-col justify-start">
        
        {/* TAB 1: ACTIVE JOBS */}
        {activeTab === 'jobs' && (
          <div className="space-y-4 flex-1 flex flex-col justify-start">
            
            {/* Offline Shield Banner */}
            {!isOnline && (
              <div className="p-6 rounded-2xl text-center space-y-3" style={{ background: '#1A1A1A', border: '1px dashed #2E2E2E' }}>
                <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center bg-zinc-800 text-zinc-500">
                  <ShieldAlert size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-sm">You are currently Offline</h3>
                  <p className="text-xs text-zinc-500 mt-1">Toggle your duty status online at the top to start receiving parcel dispatches.</p>
                </div>
              </div>
            )}

            {/* Online - Waiting state */}
            {isOnline && !activeOrder && !showAlert && (
              <div className="p-10 rounded-2xl text-center space-y-4 flex-1 flex flex-col items-center justify-center" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                <div className="relative">
                  <span className="absolute inline-flex h-12 w-12 rounded-full bg-yellow-500 opacity-20 animate-ping" />
                  <div className="relative w-12 h-12 rounded-full flex items-center justify-center bg-yellow-500/10 border border-yellow-500/20 text-yellow-500">
                    <Navigation size={22} />
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-sm">Searching for Orders...</h3>
                  <p className="text-xs text-zinc-500 mt-1">Waiting for merchants in Kirandul area to accept orders. Keep your screen active.</p>
                </div>
              </div>
            )}

            {/* Alert Drawer: New Dispatch Received */}
            {showAlert && activeOrder && (
              <div className="p-5 rounded-2xl shadow-2xl relative overflow-hidden animate-bounce-subtle space-y-4" style={{ background: 'rgba(247,209,8,0.06)', border: '2px solid rgba(247,209,8,0.4)' }}>
                <div className="absolute top-0 right-0 text-[8px] px-2.5 py-1 rounded-bl-lg font-black uppercase bg-[#F7D108] text-[#121212]">
                  SLA Active
                </div>
                <div>
                  <h3 className="text-base font-black flex items-center gap-1.5 text-yellow-500">⚡ Dispatch Request!</h3>
                  <p className="text-[11px]" style={{ color: '#8A8A8A' }}>Immediate pickup requested. Click the button or swipe to accept.</p>
                </div>

                <div className="p-3.5 rounded-xl space-y-2.5 text-xs" style={{ backgroundColor: '#121212', border: '1px solid #2E2E2E' }}>
                  <div className="flex gap-2">
                    <span className="font-bold text-slate-500 w-16">PICKUP:</span>
                    <span className="text-slate-300 font-medium">Dantewada Kirandul Store Hub</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-bold text-slate-500 w-16">DELIVERY:</span>
                    <span className="text-slate-300 font-medium">{activeOrder.delivery_address}</span>
                  </div>
                  <div className="flex gap-2 justify-between border-t pt-2 mt-2 border-zinc-800 text-[11px]">
                    <span className="font-bold text-zinc-500">Order Price: <span className="text-zinc-200">{formatINR(activeOrder.total_amount)}</span></span>
                    <span className="font-bold text-yellow-500">Est. Payout: +{formatINR(Number(activeOrder.delivery_partner_fee) || 25.00)}</span>
                  </div>
                </div>

                {/* Accept Button */}
                <button
                  onClick={handleAcceptRequest}
                  className="w-full font-bold py-3 rounded-xl bg-yellow-500 text-black hover:bg-yellow-400 transition text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg"
                >
                  <Check size={16} /> Accept Order
                </button>

                <div className="text-center text-[10px] text-zinc-500 font-semibold my-1">— OR —</div>

                {/* Accept Swipe Slider */}
                <div ref={trackRef} className="w-full h-12 rounded-xl relative select-none flex items-center justify-center" style={{ background: '#121212', border: '1px solid #2E2E2E' }}>
                  <div
                    onMouseDown={handleDragStart}
                    onTouchStart={handleDragStart}
                    style={{ transform: `translateX(${dragOffset}px)`, background: '#F7D108', color: '#121212' }}
                    className="w-12 h-10 rounded-lg flex items-center justify-center cursor-grab active:cursor-grabbing absolute left-1 top-1 font-bold shadow-lg transition-transform duration-75 select-none"
                  >
                    <ArrowRight size={18} />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wider pointer-events-none select-none pl-6 text-[#8A8A8A]">
                    Swipe to Accept
                  </span>
                </div>

                <button onClick={handleRejectRequest} className="w-full text-center text-red-400 hover:text-red-300 text-xs font-bold mt-2">
                  Reject Assignment
                </button>
              </div>
            )}

            {/* Active Order execution Console */}
            {!showAlert && activeOrder && (
              <div className="space-y-4">
                
                {/* Visual SVG Map Tracker */}
                <div className="w-full h-44 rounded-2xl relative overflow-hidden border border-zinc-800 bg-[#151515]">
                  <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {/* Simulated streets / Grid */}
                    <path d="M 10 50 Q 50 20 90 50" fill="none" stroke="#222" strokeWidth="2" strokeDasharray="3,3" />
                    <path d="M 50 10 L 50 90" fill="none" stroke="#222" strokeWidth="1.5" />
                    <path d="M 20 80 Q 50 50 80 80" fill="none" stroke="#222" strokeWidth="2" />
                    
                    {/* Route line */}
                    <path d="M 30 65 L 50 35 L 75 60" fill="none" stroke="#444" strokeWidth="1.5" strokeDasharray="2,2" />
                    <path 
                      d={['driver_accepted', 'preparing', 'awaiting_pickup'].includes(activeOrder.status) ? "M 30 65 L 50 35" : "M 50 35 L 75 60"} 
                      fill="none" 
                      stroke="#F7D108" 
                      strokeWidth="2" 
                      className="animate-pulse" 
                    />

                    {/* Merchant point */}
                    <circle cx="50" cy="35" r="3.5" fill="#EF4444" />
                    <text x="50" y="29" fill="#EF4444" fontSize="5" fontWeight="bold" textAnchor="middle">MERCHANT</text>

                    {/* Customer point */}
                    <circle cx="75" cy="60" r="3.5" fill="#3B82F6" />
                    <text x="75" y="69" fill="#3B82F6" fontSize="5" fontWeight="bold" textAnchor="middle">CUSTOMER</text>

                    {/* Rider marker (Updates relative to activeOrder.status) */}
                    {(() => {
                      let rx = 30, ry = 65;
                      if (activeOrder.status === 'driver_accepted') {
                        rx = 40;
                        ry = 50;
                      } else if (['picked_up', 'out_for_delivery'].includes(activeOrder.status)) {
                        rx = 62.5;
                        ry = 47.5;
                      } else if (activeOrder.status === 'delivered') {
                        rx = 75;
                        ry = 60;
                      }
                      return (
                        <g>
                          <circle cx={rx} cy={ry} r="4" fill="#F7D108" className="animate-pulse" />
                          <circle cx={rx} cy={ry} r="2" fill="#121212" />
                        </g>
                      );
                    })()}
                  </svg>
                  
                  {/* Floating Telemetry Tag */}
                  <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded bg-black/80 backdrop-blur-md text-[9px] font-mono border border-zinc-800">
                    GPS Coords: {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
                  </div>
                </div>

                {/* GPS HUD Nav Directions Panel */}
                <div className="p-4 rounded-2xl flex items-center justify-between" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-green-500/10 text-green-500 border border-green-500/20">
                      <Navigation size={18} className="rotate-45" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-green-500">Live GPS Tracking Active</h4>
                      <p className="text-[10px] mt-0.5" style={{ color: '#8A8A8A' }}>
                        Your coordinates are being shared in real time.
                      </p>
                    </div>
                  </div>
                  <div className="px-2.5 py-1 rounded bg-green-500/10 text-green-400 text-[10px] font-bold border border-green-500/20 flex items-center gap-1.5 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                    LIVE
                  </div>
                </div>

                {/* Progress Details card */}
                <div className="p-4 rounded-2xl space-y-4" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                  <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                    <h3 className="text-sm font-bold flex items-center gap-1.5"><MapPin size={16} /> Delivery Locations</h3>
                    <button 
                      onClick={() => setShowChat(true)}
                      className="px-3 py-1.5 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-[#F7D108] font-bold text-xs flex items-center gap-1 hover:bg-yellow-500/20 transition"
                    >
                      <MessageSquare size={13} /> Chat Desk
                    </button>
                  </div>

                  <div className="space-y-3.5 text-xs">
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 mt-1" />
                        <span className="w-0.5 h-8 bg-zinc-800" />
                      </div>
                      <div>
                        <strong className="block text-zinc-400">PICK UP FROM:</strong>
                        <p className="text-zinc-200 font-semibold text-[11px] mt-0.5">Dantewada Provision Store (Main Bazar Road)</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-1" />
                      <div>
                        <strong className="block text-zinc-400">DROP AT:</strong>
                        <p className="text-zinc-200 font-semibold text-[11px] mt-0.5">{activeOrder.delivery_address}</p>
                      </div>
                    </div>

                    {/* Payment Info Badge */}
                    <div className="border-t border-zinc-800 pt-3.5 mt-2 flex justify-between items-center text-xs">
                      <div>
                        <strong className="block text-zinc-500 font-extrabold uppercase text-[10px] tracking-wider">Payment Mode</strong>
                        <span className="text-zinc-200 font-semibold mt-0.5 block">
                          {activeOrder.payment_method === 'cod' ? '💵 Cash on Delivery (COD)' : '📱 Paid online via UPI'}
                        </span>
                      </div>
                      <div className="text-right">
                        <strong className="block text-zinc-500 font-extrabold uppercase text-[10px] tracking-wider">Collect Amount</strong>
                        <span className={`text-xs font-black block mt-0.5 ${activeOrder.payment_method === 'cod' ? 'text-yellow-500 font-extrabold animate-pulse' : 'text-green-500'}`}>
                          {activeOrder.payment_method === 'cod' ? formatINR(activeOrder.total_amount) : '₹0.00 (PAID)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Customer & Seller Details */}
                  <div className="border-t border-zinc-800 pt-3.5 mt-2 space-y-3">
                    <strong className="block text-zinc-500 font-extrabold uppercase text-[10px] tracking-wider">Customer Details</strong>
                    <div className="p-3 rounded-xl bg-[#222] border border-zinc-800 space-y-1.5 text-xs">
                      <p className="text-zinc-200 font-semibold">👤 {customerName}</p>
                      <a href={`tel:${customerPhone || '9999912345'}`} className="text-yellow-500 hover:text-yellow-400 font-semibold transition inline-flex items-center gap-1">
                        📞 {customerPhone || 'Not available'}
                      </a>
                      {customerAddress && <p className="text-zinc-400">📍 {customerAddress}</p>}
                    </div>

                    <strong className="block text-zinc-500 font-extrabold uppercase text-[10px] tracking-wider">Seller Details</strong>
                    <div className="p-3 rounded-xl bg-[#222] border border-zinc-800 space-y-1.5 text-xs">
                      <p className="text-zinc-200 font-semibold">🏪 {sellerName}</p>
                      <a href={`tel:${sellerPhone || '9876543210'}`} className="text-yellow-500 hover:text-yellow-400 font-semibold transition inline-flex items-center gap-1">
                        📞 {sellerPhone || 'Not available'}
                      </a>
                    </div>
                  </div>

                  {/* Actions depending on simulated route progress */}
                  <div className="border-t border-zinc-800 pt-4 mt-2">
                    {activeOrder.status === 'driver_accepted' ? (
                      <button
                        onClick={handleMarkPickedUp}
                        className="w-full font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 bg-yellow-500 text-black hover:bg-yellow-400 text-xs uppercase tracking-wider"
                      >
                        <Check size={16} /> Mark as Picked Up
                      </button>
                    ) : activeOrder.status === 'picked_up' ? (
                      <button
                        onClick={handleStartDelivery}
                        className="w-full font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 bg-blue-500 text-white hover:bg-blue-400 text-xs uppercase tracking-wider"
                      >
                        <Check size={16} /> Start Delivery (On the Way)
                      </button>
                    ) : activeOrder.status === 'out_for_delivery' ? (
                      <button
                        onClick={handleMarkDelivered}
                        className="w-full font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 bg-[#22C55E] text-[#121212] text-xs uppercase tracking-wider"
                      >
                        <Check size={16} /> Complete Delivery
                      </button>
                    ) : activeOrder.status === 'delivered' ? (
                      activeOrder.payment_method === 'cod' && !activeOrder.driver_cash_submitted ? (
                        <div className="space-y-4 p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5">
                          <div className="text-center">
                            <span className="text-xs font-bold text-yellow-500 block uppercase tracking-wider">💰 COD Cash Collection</span>
                            <p className="text-[10px] text-zinc-400 mt-1">
                              You collected <strong>{formatINR(activeOrder.total_amount)}</strong> in cash. 
                              Please transfer this amount online to the central UPI ID below and upload details.
                            </p>
                          </div>
                          
                          <div className="p-3 rounded-lg bg-zinc-900 text-[11px] space-y-1.5 border border-zinc-800">
                            <div className="flex justify-between">
                              <span className="text-zinc-500">Central UPI ID:</span>
                              <span className="text-yellow-500 font-mono font-bold">kdlgoods@icici</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-500">Account Name:</span>
                              <span className="text-zinc-200 font-semibold">KDL Goods Private Ltd.</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-500">Account No:</span>
                              <span className="text-zinc-200 font-mono font-semibold">123405006789</span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wide">UPI Submission Txn ID (Required)</label>
                            <input 
                              type="text"
                              placeholder="12 digit UPI transaction ID"
                              className="input py-2.5 text-xs text-center"
                              value={cashTxnId}
                              onChange={e => setCashTxnId(e.target.value)}
                            />

                            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Upload Receipt Screenshot (Optional)</label>
                            <label className="flex items-center justify-center gap-2 cursor-pointer w-full rounded-lg p-2 bg-zinc-900 border border-dashed border-zinc-800 text-zinc-500 hover:text-zinc-300 transition">
                              <span className="text-xs">{cashScreenshot ? `✓ ${cashScreenshot}` : "Attach screenshot"}</span>
                              <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={e => {
                                  if (e.target.files?.[0]) {
                                    setCashScreenshot(e.target.files[0].name);
                                  }
                                }} 
                              />
                            </label>
                          </div>

                          <button
                            onClick={handleCashSubmit}
                            disabled={cashSubmitting}
                            className="w-full font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-2 bg-yellow-500 text-black hover:bg-yellow-400 text-xs uppercase tracking-wider font-extrabold"
                          >
                            {cashSubmitting ? 'Verifying...' : 'Confirm Cash Submission'}
                          </button>
                        </div>
                      ) : (
                        <div className="p-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold border border-green-500/20 bg-green-500/5 text-[#22C55E]">
                          <CheckCircle2 size={16} /> Delivery successfully completed & cash submitted!
                        </div>
                      )
                    ) : (
                      <div className="p-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold border border-yellow-500/20 bg-yellow-500/5 text-yellow-500">
                        <Loader2 className="animate-spin" size={14} /> 
                        {activeOrder.status === 'accepted' 
                          ? 'Awaiting pickup. Head to Merchant location.' 
                          : 'Arrived at Merchant store. Collect items.'}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}

          </div>
        )}

        {/* TAB 2: PAYOUTS & EARNINGS */}
        {activeTab === 'earnings' && (
          <div className="space-y-4">
            
            {/* Earnings Dashboard Card */}
            <div className="p-5 rounded-2xl space-y-4 border border-zinc-800" style={{ background: 'linear-gradient(135deg, #1A1A1A 0%, #121212 100%)' }}>
              <div>
                <span className="text-xs text-zinc-400 font-medium block">Current Balance Available</span>
                <h2 className="text-3xl font-black mt-1" style={{ color: '#F7D108' }}>{formatINR(balance)}</h2>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-zinc-800 pt-4">
                <div>
                  <span className="text-[10px] text-zinc-500 font-bold block uppercase">Weekly Payout</span>
                  <span className="text-sm font-extrabold text-white">₹1,180.00</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 font-bold block uppercase">Deliveries Completed</span>
                  <span className="text-sm font-extrabold text-white">12 Jobs</span>
                </div>
              </div>

              <button 
                onClick={triggerCashout}
                disabled={balance <= 0}
                className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 ${
                  balance > 0 
                    ? 'bg-yellow-500 text-black hover:bg-yellow-400' 
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                }`}
              >
                <CreditCard size={15} />
                Cash Out Instantly (Flexible Pay)
              </button>
            </div>

            {/* Weekly Earnings graph card */}
            <div className="p-4 rounded-2xl space-y-3" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
              <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wide flex items-center gap-1.5">
                  <TrendingUp size={14} style={{ color: '#22C55E' }} /> Earnings Trend (Daily)
                </h3>
              </div>
              <div className="flex items-end justify-between h-20 pt-4 px-2">
                {[
                  { day: 'Mon', amt: 120, height: 'h-8' },
                  { day: 'Tue', amt: 240, height: 'h-16' },
                  { day: 'Wed', amt: 150, height: 'h-10' },
                  { day: 'Thu', amt: 180, height: 'h-12' },
                  { day: 'Fri', amt: 320, height: 'h-20' },
                  { day: 'Sat', amt: 290, height: 'h-18' },
                  { day: 'Sun', amt: 0, height: 'h-1' }
                ].map((item, index) => (
                  <div key={index} className="flex flex-col items-center gap-1.5 flex-1">
                    <div className={`w-3.5 ${item.height} bg-yellow-500/20 hover:bg-yellow-500/40 rounded-t-sm transition-all duration-300`} />
                    <span className="text-[9px] text-zinc-500 font-semibold">{item.day}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Transcript Log list */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider pl-1">Earnings &amp; Payouts Transcript</h3>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {dbConnected ? (
                  pastDeliveries.length === 0 ? (
                    <p className="text-center text-[11px] text-zinc-550 py-6">No delivery logs found in history.</p>
                  ) : (
                    pastDeliveries.map(delivery => {
                      const isDelivered = delivery.status === 'delivered';
                      return (
                        <div key={delivery.id} className="p-3.5 rounded-xl flex items-center justify-between" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                              isDelivered 
                                ? 'bg-green-500/10 text-green-500 border border-green-500/20' 
                                : 'bg-red-500/10 text-red-500 border border-red-500/20'
                            }`}>
                              {isDelivered ? '+' : '✕'}
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-white">{delivery.sellers?.store_name || 'Store'}</h4>
                              <p className="text-[9px] mt-0.5" style={{ color: '#8A8A8A' }}>
                                ORDER #{delivery.id.slice(0, 8).toUpperCase()} · {new Date(delivery.created_at).toLocaleDateString()}
                              </p>
                              <span className="text-[8px] text-zinc-500 block uppercase mt-0.5">Status: {delivery.status}</span>
                            </div>
                          </div>
                          <span className={`text-xs font-black ${isDelivered ? 'text-green-500' : 'text-red-400'}`}>
                            {isDelivered ? `+${formatINR(delivery.delivery_partner_fee || 25)}` : '₹0.00'}
                          </span>
                        </div>
                      );
                    })
                  )
                ) : (
                  transactions.map(txn => (
                    <div key={txn.id} className="p-3.5 rounded-xl flex items-center justify-between" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                          txn.type === 'delivery' 
                            ? 'bg-green-500/10 text-green-500 border border-green-500/20' 
                            : 'bg-red-500/10 text-red-500 border border-red-500/20'
                        }`}>
                          {txn.type === 'delivery' ? '+' : '-'}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white">{txn.description}</h4>
                          <p className="text-[9px] mt-0.5" style={{ color: '#8A8A8A' }}>{txn.id} · {txn.date}</p>
                        </div>
                      </div>
                      <span className={`text-xs font-black ${txn.type === 'delivery' ? 'text-green-500' : 'text-red-400'}`}>
                        {txn.type === 'delivery' ? '+' : ''}{formatINR(txn.amount)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

        {/* TAB 3: HELP & SUPPORT DESK */}
        {activeTab === 'support' && (
          <div className="space-y-4 flex-1 flex flex-col justify-start">
            
            {/* Quick Actions Panel */}
            <div className="p-4 rounded-2xl grid grid-cols-2 gap-3" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
              <button 
                onClick={() => {
                  setSupportMessages(prev => [
                    ...prev,
                    { id: Math.random().toString(), sender: 'driver', text: 'Report breakdown / flat tire', timestamp: 'Now' }
                  ]);
                  setSupportLoading(true);
                  setTimeout(() => {
                    setSupportMessages(prev => [
                      ...prev,
                      { id: Math.random().toString(), sender: 'partner', text: '🚨 Breakdown logged. A backup rider has been notified to overtake your active order. Your rating is protected.', timestamp: 'Now' }
                    ]);
                    setSupportLoading(false);
                    playNotificationSound();
                  }, 1200);
                }}
                className="p-3 rounded-xl border border-zinc-800 bg-[#222] hover:bg-zinc-800 transition flex flex-col items-center gap-1.5 text-center text-[10px] font-bold text-red-400"
              >
                <AlertTriangle size={16} />
                Report Flat Tire
              </button>
              <button 
                onClick={() => {
                  setSupportMessages(prev => [
                    ...prev,
                    { id: Math.random().toString(), sender: 'driver', text: 'Customer is unreachable', timestamp: 'Now' }
                  ]);
                  setSupportLoading(true);
                  setTimeout(() => {
                    setSupportMessages(prev => [
                      ...prev,
                      { id: Math.random().toString(), sender: 'partner', text: '📞 Customer Unreachable procedure active: please place two calls. If still offline, log the feedback in progress dashboard.', timestamp: 'Now' }
                    ]);
                    setSupportLoading(false);
                    playNotificationSound();
                  }, 1200);
                }}
                className="p-3 rounded-xl border border-zinc-800 bg-[#222] hover:bg-zinc-800 transition flex flex-col items-center gap-1.5 text-center text-[10px] font-bold text-yellow-500"
              >
                <PhoneCall size={16} />
                Unreachable User
              </button>
            </div>

            {/* Chatbot conversation area */}
            <div className="p-4 rounded-2xl flex-1 flex flex-col justify-between min-h-[250px]" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1 flex-1 mb-4">
                {supportMessages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.sender === 'driver' ? 'justify-end' : 'justify-start'}`}>
                    <div 
                      className={`p-3 rounded-xl max-w-[85%] text-xs leading-relaxed ${
                        msg.sender === 'driver' 
                          ? 'bg-yellow-500 text-black rounded-tr-none' 
                          : 'bg-zinc-800 text-zinc-200 rounded-tl-none border border-zinc-700'
                      }`}
                    >
                      <p>{msg.text}</p>
                      <span className="text-[8px] font-semibold block text-right mt-1.5 opacity-55">
                        {msg.timestamp}
                      </span>
                    </div>
                  </div>
                ))}
                {supportLoading && (
                  <div className="flex justify-start">
                    <div className="bg-zinc-800 border border-zinc-700 p-3.5 rounded-xl rounded-tl-none flex items-center gap-2">
                      <Loader2 className="animate-spin text-yellow-500" size={14} />
                      <span className="text-[10px] text-zinc-400 font-medium">Assistant is typing...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Bot input field */}
              <div className="flex gap-2">
                <input 
                  type="text" 
                  className="input flex-1 py-2 text-xs" 
                  placeholder="Ask support about flat tires, cashouts..."
                  value={supportInput}
                  onChange={e => setSupportInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSupportSend()}
                />
                <button 
                  onClick={handleSupportSend}
                  className="p-2.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black transition"
                >
                  <Send size={15} />
                </button>
              </div>
            </div>

          </div>
        )}

        {/* TAB 4: RIDER PROFILE & SETTINGS */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            {/* Profile details card */}
            <div className="p-5 rounded-2xl space-y-6 border border-zinc-800 bg-[#1A1A1A]">
              <h3 className="text-sm font-extrabold text-yellow-500 uppercase tracking-wider">Rider Profile Settings</h3>
              
              <form onSubmit={handleProfileSave} className="space-y-4">
                {/* Avatar upload */}
                <div className="flex items-center gap-4 p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                  <div className="relative w-20 h-20 rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center border border-zinc-700">
                    {profileAvatarUrl ? (
                      <img src={profileAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User size={28} className="text-zinc-500" />
                    )}
                    {uploadingAvatar && (
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                        <Loader2 className="animate-spin text-yellow-500" size={20} />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 cursor-pointer hover:text-yellow-500 transition">
                      Change Profile Photo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarFileChange}
                      />
                    </label>
                    <p className="text-[10px] text-zinc-500 mt-1">PNG, JPG up to 2MB. Your photo is visible to merchants during pick up.</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Rider Full Name</label>
                  <input
                    type="text"
                    required
                    className="input"
                    value={profileName}
                    onChange={e => setProfileName(e.target.value)}
                    placeholder="e.g. Anil Kumar"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Mobile Contact Number (Compulsory)</label>
                  <input
                    type="tel"
                    required
                    className="input"
                    value={userPhone || ''}
                    onChange={e => setUserPhone(e.target.value)}
                    placeholder="9876543210"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Home Address</label>
                  <input
                    type="text"
                    className="input"
                    value={profileAddress}
                    onChange={e => setProfileAddress(e.target.value)}
                    placeholder="House No, Street, Kirandul, Dantewada"
                  />
                </div>

                {/* Simulated Vehicle Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Vehicle Type</label>
                    <select className="input text-xs" style={{ background: '#121212' }}>
                      <option>🛵 Motorcycle / Scooter</option>
                      <option>🚲 Bicycle</option>
                      <option>🚗 Electric Vehicle (EV)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Vehicle Reg No</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="CG-18-M-1234"
                      defaultValue="CG-18-M-1234"
                    />
                  </div>
                </div>

                {profileError && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
                    {profileError}
                  </div>
                )}
                {profileSuccess && (
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs text-center">
                    {profileSuccess}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-black uppercase rounded-lg transition"
                >
                  Save Rider Info
                </button>
              </form>
            </div>

            {/* Rider settings / chime toggles */}
            <div className="p-5 rounded-2xl space-y-4 border border-zinc-800 bg-[#1A1A1A]">
              <h3 className="text-sm font-extrabold text-yellow-500 uppercase tracking-wider">HUD Preferences</h3>
              
              <div className="flex justify-between items-center p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                <div>
                  <span className="block text-xs font-semibold text-white">Chime Dispatch Alerts</span>
                  <span className="text-[9px] text-zinc-500">Play programmatic notification sound on dispatch assignment</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifPush}
                  onChange={e => setNotifPush(e.target.checked)}
                  className="w-4 h-4 accent-yellow-500"
                />
              </div>

              <div className="flex justify-between items-center p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                <div>
                  <span className="block text-xs font-semibold text-white">Online Status Sound Alerts</span>
                  <span className="text-[9px] text-zinc-500">Play audio sound effects when toggling online/offline duty</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifEmail}
                  onChange={e => setNotifEmail(e.target.checked)}
                  className="w-4 h-4 accent-yellow-500"
                />
              </div>

              <div className="flex justify-between items-center p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                <div>
                  <span className="block text-xs font-semibold text-white">Background Push Notifications</span>
                  <span className="text-[9px] text-zinc-500">Receive new delivery assignment alerts even when closed</span>
                </div>
                <input
                  type="checkbox"
                  disabled={pushLoading || driverId === 'driver-uuid-placeholder-123'}
                  checked={pushSubscribed}
                  onChange={async (e) => {
                    if (e.target.checked) {
                      await subscribeToPush(driverId);
                    } else {
                      await unsubscribeFromPush(driverId);
                    }
                  }}
                  className="w-4 h-4 accent-yellow-500 disabled:opacity-50"
                />
              </div>

              {typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted' && (
                <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 space-y-2">
                  <p className="text-[9px] text-yellow-500 leading-normal">
                    ⚠️ Browser notification permission is currently <strong>{Notification.permission}</strong>. On mobile devices (like iOS), you may need to add this app to your Home Screen first, then click below to enable permissions.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      const perm = await Notification.requestPermission();
                      if (perm === 'granted') {
                        await subscribeToPush(driverId);
                      } else {
                        alert(`Permission status: ${perm}`);
                      }
                    }}
                    className="w-full py-1.5 bg-yellow-500 hover:bg-yellow-400 text-black text-[10px] font-bold rounded transition"
                  >
                    Enable Browser Notifications
                  </button>
                </div>
              )}
            </div>

            {/* Change Password */}
            <div className="p-5 rounded-2xl space-y-6 border border-zinc-800 bg-[#1A1A1A]">
              <h3 className="text-sm font-extrabold text-yellow-500 uppercase tracking-wider">Change Rider Password</h3>
              
              <form onSubmit={handlePasswordUpdate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1.5">New Password</label>
                    <input
                      type="password"
                      required
                      className="input text-xs"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Confirm Password</label>
                    <input
                      type="password"
                      required
                      className="input text-xs"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                {securityError && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
                    {securityError}
                  </div>
                )}
                {securitySuccess && (
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs text-center">
                    {securitySuccess}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs rounded-lg transition"
                >
                  Update Rider Password
                </button>
              </form>
            </div>

            {/* Logout Button */}
            <div className="p-5 rounded-2xl space-y-4 border border-zinc-800 bg-[#1A1A1A]">
              <h3 className="text-sm font-extrabold text-red-400 uppercase tracking-wider">Session Management</h3>
              <p className="text-[10px] text-zinc-500 leading-normal">
                Log out of this delivery partner console. You will need your credentials to sign back in.
              </p>
              <button
                type="button"
                onClick={async () => {
                  if (confirm('Are you sure you want to log out?')) {
                    try {
                      const { error } = await supabase.auth.signOut();
                      if (error) throw error;
                      router.push('/auth/signin');
                    } catch (err: any) {
                      alert(err.message || 'Failed to log out. Please try again.');
                    }
                  }
                }}
                className="w-full py-2.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-2 border"
                style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
              >
                Log Out Rider Account
              </button>
            </div>
          </div>
        )}

      </main>

      {/* CUSTOMER/MERCHANT DIRECT CHAT DRAWER */}
      {showChat && activeOrder && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center">
          <div className="w-full max-w-lg bg-[#121212] border-t border-zinc-800 rounded-t-3xl p-4 flex flex-col justify-between max-h-[85vh] animate-slide-up">
            
            {/* Drawer Header */}
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3 mb-3">
              <div>
                <h3 className="text-sm font-extrabold flex items-center gap-1.5 text-yellow-500">
                  <MessageCircle size={16} /> Active Communications
                </h3>
                <p className="text-[10px]" style={{ color: '#8A8A8A' }}>Chat directly with order participants</p>
              </div>
              <button 
                onClick={() => setShowChat(false)}
                className="p-1 rounded-full bg-zinc-800 text-zinc-400"
              >
                <ChevronDown size={18} />
              </button>
            </div>

            {/* Chat Target Tabs */}
            <div className="flex gap-2 p-1 bg-zinc-900 border border-zinc-800 rounded-xl mb-3">
              <button 
                onClick={() => setChatPartner('customer')}
                className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition ${
                  chatPartner === 'customer' 
                    ? 'bg-yellow-500 text-black' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Customer Chat
              </button>
              <button 
                onClick={() => setChatPartner('merchant')}
                className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition ${
                  chatPartner === 'merchant' 
                    ? 'bg-yellow-500 text-black' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Merchant Chat
              </button>
            </div>

            {/* Message History list */}
            <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1 min-h-[180px] max-h-[300px]">
              {(chatPartner === 'customer' ? customerMessages : merchantMessages).map(msg => (
                <div key={msg.id} className={`flex ${msg.sender === 'driver' ? 'justify-end' : 'justify-start'}`}>
                  <div 
                    className={`p-3 rounded-xl max-w-[85%] text-xs leading-relaxed ${
                      msg.sender === 'driver' 
                        ? 'bg-yellow-500 text-black rounded-tr-none font-medium' 
                        : 'bg-zinc-800 text-zinc-200 rounded-tl-none border border-zinc-700'
                    }`}
                  >
                    <p>{msg.text}</p>
                    <span className="text-[8px] font-semibold block text-right mt-1.5 opacity-55">
                      {msg.timestamp}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Preset quick response templates */}
            <div className="flex gap-1.5 overflow-x-auto pb-3 border-t border-zinc-800/50 pt-2.5 mb-2.5">
              {[
                "I've picked up your order and am on the way!",
                "Arrived at the location.",
                "Stuck in a small traffic jam, will be late by 5 mins."
              ].map((tpl, i) => (
                <button
                  key={i}
                  onClick={() => setChatInput(tpl)}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px] font-bold whitespace-nowrap hover:bg-zinc-700 transition"
                >
                  {tpl.slice(0, 24)}...
                </button>
              ))}
            </div>

            {/* Message input field */}
            <div className="flex gap-2">
              <input 
                type="text" 
                className="input flex-1 py-2 text-xs" 
                placeholder={`Type message to ${chatPartner}...`}
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
              />
              <button 
                onClick={sendMessage}
                className="p-2.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black transition"
              >
                <Send size={15} />
              </button>
            </div>

          </div>
        </div>
      )}

      {/* FLEXIBLE PAY: INSTANT CASHOUT MODAL */}
      {showCashoutModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-xs w-full bg-[#1A1A1A] border border-zinc-800 rounded-2xl p-5 text-center space-y-4">
            
            {cashoutProcessing ? (
              <div className="py-8 space-y-4">
                <Loader2 className="animate-spin text-yellow-500 mx-auto" size={36} />
                <div>
                  <h3 className="font-bold text-sm">Transferring Funds...</h3>
                  <p className="text-[10px] text-zinc-500 mt-1">Connecting to gateway to transfer money safely to your bank.</p>
                </div>
              </div>
            ) : cashoutSuccess ? (
              <div className="py-6 space-y-4">
                <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center bg-green-500/10 text-green-500 border border-green-500/20">
                  <Check size={26} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-green-400">Cashout Successful!</h3>
                  <p className="text-[10px] text-zinc-400 mt-1">Money has been deposited into your bank account *1234.</p>
                </div>
                <button onClick={closeCashout} className="w-full py-2 bg-zinc-800 text-white rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-zinc-700 transition">
                  Close Receipt
                </button>
              </div>
            ) : null}

          </div>
        </div>
      )}

      {/* Bottom Sticky Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-[#1A1A1A]/90 backdrop-blur-lg border-t border-zinc-800 flex justify-around items-center z-40 max-w-lg mx-auto">
        <button 
          onClick={() => setActiveTab('jobs')}
          className={`flex flex-col items-center gap-1 transition ${activeTab === 'jobs' ? 'text-yellow-500' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <Navigation size={18} />
          <span className="text-[9px] font-black tracking-wider uppercase">Active Jobs</span>
        </button>
        <button 
          onClick={() => setActiveTab('earnings')}
          className={`flex flex-col items-center gap-1 transition ${activeTab === 'earnings' ? 'text-yellow-500' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <DollarSign size={18} />
          <span className="text-[9px] font-black tracking-wider uppercase">Earnings</span>
        </button>
        <button 
          onClick={() => setActiveTab('support')}
          className={`flex flex-col items-center gap-1 transition ${activeTab === 'support' ? 'text-yellow-500' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <LifeBuoy size={18} />
          <span className="text-[9px] font-black tracking-wider uppercase">Rider Help</span>
        </button>
        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-1 transition ${activeTab === 'profile' ? 'text-yellow-500' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <User size={18} />
          <span className="text-[9px] font-black tracking-wider uppercase">Profile</span>
        </button>
      </nav>

    </div>
  );
}
