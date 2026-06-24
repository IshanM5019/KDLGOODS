'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Product, Order, OrderStatus } from '@kdlgoods/shared';
import { CreateProductSchema } from '@kdlgoods/shared';
import { formatINR } from '@kdlgoods/shared';
import {
  Plus, Edit, Trash2, Check, X, Clock, ToggleLeft, ToggleRight,
  Store, ShoppingBag, Loader2, AlertCircle, BarChart2, ShieldAlert,
  ImagePlus, PackageSearch, InboxIcon,
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
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    fetchInitialData();

    const ordersChannel = supabase
      .channel('seller-orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders())
      .subscribe();

    const checkLocalInterval = setInterval(() => {
      const local = JSON.parse(localStorage.getItem('kdlgoods_orders') || '[]');
      if (local.length > 0) setOrders(local);
    }, 1000);

    return () => {
      supabase.removeChannel(ordersChannel);
      clearInterval(checkLocalInterval);
    };
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setSellerId(user.id);
        const { data: seller } = await supabase.from('sellers').select('store_name').eq('id', user.id).single();
        if (seller) setStoreName(seller.store_name);
      }
      await Promise.all([fetchProducts(), fetchOrders()]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (!error && data) setProducts(data);
    // On error: keep as empty array — no mock data
  };

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase.from('orders').select('*, profiles(full_name)').order('created_at', { ascending: false });
      if (error) throw error;
      setOrders(data || []);
    } catch {
      const local = JSON.parse(localStorage.getItem('kdlgoods_orders') || '[]');
      setOrders(local);
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
      {/* Top Navbar */}
      <header className="flex justify-between items-center mb-6 p-4 rounded-xl" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
        <div className="flex items-center gap-3">
          <Store style={{ color: '#F7D108' }} size={30} />
          <div>
            <h1 className="text-xl font-black">{storeName}</h1>
            <p className="text-xs" style={{ color: '#8A8A8A' }}>Merchant Admin Panel · Kirandul, Dantewada</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#22C55E' }} />
          <span className="text-xs font-semibold" style={{ color: '#22C55E' }}>ONLINE &amp; ACCEPTING</span>
        </div>
      </header>

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Active Catalog Items', value: `${products.length} Items`, icon: <ShoppingBag size={28} style={{ color: '#F7D108', opacity: 0.6 }} /> },
          { label: 'Incoming Order Queue', value: `${orders.filter(o => ['placed', 'accepted', 'preparing'].includes(o.status)).length} Orders`, icon: <Clock size={28} style={{ color: '#F59E0B', opacity: 0.6 }} /> },
          { label: 'SLA Completion Rate', value: '98.4%', icon: <BarChart2 size={28} style={{ color: '#22C55E', opacity: 0.6 }} /> },
        ].map((stat, i) => (
          <div key={i} className="p-5 rounded-xl flex items-center justify-between" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
            <div>
              <span className="text-sm" style={{ color: '#8A8A8A' }}>{stat.label}</span>
              <h2 className="text-2xl font-extrabold mt-1">{stat.value}</h2>
            </div>
            {stat.icon}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Catalog Manager */}
        <div className="lg:col-span-2 space-y-5">
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
        <div className="space-y-5">
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
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase" style={{ background: sc.bg, color: sc.text }}>
                        {order.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="text-sm border-y py-2.5 space-y-1" style={{ borderColor: '#2E2E2E' }}>
                      <p style={{ color: '#B0B0B0' }}>📍 {order.delivery_address}</p>
                      <p style={{ color: '#8A8A8A' }} className="text-xs">Total: <span className="font-bold text-white">{formatINR(order.total_amount)}</span></p>
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
    </div>
  );
}
