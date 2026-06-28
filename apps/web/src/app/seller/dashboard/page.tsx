'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { Product, Order, OrderStatus, CreateProductSchema, formatINR, DANTEWADA_CENTER } from '@kdlgoods/shared';
import {
  Plus, Edit, Trash2, Check, X, Clock, ToggleLeft, ToggleRight,
  Store, ShoppingBag, Loader2, AlertCircle, BarChart2, ShieldAlert,
  ImagePlus, PackageSearch, InboxIcon, Settings, MessageSquare, MessageCircle
} from 'lucide-react';

// ─── Supabase Storage bucket for product images ───────────────────────────────
const STORAGE_BUCKET = 'product-images';

/**
 * Uploads a File to Supabase Storage and returns the public URL.
 * Falls back to a default placeholder path when offline.
 */
async function uploadProductImage(file: File, sellerId: string): Promise<string> {
  const ext = file.name.split('.').pop();
  const path = `${sellerId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });

  if (error) throw error;

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export default function SellerDashboard() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'orders' | 'catalog' | 'profile'>('orders');
  const [loading, setLoading] = useState(true);
  const [dbConnected, setDbConnected] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseFloat(localStorage.getItem('kdlgoods_seller_balance') || '0');
    }
    return 0;
  });

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [isReadyFor30Min, setIsReadyFor30Min] = useState(true);
  const [savingProduct, setSavingProduct] = useState(false);

  const [sellerId, setSellerId] = useState<string>('00000000-0000-0000-0000-000000000000');
  const [storeName, setStoreName] = useState('My Store');

  // Store Registration & Settings State
  const [hasStore, setHasStore] = useState<boolean | null>(null);
  const [storeNameInput, setStoreNameInput] = useState('');
  const [storeDescInput, setStoreDescInput] = useState('');
  const [storeAddressInput, setStoreAddressInput] = useState('');
  const [storeLatInput, setStoreLatInput] = useState(String(DANTEWADA_CENTER.latitude));
  const [storeLngInput, setStoreLngInput] = useState(String(DANTEWADA_CENTER.longitude));
  const [registeringStore, setRegisteringStore] = useState(false);
  const [showStoreSettings, setShowStoreSettings] = useState(false);

  // Chat & Track States
  const [activeChatOrderId, setActiveChatOrderId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('kdlgoods_seller_active_chat_order_id');
    }
    return null;
  });
  const [dbMessages, setDbMessages] = useState<any[]>([]);
  const [chatPartner, setChatPartner] = useState<'customer' | 'delivery'>('customer');
  const [chatInput, setChatInput] = useState('');
  const [driverCoords, setDriverCoords] = useState<any | null>(null);
  const [isStoreActive, setIsStoreActive] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kdlgoods_store_active');
      return saved !== 'false';
    }
    return true;
  });
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('');
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

  useEffect(() => {
    if (activeChatOrderId) {
      localStorage.setItem('kdlgoods_seller_active_chat_order_id', activeChatOrderId);
    } else {
      localStorage.removeItem('kdlgoods_seller_active_chat_order_id');
    }
  }, [activeChatOrderId]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (sellerId === '00000000-0000-0000-0000-000000000000') return;

    const ordersChannel = supabase
      .channel('seller-orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders(sellerId))
      .subscribe();

    const checkLocalInterval = setInterval(() => {
      if (!dbConnected) {
        const local = JSON.parse(localStorage.getItem('kdlgoods_orders') || '[]');
        const filtered = local.filter((o: any) => o.seller_id === sellerId);
        setOrders(filtered);
      }
      const localBal = localStorage.getItem('kdlgoods_seller_balance');
      if (localBal) setBalance(parseFloat(localBal));
    }, 1000);

    return () => {
      supabase.removeChannel(ordersChannel);
      clearInterval(checkLocalInterval);
    };
  }, [sellerId, dbConnected]);

  // Chat & Track Synchronization effect
  useEffect(() => {
    if (!activeChatOrderId) {
      setDbMessages([]);
      setDriverCoords(null);
      return;
    }

    const chatChannel = supabase
      .channel(`seller-chat-${activeChatOrderId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'order_messages',
        filter: `order_id=eq.${activeChatOrderId}`
      }, (payload) => {
        setDbMessages(prev => {
          if (prev.some(m => m.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });
      })
      .subscribe();

    const loadMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('order_messages')
          .select('*')
          .eq('order_id', activeChatOrderId)
          .order('created_at', { ascending: true });
        if (!error && data) {
          setDbMessages(data);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadMessages();

    // Check localStorage fallback for offline testing
    const syncLocalStorage = () => {
      const localChats = JSON.parse(localStorage.getItem('kdlgoods_chats') || '[]');
      setDbMessages(localChats.filter((c: any) => c.order_id === activeChatOrderId));

      // Retrieve driver location if rider assigned
      const targetOrder = orders.find(o => o.id === activeChatOrderId);
      if (targetOrder?.delivery_partner_id) {
        const partners = JSON.parse(localStorage.getItem('kdlgoods_delivery_partners') || '{}');
        const driver = partners[targetOrder.delivery_partner_id];
        if (driver?.location) {
          setDriverCoords(driver.location);
        }
      }
    };

    syncLocalStorage();
    const interval = setInterval(syncLocalStorage, 1000);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'kdlgoods_chats' || e.key === 'kdlgoods_delivery_partners') {
        syncLocalStorage();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      supabase.removeChannel(chatChannel);
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [activeChatOrderId, orders]);

  // Subscribe to driver coordinates in database mode
  useEffect(() => {
    const selectedOrder = orders.find(o => o.id === activeChatOrderId);
    if (!selectedOrder?.delivery_partner_id) {
      setDriverCoords(null);
      return;
    }

    const loadDriverCoords = async () => {
      try {
        const { data, error } = await supabase
          .from('delivery_partners')
          .select('location')
          .eq('id', selectedOrder.delivery_partner_id)
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

    const channel = supabase
      .channel(`seller-rider-coords-${selectedOrder.delivery_partner_id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'delivery_partners',
        filter: `id=eq.${selectedOrder.delivery_partner_id}`
      }, (payload: any) => {
        if (payload.new?.location?.coordinates) {
          setDriverCoords({
            longitude: payload.new.location.coordinates[0],
            latitude: payload.new.location.coordinates[1]
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChatOrderId, orders]);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !activeChatOrderId) return;
    const text = chatInput.trim();
    setChatInput('');

    const selectedOrder = orders.find(o => o.id === activeChatOrderId);
    if (!selectedOrder) return;

    const targetRecipient = chatPartner === 'customer' ? 'customer' : 'delivery';
    const messageId = Math.random().toString();
    const timestamp = new Date().toISOString();

    const dbPayload = {
      order_id: activeChatOrderId,
      sender_id: sellerId,
      sender_role: 'seller',
      recipient_role: targetRecipient,
      text,
    };

    try {
      const { error } = await supabase
        .from('order_messages')
        .insert([dbPayload]);
      if (error) throw error;
    } catch (err) {
      // LocalStorage sync fallback
      const local = JSON.parse(localStorage.getItem('kdlgoods_chats') || '[]');
      const mockMsg = {
        id: messageId,
        order_id: activeChatOrderId,
        sender_id: sellerId,
        sender_role: 'seller',
        recipient_role: targetRecipient,
        text,
        created_at: timestamp,
      };
      localStorage.setItem('kdlgoods_chats', JSON.stringify([...local, mockMsg]));
      window.dispatchEvent(new Event('storage'));
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
        .update({
          full_name: profileName,
          phone_number: userPhone,
          avatar_url: profileAvatarUrl,
        })
        .eq('id', user.id);

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

  const handleToggleStoreActive = async () => {
    const nextVal = !isStoreActive;
    setIsStoreActive(nextVal);
    localStorage.setItem('kdlgoods_store_active', String(nextVal));

    // Update local profile cache
    const profile = localStorage.getItem('kdlgoods_seller_profile');
    if (profile) {
      const parsed = JSON.parse(profile);
      parsed.is_active = nextVal;
      localStorage.setItem('kdlgoods_seller_profile', JSON.stringify(parsed));
    }

    try {
      await supabase
        .from('sellers')
        .update({ is_active: nextVal })
        .eq('id', sellerId);
    } catch (err) {
      console.warn('Failed to update store status in DB:', err);
    }
    window.dispatchEvent(new Event('storage'));
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/signin');
        return;
      }

      // Verify user role
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('role, phone_number, full_name, avatar_url')
        .eq('id', user.id)
        .single();
      const userRole = profile?.role || user.user_metadata?.role || 'customer';
      setUserPhone(profile?.phone_number || null);
      setProfileName(profile?.full_name || '');
      setProfileAvatarUrl(profile?.avatar_url || '');
      if (userRole !== 'seller') {
        if (userRole === 'delivery') {
          router.push('/delivery/dashboard');
        } else {
          router.push('/customer/dashboard');
        }
        return;
      }

      setSellerId(user.id);
      const { data: seller, error: sellerErr } = await supabase
        .from('sellers')
        .select('*')
        .eq('id', user.id)
        .single();

      if (sellerErr || !seller) {
        // Check local storage fallback
        const localProfile = localStorage.getItem('kdlgoods_seller_profile');
        if (localProfile) {
          const parsed = JSON.parse(localProfile);
          setStoreName(parsed.store_name);
          setStoreNameInput(parsed.store_name);
          setStoreDescInput(parsed.description || '');
          setStoreAddressInput(parsed.address);
          setStoreLngInput(parsed.lng || String(DANTEWADA_CENTER.longitude));
          setStoreLatInput(parsed.lat || String(DANTEWADA_CENTER.latitude));
          setIsStoreActive(parsed.is_active);
          setHasStore(true);
        } else {
          setHasStore(false);
        }
      } else {
        setStoreName(seller.store_name);
        setStoreNameInput(seller.store_name);
        setStoreDescInput(seller.description || '');
        setStoreAddressInput(seller.address);
        if (seller.location?.coordinates) {
          setStoreLngInput(String(seller.location.coordinates[0]));
          setStoreLatInput(String(seller.location.coordinates[1]));
        }
        setIsStoreActive(seller.is_active);
        setHasStore(true);
        setBalance(Number(seller.balance) || 0);
        localStorage.setItem('kdlgoods_seller_balance', String(seller.balance || '0'));
        localStorage.setItem('kdlgoods_store_active', String(seller.is_active));
        localStorage.setItem('kdlgoods_seller_profile', JSON.stringify({
          id: user.id,
          store_name: seller.store_name,
          description: seller.description,
          address: seller.address,
          lat: seller.location?.coordinates ? String(seller.location.coordinates[1]) : String(DANTEWADA_CENTER.latitude),
          lng: seller.location?.coordinates ? String(seller.location.coordinates[0]) : String(DANTEWADA_CENTER.longitude),
          is_active: seller.is_active
        }));
      }
      await Promise.all([fetchProducts(user.id), fetchOrders(user.id)]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisteringStore(true);
    setError(null);

    const lat = parseFloat(storeLatInput);
    const lng = parseFloat(storeLngInput);

    if (isNaN(lat) || isNaN(lng)) {
      setError('Please enter valid latitude and longitude coordinates.');
      setRegisteringStore(false);
      return;
    }

    try {
      const payload = {
        store_name: storeNameInput,
        description: storeDescInput || null,
        address: storeAddressInput,
        location: `POINT(${lng} ${lat})`,
        is_active: isStoreActive,
      };

      if (hasStore) {
        // Update existing store details
        const { error: updateErr } = await supabase
          .from('sellers')
          .update(payload)
          .eq('id', sellerId);
        if (updateErr) throw updateErr;
      } else {
        // Insert new store record (First-time registration)
        const { error: insertErr } = await supabase
          .from('sellers')
          .insert([{ id: sellerId, ...payload }]);
        if (insertErr) throw insertErr;
        setHasStore(true);
      }

      localStorage.setItem('kdlgoods_seller_profile', JSON.stringify({
        id: sellerId,
        store_name: storeNameInput,
        description: storeDescInput,
        address: storeAddressInput,
        lat: String(lat),
        lng: String(lng),
        is_active: isStoreActive
      }));
      setStoreName(storeNameInput);
      setShowStoreSettings(false);
    } catch (err: any) {
      // Offline fallback
      localStorage.setItem('kdlgoods_seller_profile', JSON.stringify({
        id: sellerId,
        store_name: storeNameInput,
        description: storeDescInput,
        address: storeAddressInput,
        lat: String(lat),
        lng: String(lng),
        is_active: isStoreActive
      }));
      setStoreName(storeNameInput);
      setHasStore(true);
      setShowStoreSettings(false);
    } finally {
      setRegisteringStore(false);
    }
  };

  const fetchProducts = async (currentSellerId = sellerId) => {
    if (currentSellerId === '00000000-0000-0000-0000-000000000000') return;
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('seller_id', currentSellerId)
      .order('created_at', { ascending: false });
    if (!error && data) setProducts(data);
    // On error: keep as empty array — no mock data
  };

  const fetchOrders = async (currentSellerId = sellerId) => {
    if (currentSellerId === '00000000-0000-0000-0000-000000000000') return;
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, profiles(full_name)')
        .eq('seller_id', currentSellerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setOrders(data || []);
      setDbConnected(true);
    } catch {
      setDbConnected(false);
      const local = JSON.parse(localStorage.getItem('kdlgoods_orders') || '[]');
      const filtered = local.filter((o: any) => o.seller_id === currentSellerId);
      setOrders(filtered);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavingProduct(true);

    try {
      const priceNum = parseFloat(price);
      const validationResult = CreateProductSchema.safeParse({
        name, description: description || null, price: priceNum, category,
        image_url: imagePreview || null, is_available: isAvailable, is_ready_for_30min: isReadyFor30Min,
      });

      if (!validationResult.success) {
        setError(validationResult.error.errors.map(err => err.message).join(', '));
        return;
      }

      // Upload image to Supabase Storage if a new file was selected
      let resolvedImageUrl: string | null = imagePreview || null;
      if (imageFile) {
        try {
          resolvedImageUrl = await uploadProductImage(imageFile, sellerId);
        } catch (uploadErr) {
          setError('Image upload failed. Please check your Supabase Storage configuration.');
          return;
        }
      }

      const payload = {
        seller_id: sellerId, name, description: description || null,
        price: priceNum, category, image_url: resolvedImageUrl,
        is_available: isAvailable, is_ready_for_30min: isReadyFor30Min,
      };

      if (editProduct) {
        const { error } = await supabase.from('products').update(payload).eq('id', editProduct.id);
        if (error) setProducts(prev => prev.map(p => p.id === editProduct.id ? { ...p, ...payload } : p));
        else fetchProducts();
      } else {
        const { error } = await supabase.from('products').insert([payload]);
        if (error) {
          const mockNew: Product = {
            id: Math.random().toString(),
            ...payload,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          setProducts(prev => [mockNew, ...prev]);
        } else {
          fetchProducts();
        }
      }
      resetForm();
    } finally {
      setSavingProduct(false);
    }
  };

  const resetForm = () => {
    setShowForm(false); setEditProduct(null); setName(''); setDescription('');
    setPrice(''); setCategory(''); setImageFile(null); setImagePreview('');
    setIsAvailable(true); setIsReadyFor30Min(true);
  };

  const handleEditClick = (product: Product) => {
    setEditProduct(product); setName(product.name); setDescription(product.description || '');
    setPrice(product.price.toString()); setCategory(product.category);
    setImagePreview(product.image_url || ''); setIsAvailable(product.is_available);
    setIsReadyFor30Min(product.is_ready_for_30min); setShowForm(true);
  };

  const handleDeleteProduct = async (id: string) => {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) setProducts(prev => prev.filter(p => p.id !== id));
    else fetchProducts();
  };

  const toggleBoolean = async (product: Product, field: 'is_available' | 'is_ready_for_30min') => {
    const newVal = !product[field as keyof Product];
    const { error } = await supabase.from('products').update({ [field]: newVal }).eq('id', product.id);
    if (error) setProducts(prev => prev.map(p => p.id === product.id ? { ...p, [field]: newVal } : p));
    else fetchProducts();
  };

  const handleUpdateOrderStatus = async (orderId: string, nextStatus: OrderStatus) => {
    try {
      const { error } = await supabase.from('orders').update({ status: nextStatus }).eq('id', orderId);
      if (error) throw error;
      fetchOrders();
    } catch {
      const local = JSON.parse(localStorage.getItem('kdlgoods_orders') || '[]');
      const updated = local.map((o: any) => {
        if (o.id === orderId) {
          return {
            ...o, status: nextStatus,
            delivery_partner_id: nextStatus === 'awaiting_pickup' ? 'driver-uuid-placeholder-123' : o.delivery_partner_id,
          };
        }
        return o;
      });
      localStorage.setItem('kdlgoods_orders', JSON.stringify(updated));
      setOrders(updated);
    }
  };

  return (
    <div className="min-h-screen text-white p-4 md:p-6" style={{ backgroundColor: '#121212' }}>
      {/* Compulsory Mobile Number Warning Banner */}
      {!userPhone && (
        <div className="mb-6 p-4 rounded-xl flex items-center justify-between text-xs font-semibold animate-pulse" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>Compulsory Mobile Contact Required! Please update your profile settings with a contact number.</span>
          </div>
        </div>
      )}

      {/* Top Navbar */}
      <header className="flex justify-between items-center mb-6 p-4 rounded-xl" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
        <div className="flex items-center gap-3">
          <Store style={{ color: '#F7D108' }} size={30} />
          <div>
            <h1 className="text-xl font-black">{storeName}</h1>
            <p className="text-xs" style={{ color: '#8A8A8A' }}>Merchant Admin Panel · Kirandul, Dantewada</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hasStore && (
            <button
              onClick={() => {
                setError(null);
                setShowStoreSettings(!showStoreSettings);
              }}
              className="text-xs px-3 py-1.5 rounded-lg font-bold hover:bg-[#2E2E2E] transition flex items-center gap-1.5"
              style={{ border: '1px solid #2E2E2E', background: '#1A1A1A', color: '#B0B0B0' }}
            >
              <Settings size={14} /> Store Settings
            </button>
          )}
          {hasStore && (
            <button 
              onClick={handleToggleStoreActive}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold text-xs transition"
              style={{
                borderColor: isStoreActive ? '#22C55E' : '#EF4444',
                backgroundColor: isStoreActive ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
                color: isStoreActive ? '#22C55E' : '#EF4444'
              }}
            >
              <span className={`w-2 h-2 rounded-full ${isStoreActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              {isStoreActive ? 'STORE OPEN' : 'STORE CLOSED'}
            </button>
          )}
        </div>
      </header>

      {(!hasStore || showStoreSettings) ? (
        <div className="max-w-2xl mx-auto mt-8">
          <div className="rounded-xl p-6 space-y-6" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
            <div>
              <h2 className="text-xl font-black text-white">
                {hasStore ? 'Store Profile Settings' : '⚡ Register Your Store'}
              </h2>
              <p className="text-sm mt-1" style={{ color: '#8A8A8A' }}>
                {hasStore 
                  ? 'Update your store details and coordinates for customer deliveries.' 
                  : 'Welcome to KDLGOODS! Please set up your store profile to begin listing items and accepting orders.'}
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-lg flex gap-2 items-center text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444' }}>
                <AlertCircle size={15} /> {error}
              </div>
            )}

            <form onSubmit={handleRegisterStore} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#8A8A8A' }}>Store Name</label>
                <input 
                  type="text" 
                  required 
                  className="input" 
                  placeholder="e.g. Dantewada Provision Store" 
                  value={storeNameInput} 
                  onChange={e => setStoreNameInput(e.target.value)} 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#8A8A8A' }}>Description</label>
                <textarea 
                  className="input resize-none" 
                  rows={2} 
                  placeholder="e.g. Fresh groceries, local produce and daily essentials." 
                  value={storeDescInput} 
                  onChange={e => setStoreDescInput(e.target.value)} 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#8A8A8A' }}>Store Address</label>
                <input 
                  type="text" 
                  required 
                  className="input" 
                  placeholder="e.g. Main Road, Kirandul" 
                  value={storeAddressInput} 
                  onChange={e => setStoreAddressInput(e.target.value)} 
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#8A8A8A' }}>Latitude</label>
                  <input 
                    type="number" 
                    step="any" 
                    required 
                    className="input" 
                    value={storeLatInput} 
                    onChange={e => setStoreLatInput(e.target.value)} 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#8A8A8A' }}>Longitude</label>
                  <input 
                    type="number" 
                    step="any" 
                    required 
                    className="input" 
                    value={storeLngInput} 
                    onChange={e => setStoreLngInput(e.target.value)} 
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: '#2E2E2E' }}>
                {hasStore && (
                  <button 
                    type="button" 
                    onClick={() => setShowStoreSettings(false)} 
                    className="btn-secondary text-sm"
                  >
                    Cancel
                  </button>
                )}
                <button 
                  type="submit" 
                  disabled={registeringStore} 
                  className="btn-primary text-sm flex items-center gap-1.5"
                >
                  {registeringStore ? (
                    <><Loader2 className="animate-spin" size={14} /> Saving...</>
                  ) : (
                    hasStore ? 'Update Store' : 'Complete Registration'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <>
          {activeTab === 'profile' && (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Profile details */}
              <div className="rounded-xl p-6 space-y-6" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                <h3 className="text-lg font-bold text-yellow-500 uppercase tracking-wider">Merchant Profile Settings</h3>
                
                <form onSubmit={handleProfileSave} className="space-y-4">
                  {/* Avatar Upload */}
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                    <div className="relative w-20 h-20 rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center border border-zinc-700">
                      {profileAvatarUrl ? (
                        <img src={profileAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <Store size={28} className="text-zinc-500" />
                      )}
                      {uploadingAvatar && (
                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                          <Loader2 className="animate-spin text-yellow-500" size={20} />
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-300 cursor-pointer hover:text-yellow-500 transition">
                        Change Merchant Logo / Avatar
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarFileChange}
                        />
                      </label>
                      <p className="text-[10px] text-zinc-500 mt-1">PNG, JPG up to 2MB. Your logo is visible to customers browsing stores.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Owner / Merchant Name</label>
                      <input
                        type="text"
                        required
                        className="input"
                        value={profileName}
                        onChange={e => setProfileName(e.target.value)}
                        placeholder="Owner Name"
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
                    className="btn-primary text-xs py-2 px-6 font-black uppercase tracking-wider"
                  >
                    Save Personal Profile
                  </button>
                </form>
              </div>

              {/* Security Credentials */}
              <div className="rounded-xl p-6 space-y-6" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                <h3 className="text-lg font-bold text-yellow-500 uppercase tracking-wider">Change Account Password</h3>
                
                <form onSubmit={handlePasswordUpdate} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-1.5">New Password</label>
                      <input
                        type="password"
                        required
                        className="input"
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
                        className="input"
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
                    className="py-2 px-6 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs rounded-lg transition"
                  >
                    Update Password
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Main Console Tab Switcher - always visible */}
          <div className="flex border-b border-zinc-800 mb-6">
            <button
              onClick={() => setActiveTab('orders')}
              className={`pb-3 px-6 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
                activeTab === 'orders'
                  ? 'border-yellow-500 text-yellow-500'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Clock size={16} />
              <span>Live Orders</span>
              {orders.filter(o => ['placed', 'accepted', 'preparing'].includes(o.status)).length > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                  {orders.filter(o => ['placed', 'accepted', 'preparing'].includes(o.status)).length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('catalog')}
              className={`pb-3 px-6 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
                activeTab === 'catalog'
                  ? 'border-yellow-500 text-yellow-500'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ShoppingBag size={16} />
              <span>Inventory Catalog</span>
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`pb-3 px-6 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
                activeTab === 'profile'
                  ? 'border-yellow-500 text-yellow-500'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Settings size={16} />
              <span>Profile &amp; Settings</span>
            </button>
          </div>

          {activeTab !== 'profile' && (
            <>
          {/* Pending Orders Flash Banner */}
          {orders.some(o => o.status === 'placed') && (
            <div className="mb-5 p-4 rounded-xl flex items-center justify-between animate-pulse" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full animate-ping" style={{ background: '#EF4444' }} />
                <div>
                  <h4 className="font-bold" style={{ color: '#EF4444' }}>⚡ New Order Received!</h4>
                  <p className="text-xs mt-0.5" style={{ color: '#8A8A8A' }}>A customer has placed an order. Accept to secure the 30-min delivery SLA.</p>
                </div>
              </div>
              <span className="text-[10px] font-black px-2.5 py-1 rounded" style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}>AWAITING ACCEPTANCE</span>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Active Catalog Items', value: `${products.length} Items`, icon: <ShoppingBag size={28} style={{ color: '#F7D108', opacity: 0.6 }} /> },
              { label: 'Incoming Order Queue', value: `${orders.filter(o => ['placed', 'accepted', 'preparing'].includes(o.status)).length} Orders`, icon: <Clock size={28} style={{ color: '#F59E0B', opacity: 0.6 }} /> },
              { label: 'Store Revenue Balance', value: formatINR(balance), icon: <BarChart2 size={28} style={{ color: '#22C55E', opacity: 0.6 }} /> },
              { label: 'SLA Completion Rate', value: '98.4%', icon: <BarChart2 size={28} style={{ color: '#3B82F6', opacity: 0.6 }} /> },
            ].map((stat, i) => (
              <div key={i} className="p-5 rounded-xl flex items-center justify-between" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                <div>
                  <span className="text-xs font-semibold" style={{ color: '#8A8A8A' }}>{stat.label}</span>
                  <h2 className="text-xl font-extrabold mt-1 text-zinc-100">{stat.value}</h2>
                </div>
                {stat.icon}
              </div>
            ))}
          </div>

          {/* Daily Payout Settlement Banner */}
          <div className="mb-6 p-4 rounded-xl flex items-center justify-between text-xs font-semibold" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ADE80' }}>
            <div className="flex items-center gap-2">
              <BarChart2 size={16} />
              <span>Daily Payout Settlement Schedule: Today's accumulated Store Revenue Balance will be settled to your bank account automatically tonight at 11:59 PM.</span>
            </div>
          </div>



          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Catalog Manager */}
            <div className={`lg:col-span-2 space-y-5 ${activeTab === 'catalog' ? 'block' : 'hidden lg:block'}`}>
              <div className="rounded-xl p-5" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                <div className="flex justify-between items-center mb-5">
                  <div>
                    <h3 className="text-lg font-bold">Catalog Inventory Manager</h3>
                    <p className="text-sm mt-0.5" style={{ color: '#8A8A8A' }}>Create and manage your product offerings with ₹ INR pricing</p>
                  </div>
                  <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary text-sm">
                    <Plus size={16} /> Add Item
                  </button>
                </div>

                {/* Product Form */}
                {showForm && (
                  <form onSubmit={handleSaveProduct} className="rounded-xl mb-5 p-5 space-y-4" style={{ background: '#222222', border: '1px solid #2E2E2E' }}>
                    <div className="flex justify-between items-center border-b pb-3" style={{ borderColor: '#2E2E2E' }}>
                      <h4 className="text-base font-bold">{editProduct ? 'Edit Product' : 'New Product Details'}</h4>
                      <button type="button" onClick={resetForm} style={{ color: '#8A8A8A' }}><X size={18} /></button>
                    </div>

                    {error && (
                      <div className="p-3 rounded-lg flex gap-2 items-center text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444' }}>
                        <AlertCircle size={15} /> {error}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: '#8A8A8A' }}>Product Name</label>
                        <input type="text" required className="input" placeholder="e.g. Atta 5 kg" value={name} onChange={e => setName(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: '#8A8A8A' }}>Category</label>
                        <input type="text" required className="input" placeholder="e.g. Grocery" value={category} onChange={e => setCategory(e.target.value)} />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: '#8A8A8A' }}>Description</label>
                      <textarea className="input resize-none" rows={2} placeholder="Short product description..." value={description} onChange={e => setDescription(e.target.value)} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: '#8A8A8A' }}>Price (₹ INR)</label>
                        <input type="number" step="0.01" required className="input" placeholder="e.g. 149" value={price} onChange={e => setPrice(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: '#8A8A8A' }}>Product Image (Upload)</label>
                        <label className="flex items-center gap-2 cursor-pointer w-full rounded-lg p-2.5" style={{ background: '#1A1A1A', border: '1px dashed #2E2E2E', color: '#8A8A8A' }}>
                          <ImagePlus size={18} />
                          <span className="text-xs">{imageFile ? imageFile.name : 'Click to upload image'}</span>
                          <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                        </label>
                        {imagePreview && (
                          <img src={imagePreview} alt="Preview" className="mt-2 w-16 h-16 rounded-lg object-cover" style={{ border: '1px solid #2E2E2E' }} />
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-6 pt-3 border-t" style={{ borderColor: '#2E2E2E' }}>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <span className="text-sm font-semibold">In Stock</span>
                        <button type="button" onClick={() => setIsAvailable(!isAvailable)}>
                          {isAvailable ? <ToggleRight size={36} style={{ color: '#F7D108' }} /> : <ToggleLeft size={36} style={{ color: '#444' }} />}
                        </button>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <span className="text-sm font-semibold">30-Min Delivery Ready</span>
                        <button type="button" onClick={() => setIsReadyFor30Min(!isReadyFor30Min)}>
                          {isReadyFor30Min ? <ToggleRight size={36} style={{ color: '#22C55E' }} /> : <ToggleLeft size={36} style={{ color: '#444' }} />}
                        </button>
                      </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-3">
                      <button type="button" onClick={resetForm} className="btn-secondary text-sm">Cancel</button>
                      <button type="submit" disabled={savingProduct} className="btn-primary text-sm">
                        {savingProduct ? <><Loader2 className="animate-spin" size={14} /> Saving...</> : 'Save Product'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Product Table */}
                {products.length === 0 && !showForm ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(247,209,8,0.08)' }}>
                      <PackageSearch size={30} style={{ color: '#F7D108' }} />
                    </div>
                    <div>
                      <p className="font-bold text-base" style={{ color: '#8A8A8A' }}>No catalog items yet</p>
                      <p className="text-sm mt-1" style={{ color: '#444' }}>Click "Add Item" above to add your first product!</p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b text-xs" style={{ borderColor: '#2E2E2E', color: '#8A8A8A' }}>
                          <th className="py-3 px-3">Product</th>
                          <th className="py-3 px-3">Category</th>
                          <th className="py-3 px-3">Price (₹)</th>
                          <th className="py-3 px-3">In Stock</th>
                          <th className="py-3 px-3">30-Min</th>
                          <th className="py-3 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map(product => (
                          <tr key={product.id} className="border-b hover:bg-[#222222] transition text-sm" style={{ borderColor: '#2E2E2E' }}>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-3">
                                {product.image_url ? (
                                  <img src={product.image_url} alt={product.name} className="w-10 h-10 rounded-lg object-cover" style={{ border: '1px solid #2E2E2E' }} />
                                ) : (
                                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: '#2E2E2E' }}>
                                    <ImagePlus size={16} style={{ color: '#444' }} />
                                  </div>
                                )}
                                <div>
                                  <span className="font-semibold block">{product.name}</span>
                                  <span className="text-xs truncate max-w-xs block" style={{ color: '#8A8A8A' }}>{product.description}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3" style={{ color: '#B0B0B0' }}>{product.category}</td>
                            <td className="py-3 px-3 font-bold">{formatINR(product.price)}</td>
                            <td className="py-3 px-3">
                              <button onClick={() => toggleBoolean(product, 'is_available')}>
                                {product.is_available
                                  ? <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E' }}>In Stock</span>
                                  : <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>Out of Stock</span>}
                              </button>
                            </td>
                            <td className="py-3 px-3">
                              <button onClick={() => toggleBoolean(product, 'is_ready_for_30min')}>
                                {product.is_ready_for_30min
                                  ? <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(247,209,8,0.1)', color: '#F7D108' }}>Ready</span>
                                  : <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ background: '#222', color: '#444' }}>Off</span>}
                              </button>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex justify-end gap-2">
                                <button onClick={() => handleEditClick(product)} className="p-1.5 rounded-md hover:text-yellow-400 transition" style={{ background: '#2E2E2E', color: '#8A8A8A' }}><Edit size={14} /></button>
                                <button onClick={() => handleDeleteProduct(product.id)} className="p-1.5 rounded-md hover:text-red-400 transition" style={{ background: '#2E2E2E', color: '#8A8A8A' }}><Trash2 size={14} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Order Pipeline */}
            <div className={`space-y-5 ${activeTab === 'orders' ? 'block' : 'hidden lg:block'}`}>
              <div className="rounded-xl p-5" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                <h3 className="text-lg font-bold mb-1">Live Dispatch Board</h3>
                <p className="text-sm mb-5" style={{ color: '#8A8A8A' }}>Manage order lifecycles and dispatch states</p>

                <div className="space-y-4">
                  {orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center gap-3 rounded-lg" style={{ border: '1px dashed #2E2E2E' }}>
                      <InboxIcon size={32} style={{ color: '#2E2E2E' }} />
                      <p className="text-sm" style={{ color: '#444' }}>No orders yet. Orders will appear here once customers start ordering!</p>
                    </div>
                  ) : orders.map(order => {
                    const orderDate = new Date(order.created_at).toLocaleTimeString('hi-IN');
                    const statusColors: Record<string, { bg: string; text: string }> = {
                      placed:          { bg: 'rgba(59,130,246,0.1)',  text: '#3B82F6' },
                      accepted:        { bg: 'rgba(247,209,8,0.1)',   text: '#F7D108' },
                      preparing:       { bg: 'rgba(245,158,11,0.1)',  text: '#F59E0B' },
                      awaiting_pickup: { bg: 'rgba(249,115,22,0.1)',  text: '#F97316' },
                      driver_accepted: { bg: 'rgba(99,102,241,0.1)',  text: '#6366F1' },
                      picked_up:       { bg: 'rgba(168,85,247,0.1)',  text: '#A855F7' },
                      out_for_delivery:{ bg: 'rgba(34,197,94,0.1)',   text: '#22C55E' },
                      delivered:       { bg: 'rgba(34,197,94,0.08)',  text: '#16A34A' },
                      cancelled:       { bg: 'rgba(239,68,68,0.1)',   text: '#EF4444' },
                    };
                    const sc = statusColors[order.status] ?? { bg: '#2E2E2E', text: '#8A8A8A' };
                    return (
                      <div key={order.id} className="p-4 rounded-xl space-y-3" style={{ border: '1px solid #2E2E2E', background: '#222222' }}>
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] font-bold block" style={{ color: '#444' }}>ORDER #{order.id.slice(0, 8).toUpperCase()}</span>
                            <span className="text-xs" style={{ color: '#8A8A8A' }}>{orderDate}</span>
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase" style={{ background: sc.bg, color: sc.text }}>
                              {order.status.replace('_', ' ')}
                            </span>
                            <button
                              onClick={() => {
                                setChatPartner('customer');
                                setActiveChatOrderId(order.id);
                              }}
                              className="text-[10px] px-2 py-0.5 rounded border border-zinc-800 bg-[#222] hover:bg-zinc-800 text-yellow-500 font-bold transition flex items-center gap-1"
                            >
                              <MessageSquare size={10} /> Chat &amp; Track
                            </button>
                          </div>
                        </div>

                        <div className="text-xs border-y py-2.5 space-y-1.5" style={{ borderColor: '#2E2E2E' }}>
                          <p className="text-sm" style={{ color: '#B0B0B0' }}>📍 {order.delivery_address}</p>
                          <div className="space-y-1 pl-1 border-l-2 border-zinc-800 text-zinc-400">
                            <div className="flex justify-between">
                              <span>Product Price (Listed):</span>
                              <span className="font-bold text-zinc-100">{formatINR(order.items_total || (order.total_amount - (order.delivery_partner_fee || 25) - (order.handling_charge || 0) - (order.small_cart_fee || 0)))}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Delivery partner fee:</span>
                              <span className="text-zinc-500">{formatINR(order.delivery_partner_fee || 25)}</span>
                            </div>
                            {Number(order.small_cart_fee) > 0 && (
                              <div className="flex justify-between">
                                <span>Small cart fee:</span>
                                <span className="text-zinc-500">{formatINR(order.small_cart_fee)}</span>
                              </div>
                            )}
                            {Number(order.handling_charge) > 0 && (
                              <div className="flex justify-between">
                                <span>Handling charge:</span>
                                <span className="text-zinc-500">{formatINR(order.handling_charge)}</span>
                              </div>
                            )}
                            <div className="flex justify-between border-t border-dashed border-zinc-800 pt-1.5 mt-1.5 text-[10px]">
                              <div>
                                <span className="text-zinc-500 font-bold block">PAYMENT METHOD</span>
                                <span className="text-zinc-300 font-semibold uppercase">{order.payment_method || 'COD'}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-zinc-500 font-bold block">PAYMENT STATUS</span>
                                <span className={`font-semibold uppercase ${order.payment_status === 'paid' ? 'text-green-400' : 'text-yellow-500'}`}>{order.payment_status || 'PENDING'}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-between pt-1 border-t border-zinc-900 font-bold text-xs">
                            <span style={{ color: '#8A8A8A' }}>Customer Paid:</span>
                            <span className="text-[#F7D108]">{formatINR(order.total_amount)}</span>
                          </div>
                          <div className="text-[10px] text-green-500 font-semibold mt-1">
                            💰 Store Payout: +{formatINR(order.items_total || (order.total_amount - (order.delivery_partner_fee || 25) - (order.handling_charge || 0) - (order.small_cart_fee || 0)))} credited on delivery
                          </div>
                        </div>

                        <div className="pt-1">
                          {order.status === 'placed' && (
                            <div className="flex gap-2">
                              <button onClick={() => handleUpdateOrderStatus(order.id, 'accepted')} className="btn-primary text-xs py-1.5 flex-1">Accept Order</button>
                              <button onClick={() => handleUpdateOrderStatus(order.id, 'cancelled')} className="text-xs py-1.5 px-3 rounded-lg font-bold" style={{ border: '1px solid #2E2E2E', color: '#EF4444' }}>Reject</button>
                            </div>
                          )}
                          {order.status === 'accepted' && (
                            <button onClick={() => handleUpdateOrderStatus(order.id, 'preparing')} className="w-full text-xs py-2 px-3 rounded-lg font-bold" style={{ background: '#F59E0B', color: '#121212' }}>Start Preparation</button>
                          )}
                          {order.status === 'preparing' && (
                            <button onClick={() => handleUpdateOrderStatus(order.id, 'awaiting_pickup')} className="w-full text-xs py-2 px-3 rounded-lg font-bold" style={{ background: '#22C55E', color: '#121212' }}>Mark as Prepared [Ready for Dispatch]</button>
                          )}
                          {order.status === 'awaiting_pickup' && (
                            <div className="space-y-1.5">
                              <div className="p-2.5 rounded-lg flex items-center gap-2" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                                <Loader2 className="animate-spin" size={14} style={{ color: '#F97316' }} />
                                <span className="text-xs font-semibold" style={{ color: '#F97316' }}>
                                  {order.delivery_partner_id ? 'Rider assigned! Awaiting pickup.' : 'Locating nearest online rider...'}
                                </span>
                              </div>
                              {order.delivery_partner_id && (
                                <p className="text-[11px]" style={{ color: '#8A8A8A' }}>Rider ID: <span className="font-mono text-white">{order.delivery_partner_id}</span></p>
                              )}
                            </div>
                          )}
                          {order.status === 'driver_accepted' && (
                            <div className="space-y-1.5">
                              <div className="p-2.5 rounded-lg flex items-center gap-2" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                                <Loader2 className="animate-spin" size={14} style={{ color: '#6366F1' }} />
                                <span className="text-xs font-semibold" style={{ color: '#6366F1' }}>
                                  Rider accepted! Heading to store.
                                </span>
                              </div>
                            </div>
                          )}
                          {order.status === 'picked_up' && (
                            <div className="space-y-1.5">
                              <div className="p-2.5 rounded-lg flex items-center gap-2" style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}>
                                <Check size={14} style={{ color: '#A855F7' }} />
                                <span className="text-xs font-bold" style={{ color: '#A855F7' }}>
                                  Order picked up by rider.
                                </span>
                              </div>
                            </div>
                          )}
                          {order.status === 'out_for_delivery' && (
                            <div className="p-2.5 rounded-lg flex items-center gap-2" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                              <Check size={14} style={{ color: '#22C55E' }} />
                              <span className="text-xs font-bold" style={{ color: '#22C55E' }}>Rider is out delivering!</span>
                            </div>
                          )}
                          {order.status === 'delivered' && (
                            <div className="p-2.5 rounded-lg flex items-center gap-2" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                              <Check size={14} style={{ color: '#444' }} />
                              <span className="text-xs font-bold" style={{ color: '#8A8A8A' }}>Order completed successfully.</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
            </>
          )}
        </>
      )}

      {/* SELLER CHAT & TRACK CONSOLE DRAWER */}
      {activeChatOrderId && (() => {
        const selectedOrder = orders.find(o => o.id === activeChatOrderId);
        if (!selectedOrder) return null;
        return (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-end justify-center">
            <div className="w-full max-w-2xl bg-[#121212] border-t border-zinc-800 rounded-t-3xl p-5 flex flex-col justify-between max-h-[90vh] animate-slide-up">
              
              {/* Drawer Header */}
              <div className="flex justify-between items-center border-b border-zinc-800 pb-3 mb-3">
                <div>
                  <h3 className="text-sm font-extrabold flex items-center gap-1.5 text-yellow-500">
                    <MessageCircle size={16} /> Live Chat &amp; Track: Order #{selectedOrder.id.slice(0, 8).toUpperCase()}
                  </h3>
                  <p className="text-[10px]" style={{ color: '#8A8A8A' }}>Communicate with customer and assigned delivery rider</p>
                </div>
                <button 
                  onClick={() => setActiveChatOrderId(null)}
                  className="p-1 rounded-full bg-zinc-800 text-zinc-400"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Grid: Map on Left, Chat on Right */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-hidden my-2 min-h-[300px]">
                
                {/* Visual Map */}
                <div className="p-4 rounded-xl border border-zinc-800 bg-[#1A1A1A] flex flex-col justify-between h-[300px] md:h-full">
                  <div className="w-full h-44 rounded-lg relative overflow-hidden bg-[#151515] border border-zinc-800">
                    <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <path d="M 20 65 L 50 35 L 80 65" fill="none" stroke="#222" strokeWidth="2" strokeDasharray="3,3" />
                      
                      {/* Customer point */}
                      <circle cx="80" cy="65" r="3.5" fill="#3B82F6" />
                      <text x="80" y="73" fill="#3B82F6" fontSize="4" fontWeight="bold" textAnchor="middle">CUSTOMER</text>

                      {/* Store point (You) */}
                      <circle cx="50" cy="35" r="3.5" fill="#EF4444" />
                      <text x="50" y="29" fill="#EF4444" fontSize="4" fontWeight="bold" textAnchor="middle">YOUR STORE</text>

                      {/* Driver marker */}
                      {driverCoords ? (
                        (() => {
                          const sellerLat = 18.8492;
                          const sellerLng = 81.7055;
                          // Use default customer coordinates for mapping
                          const custLat = 18.8435;
                          const custLng = 81.7095;
                          
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
                              <circle cx={rx} cy={ry} r="4" fill="#F7D108" className="animate-pulse" />
                              <circle cx={rx} cy={ry} r="1.5" fill="#121212" />
                              <text x={rx} y={ry - 6} fill="#F7D108" fontSize="4" fontWeight="black" textAnchor="middle">RIDER</text>
                            </g>
                          );
                        })()
                      ) : (
                        selectedOrder.delivery_partner_id && (
                          <g>
                            <circle cx="50" cy="35" r="4" fill="#F7D108" className="animate-pulse" />
                            <circle cx="50" cy="35" r="1.5" fill="#121212" />
                            <text x="50" y="24" fill="#F7D108" fontSize="3.5" textAnchor="middle">Rider at Store</text>
                          </g>
                        )
                      )}
                    </svg>
                  </div>

                  <div className="text-xs space-y-1 mt-2 text-zinc-400">
                    <p>📍 Destination: <span className="text-white font-medium">{selectedOrder.delivery_address}</span></p>
                    <p>🚴 Delivery Partner: {selectedOrder.delivery_partner_id ? (
                      <span className="text-green-400 font-semibold">Assigned (ID: {selectedOrder.delivery_partner_id.slice(0, 8)})</span>
                    ) : (
                      <span className="text-yellow-500 font-semibold">Preparing order / Locating driver</span>
                    )}</p>
                  </div>
                </div>

                {/* Chat Panel */}
                <div className="flex flex-col justify-between h-[300px] md:h-full p-4 rounded-xl border border-zinc-800 bg-[#1A1A1A]">
                  <div className="flex gap-2 p-1 bg-zinc-900 border border-zinc-800 rounded-lg mb-3">
                    <button 
                      onClick={() => setChatPartner('customer')}
                      className={`flex-1 py-1 rounded font-bold text-xs transition ${
                        chatPartner === 'customer' 
                          ? 'bg-yellow-500 text-black' 
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      Customer Chat
                    </button>
                    {selectedOrder.delivery_partner_id && (
                      <button 
                        onClick={() => setChatPartner('delivery')}
                        className={`flex-1 py-1 rounded font-bold text-xs transition ${
                          chatPartner === 'delivery' 
                            ? 'bg-yellow-500 text-black' 
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        Rider Chat
                      </button>
                    )}
                  </div>

                  {/* Messages list */}
                  <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1 min-h-[140px]">
                    {dbMessages.filter(m => 
                      m.recipient_role === chatPartner || m.sender_role === chatPartner || !m.recipient_role
                    ).length === 0 ? (
                      <p className="text-center text-xs text-zinc-600 py-8">No messages in this chat yet.</p>
                    ) : (
                      dbMessages
                        .filter(m => m.recipient_role === chatPartner || m.sender_role === chatPartner || !m.recipient_role)
                        .map(msg => {
                          const isMe = msg.sender_role === 'seller';
                          return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                              <div 
                                className={`p-2 rounded-xl max-w-[85%] text-xs ${
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

                  {/* Message Input */}
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      className="input flex-1 py-1.5 text-xs bg-zinc-900 border-zinc-800" 
                      placeholder={`Message ${chatPartner === 'customer' ? 'Customer' : 'Rider'}...`}
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                    />
                    <button 
                      onClick={handleSendMessage}
                      className="px-3 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-xs"
                    >
                      Send
                    </button>
                  </div>
                </div>

              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
}
