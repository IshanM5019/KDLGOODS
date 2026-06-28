'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import {
  calculateDistance,
  isWithinSlaRadius,
  DANTEWADA_CENTER,
  TOWN_NAME,
  OPERATIONAL_GEOFENCE_KM,
  formatINR,
  LatLng,
} from '@kdlgoods/shared';
import {
  ShoppingBag, MapPin, Zap, AlertTriangle, ShieldCheck,
  Search, ChevronRight, Navigation, Loader2, Plus, Minus, X, Check, PackageSearch, Store,
  MessageSquare, MessageCircle, CreditCard, Settings, History
} from 'lucide-react';


interface LocalSeller {
  id: string;
  store_name: string;
  description: string | null;
  address: string;
  latitude: number;
  longitude: number;
  geohash: string;
  is_active: boolean;
  distanceKm: number;
  withinSla: boolean;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  seller_id: string;
}

export default function CustomerDashboard() {
  const router = useRouter();
  const [sellers, setSellers] = useState<LocalSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string>('00000000-0000-0000-0000-000000000000');

  // Default to Dantewada Kirandul operational centre or cached coordinates
  const [userCoords, setUserCoords] = useState<LatLng>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kdlgoods_customer_user_coords');
      return saved ? JSON.parse(saved) : DANTEWADA_CENTER;
    }
    return DANTEWADA_CENTER;
  });
  const [latInput, setLatInput] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('kdlgoods_customer_lat_input') || String(DANTEWADA_CENTER.latitude);
    }
    return String(DANTEWADA_CENTER.latitude);
  });
  const [lngInput, setLngInput] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('kdlgoods_customer_lng_input') || String(DANTEWADA_CENTER.longitude);
    }
    return String(DANTEWADA_CENTER.longitude);
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showLocationWarning, setShowLocationWarning] = useState(false);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [showCheckoutDetails, setShowCheckoutDetails] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'upi'>('cod');
  const [upiTxnId, setUpiTxnId] = useState('');
  const [upiScreenshot, setUpiScreenshot] = useState<string | null>(null);
  const [showUpiGateway, setShowUpiGateway] = useState(false);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
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
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [activeOrderTrackingId, setActiveOrderTrackingId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('kdlgoods_customer_active_tracking_id');
    }
    return null;
  });

  // Seller product view
  const [selectedSeller, setSelectedSeller] = useState<LocalSeller | null>(null);
  const [sellerProducts, setSellerProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Product image lightbox
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null);

  // Real-time tracking and chat states
  const [activeOrder, setActiveOrder] = useState<any | null>(null);
  const [driverCoords, setDriverCoords] = useState<LatLng | null>(null);
  const [dbMessages, setDbMessages] = useState<any[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [chatPartner, setChatPartner] = useState<'seller' | 'delivery'>('seller');
  const [chatInput, setChatInput] = useState('');

  const detectLocation = () => {
    if (typeof window !== 'undefined' && 'navigator' in window && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const distance = calculateDistance({ latitude: lat, longitude: lng }, DANTEWADA_CENTER);
          
          if (distance > 15) {
            // Outside operational zone: show warning banner, keep Dantewada Center
            setShowLocationWarning(true);
            setUserCoords(DANTEWADA_CENTER);
            setLatInput(String(DANTEWADA_CENTER.latitude));
            setLngInput(String(DANTEWADA_CENTER.longitude));
            localStorage.setItem('kdlgoods_customer_user_coords', JSON.stringify(DANTEWADA_CENTER));
            localStorage.setItem('kdlgoods_customer_lat_input', String(DANTEWADA_CENTER.latitude));
            localStorage.setItem('kdlgoods_customer_lng_input', String(DANTEWADA_CENTER.longitude));
          } else {
            // Inside operational zone: set coords
            setShowLocationWarning(false);
            const newCoords = { latitude: lat, longitude: lng };
            setUserCoords(newCoords);
            setLatInput(String(lat));
            setLngInput(String(lng));
            localStorage.setItem('kdlgoods_customer_user_coords', JSON.stringify(newCoords));
            localStorage.setItem('kdlgoods_customer_lat_input', String(lat));
            localStorage.setItem('kdlgoods_customer_lng_input', String(lng));
          }
        },
        (err) => {
          console.warn('Geolocation query failed or denied:', err.message);
        }
      );
    }
  };

  // Auto-detect existing active database orders for the customer
  useEffect(() => {
    if (activeOrderTrackingId) {
      localStorage.setItem('kdlgoods_customer_active_tracking_id', activeOrderTrackingId);
    } else {
      localStorage.removeItem('kdlgoods_customer_active_tracking_id');
    }
  }, [activeOrderTrackingId]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        let user = session?.user;
        if (!user) {
          // Give client-side storage session restoring a moment to complete
          await new Promise(resolve => setTimeout(resolve, 600));
          const { data: { user: retryUser } } = await supabase.auth.getUser();
          user = retryUser || undefined;
        }

        if (!user) {
          router.push('/auth/signin');
          return;
        }

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
              role: 'customer',
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
        if (userRole !== 'customer') {
          if (userRole === 'seller') {
            router.push('/seller/dashboard');
          } else if (userRole === 'delivery') {
            router.push('/delivery/dashboard');
          }
          return;
        }

        setCustomerId(user.id);
        // Auto-detect existing active database orders for the customer
        const { data, error } = await supabase
          .from('orders')
          .select('id')
          .eq('customer_id', user.id)
          .not('status', 'in', '("delivered","cancelled")')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) {
          setActiveOrderTrackingId(data.id);
          localStorage.setItem('kdlgoods_customer_active_tracking_id', data.id);
        }
      } catch (err) {
        console.error('Failed to fetch user:', err);
      }
    };
    fetchUser();
    detectLocation();
  }, []);

  // Poll LocalStorage offline fallback active order check
  useEffect(() => {
    if (customerId === '00000000-0000-0000-0000-000000000000') return;

    const checkLocalActiveOrder = () => {
      if (activeOrderTrackingId) return;
      const local = JSON.parse(localStorage.getItem('kdlgoods_orders') || '[]');
      const active = local.find((o: any) => o.customer_id === customerId && !['delivered', 'cancelled'].includes(o.status));
      if (active) {
        setActiveOrderTrackingId(active.id);
      }
    };
    checkLocalActiveOrder();
    const interval = setInterval(checkLocalActiveOrder, 2000);
    return () => clearInterval(interval);
  }, [activeOrderTrackingId, customerId]);

  // Order status, location tracking, and chat synchronization
  useEffect(() => {
    if (!activeOrderTrackingId) {
      setActiveOrder(null);
      setDriverCoords(null);
      return;
    }

    const fetchOrder = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*, sellers(store_name, address, location), driver:profiles!orders_delivery_partner_id_fkey(full_name, phone_number)')
          .eq('id', activeOrderTrackingId)
          .single();
        if (!error && data) {
          setActiveOrder(data);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchOrder();

    // Subscribe to order status changes
    const orderChannel = supabase
      .channel(`customer-order-tracking-${activeOrderTrackingId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${activeOrderTrackingId}`
      }, (payload) => {
        fetchOrder();
      })
      .subscribe();

    // Subscribe to chats
    const chatChannel = supabase
      .channel(`customer-order-chat-${activeOrderTrackingId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'order_messages',
        filter: `order_id=eq.${activeOrderTrackingId}`
      }, (payload) => {
        setDbMessages(prev => {
          if (prev.some(m => m.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });
      })
      .subscribe();

    // Load initial messages
    const loadMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('order_messages')
          .select('*')
          .eq('order_id', activeOrderTrackingId)
          .order('created_at', { ascending: true });
        if (!error && data) {
          setDbMessages(data);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadMessages();

    // Sync helpers for localStorage fallback
    const syncLocalStorage = () => {
      // Sync order details
      const local = JSON.parse(localStorage.getItem('kdlgoods_orders') || '[]');
      const currentOrder = local.find((o: any) => o.id === activeOrderTrackingId);
      if (currentOrder) {
        setActiveOrder(currentOrder);
      }

      // Sync chats
      const localChats = JSON.parse(localStorage.getItem('kdlgoods_chats') || '[]');
      setDbMessages(localChats.filter((c: any) => c.order_id === activeOrderTrackingId));
    };

    syncLocalStorage();
    const interval = setInterval(syncLocalStorage, 1000);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'kdlgoods_orders' || e.key === 'kdlgoods_chats') {
        syncLocalStorage();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      supabase.removeChannel(orderChannel);
      supabase.removeChannel(chatChannel);
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [activeOrderTrackingId]);

  // Subscribe to driver coordinates
  useEffect(() => {
    if (!activeOrder?.delivery_partner_id) {
      setDriverCoords(null);
      return;
    }

    const loadDriverCoords = async () => {
      try {
        const { data, error } = await supabase
          .from('delivery_partners')
          .select('location')
          .eq('id', activeOrder.delivery_partner_id)
          .single();
        if (!error && data?.location?.coordinates) {
          setDriverCoords({
            longitude: data.location.coordinates[0],
            latitude: data.location.coordinates[1]
          });
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadDriverCoords();

    // Realtime driver coordinates subscription
    const partnerChannel = supabase
      .channel(`customer-rider-location-${activeOrder.delivery_partner_id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'delivery_partners',
        filter: `id=eq.${activeOrder.delivery_partner_id}`
      }, (payload: any) => {
        if (payload.new?.location?.coordinates) {
          setDriverCoords({
            longitude: payload.new.location.coordinates[0],
            latitude: payload.new.location.coordinates[1]
          });
        }
      })
      .subscribe();

    // LocalStorage fallback
    const syncLocalLocation = () => {
      const partners = JSON.parse(localStorage.getItem('kdlgoods_delivery_partners') || '{}');
      const partner = partners[activeOrder.delivery_partner_id];
      if (partner?.location) {
        setDriverCoords(partner.location);
      }
    };

    syncLocalLocation();
    const interval = setInterval(syncLocalLocation, 1000);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'kdlgoods_delivery_partners') {
        syncLocalLocation();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      supabase.removeChannel(partnerChannel);
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [activeOrder?.delivery_partner_id]);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !activeOrder) return;
    const text = chatInput.trim();
    setChatInput('');

    const targetRecipient = chatPartner === 'seller' ? 'seller' : 'delivery';
    const messageId = Math.random().toString();
    const timestamp = new Date().toISOString();

    const dbPayload = {
      order_id: activeOrder.id,
      sender_id: customerId,
      sender_role: 'customer',
      recipient_role: targetRecipient,
      text,
    };

    try {
      const { error } = await supabase
        .from('order_messages')
        .insert([dbPayload]);
      if (error) throw error;
    } catch (err) {
      // LocalStorage fallback
      const local = JSON.parse(localStorage.getItem('kdlgoods_chats') || '[]');
      const mockMsg = {
        id: messageId,
        order_id: activeOrder.id,
        sender_id: customerId,
        sender_role: 'customer',
        recipient_role: targetRecipient,
        text,
        created_at: timestamp,
      };
      localStorage.setItem('kdlgoods_chats', JSON.stringify([...local, mockMsg]));
      window.dispatchEvent(new Event('storage'));
    }
  };

  useEffect(() => {
    fetchSellers(true);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'kdlgoods_seller_profile' || e.key === 'kdlgoods_store_active') {
        fetchSellers(false);
      }
    };
    window.addEventListener('storage', handleStorage);

    const interval = setInterval(() => fetchSellers(false), 2000);

    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, [userCoords]);

  const fetchSellers = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.rpc('get_nearby_sellers', {
        customer_lat: userCoords.latitude,
        customer_lng: userCoords.longitude,
        max_distance_meters: OPERATIONAL_GEOFENCE_KM * 1000,
      });

      if (error) throw error;

      const calculated = (data || []).map((s: any) => {
        const withinSla = s.distance_meters <= OPERATIONAL_GEOFENCE_KM * 1000;
        return {
          id: s.id,
          store_name: s.store_name,
          description: s.description,
          address: s.address,
          latitude: s.location?.coordinates?.[1] ?? 0,
          longitude: s.location?.coordinates?.[0] ?? 0,
          geohash: s.geohash,
          is_active: true,
          distanceKm: s.distance_meters / 1000,
          withinSla,
        };
      });
      setSellers(calculated);
    } catch {
      // Offline fallback: check local seller profile
      const localProfile = localStorage.getItem('kdlgoods_seller_profile');
      if (localProfile) {
        try {
          const parsed = JSON.parse(localProfile);
          if (parsed.is_active) {
            const sLat = parseFloat(parsed.lat);
            const sLng = parseFloat(parsed.lng);
            if (!isNaN(sLat) && !isNaN(sLng)) {
              const distanceKm = calculateDistance(userCoords, { latitude: sLat, longitude: sLng });
              const withinSla = distanceKm <= OPERATIONAL_GEOFENCE_KM;
              setSellers([
                {
                  id: parsed.id || 'offline-seller-id',
                  store_name: parsed.store_name || 'Mock Seller',
                  description: parsed.description || '',
                  address: parsed.address || '',
                  latitude: sLat,
                  longitude: sLng,
                  geohash: '',
                  is_active: true,
                  distanceKm,
                  withinSla
                }
              ]);
            } else {
              setSellers([]);
            }
          } else {
            setSellers([]);
          }
        } catch {
          setSellers([]);
        }
      } else {
        setSellers([]);
      }
    } finally {
      if (showLoading) {
        setTimeout(() => setLoading(false), 400);
      }
    }
  };

  const fetchSellerProducts = async (seller: LocalSeller) => {
    setSelectedSeller(seller);
    setLoadingProducts(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('seller_id', seller.id)
        .eq('is_available', true);

      if (error) throw error;
      if (!data || data.length === 0) throw new Error('empty');
      setSellerProducts(data);
    } catch {
      // Clean empty catalog — seller hasn't added items yet
      setSellerProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleUpdateCoords = () => {
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (!isNaN(lat) && !isNaN(lng)) {
      const newCoords = { latitude: lat, longitude: lng };
      setUserCoords(newCoords);
      setSelectedSeller(null);
      localStorage.setItem('kdlgoods_customer_user_coords', JSON.stringify(newCoords));
      localStorage.setItem('kdlgoods_customer_lat_input', String(lat));
      localStorage.setItem('kdlgoods_customer_lng_input', String(lng));
    }
  };

  const addToCart = (product: any) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) return prev.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { id: product.id, name: product.name, price: product.price, quantity: 1, seller_id: selectedSeller!.id }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === productId);
      if (existing && existing.quantity > 1) return prev.map((item) => item.id === productId ? { ...item, quantity: item.quantity - 1 } : item);
      return prev.filter((item) => item.id !== productId);
    });
  };

  const cartTotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  // Blinkit-style delivery partner fee: between ₹20 and ₹30 based on distance
  const getDeliveryPartnerFee = () => {
    if (!selectedSeller) return 25;
    const calculated = 20 + Math.round(selectedSeller.distanceKm * 5);
    return Math.max(20, Math.min(30, calculated));
  };

  const deliveryPartnerFee = getDeliveryPartnerFee();

  // Only apply delivery charges
  const smallCartFee = 0;
  const handlingCharge = 0;
  const grandTotal = cartTotal + deliveryPartnerFee;

  // Razorpay script loading removed

  const createOrder = async (method: 'cod' | 'upi', txnId: string | null = null, screenshotUrl: string | null = null) => {
    setCheckingOut(true);

    try {
      const payload = {
        customer_id: customerId,
        seller_id: cart[0].seller_id,
        status: 'placed',
        total_amount: grandTotal,
        delivery_partner_fee: deliveryPartnerFee,
        items_total: cartTotal,
        handling_charge: handlingCharge,
        small_cart_fee: smallCartFee,
        delivery_address: 'Kirandul, Dantewada District, Chhattisgarh – 494556',
        delivery_location: `POINT(${userCoords.longitude} ${userCoords.latitude})`,
        payment_method: method,
        payment_status: method === 'upi' ? 'paid' : 'pending',
        upi_transaction_id: txnId,
        upi_screenshot_url: screenshotUrl,
      };

      const { data, error } = await supabase
        .from('orders')
        .insert([payload])
        .select('id')
        .single();

      if (error) throw error;
      setActiveOrderTrackingId(data.id);
      localStorage.setItem('kdlgoods_customer_active_tracking_id', data.id);
      setCheckoutSuccess(true);
      setCart([]);
    } catch (err: any) {
      console.error('Supabase DB checkout failed:', err);
      setPaymentError(err.message || 'Database checkout failed. Please check connection/schema.');
    } finally {
      setCheckingOut(false);
      setShowCheckoutDetails(false);
    }
  };

  const fetchOrderHistory = async () => {
    if (!customerId) return;
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          status,
          total_amount,
          created_at,
          payment_method,
          payment_status,
          sellers ( store_name )
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrderHistory(data || []);
    } catch (err) {
      console.error('Failed to fetch order history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId);
      
      if (error) throw error;
      
      setActiveOrderTrackingId(null);
      setActiveOrder(null);
      localStorage.removeItem('kdlgoods_customer_active_tracking_id');
      alert('Order cancelled successfully.');
      fetchOrderHistory();
    } catch (err: any) {
      alert('Failed to cancel order: ' + err.message);
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
          role: 'customer',
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

  const handleConfirmCheckout = async () => {
    setPaymentError(null);
    if (paymentMethod === 'cod') {
      await createOrder('cod');
    } else {
      setShowUpiGateway(true);
    }
  };

  const handleUpiSubmit = async () => {
    if (!upiTxnId.trim()) {
      setPaymentError('UPI Transaction ID is required for verification');
      return;
    }
    if (upiTxnId.trim().length < 8) {
      setPaymentError('Please enter a valid UPI Transaction ID (minimum 8 characters)');
      return;
    }
    
    setPaymentError(null);
    setShowUpiGateway(false);
    // Simulate image upload preview URL
    const screenshotUrl = upiScreenshot || 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=300&q=80';
    await createOrder('upi', upiTxnId.trim(), screenshotUrl);
    setUpiTxnId('');
    setUpiScreenshot(null);
  };

  if (loading || customerId === '00000000-0000-0000-0000-000000000000') {
    return (
      <div className="min-h-screen flex items-center justify-center text-white" style={{ backgroundColor: '#121212' }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-yellow-500" size={32} />
          <p className="text-sm text-zinc-400">Loading customer profile...</p>
        </div>
      </div>
    );
  }

  const activeSellersInSla = sellers.filter(s => s.withinSla && s.is_active);
  const outOfSlaSellers = sellers.filter(s => !s.withinSla && s.is_active);

  return (
    <div className="min-h-screen text-slate-100 pb-28 p-4 md:p-6" style={{ backgroundColor: '#121212' }}>
      {/* Top Navbar */}
      <header className="flex justify-between items-center mb-6 p-4 rounded-xl" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
        <div className="flex items-center gap-3">
          <ShoppingBag style={{ color: '#F7D108' }} size={30} />
          <div>
            <h1 className="text-xl font-black" style={{ color: '#F7D108' }}>KDLGOODS</h1>
            <p className="text-xs" style={{ color: '#8A8A8A' }}>Customer Delivery Portal</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(247,209,8,0.1)', border: '1px solid rgba(247,209,8,0.3)' }}>
            <MapPin size={13} style={{ color: '#F7D108' }} />
            <span className="text-xs font-semibold" style={{ color: '#F7D108' }}>{TOWN_NAME}</span>
          </div>
          
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: '#222222', border: '1px solid #2E2E2E' }}>
            <Navigation size={13} style={{ color: '#8A8A8A' }} />
            <span className="text-xs font-mono" style={{ color: '#B0B0B0' }}>
              {userCoords.latitude.toFixed(4)}°N, {userCoords.longitude.toFixed(4)}°E
            </span>
          </div>

          {/* Order History Button */}
          <button
            onClick={() => {
              setShowHistoryDrawer(true);
              fetchOrderHistory();
            }}
            className="flex items-center justify-center p-2 rounded-lg transition hover:bg-zinc-800"
            style={{ background: '#222222', border: '1px solid #2E2E2E' }}
            title="Order History"
          >
            <History size={18} className="text-yellow-500" />
          </button>

          {/* Profile & Settings Cog */}
          <button
            onClick={() => setShowSettingsDrawer(true)}
            className="flex items-center justify-center p-2 rounded-lg transition hover:bg-zinc-800"
            style={{ background: '#222222', border: '1px solid #2E2E2E' }}
            title="Profile & Settings"
          >
            {profileAvatarUrl ? (
              <img src={profileAvatarUrl} alt="Avatar" className="w-5 h-5 rounded-full object-cover" />
            ) : (
              <Settings size={18} className="text-yellow-500 hover:rotate-45 transition-transform duration-300" />
            )}
          </button>
        </div>
      </header>

      {/* Compulsory Mobile Number Banner */}
      {!userPhone && (
        <div className="mb-6 p-4 rounded-xl flex items-center justify-between text-xs font-semibold animate-pulse" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>Compulsory Mobile Contact Required! Please update your profile settings with a phone number.</span>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Left Column: Location Simulator */}
        <div className="space-y-4 lg:col-span-1">
          <div className="p-5 rounded-xl space-y-4" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
            <div className="flex items-center gap-2 border-b pb-3 mb-2" style={{ borderColor: '#2E2E2E' }}>
              <MapPin size={18} style={{ color: '#F7D108' }} />
              <h3 className="font-bold text-sm">Coordinate Simulator</h3>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: '#8A8A8A' }}>
              Adjust your GPS coordinates to test geofencing. Default is centred on Kirandul, Dantewada.
            </p>
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#8A8A8A' }}>Latitude</label>
                <input type="number" step="0.0001" className="input" value={latInput} onChange={e => setLatInput(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#8A8A8A' }}>Longitude</label>
                <input type="number" step="0.0001" className="input" value={lngInput} onChange={e => setLngInput(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleUpdateCoords} className="btn-primary flex-1 text-xs py-2.5">
                Update Centre
              </button>
              <button 
                onClick={detectLocation} 
                className="px-3 py-2.5 rounded-lg border border-zinc-800 bg-[#222] hover:bg-zinc-800 text-zinc-300 transition text-xs font-bold flex items-center gap-1"
              >
                <Navigation size={12} /> Detect Current
              </button>
            </div>

            {showLocationWarning && (
              <div className="p-3 rounded-xl flex flex-col gap-1 text-[10px] leading-normal" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#F59E0B' }}>
                <span className="font-black flex items-center gap-1 text-yellow-500">⚠️ OUTSIDE SERVICE ZONE</span>
                <span>We noticed your location is outside Kirandul geofence. Centred to Dantewada Center so you can test the storefronts.</span>
              </div>
            )}
          </div>

          <div className="p-5 rounded-xl" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
            <h4 className="font-bold mb-2 flex items-center gap-2 text-sm" style={{ color: '#22C55E' }}>
              <ShieldCheck size={16} /> Geofencing Guard Active
            </h4>
            <p className="text-xs leading-relaxed" style={{ color: '#8A8A8A' }}>
              Strict <strong style={{ color: '#F7D108' }}>{OPERATIONAL_GEOFENCE_KM} km</strong> radius enforced around Kirandul, Dantewada. Sellers beyond this boundary are locked automatically.
            </p>
          </div>
        </div>

        {/* Right Column: Stores & Products */}
        <div className="lg:col-span-3 space-y-6">

          {/* Active Order tracking interface */}
          {activeOrder && (
            <div className="rounded-xl p-5 mb-6 animate-fade-in" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
              <div className="flex justify-between items-center border-b pb-4 mb-5" style={{ borderColor: '#2E2E2E' }}>
                <div>
                  <span className="text-[10px] font-black uppercase text-yellow-500">LIVE SHIPMENT HUD</span>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    Order #{activeOrder.id.slice(0, 8).toUpperCase()}
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: '#8A8A8A' }}>
                    Status: <span className="text-white font-semibold capitalize">
                      {(() => {
                        if (activeOrder.status === 'awaiting_pickup') return 'Order is ready for pickup';
                        if (activeOrder.status === 'driver_accepted') return 'Rider accepted & heading to store';
                        if (activeOrder.status === 'picked_up') return 'Order is picked up by rider';
                        if (activeOrder.status === 'out_for_delivery') return 'Rider is out delivering (On the way)';
                        return activeOrder.status.replace('_', ' ');
                      })()}
                    </span>
                  </p>
                </div>
                <div className="flex gap-2">
                  {activeOrder.status === 'placed' && (
                    <button
                      onClick={() => handleCancelOrder(activeOrder.id)}
                      className="px-3.5 py-2 rounded-lg font-bold text-xs bg-red-600 hover:bg-red-700 text-white transition flex items-center gap-1.5 shadow-lg shadow-red-900/20"
                    >
                      Cancel Order
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      setShowChat(!showChat);
                      // Auto-switch partner to delivery if assigned and store is prepared
                      if (activeOrder.delivery_partner_id && ['awaiting_pickup', 'driver_accepted', 'picked_up', 'out_for_delivery'].includes(activeOrder.status)) {
                        setChatPartner('delivery');
                      } else {
                        setChatPartner('seller');
                      }
                    }}
                    className="px-3.5 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition"
                    style={{ background: '#F7D108', color: '#121212' }}
                  >
                    <MessageSquare size={14} /> {showChat ? 'Hide Chat' : 'Chat Desk'}
                  </button>
                  {/* Cancel/Reset simulation fallback */}
                  {['delivered', 'cancelled'].includes(activeOrder.status) && (
                    <button 
                      onClick={() => {
                        setActiveOrderTrackingId(null);
                        setActiveOrder(null);
                        setCheckoutSuccess(false);
                        localStorage.removeItem('kdlgoods_customer_active_tracking_id');
                      }} 
                      className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-bold"
                    >
                      Clear Board
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex justify-between text-[9px] md:text-[10px] font-bold text-zinc-500 uppercase mb-2 overflow-x-auto whitespace-nowrap scrollbar-none gap-2">
                  <span>Placed</span>
                  <span>Preparing</span>
                  <span>Ready</span>
                  <span>Rider Accepted</span>
                  <span>Picked Up</span>
                  <span>On the Way</span>
                  <span>Delivered</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-zinc-800 relative overflow-hidden">
                  {(() => {
                    const getProgressWidth = () => {
                      if (activeOrder.status === 'cancelled') return 'w-0';
                      if (activeOrder.status === 'placed') return 'w-[10%]';
                      if (activeOrder.status === 'accepted') return 'w-[25%]';
                      if (activeOrder.status === 'preparing') return 'w-[40%]';
                      if (activeOrder.status === 'awaiting_pickup') return 'w-[52%]';
                      if (activeOrder.status === 'driver_accepted') return 'w-[68%]';
                      if (activeOrder.status === 'picked_up') return 'w-[80%]';
                      if (activeOrder.status === 'out_for_delivery') return 'w-[92%]';
                      if (activeOrder.status === 'delivered') return 'w-full';
                      return 'w-0';
                    };
                    const color = activeOrder.status === 'cancelled' ? 'bg-red-500' : 'bg-yellow-500';
                    return <div className={`h-full ${getProgressWidth()} ${color} transition-all duration-500`} />;
                  })()}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* SVG Visual Map Tracker */}
                <div className="w-full h-56 rounded-xl relative overflow-hidden border border-zinc-800 bg-[#151515]">
                  <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {/* Simulated street path */}
                    <path d="M 20 65 L 50 35 L 80 65" fill="none" stroke="#222" strokeWidth="2.5" strokeDasharray="3,3" />
                    <path d="M 20 65 L 50 35" fill="none" stroke="#3B82F6" strokeWidth="1.5" strokeOpacity="0.4" />
                    <path d="M 50 35 L 80 65" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeOpacity="0.4" />

                    {/* Customer point (Kirandul User location) */}
                    <circle cx="80" cy="65" r="4" fill="#3B82F6" />
                    <text x="80" y="74" fill="#3B82F6" fontSize="4.5" fontWeight="bold" textAnchor="middle">YOUR HOME</text>

                    {/* Seller point (Store coordinates) */}
                    <circle cx="50" cy="35" r="4" fill="#EF4444" />
                    <text x="50" y="28" fill="#EF4444" fontSize="4.5" fontWeight="bold" textAnchor="middle">STORE</text>

                    {/* Driver marker (Updates dynamically) */}
                    {driverCoords ? (
                      (() => {
                        // Coordinates simulation to SVG conversion logic
                        // Store: (50, 35). Customer: (80, 65).
                        // Let's compute actual driver coordinates mapping:
                        const sellerLat = 18.8492;
                        const sellerLng = 81.7055;
                        const custLat = userCoords.latitude;
                        const custLng = userCoords.longitude;
                        
                        let rx = 50, ry = 35;
                        const totalLat = custLat - sellerLat;
                        const totalLng = custLng - sellerLng;
                        
                        if (totalLat !== 0 && totalLng !== 0) {
                          const latPct = Math.max(0, Math.min(1, (driverCoords.latitude - sellerLat) / totalLat));
                          const lngPct = Math.max(0, Math.min(1, (driverCoords.longitude - sellerLng) / totalLng));
                          const avgPct = (latPct + lngPct) / 2;
                          
                          rx = 50 + (80 - 50) * avgPct;
                          ry = 35 + (65 - 35) * avgPct;
                        }

                        return (
                          <g>
                            <circle cx={rx} cy={ry} r="4.5" fill="#F7D108" className="animate-pulse" />
                            <circle cx={rx} cy={ry} r="2" fill="#121212" />
                            <text x={rx} y={ry - 7} fill="#F7D108" fontSize="4.5" fontWeight="black" textAnchor="middle">RIDER</text>
                          </g>
                        );
                      })()
                    ) : (
                      activeOrder.delivery_partner_id && (
                        <g>
                          <circle cx="50" cy="35" r="4.5" fill="#F7D108" className="animate-pulse" />
                          <circle cx="50" cy="35" r="2" fill="#121212" />
                          <text x="50" y="22" fill="#F7D108" fontSize="4" textAnchor="middle">Rider at Store</text>
                        </g>
                      )
                    )}
                  </svg>

                  {/* Floating Coordinates overlay */}
                  <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded bg-black/85 backdrop-blur-md text-[8px] font-mono border border-zinc-800">
                    {driverCoords 
                      ? `Rider GPS: ${driverCoords.latitude.toFixed(5)}°N, ${driverCoords.longitude.toFixed(5)}°E` 
                      : 'Rider: Offline / Awaiting Assignment'}
                  </div>
                </div>

                {/* Details & Timeline HUD */}
                <div className="flex flex-col gap-5">
                  {/* Shipment Status Timeline */}
                  <div className="p-4 rounded-xl space-y-4 border border-zinc-800" style={{ background: '#222222' }}>
                    <h3 className="text-xs font-black uppercase text-yellow-500 tracking-wider flex items-center gap-1.5 border-b border-zinc-800 pb-2 mb-1">
                      <Zap size={14} className="text-yellow-500 animate-pulse" /> Live Status Timeline
                    </h3>
                    <div className="space-y-4 pt-1">
                      {(() => {
                        const isPlaced = activeOrder.status === 'placed';
                        const isAccepted = activeOrder.status === 'accepted';
                        const isPreparing = activeOrder.status === 'preparing';
                        const isAwaiting = activeOrder.status === 'awaiting_pickup';
                        const isDriverAccepted = activeOrder.status === 'driver_accepted';
                        const isPickedUp = activeOrder.status === 'picked_up';
                        const isOut = activeOrder.status === 'out_for_delivery';
                        const isDelivered = activeOrder.status === 'delivered';

                        const steps = [
                          { 
                            title: 'Order Placed', 
                            desc: 'Your order has been received by the merchant',
                            status: (!isPlaced) ? 'completed' as const : 'active' as const
                          },
                          { 
                            title: 'Preparing Order', 
                            desc: 'Merchant is preparing your items',
                            status: (isPreparing || isAwaiting || isDriverAccepted || isPickedUp || isOut || isDelivered) ? 'completed' as const : (isAccepted ? 'active' as const : 'pending' as const)
                          },
                          { 
                            title: 'Ready for Pickup', 
                            desc: 'Order is ready for dispatch',
                            status: (isDriverAccepted || isPickedUp || isOut || isDelivered) ? 'completed' as const : (isAwaiting ? 'active' as const : 'pending' as const)
                          },
                          { 
                            title: 'Rider Heading to Store', 
                            desc: 'Rider accepted & heading to merchant',
                            status: (isPickedUp || isOut || isDelivered) ? 'completed' as const : (isDriverAccepted ? 'active' as const : 'pending' as const)
                          },
                          { 
                            title: 'Rider Picked Up', 
                            desc: 'Rider has collected your items from merchant',
                            status: (isOut || isDelivered) ? 'completed' as const : (isPickedUp ? 'active' as const : 'pending' as const)
                          },
                          { 
                            title: 'On the Way', 
                            desc: 'Rider is heading to your address',
                            status: isDelivered ? 'completed' as const : (isOut ? 'active' as const : 'pending' as const)
                          },
                          { 
                            title: 'Delivered', 
                            desc: 'Package delivered successfully',
                            status: isDelivered ? 'completed' as const : 'pending' as const
                          }
                        ];

                        return steps.map((step, idx) => {
                          let dotColor = 'border-zinc-700 bg-zinc-800 text-zinc-500';
                          let textColor = 'text-zinc-500';
                          let lineActive = false;

                          if (step.status === 'completed') {
                            dotColor = 'bg-yellow-500 border-yellow-500 text-black shadow-[0_0_8px_rgba(247,209,8,0.3)]';
                            textColor = 'text-zinc-200 font-medium';
                            lineActive = true;
                          } else if (step.status === 'active') {
                            dotColor = 'border-yellow-500 bg-yellow-500/10 text-yellow-500 animate-pulse shadow-[0_0_12px_rgba(247,209,8,0.4)]';
                            textColor = 'text-yellow-500 font-bold';
                          }

                          return (
                            <div key={idx} className="flex gap-3 relative">
                              {idx < steps.length - 1 && (
                                <div 
                                  className={`absolute left-2.5 top-5 bottom-[-16px] w-[2px] transition-colors duration-500 ${
                                    lineActive ? 'bg-yellow-500' : 'bg-zinc-800'
                                  }`} 
                                />
                              )}
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-black z-10 ${dotColor}`}>
                                {step.status === 'completed' ? (
                                  <Check size={10} strokeWidth={3} />
                                ) : idx + 1}
                              </div>
                              <div className="flex-1">
                                <span className={`text-xs block ${textColor}`}>{step.title}</span>
                                <span className="text-[10px] block text-zinc-500 leading-tight mt-0.5">{step.desc}</span>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* Details HUD */}
                  <div className="p-4 rounded-xl flex flex-col justify-between" style={{ background: '#222222', border: '1px solid #2E2E2E' }}>
                    <div className="space-y-3.5 text-xs">
                      <div>
                        <strong className="block text-zinc-500 font-extrabold uppercase">Delivery Destination</strong>
                        <p className="text-zinc-200 font-semibold mt-0.5">{activeOrder.delivery_address}</p>
                      </div>
                      {activeOrder.sellers && (
                        <div className="border-t border-zinc-800 pt-3">
                          <strong className="block text-zinc-500 font-extrabold uppercase">Store Details</strong>
                          <p className="text-zinc-200 font-semibold mt-1">🏪 {activeOrder.sellers.store_name}</p>
                          {activeOrder.sellers.address && <p className="text-zinc-400 mt-0.5">{activeOrder.sellers.address}</p>}
                        </div>
                      )}
                      <div className="border-t border-zinc-800 pt-3">
                        <strong className="block text-zinc-500 font-extrabold uppercase">Delivery Partner</strong>
                        {activeOrder.delivery_partner_id ? (
                          <div className="mt-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                              <p className="text-zinc-200 font-semibold">{activeOrder.driver?.full_name || 'Rider Assigned'}</p>
                            </div>
                            {activeOrder.driver?.phone_number && (
                              <a href={`tel:${activeOrder.driver.phone_number}`} className="inline-flex items-center gap-1.5 text-yellow-500 hover:text-yellow-400 font-semibold transition">
                                📞 {activeOrder.driver.phone_number}
                              </a>
                            )}
                          </div>
                        ) : (
                          <p className="text-yellow-500 font-semibold mt-1 flex items-center gap-1">
                            <Loader2 size={12} className="animate-spin" /> Store preparing order. Locating nearest partner...
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-zinc-800 pt-3 mt-3 space-y-2 text-xs">
                      {activeOrder.items_total && (
                        <div className="flex justify-between items-center text-zinc-400">
                          <span>Item Total</span>
                          <span>{formatINR(activeOrder.items_total)}</span>
                        </div>
                      )}
                      {activeOrder.delivery_partner_fee && (
                        <div className="flex justify-between items-center text-zinc-400">
                          <span>Delivery partner fee</span>
                          <span>{formatINR(activeOrder.delivery_partner_fee)}</span>
                        </div>
                      )}
                      {activeOrder.small_cart_fee > 0 && (
                        <div className="flex justify-between items-center text-zinc-400">
                          <span>Small cart fee</span>
                          <span>{formatINR(activeOrder.small_cart_fee)}</span>
                        </div>
                      )}
                      {activeOrder.handling_charge > 0 && (
                        <div className="flex justify-between items-center text-zinc-400">
                          <span>Handling charge</span>
                          <span>{formatINR(activeOrder.handling_charge)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between font-bold border-t border-zinc-900 pt-2 mt-1">
                        <span className="text-zinc-500 uppercase text-[10px]">Total Paid (via Razorpay)</span>
                        <span className="text-sm font-extrabold text-white">{formatINR(activeOrder.total_amount)}</span>
                      </div>
                    </div>

                  </div>
                </div>

              </div>

              {/* Chat Desk Drawer */}
              {showChat && (
                <div className="mt-5 p-4 rounded-xl space-y-4 border border-zinc-800" style={{ background: '#222222' }}>
                  <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                    <h3 className="text-xs font-bold flex items-center gap-1.5 text-yellow-500">
                      <MessageCircle size={14} /> Order Communications Desk
                    </h3>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setChatPartner('seller')}
                        className={`px-3 py-1 rounded font-bold text-[10px] transition ${
                          chatPartner === 'seller' ? 'bg-yellow-500 text-black' : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        Chat Store
                      </button>
                      {activeOrder.delivery_partner_id && (
                        <button 
                          onClick={() => setChatPartner('delivery')}
                          className={`px-3 py-1 rounded font-bold text-[10px] transition ${
                            chatPartner === 'delivery' ? 'bg-yellow-500 text-black' : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          Chat Rider
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Messages rendering */}
                  <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                    {dbMessages.filter(m => 
                      m.recipient_role === chatPartner || m.sender_role === chatPartner || !m.recipient_role
                    ).length === 0 ? (
                      <p className="text-center text-xs text-zinc-600 py-6">No messages in this channel yet.</p>
                    ) : (
                      dbMessages
                        .filter(m => m.recipient_role === chatPartner || m.sender_role === chatPartner || !m.recipient_role)
                        .map(msg => {
                          const isMe = msg.sender_role === 'customer';
                          return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                              <div 
                                className={`p-2.5 rounded-xl max-w-[85%] text-xs ${
                                  isMe 
                                    ? 'bg-yellow-500 text-black rounded-tr-none font-medium' 
                                    : 'bg-zinc-800 text-zinc-200 rounded-tl-none border border-zinc-700'
                                }`}
                              >
                                <p>{msg.text}</p>
                                <span className="text-[8px] font-semibold block text-right mt-1 opacity-55">
                                  {new Date(msg.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>

                  {/* Send Input */}
                  <div className="flex gap-2 border-t border-zinc-800 pt-3">
                    <input 
                      type="text" 
                      className="input flex-1 py-1.5 text-xs bg-zinc-900 border-zinc-800" 
                      placeholder={`Type message to ${chatPartner === 'seller' ? 'store' : 'rider'}...`}
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                    />
                    <button 
                      onClick={handleSendMessage}
                      className="px-3 py-1.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-xs"
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Checkout success banner */}
          {checkoutSuccess && (
            <div className="p-5 rounded-xl flex items-center gap-4 justify-between animate-fade-in" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-full" style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}>
                  <Check size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-lg" style={{ color: '#22C55E' }}>Order Confirmed!</h4>
                  <p className="text-sm" style={{ color: '#B0B0B0' }}>
                    Tracking ID: <span className="font-mono text-white text-xs">{activeOrderTrackingId}</span>
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#8A8A8A' }}>Rider assignment will appear once your seller prepares the order.</p>
                </div>
              </div>
              <button onClick={() => setCheckoutSuccess(false)} style={{ color: '#8A8A8A' }}><X size={18} /></button>
            </div>
          )}

          {/* Seller product menu view */}
          {selectedSeller ? (
            <div className="rounded-xl p-5" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
              <div className="flex justify-between items-center border-b pb-4 mb-5" style={{ borderColor: '#2E2E2E' }}>
                <div>
                  <button onClick={() => setSelectedSeller(null)} className="text-sm font-semibold mb-1 flex items-center" style={{ color: '#F7D108' }}>
                    ← Back to stores
                  </button>
                  <h2 className="text-xl font-bold">{selectedSeller.store_name} Menu</h2>
                  <p className="text-xs mt-0.5" style={{ color: '#8A8A8A' }}>{selectedSeller.address}</p>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E' }}>
                  {selectedSeller.distanceKm.toFixed(2)} km away
                </span>
              </div>

              {loadingProducts ? (
                <div className="flex justify-center items-center py-16">
                  <Loader2 className="animate-spin" size={32} style={{ color: '#F7D108' }} />
                </div>
              ) : sellerProducts.length === 0 ? (
                /* Empty catalog state */
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  <PackageSearch size={48} style={{ color: '#2E2E2E' }} />
                  <p className="font-bold text-lg" style={{ color: '#8A8A8A' }}>No Items in Catalog Yet</p>
                  <p className="text-sm" style={{ color: '#444' }}>This store is adding items to our catalog. Check back soon!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {sellerProducts.map(product => {
                    const cartQty = cart.find(item => item.id === product.id)?.quantity || 0;
                    return (
                      <div key={product.id} className="rounded-xl overflow-hidden flex flex-col hover:border-[#3E3E3E] transition-all duration-200" style={{ background: '#222222', border: '1px solid #2E2E2E' }}>
                        {/* Product Image */}
                        <div
                          className="relative w-full overflow-hidden cursor-pointer group"
                          style={{ height: '160px', background: '#1A1A1A' }}
                          onClick={() => product.image_url && setLightboxImage({ url: product.image_url, name: product.name })}
                        >
                          {product.image_url ? (
                            <>
                              <img
                                src={product.image_url}
                                alt={product.name}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                              {/* Hover overlay with zoom hint */}
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200" style={{ background: 'rgba(0,0,0,0.45)' }}>
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: 'rgba(247,209,8,0.9)', color: '#121212' }}>
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                                  View Photo
                                </div>
                              </div>
                            </>
                          ) : (
                            /* Placeholder when no image */
                            <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ color: '#3E3E3E' }}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                              <span className="text-[10px] font-semibold" style={{ color: '#444' }}>No Photo</span>
                            </div>
                          )}
                          {/* 30MIN badge */}
                          {product.is_ready_for_30min && (
                            <span className="absolute top-2 left-2 text-[9px] px-1.5 py-0.5 rounded font-black" style={{ background: 'rgba(247,209,8,0.92)', color: '#121212' }}>⚡ 30MIN</span>
                          )}
                        </div>

                        {/* Product Info & Cart Controls */}
                        <div className="p-3.5 flex flex-col flex-1">
                          <h3 className="font-bold text-sm leading-snug mb-1">{product.name}</h3>
                          <p className="text-xs line-clamp-2 leading-relaxed flex-1" style={{ color: '#8A8A8A' }}>{product.description || 'No description available.'}</p>
                          <div className="flex items-center justify-between mt-3">
                            <span className="font-extrabold text-base" style={{ color: '#F5F5F5' }}>{formatINR(product.price)}</span>
                            {cartQty > 0 ? (
                              <div className="flex items-center rounded-lg p-1.5 gap-3" style={{ background: '#F7D108' }}>
                                <button onClick={() => removeFromCart(product.id)} className="font-bold" style={{ color: '#121212' }}><Minus size={14} /></button>
                                <span className="text-xs font-bold font-mono" style={{ color: '#121212' }}>{cartQty}</span>
                                <button onClick={() => addToCart(product)} className="font-bold" style={{ color: '#121212' }}><Plus size={14} /></button>
                              </div>
                            ) : (
                              <button onClick={() => addToCart(product)} className="btn-primary text-xs py-1.5 px-4">
                                Add
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Storefront discovery list */
            <div>
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h2 className="text-xl font-bold">Active Stores Near You</h2>
                  <p className="text-sm mt-0.5" style={{ color: '#8A8A8A' }}>Within {OPERATIONAL_GEOFENCE_KM} km SLA delivery radius in {TOWN_NAME}</p>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: 'rgba(247,209,8,0.1)', color: '#F7D108' }}>
                  {activeSellersInSla.length} Online
                </span>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {[1, 2, 3, 4].map(idx => (
                    <div key={idx} className="rounded-xl p-5 space-y-4 animate-pulse" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                      <div className="flex justify-between items-start">
                        <div className="h-5 w-40 skeleton rounded" />
                        <div className="h-4 w-16 skeleton rounded" />
                      </div>
                      <div className="h-3 w-full skeleton rounded" />
                      <div className="h-9 w-full skeleton rounded mt-3" />
                    </div>
                  ))}
                </div>
              ) : activeSellersInSla.length === 0 ? (
                /* Clean empty state — no mock sellers */
                <div className="rounded-xl p-12 text-center flex flex-col items-center gap-4" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                  <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(247,209,8,0.1)' }}>
                    <Store size={32} style={{ color: '#F7D108' }} />
                  </div>
                  <div>
                    <p className="font-bold text-lg mb-1" style={{ color: '#F5F5F5' }}>No stores online in your area yet</p>
                    <p className="text-sm leading-relaxed" style={{ color: '#8A8A8A' }}>
                      KDLGOODS is coming soon to {TOWN_NAME}!<br />
                      Sellers are being onboarded — check back shortly.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {activeSellersInSla.map(seller => (
                    <div key={seller.id} className="rounded-xl p-5 flex flex-col justify-between gap-4 hover:border-[#3E3E3E] transition" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-base">{seller.store_name}</h3>
                          <span className="text-[10px] px-2 py-0.5 rounded font-extrabold" style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E' }}>
                            {seller.distanceKm.toFixed(2)} KM
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed mb-3" style={{ color: '#8A8A8A' }}>{seller.description}</p>
                        <div className="text-xs space-y-1 p-2.5 rounded" style={{ background: '#222222', border: '1px solid #2E2E2E' }}>
                          <p style={{ color: '#8A8A8A' }}>📍 {seller.address}</p>
                          <p className="font-mono text-[10px]" style={{ color: '#444' }}>GEOHASH: {seller.geohash}</p>
                        </div>
                      </div>
                      <button onClick={() => fetchSellerProducts(seller)} className="btn-primary text-xs w-full">
                        Browse Menu <ChevronRight size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Out-of-SLA sellers (locked) */}
              {outOfSlaSellers.length > 0 && (
                <div className="border-t pt-6 mt-6" style={{ borderColor: '#2E2E2E' }}>
                  <h2 className="text-base font-bold mb-1" style={{ color: '#8A8A8A' }}>Stores Outside {OPERATIONAL_GEOFENCE_KM} km Delivery Zone</h2>
                  <p className="text-xs mb-5" style={{ color: '#444' }}>These stores are locked — beyond the 30-minute delivery radius.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 opacity-40">
                    {outOfSlaSellers.map(seller => (
                      <div key={seller.id} className="rounded-xl p-5 cursor-not-allowed" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold">{seller.store_name}</h3>
                          <span className="text-[10px] px-2 py-0.5 rounded font-extrabold" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                            {seller.distanceKm.toFixed(2)} KM (OUT)
                          </span>
                        </div>
                        <p className="text-xs" style={{ color: '#8A8A8A' }}>{seller.description}</p>
                        <p className="text-xs font-semibold mt-2" style={{ color: '#EF4444' }}>⚠️ Locked to guarantee 30-min SLA</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sticky Cart Banner */}
      {cart.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 p-4 rounded-xl flex items-center justify-between shadow-2xl z-40 max-w-4xl mx-auto animate-bounce-subtle" style={{ background: '#1A1A1A', border: '1.5px solid #F7D108' }}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg" style={{ background: '#F7D108' }}>
              <ShoppingBag size={22} style={{ color: '#121212' }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold">{cart.length} Item{cart.length > 1 ? 's' : ''}</span>
                <span className="text-[10px] px-2 py-0.5 rounded font-extrabold flex items-center gap-0.5" style={{ background: 'rgba(247,209,8,0.12)', color: '#F7D108' }}>
                  <Zap size={10} /> ~18 MIN DELIVERY
                </span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: '#8A8A8A' }}>30-min SLA guaranteed · {TOWN_NAME}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-lg font-extrabold">{formatINR(cartTotal)}</span>
            <button onClick={() => setShowCheckoutDetails(true)} disabled={checkingOut} className="btn-primary">
              {checkingOut ? (
                <><Loader2 className="animate-spin" size={15} /> Processing...</>
              ) : 'Checkout'}
            </button>
          </div>
        </div>
      )}

      {/* Blinkit-Style Bill Details Modal */}
      {showCheckoutDetails && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl p-6 relative" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
            <button 
              onClick={() => setShowCheckoutDetails(false)} 
              className="absolute top-4 right-4 text-zinc-500 hover:text-white transition"
            >
              <X size={20} />
            </button>

            <h3 className="text-base font-black text-white mb-5 flex items-center gap-2 border-b pb-3 animate-fade-in" style={{ borderColor: '#2E2E2E' }}>
              <ShoppingBag size={20} style={{ color: '#F7D108' }} /> Bill Details
            </h3>

            {/* Bill Rows */}
            <div className="space-y-4 text-xs text-zinc-300">
              <div className="flex justify-between items-center">
                <span>Item Total</span>
                <span className="font-semibold text-white">{formatINR(cartTotal)}</span>
              </div>
              
              <div className="flex justify-between items-start">
                <div>
                  <span className="block text-zinc-200">Delivery partner fee</span>
                  <span className="text-[10px] text-zinc-500 block">This fee goes entirely to support your delivery partner</span>
                </div>
                <span className="font-semibold text-white">{formatINR(deliveryPartnerFee)}</span>
              </div>

              {smallCartFee > 0 && (
                <div className="flex justify-between items-center">
                  <div>
                    <span className="block text-zinc-200">Small cart fee</span>
                    <span className="text-[10px] text-zinc-500 block">Applied to orders under ₹250</span>
                  </div>
                  <span className="font-semibold text-white">{formatINR(smallCartFee)}</span>
                </div>
              )}

              {handlingCharge > 0 && (
                <div className="flex justify-between items-center">
                  <div>
                    <span className="block text-zinc-200">Handling charge</span>
                    <span className="text-[10px] text-zinc-500 block">Standard quick-commerce handling charge</span>
                  </div>
                  <span className="font-semibold text-white">{formatINR(handlingCharge)}</span>
                </div>
              )}

              <div className="border-t pt-4 flex justify-between items-center" style={{ borderColor: '#2E2E2E' }}>
                <span className="font-bold text-white text-sm">Grand Total</span>
                <span className="text-base font-extrabold text-[#F7D108]">{formatINR(grandTotal)}</span>
              </div>
            </div>
                 {/* Payment Method Selector */}
            <div className="mt-5 border-t pt-4 space-y-3" style={{ borderColor: '#2E2E2E' }}>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">Select Payment Method</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cod')}
                  className={`py-3 px-4 rounded-xl border text-xs font-bold text-center transition ${
                    paymentMethod === 'cod'
                      ? 'border-yellow-500 bg-yellow-500/10 text-yellow-500'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  💵 Cash on Delivery
                </button>
                <button
                  type="button"
                  disabled
                  style={{ opacity: 0.4, cursor: 'not-allowed' }}
                  className="py-3 px-4 rounded-xl border border-zinc-900 bg-zinc-950 text-zinc-500 text-xs font-bold text-center"
                >
                  📱 Online UPI (Disabled)
                </button>
              </div>
            </div>

            {paymentError && (
              <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] flex items-center gap-1.5">
                <AlertTriangle size={14} />
                <span>{paymentError}</span>
              </div>
            )}

            {/* Pay Button */}
            <div className="mt-6 flex flex-col gap-3">
              <button 
                onClick={handleConfirmCheckout} 
                disabled={checkingOut} 
                className="w-full btn-primary py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
              >
                {checkingOut ? (
                  <><Loader2 className="animate-spin" size={16} /> Processing...</>
                ) : paymentMethod === 'cod' ? (
                  <>Place Order via COD ({formatINR(grandTotal)})</>
                ) : (
                  <>Proceed to UPI Payment ({formatINR(grandTotal)})</>
                )}
              </button>
              
              <button 
                onClick={() => setShowCheckoutDetails(false)}
                className="w-full text-center text-xs text-zinc-500 hover:text-zinc-300 font-bold transition"
              >
                Cancel &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Central UPI Payment Gateway Modal */}
      {showUpiGateway && (
        <div className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl relative border border-zinc-800 bg-[#121212] p-5 space-y-4">
            
            {/* Brand Header */}
            <div className="text-center pb-3 border-b border-zinc-800">
              <h4 className="text-sm font-black text-yellow-500 uppercase tracking-wider">KDL UPI Gateway</h4>
              <p className="text-[10px] text-zinc-500 mt-0.5">Submit payment to the central account below</p>
            </div>

            {/* Bank details & QR simulation */}
            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900 text-xs space-y-2.5">
              <div className="flex justify-between">
                <span className="text-zinc-500">Beneficiary:</span>
                <span className="text-zinc-200 font-semibold">KDL Goods Private Ltd.</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Central UPI ID:</span>
                <span className="text-yellow-500 font-mono font-bold">kdlgoods@icici</span>
              </div>
              <div className="flex justify-between border-t border-zinc-800/50 pt-2">
                <span className="text-zinc-500">Bank Name:</span>
                <span className="text-zinc-200 font-semibold">ICICI Bank</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Account Number:</span>
                <span className="text-zinc-200 font-mono font-semibold">123405006789</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">IFSC Code:</span>
                <span className="text-zinc-200 font-mono font-semibold">ICIC0001234</span>
              </div>
              <div className="flex justify-between border-t border-zinc-800/50 pt-2 font-bold text-sm">
                <span className="text-zinc-400">Total Payable:</span>
                <span className="text-[#F7D108]">{formatINR(grandTotal)}</span>
              </div>
            </div>

            {/* Instructions */}
            <p className="text-[10px] text-zinc-500 text-center leading-relaxed">
              Open your favorite UPI app (GPay, PhonePe, Paytm, BHIM) and complete the transfer, then enter the 12-digit transaction ID below.
            </p>

            {/* Input Details */}
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-1">UPI Transaction ID / Ref No (Required)</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. 432109876543" 
                  className="input py-2.5 text-xs text-center" 
                  value={upiTxnId}
                  onChange={e => setUpiTxnId(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-1.5">Upload Receipt Screenshot (Optional)</label>
                <label className="flex items-center justify-center gap-2 cursor-pointer w-full rounded-lg p-2.5 bg-zinc-900 border border-dashed border-zinc-800 text-zinc-500 hover:text-zinc-300 transition">
                  <span className="text-xs">{upiScreenshot ? `✓ ${upiScreenshot}` : "Click to attach screenshot"}</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={e => {
                      if (e.target.files?.[0]) {
                        setUpiScreenshot(e.target.files[0].name);
                      }
                    }} 
                  />
                </label>
              </div>
            </div>

            {/* Error Message */}
            {paymentError && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] text-center">
                {paymentError}
              </div>
            )}

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button 
                onClick={() => {
                  setShowUpiGateway(false);
                  setPaymentError(null);
                }}
                className="py-2.5 rounded-xl border border-zinc-800 text-zinc-400 text-xs font-bold transition hover:bg-zinc-900"
              >
                Go Back
              </button>
              <button 
                onClick={handleUpiSubmit}
                className="py-2.5 rounded-xl bg-yellow-500 text-black text-xs font-black transition hover:bg-yellow-400"
              >
                Submit Payment
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Profile & Settings Slider Drawer */}
      {showSettingsDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md h-full bg-[#1A1A1A] border-l border-zinc-800 p-6 flex flex-col justify-between overflow-y-auto shadow-2xl">
            <div>
              {/* Header */}
              <div className="flex justify-between items-center pb-4 border-b border-zinc-850 mb-6">
                <div className="flex items-center gap-2">
                  <Settings size={20} className="text-yellow-500" />
                  <h3 className="text-base font-black text-white">Profile &amp; Settings</h3>
                </div>
                <button
                  onClick={() => {
                    setShowSettingsDrawer(false);
                    setProfileSuccess(null);
                    setProfileError(null);
                    setSecuritySuccess(null);
                    setSecurityError(null);
                  }}
                  className="text-zinc-500 hover:text-white transition"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Profile Details Form */}
              <form onSubmit={handleProfileSave} className="space-y-4">
                <h4 className="text-xs font-bold text-yellow-500 uppercase tracking-wider">Account Details</h4>
                
                {/* Avatar upload */}
                <div className="flex items-center gap-4 p-3 rounded-xl bg-zinc-900 border border-zinc-850">
                  <div className="relative w-16 h-16 rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center border border-zinc-700">
                    {profileAvatarUrl ? (
                      <img src={profileAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <Store size={24} className="text-zinc-500" />
                    )}
                    {uploadingAvatar && (
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                        <Loader2 className="animate-spin text-yellow-500" size={16} />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 cursor-pointer hover:text-yellow-500 transition">
                      Change Profile Picture
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarFileChange}
                      />
                    </label>
                    <p className="text-[10px] text-zinc-500 mt-1">PNG, JPG up to 2MB</p>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={profileName}
                    onChange={e => setProfileName(e.target.value)}
                    className="input py-2 px-3 text-xs w-full"
                    placeholder="Anil Kumar"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-1">Mobile Contact (Compulsory)</label>
                  <input
                    type="tel"
                    required
                    value={userPhone || ''}
                    onChange={e => setUserPhone(e.target.value)}
                    className="input py-2 px-3 text-xs w-full"
                    placeholder="9876543210"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-1">Delivery Address</label>
                  <input
                    type="text"
                    value={profileAddress}
                    onChange={e => setProfileAddress(e.target.value)}
                    className="input py-2 px-3 text-xs w-full"
                    placeholder="House No, Street, Kirandul, Dantewada"
                  />
                </div>

                {profileError && (
                  <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] text-center">
                    {profileError}
                  </div>
                )}
                {profileSuccess && (
                  <div className="p-2.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] text-center">
                    {profileSuccess}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2 bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-black rounded-lg transition"
                >
                  Save Profile Changes
                </button>
              </form>

              <div className="border-t border-zinc-850 my-6" />

              {/* Preferences Settings */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-yellow-500 uppercase tracking-wider">App Preferences</h4>
                
                <div className="flex justify-between items-center p-3 rounded-lg bg-zinc-900 border border-zinc-850">
                  <div>
                    <span className="block text-xs font-semibold text-white">Email Notifications</span>
                    <span className="text-[10px] text-zinc-500">Receive order receipts and merchant notifications</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifEmail}
                    onChange={e => setNotifEmail(e.target.checked)}
                    className="w-4 h-4 accent-yellow-500"
                  />
                </div>

                <div className="flex justify-between items-center p-3 rounded-lg bg-zinc-900 border border-zinc-850">
                  <div>
                    <span className="block text-xs font-semibold text-white">Push Alert Sounds</span>
                    <span className="text-[10px] text-zinc-500">Play standard chimes on geofence updates</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifPush}
                    onChange={e => setNotifPush(e.target.checked)}
                    className="w-4 h-4 accent-yellow-500"
                  />
                </div>
              </div>

              <div className="border-t border-zinc-850 my-6" />

              {/* Change Password Form */}
              <form onSubmit={handlePasswordUpdate} className="space-y-4">
                <h4 className="text-xs font-bold text-yellow-500 uppercase tracking-wider">Change Password</h4>
                
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="input py-2 px-3 text-xs w-full"
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-1">Confirm Password</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="input py-2 px-3 text-xs w-full"
                    placeholder="••••••••"
                  />
                </div>

                {securityError && (
                  <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] text-center">
                    {securityError}
                  </div>
                )}
                {securitySuccess && (
                  <div className="p-2.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] text-center">
                    {securitySuccess}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold rounded-lg transition"
                >
                  Update Security Credentials
                </button>
              </form>
            </div>
            
            <div className="pt-6 mt-6 border-t border-zinc-850 text-center">
              <span className="text-[10px] text-zinc-600">KDLGOODS Customer Dashboard v2.0.1</span>
            </div>
          </div>
        </div>
      )}

      {/* Product Image Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)' }}
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-w-2xl w-full rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: '#1A1A1A', border: '1px solid #3E3E3E' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #2E2E2E' }}>
              <p className="font-bold text-sm truncate pr-4" style={{ color: '#F5F5F5' }}>{lightboxImage.name}</p>
              <button
                onClick={() => setLightboxImage(null)}
                className="p-1.5 rounded-full hover:bg-zinc-800 transition"
                style={{ color: '#8A8A8A' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Full Image */}
            <div className="w-full flex items-center justify-center" style={{ background: '#111', maxHeight: '75vh' }}>
              <img
                src={lightboxImage.url}
                alt={lightboxImage.name}
                className="object-contain w-full"
                style={{ maxHeight: '70vh' }}
              />
            </div>

            {/* Footer hint */}
            <div className="px-4 py-2 text-center">
              <p className="text-[10px]" style={{ color: '#555' }}>Tap outside or press ✕ to close</p>
            </div>
          </div>
        </div>
      )}

      {/* Order History Drawer */}
      {showHistoryDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md h-full bg-[#1A1A1A] border-l border-zinc-800 p-6 flex flex-col justify-between overflow-y-auto shadow-2xl">
            <div>
              {/* Header */}
              <div className="flex justify-between items-center pb-4 border-b border-zinc-850 mb-6">
                <div className="flex items-center gap-2">
                  <History size={20} className="text-yellow-500" />
                  <h3 className="text-base font-black text-white">Your Order History</h3>
                </div>
                <button
                  onClick={() => setShowHistoryDrawer(false)}
                  className="text-zinc-500 hover:text-white transition"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Order List */}
              {loadingHistory ? (
                <div className="flex flex-col items-center justify-center py-20 gap-2">
                  <Loader2 className="animate-spin text-yellow-500" size={24} />
                  <p className="text-xs text-zinc-500">Loading your history...</p>
                </div>
              ) : orderHistory.length === 0 ? (
                <div className="text-center py-20 text-zinc-500 text-xs">
                  No orders placed yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {orderHistory.map((order) => (
                    <div 
                      key={order.id} 
                      className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 transition flex flex-col gap-2"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-xs font-black text-white">{order.sellers?.store_name || 'Store'}</h4>
                          <span className="text-[10px] text-zinc-500 block font-mono mt-0.5">{order.id.slice(0, 8)}...</span>
                        </div>
                        <span 
                          className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            order.status === 'delivered'
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                              : order.status === 'cancelled'
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                          }`}
                        >
                          {order.status}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-xs mt-1 border-t border-zinc-850 pt-2">
                        <div className="text-zinc-400">
                          <span className="block text-[10px] text-zinc-500">{new Date(order.created_at).toLocaleDateString()}</span>
                          <span className="text-[10px] uppercase font-bold text-zinc-500">{order.payment_method} · {order.payment_status}</span>
                        </div>
                        <strong className="text-white font-extrabold">{formatINR(order.total_amount)}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-8 border-t border-zinc-850 pt-4">
              <button
                onClick={() => setShowHistoryDrawer(false)}
                className="w-full py-2.5 rounded-xl bg-zinc-850 hover:bg-zinc-800 text-zinc-300 font-bold text-xs transition border border-zinc-800"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
