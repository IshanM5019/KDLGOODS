'use client';

import React, { useState, useEffect } from 'react';
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
  MessageSquare, MessageCircle, CreditCard
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
  const [showRazorpaySandbox, setShowRazorpaySandbox] = useState(false);
  const [razorpayOrderId, setRazorpayOrderId] = useState('');
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
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
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
          }
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
    const checkLocalActiveOrder = () => {
      if (activeOrderTrackingId) return;
      const local = JSON.parse(localStorage.getItem('kdlgoods_orders') || '[]');
      const active = local.find((o: any) => !['delivered', 'cancelled'].includes(o.status));
      if (active) {
        setActiveOrderTrackingId(active.id);
      }
    };
    checkLocalActiveOrder();
    const interval = setInterval(checkLocalActiveOrder, 2000);
    return () => clearInterval(interval);
  }, [activeOrderTrackingId]);

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
          .select('*, sellers(store_name, location)')
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
        setActiveOrder(payload.new);
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

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') {
        resolve(false);
        return;
      }
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const createOrder = async (razorpayPaymentId?: string) => {
    const finalAmount = cartTotal + deliveryPartnerFee;
    setCheckingOut(true);

    try {
      const payload = {
        customer_id: customerId,
        seller_id: cart[0].seller_id,
        status: 'placed',
        total_amount: finalAmount,
        delivery_partner_fee: deliveryPartnerFee,
        delivery_address: 'Kirandul, Dantewada District, Chhattisgarh – 494556',
        delivery_location: `POINT(${userCoords.longitude} ${userCoords.latitude})`,
      };

      const { data, error } = await supabase
        .from('orders')
        .insert([payload])
        .select('id')
        .single();

      if (error) throw error;
      setActiveOrderTrackingId(data.id);
    } catch (err) {
      console.warn('Supabase DB checkout failed. Falling back to local offline storage simulation:', err);
      const mockOrderId = 'order-' + Math.floor(Math.random() * 10000);
      const mockOrder = {
        id: mockOrderId,
        customer_id: customerId || 'cust-1',
        seller_id: cart[0].seller_id,
        delivery_partner_id: null,
        status: 'placed',
        total_amount: finalAmount,
        delivery_partner_fee: deliveryPartnerFee,
        delivery_address: 'Kirandul, Dantewada District, Chhattisgarh – 494556',
        delivery_location: { latitude: userCoords.latitude, longitude: userCoords.longitude },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      const existing = JSON.parse(localStorage.getItem('kdlgoods_orders') || '[]');
      localStorage.setItem('kdlgoods_orders', JSON.stringify([mockOrder, ...existing]));
      setActiveOrderTrackingId(mockOrderId);
    } finally {
      setCheckoutSuccess(true);
      setCart([]);
      setCheckingOut(false);
      setShowCheckoutDetails(false);
    }
  };

  const initiatePaymentFlow = async () => {
    setPaymentError(null);
    setCheckingOut(true);

    try {
      // 1. Create order on Next.js server
      const finalAmount = cartTotal + deliveryPartnerFee;
      const res = await fetch('/api/checkout/razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: finalAmount })
      });

      if (!res.ok) {
        throw new Error('Failed to initialize payment gateway order');
      }

      const orderData = await res.json();
      
      // If server generated a mock order (missing/empty credentials)
      if (orderData.is_mock) {
        setRazorpayOrderId(orderData.id);
        setShowRazorpaySandbox(true);
        setCheckingOut(false);
        return;
      }

      // 2. Try loading script for real integration
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        // Falling back to Sandbox mode
        setRazorpayOrderId(orderData.id || 'order_mock_' + Math.random().toString(36).substring(2, 10));
        setShowRazorpaySandbox(true);
        setCheckingOut(false);
        return;
      }

      // 3. Launch Razorpay Checkout dialog
      const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      const options = {
        key: keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'KDLGOODS',
        description: 'Instant Hyperlocal Checkout',
        image: '/icon-192.png',
        order_id: orderData.id,
        handler: async (response: any) => {
          setCheckingOut(true);
          // Verify payment
          try {
            const verifyRes = await fetch('/api/checkout/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              await createOrder(response.razorpay_payment_id);
            } else {
              setPaymentError('Signature verification failed. Payment was rejected.');
              setCheckingOut(false);
            }
          } catch (err: any) {
            setPaymentError(err.message || 'Payment verification failed');
            setCheckingOut(false);
          }
        },
        prefill: {
          name: 'Customer test',
          email: 'customer@kdlgoods.com',
          contact: '9999999999'
        },
        theme: {
          color: '#F7D108'
        },
        modal: {
          ondismiss: () => {
            setCheckingOut(false);
          }
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      console.warn('Real Razorpay initialization failed, launching Sandbox simulation overlay:', err);
      // Sandbox fallback on failure
      setRazorpayOrderId('order_mock_' + Math.random().toString(36).substring(2, 10));
      setShowRazorpaySandbox(true);
      setCheckingOut(false);
    }
  };

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
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(247,209,8,0.1)', border: '1px solid rgba(247,209,8,0.3)' }}>
          <MapPin size={13} style={{ color: '#F7D108' }} />
          <span className="text-xs font-semibold" style={{ color: '#F7D108' }}>{TOWN_NAME}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: '#222222', border: '1px solid #2E2E2E' }}>
          <Navigation size={13} style={{ color: '#8A8A8A' }} />
          <span className="text-xs font-mono" style={{ color: '#B0B0B0' }}>
            {userCoords.latitude.toFixed(4)}°N, {userCoords.longitude.toFixed(4)}°E
          </span>
        </div>
      </header>

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
                    Status: <span className="text-white font-semibold capitalize">{activeOrder.status.replace('_', ' ')}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setShowChat(!showChat);
                      // Auto-switch partner to delivery if assigned and store is prepared
                      if (activeOrder.delivery_partner_id && ['awaiting_pickup', 'out_for_delivery'].includes(activeOrder.status)) {
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
                <div className="flex justify-between text-[10px] font-bold text-zinc-500 uppercase mb-2">
                  <span>Placed</span>
                  <span>Preparing</span>
                  <span>Picked Up</span>
                  <span>Delivered</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-zinc-800 relative overflow-hidden">
                  {(() => {
                    const statusProgress: Record<string, string> = {
                      placed: 'w-[10%]',
                      accepted: 'w-[25%]',
                      preparing: 'w-[50%]',
                      awaiting_pickup: 'w-[75%]',
                      out_for_delivery: 'w-[90%]',
                      delivered: 'w-[100%]',
                      cancelled: 'w-[0%]'
                    };
                    const color = activeOrder.status === 'cancelled' ? 'bg-red-500' : 'bg-yellow-500';
                    return <div className={`h-full ${statusProgress[activeOrder.status] || 'w-0'} ${color} transition-all duration-500`} />;
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

                {/* Details HUD */}
                <div className="p-4 rounded-xl flex flex-col justify-between" style={{ background: '#222222', border: '1px solid #2E2E2E' }}>
                  <div className="space-y-3.5 text-xs">
                    <div>
                      <strong className="block text-zinc-500 font-extrabold uppercase">Delivery Destination</strong>
                      <p className="text-zinc-200 font-semibold mt-0.5">{activeOrder.delivery_address}</p>
                    </div>
                    <div className="border-t border-zinc-800 pt-3">
                      <strong className="block text-zinc-500 font-extrabold uppercase">Rider Assignment</strong>
                      {activeOrder.delivery_partner_id ? (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          <p className="text-zinc-200 font-medium">Assigned Rider (ID: <span className="font-mono text-zinc-400">{activeOrder.delivery_partner_id.slice(0, 8)}</span>)</p>
                        </div>
                      ) : (
                        <p className="text-yellow-500 font-semibold mt-1 flex items-center gap-1">
                          <Loader2 size={12} className="animate-spin" /> Store preparing order. Locating nearest partner...
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-zinc-800 pt-3 mt-3 space-y-2 text-xs">
                    {activeOrder.delivery_partner_fee && (
                      <div className="flex justify-between items-center text-zinc-400">
                        <span>Delivery partner fee</span>
                        <span>{formatINR(activeOrder.delivery_partner_fee)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-zinc-500 uppercase">Total Bill (Paid)</span>
                      <span className="text-base font-extrabold text-white">{formatINR(activeOrder.total_amount)}</span>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sellerProducts.map(product => {
                    const cartQty = cart.find(item => item.id === product.id)?.quantity || 0;
                    return (
                      <div key={product.id} className="p-4 rounded-xl flex justify-between items-center hover:border-[#3E3E3E] transition" style={{ background: '#222222', border: '1px solid #2E2E2E' }}>
                        <div className="flex-1 pr-4">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-sm">{product.name}</h3>
                            {product.is_ready_for_30min && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(247,209,8,0.12)', color: '#F7D108' }}>30MIN</span>
                            )}
                          </div>
                          <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: '#8A8A8A' }}>{product.description || 'No description available.'}</p>
                          <span className="font-bold mt-2 block" style={{ color: '#F5F5F5' }}>{formatINR(product.price)}</span>
                        </div>
                        <div>
                          {cartQty > 0 ? (
                            <div className="flex items-center rounded-lg p-1.5 gap-3" style={{ background: '#F7D108' }}>
                              <button onClick={() => removeFromCart(product.id)} className="font-bold" style={{ color: '#121212' }}><Minus size={14} /></button>
                              <span className="text-xs font-bold font-mono" style={{ color: '#121212' }}>{cartQty}</span>
                              <button onClick={() => addToCart(product)} className="font-bold" style={{ color: '#121212' }}><Plus size={14} /></button>
                            </div>
                          ) : (
                            <button onClick={() => addToCart(product)} className="btn-primary text-xs py-1.5 px-3">
                              Add
                            </button>
                          )}
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

              <div className="border-t pt-4 flex justify-between items-center" style={{ borderColor: '#2E2E2E' }}>
                <span className="font-bold text-white text-sm">Grand Total</span>
                <span className="text-base font-extrabold text-[#F7D108]">{formatINR(cartTotal + deliveryPartnerFee)}</span>
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
                onClick={initiatePaymentFlow} 
                disabled={checkingOut} 
                className="w-full btn-primary py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-xs"
              >
                {checkingOut ? (
                  <><Loader2 className="animate-spin" size={16} /> Initializing payment...</>
                ) : (
                  <>Pay {formatINR(cartTotal + deliveryPartnerFee)} via Razorpay</>
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

      {/* Razorpay Simulated Sandbox Gateway */}
      {showRazorpaySandbox && (
        <div className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl overflow-hidden shadow-2xl relative border border-zinc-800" style={{ background: '#121212', fontFamily: 'sans-serif' }}>
            {/* Razorpay Brand Header */}
            <div className="p-4 bg-[#1e2736] flex items-center justify-between border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-[#2e3e56] flex items-center justify-center text-[10px] font-black text-blue-400">rzp</div>
                <div>
                  <h4 className="text-[10px] font-black text-white uppercase tracking-wider">Razorpay Checkout</h4>
                  <p className="text-[9px] text-zinc-400">Sandbox Test Mode</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[9px] text-zinc-400 block font-semibold">Amount to Pay</span>
                <span className="text-xs font-extrabold text-white">{formatINR(cartTotal + deliveryPartnerFee)}</span>
              </div>
            </div>

            {/* Content body */}
            <div className="p-6 space-y-5 text-center">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto animate-pulse">
                <CreditCard size={22} />
              </div>
              
              <div>
                <h3 className="font-bold text-white text-xs">Simulated Payment Gateway</h3>
                <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                  Real credentials are not set in <code>.env.local</code>.<br />
                  Select a test result below to simulate the Razorpay transaction response.
                </p>
              </div>

              {/* Order ID Tag */}
              <div className="py-1.5 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-400 select-all">
                ORDER ID: {razorpayOrderId}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button 
                  onClick={async () => {
                    setShowRazorpaySandbox(false);
                    setCheckingOut(true);
                    // Simulate successful API call response verification
                    await new Promise(resolve => setTimeout(resolve, 800));
                    await createOrder('pay_mock_' + Math.random().toString(36).substring(2, 10));
                  }}
                  className="py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition shadow-lg shadow-green-900/20"
                >
                  ✓ Success
                </button>
                <button 
                  onClick={() => {
                    setShowRazorpaySandbox(false);
                    setPaymentError('Payment failed or cancelled by user in Razorpay Simulator.');
                  }}
                  className="py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition shadow-lg shadow-red-900/20"
                >
                  ✗ Failure
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 bg-zinc-900 border-t border-zinc-800 text-center">
              <button 
                onClick={() => {
                  setShowRazorpaySandbox(false);
                  setCheckingOut(false);
                }}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 font-bold transition"
              >
                Close Gateway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
