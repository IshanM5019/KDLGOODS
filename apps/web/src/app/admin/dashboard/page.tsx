'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { 
  ShieldAlert, Loader2, Landmark, Clock, CheckCircle2, 
  TrendingUp, DollarSign, Users, Award, FileText, ChevronRight, 
  PlusCircle, RefreshCw, X, MessageSquare, Shield, HelpCircle 
} from 'lucide-react';
import { formatINR } from '@kdlgoods/shared';

interface Order {
  id: string;
  status: string;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
  items_total: number;
  delivery_partner_fee: number;
  customer?: { full_name: string } | null;
  seller?: { store_name: string } | null;
  delivery_partner?: { full_name: string } | null;
}

interface Seller {
  id: string;
  store_name: string;
  balance: number;
  profiles?: { full_name: string; phone_number: string | null } | null;
}

interface Rider {
  id: string;
  balance: number;
  profiles?: { full_name: string; phone_number: string | null } | null;
}

interface Payout {
  id: string;
  recipient_id: string;
  recipient_role: string;
  amount: number;
  payment_method: string;
  reference_details: string | null;
  created_at: string;
  recipient_name?: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [adminUser, setAdminUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'orders' | 'sellers' | 'riders' | 'payouts'>('orders');

  // Database lists
  const [orders, setOrders] = useState<Order[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);

  // Telemetry statistics
  const [stats, setStats] = useState({
    totalCompletedOrders: 0,
    totalRevenue: 0,
    outstandingSellerBal: 0,
    outstandingRiderBal: 0,
  });

  // Modal Payout Management
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutRecipient, setPayoutRecipient] = useState<{ id: string; name: string; role: 'seller' | 'delivery'; balance: number } | null>(null);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState<'cheque' | 'bank_transfer' | 'upi' | 'cash'>('cheque');
  const [payoutRef, setPayoutRef] = useState('');
  const [submittingPayout, setSubmittingPayout] = useState(false);

  // Verification & Auth check
  useEffect(() => {
    let active = true;

    const checkAdmin = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        let user = session?.user;

        if (!user) {
          const { data: { user: apiUser } } = await supabase.auth.getUser();
          user = apiUser || undefined;
        }

        if (!active) return;

        if (!user) {
          router.push('/auth/signin');
          return;
        }

        // Fetch profile to verify admin role
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role, full_name')
          .eq('id', user.id)
          .single();

        if (!active) return;

        if (error || !profile || profile.role !== 'admin') {
          // If not an admin, block access
          setAdminUser(null);
          setLoading(false);
          return;
        }

        setAdminUser({ id: user.id, full_name: profile.full_name, email: user.email });
        
        // Load initial dashboard datasets
        await fetchAllData();
      } catch (err) {
        console.error('Failed verification:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    checkAdmin();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        router.push('/auth/signin');
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchAllData = async () => {
    try {
      // 1. Fetch completed and active orders with profiles
      const { data: ordersData, error: ordersErr } = await supabase
        .from('orders')
        .select(`
          id,
          status,
          total_amount,
          payment_method,
          payment_status,
          created_at,
          items_total,
          delivery_partner_fee,
          customer:profiles!customer_id(full_name),
          seller:sellers(store_name),
          delivery_partner:profiles!delivery_partner_id(full_name)
        `)
        .order('created_at', { ascending: false });

      if (ordersErr) throw ordersErr;

      // 2. Fetch sellers
      const { data: sellersData, error: sellersErr } = await supabase
        .from('sellers')
        .select(`
          id,
          store_name,
          balance,
          profiles(full_name, phone_number)
        `);

      if (sellersErr) throw sellersErr;

      // 3. Fetch delivery partners
      const { data: ridersData, error: ridersErr } = await supabase
        .from('delivery_partners')
        .select(`
          id,
          balance,
          profiles(full_name, phone_number)
        `);

      if (ridersErr) throw ridersErr;

      // 4. Fetch payout entries
      const { data: payoutsData, error: payoutsErr } = await supabase
        .from('payouts')
        .select('*')
        .order('created_at', { ascending: false });

      if (payoutsErr) throw payoutsErr;

      // Transform raw orders and map names
      const mappedOrders = (ordersData || []).map((o: any) => ({
        id: o.id,
        status: o.status,
        total_amount: Number(o.total_amount) || 0,
        payment_method: o.payment_method,
        payment_status: o.payment_status,
        created_at: o.created_at,
        items_total: Number(o.items_total) || 0,
        delivery_partner_fee: Number(o.delivery_partner_fee) || 0,
        customer: o.customer ? { full_name: o.customer.full_name } : null,
        seller: o.seller ? { store_name: o.seller.store_name } : null,
        delivery_partner: o.delivery_partner ? { full_name: o.delivery_partner.full_name } : null,
      }));

      const mappedSellers = (sellersData || []).map((s: any) => ({
        id: s.id,
        store_name: s.store_name,
        balance: Number(s.balance) || 0,
        profiles: Array.isArray(s.profiles) ? s.profiles[0] : s.profiles
      }));

      const mappedRiders = (ridersData || []).map((r: any) => ({
        id: r.id,
        balance: Number(r.balance) || 0,
        profiles: Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
      }));

      // Map payouts recipient names
      const allProfiles = [...mappedSellers, ...mappedRiders].map((item: any) => ({
        id: item.id,
        name: item.store_name || item.profiles?.full_name || 'Partner',
      }));

      const mappedPayouts = (payoutsData || []).map((p: any) => {
        const profile = allProfiles.find(prof => prof.id === p.recipient_id);
        return {
          ...p,
          amount: Number(p.amount) || 0,
          recipient_name: profile?.name || 'Unknown Recipient',
        };
      });

      // Calculate stats
      const completedOrdersList = mappedOrders.filter(o => o.status === 'delivered');
      const totalRev = completedOrdersList.reduce((sum, o) => sum + o.total_amount, 0);
      const outSellers = mappedSellers.reduce((sum, s) => sum + s.balance, 0);
      const outRiders = mappedRiders.reduce((sum, r) => sum + r.balance, 0);

      setOrders(mappedOrders);
      setSellers(mappedSellers);
      setRiders(mappedRiders);
      setPayouts(mappedPayouts);

      setStats({
        totalCompletedOrders: completedOrdersList.length,
        totalRevenue: totalRev,
        outstandingSellerBal: outSellers,
        outstandingRiderBal: outRiders,
      });

    } catch (err) {
      console.error('Failed to load datasets:', err);
    }
  };

  const handleOpenPayout = (id: string, name: string, role: 'seller' | 'delivery', balance: number) => {
    setPayoutRecipient({ id, name, role, balance });
    setPayoutAmount(String(balance));
    setPayoutMethod('cheque');
    setPayoutRef('');
    setShowPayoutModal(true);
  };

  const submitPayoutSettle = async () => {
    if (!payoutRecipient) return;
    const amountToDeduct = parseFloat(payoutAmount);

    if (isNaN(amountToDeduct) || amountToDeduct <= 0) {
      alert('Please enter a valid payout amount greater than 0.');
      return;
    }

    if (amountToDeduct > payoutRecipient.balance) {
      alert('Cannot pay out more than the outstanding profile balance.');
      return;
    }

    setSubmittingPayout(true);

    try {
      // 1. Insert payout ledger log entry
      const { error: insertErr } = await supabase
        .from('payouts')
        .insert({
          recipient_id: payoutRecipient.id,
          recipient_role: payoutRecipient.role,
          amount: amountToDeduct,
          payment_method: payoutMethod,
          reference_details: payoutRef.trim() || null,
        });

      if (insertErr) throw insertErr;

      // 2. Settle the balance in recipient's database table
      if (payoutRecipient.role === 'seller') {
        const { error: updateErr } = await supabase
          .from('sellers')
          .update({ balance: payoutRecipient.balance - amountToDeduct })
          .eq('id', payoutRecipient.id);
        if (updateErr) throw updateErr;
      } else {
        const { error: updateErr } = await supabase
          .from('delivery_partners')
          .update({ balance: payoutRecipient.balance - amountToDeduct })
          .eq('id', payoutRecipient.id);
        if (updateErr) throw updateErr;
      }

      // Settle successfully
      alert(`Successfully settled ${formatINR(amountToDeduct)} for ${payoutRecipient.name}!`);
      setShowPayoutModal(false);
      setPayoutRecipient(null);
      await fetchAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to process settlement.');
    } finally {
      setSubmittingPayout(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white" style={{ backgroundColor: '#121212' }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-yellow-500" size={32} />
          <p className="text-sm text-zinc-400">Verifying Admin Access...</p>
        </div>
      </div>
    );
  }

  if (!adminUser) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white p-6" style={{ backgroundColor: '#121212' }}>
        <div className="max-w-md w-full p-6 text-center space-y-4 rounded-2xl border border-red-500/20 bg-red-500/5">
          <ShieldAlert size={48} className="text-red-500 mx-auto" />
          <h2 className="text-lg font-bold text-red-400 uppercase tracking-wide">Access Denied</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            This dashboard is restricted strictly to the platform administrator. Your account role does not have authorization to view this area.
          </p>
          <button 
            onClick={() => router.push('/auth/signin')}
            className="w-full py-2 bg-red-500 hover:bg-red-400 text-black text-xs font-bold rounded-lg transition"
          >
            Switch Accounts / Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#121212', color: '#F5F5F5' }}>
      
      {/* Admin Dashboard Header */}
      <header className="glass border-b border-zinc-850" style={{ position: 'sticky', top: 0, zIndex: 10, padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Shield style={{ color: '#F7D108' }} size={24} />
          <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#F7D108', letterSpacing: '-0.02em' }}>
            KDL ADMIN CONSOLE
          </span>
          <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
            ROOT
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="text-right hidden sm:block">
            <p className="font-bold text-zinc-300">{adminUser.full_name}</p>
            <p className="text-[10px] text-zinc-500">{adminUser.email}</p>
          </div>
          <button
            onClick={async () => {
              if (confirm('Log out from Admin Console?')) {
                await supabase.auth.signOut();
                router.push('/auth/signin');
              }
            }}
            className="px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 font-bold transition text-[11px]"
          >
            LOGOUT
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        
        {/* Statistics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-zinc-850 bg-[#1A1A1A]">
            <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block">Total Completed Deliveries</span>
            <div className="flex items-baseline gap-2 mt-2">
              <h2 className="text-2xl font-black text-white">{stats.totalCompletedOrders}</h2>
              <span className="text-[10px] text-green-500 font-bold flex items-center">✓ DELIVERED</span>
            </div>
          </div>
          
          <div className="p-4 rounded-xl border border-zinc-850 bg-[#1A1A1A]">
            <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block">Gross Sales Value</span>
            <div className="flex items-baseline gap-2 mt-2">
              <h2 className="text-2xl font-black text-yellow-500">{formatINR(stats.totalRevenue)}</h2>
              <TrendingUp size={12} className="text-yellow-500" />
            </div>
          </div>

          <div className="p-4 rounded-xl border border-zinc-850 bg-[#1A1A1A]">
            <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block">Outstanding Seller Balances</span>
            <div className="flex items-baseline gap-2 mt-2">
              <h2 className="text-2xl font-black text-orange-500">{formatINR(stats.outstandingSellerBal)}</h2>
              <span className="text-[9px] text-zinc-400 font-mono">DUE</span>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-zinc-850 bg-[#1A1A1A]">
            <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block">Outstanding Rider Balances</span>
            <div className="flex items-baseline gap-2 mt-2">
              <h2 className="text-2xl font-black text-blue-500">{formatINR(stats.outstandingRiderBal)}</h2>
              <span className="text-[9px] text-zinc-400 font-mono">DUE</span>
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-zinc-800">
          <button
            onClick={() => setActiveTab('orders')}
            className={`pb-3 px-4 md:px-6 text-xs md:text-sm font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'orders'
                ? 'border-yellow-500 text-yellow-500'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Clock size={14} />
            <span>Order & Payment History</span>
          </button>
          
          <button
            onClick={() => setActiveTab('sellers')}
            className={`pb-3 px-4 md:px-6 text-xs md:text-sm font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'sellers'
                ? 'border-yellow-500 text-yellow-500'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Landmark size={14} />
            <span>Merchant Payouts</span>
          </button>

          <button
            onClick={() => setActiveTab('riders')}
            className={`pb-3 px-4 md:px-6 text-xs md:text-sm font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'riders'
                ? 'border-yellow-500 text-yellow-500'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Users size={14} />
            <span>Rider Settlements</span>
          </button>

          <button
            onClick={() => setActiveTab('payouts')}
            className={`pb-3 px-4 md:px-6 text-xs md:text-sm font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'payouts'
                ? 'border-yellow-500 text-yellow-500'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileText size={14} />
            <span>Payout Log Ledger</span>
          </button>
        </div>

        {/* Tab contents */}
        <div className="space-y-4">
          
          {/* TAB 1: ORDER HISTORY */}
          {activeTab === 'orders' && (
            <div className="rounded-xl border border-zinc-850 overflow-hidden bg-[#161616]">
              <div className="p-4 border-b border-zinc-850 flex justify-between items-center bg-[#1C1C1C]">
                <h3 className="text-xs font-bold text-yellow-500 uppercase tracking-wider">Completed and Active Orders</h3>
                <button 
                  onClick={fetchAllData}
                  className="p-1.5 text-zinc-400 hover:text-yellow-500 rounded bg-zinc-900 border border-zinc-800 transition"
                >
                  <RefreshCw size={13} />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-850 text-zinc-500 font-extrabold uppercase bg-zinc-900 text-[10px] tracking-wider">
                      <th className="p-3">Order ID</th>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Merchant</th>
                      <th className="p-3">Rider</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Total Amount</th>
                      <th className="p-3">Method</th>
                      <th className="p-3">Payment</th>
                      <th className="p-3">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-zinc-500">No order history found.</td>
                      </tr>
                    ) : (
                      orders.map((o) => (
                        <tr key={o.id} className="border-b border-zinc-850 hover:bg-[#1E1E1E] transition">
                          <td className="p-3 font-mono font-bold text-zinc-400">#{o.id.slice(0, 5).toUpperCase()}</td>
                          <td className="p-3 font-semibold text-zinc-200">{o.customer?.full_name || 'Customer'}</td>
                          <td className="p-3 text-zinc-300 font-semibold">{o.seller?.store_name || 'Store'}</td>
                          <td className="p-3 text-zinc-400">{o.delivery_partner?.full_name || 'Unassigned'}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                              o.status === 'delivered' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                              o.status === 'cancelled' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                              'bg-yellow-500/10 text-yellow-500 border-yellow-500/20 animate-pulse'
                            }`}>
                              {o.status}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-white">{formatINR(o.total_amount)}</td>
                          <td className="p-3 text-zinc-400 uppercase font-mono">{o.payment_method}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${
                              o.payment_status === 'paid' 
                                ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                                : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                            }`}>
                              {o.payment_status.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-3 text-zinc-500 font-mono">{new Date(o.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: SELLER PAYOUTS */}
          {activeTab === 'sellers' && (
            <div className="rounded-xl border border-zinc-850 overflow-hidden bg-[#161616]">
              <div className="p-4 border-b border-zinc-850 bg-[#1C1C1C] flex justify-between items-center">
                <h3 className="text-xs font-bold text-yellow-500 uppercase tracking-wider">Merchant Outstanding Balances</h3>
                <span className="text-[10px] text-zinc-500 font-mono">Deduct balances when you write cheque payouts</span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-850 text-zinc-500 font-extrabold uppercase bg-zinc-900 text-[10px] tracking-wider">
                      <th className="p-3">Store Name</th>
                      <th className="p-3">Merchant Owner</th>
                      <th className="p-3">Contact</th>
                      <th className="p-3">Current Balance</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sellers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-zinc-500">No merchant profiles found.</td>
                      </tr>
                    ) : (
                      sellers.map((s) => (
                        <tr key={s.id} className="border-b border-zinc-850 hover:bg-[#1E1E1E] transition">
                          <td className="p-3 font-semibold text-zinc-200">{s.store_name}</td>
                          <td className="p-3 text-zinc-300">{s.profiles?.full_name || 'Owner'}</td>
                          <td className="p-3 text-zinc-400 font-mono">{s.profiles?.phone_number || 'N/A'}</td>
                          <td className="p-3 font-bold text-yellow-500">{formatINR(s.balance)}</td>
                          <td className="p-3 text-right">
                            <button
                              disabled={s.balance <= 0}
                              onClick={() => handleOpenPayout(s.id, s.store_name, 'seller', s.balance)}
                              className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-yellow-500 hover:bg-yellow-400 text-black transition disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              Settle & Pay Out
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: RIDER SETTLEMENTS */}
          {activeTab === 'riders' && (
            <div className="rounded-xl border border-zinc-850 overflow-hidden bg-[#161616]">
              <div className="p-4 border-b border-zinc-850 bg-[#1C1C1C] flex justify-between items-center">
                <h3 className="text-xs font-bold text-yellow-500 uppercase tracking-wider">Rider Fleet Outstanding Fares</h3>
                <span className="text-[10px] text-zinc-500 font-mono">Process settlements for delivery partners</span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-850 text-zinc-500 font-extrabold uppercase bg-zinc-900 text-[10px] tracking-wider">
                      <th className="p-3">Rider Name</th>
                      <th className="p-3">Rider Contact</th>
                      <th className="p-3">Accumulated Fares</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {riders.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-zinc-500">No active riders found.</td>
                      </tr>
                    ) : (
                      riders.map((r) => (
                        <tr key={r.id} className="border-b border-zinc-850 hover:bg-[#1E1E1E] transition">
                          <td className="p-3 font-semibold text-zinc-200">{r.profiles?.full_name || 'Rider'}</td>
                          <td className="p-3 text-zinc-400 font-mono">{r.profiles?.phone_number || 'N/A'}</td>
                          <td className="p-3 font-bold text-yellow-500">{formatINR(r.balance)}</td>
                          <td className="p-3 text-right">
                            <button
                              disabled={r.balance <= 0}
                              onClick={() => handleOpenPayout(r.id, r.profiles?.full_name || 'Rider', 'delivery', r.balance)}
                              className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-yellow-500 hover:bg-yellow-400 text-black transition disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              Settle & Pay Out
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: PAYOUT LEDGER LOG */}
          {activeTab === 'payouts' && (
            <div className="rounded-xl border border-zinc-850 overflow-hidden bg-[#161616]">
              <div className="p-4 border-b border-zinc-850 bg-[#1C1C1C] flex justify-between items-center">
                <h3 className="text-xs font-bold text-yellow-500 uppercase tracking-wider">Payout History Ledger</h3>
                <span className="text-[10px] text-zinc-500 font-mono">Auditable log of processed bank & cheque transfers</span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-850 text-zinc-500 font-extrabold uppercase bg-zinc-900 text-[10px] tracking-wider">
                      <th className="p-3">Txn ID</th>
                      <th className="p-3">Recipient Name</th>
                      <th className="p-3">Partner Role</th>
                      <th className="p-3">Amount Settled</th>
                      <th className="p-3">Payment Mode</th>
                      <th className="p-3">Ref Details</th>
                      <th className="p-3">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-zinc-500">No payout settlements recorded.</td>
                      </tr>
                    ) : (
                      payouts.map((p) => (
                        <tr key={p.id} className="border-b border-zinc-850 hover:bg-[#1E1E1E] transition">
                          <td className="p-3 font-mono text-[10px] text-zinc-500">#{p.id.slice(0, 8).toUpperCase()}</td>
                          <td className="p-3 font-semibold text-zinc-200">{p.recipient_name}</td>
                          <td className="p-3 font-mono font-semibold">
                            <span className={`px-2 py-0.5 rounded text-[8px] uppercase font-black ${
                              p.recipient_role === 'seller' 
                                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' 
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            }`}>
                              {p.recipient_role}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-green-400">-{formatINR(p.amount)}</td>
                          <td className="p-3 text-zinc-300 font-semibold uppercase">{p.payment_method.replace('_', ' ')}</td>
                          <td className="p-3 text-zinc-400 font-mono">{p.reference_details || 'N/A'}</td>
                          <td className="p-3 text-zinc-500 font-mono">{new Date(p.created_at).toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

      </main>

      {/* PAYOUT SETTLEMENT DRAWER MODAL */}
      {showPayoutModal && payoutRecipient && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#161616] border border-zinc-800 rounded-2xl p-6 relative space-y-5 animate-slide-up text-white">
            
            <button
              onClick={() => {
                setShowPayoutModal(false);
                setPayoutRecipient(null);
              }}
              className="absolute top-4 right-4 p-1 rounded-full text-zinc-500 hover:text-zinc-200 bg-zinc-900 border border-zinc-800"
            >
              <X size={16} />
            </button>

            <div className="space-y-1.5">
              <span className="px-2 py-0.5 text-[8px] font-black uppercase rounded bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                Process Settlement
              </span>
              <h3 className="text-base font-black">Settle Outstanding Balance</h3>
              <p className="text-xs text-zinc-400 leading-normal">
                Input the payment details after writing the cheque or bank transfer. This action will deduct their database balance.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-850 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Recipient Name:</span>
                <span className="font-bold text-zinc-200">{payoutRecipient.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Partner Role:</span>
                <span className="font-semibold text-yellow-500 uppercase">{payoutRecipient.role}</span>
              </div>
              <div className="flex justify-between border-t border-zinc-850 pt-1.5 mt-1.5">
                <span className="text-zinc-400 font-semibold">Total Outstanding Balance:</span>
                <span className="font-black text-white">{formatINR(payoutRecipient.balance)}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-1.5">Payout Amount (INR)</label>
                <input 
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  className="input py-2.5 px-3 text-xs w-full font-bold"
                  value={payoutAmount}
                  onChange={e => setPayoutAmount(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-1.5">Payment Method</label>
                <select
                  className="input py-2.5 px-3 text-xs w-full bg-zinc-900 font-semibold"
                  value={payoutMethod}
                  onChange={e => setPayoutMethod(e.target.value as any)}
                >
                  <option value="cheque">Cheque Payment</option>
                  <option value="bank_transfer">Bank Transfer (IMPS/NEFT)</option>
                  <option value="upi">UPI Transfer</option>
                  <option value="cash">Cash Settlement</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-1.5">Reference Details (Required)</label>
                <input 
                  type="text"
                  required
                  placeholder="Cheque No., Bank Transaction ID, or UPI Ref"
                  className="input py-2.5 px-3 text-xs w-full font-mono"
                  value={payoutRef}
                  onChange={e => setPayoutRef(e.target.value)}
                />
              </div>

              <button
                disabled={submittingPayout || !payoutRef.trim()}
                onClick={submitPayoutSettle}
                className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider font-black"
              >
                {submittingPayout ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    Processing Settlement...
                  </>
                ) : (
                  'Confirm & Settle Balance'
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
