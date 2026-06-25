'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { Order, OrderStatus, DANTEWADA_CENTER, TOWN_NAME, formatINR } from '@kdlgoods/shared';
import {
  Navigation, Loader2, Award, Check, MapPin,
  ToggleLeft, ToggleRight, ShieldAlert, ArrowRight, RefreshCw
} from 'lucide-react';

export default function DeliveryDashboard() {
  const [isOnline, setIsOnline] = useState(false);
  const [driverId, setDriverId] = useState('driver-uuid-placeholder-123');
  const [loadingUser, setLoadingUser] = useState(true);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [showAlert, setShowAlert] = useState(false);

  // Coordinates – defaulted to Dantewada Kirandul operational centre
  const [coords, setCoords] = useState(DANTEWADA_CENTER);

  // Swipe-to-Accept Slider Drag State
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setDriverId(user.id);
        }
      } catch (err) {
        console.error('Failed to get delivery partner user:', err);
      } finally {
        setLoadingUser(false);
      }
    };
    fetchUser();
  }, []);

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
          if (updatedOrder.delivery_partner_id === driverId && updatedOrder.status === 'awaiting_pickup') {
            setActiveOrder(updatedOrder);
            setShowAlert(true);
          }
        }
      )
      .subscribe();

    // Local Storage Offline Poll Fallback
    const checkLocalInterval = setInterval(() => {
      const local = JSON.parse(localStorage.getItem('kdlgoods_orders') || '[]');
      
      // Check if we already have an active order in local storage that is out_for_delivery
      const ongoingOrder = local.find((o: any) => o.delivery_partner_id === driverId && o.status === 'out_for_delivery');
      if (ongoingOrder && (!activeOrder || activeOrder.status !== 'out_for_delivery')) {
        setActiveOrder(ongoingOrder);
        setShowAlert(false);
        return;
      }

      const pendingIndex = local.findIndex((o: any) => o.status === 'awaiting_pickup' && (!o.delivery_partner_id || o.delivery_partner_id === driverId));
      if (pendingIndex !== -1) {
        if (!local[pendingIndex].delivery_partner_id) {
          local[pendingIndex].delivery_partner_id = driverId;
          localStorage.setItem('kdlgoods_orders', JSON.stringify(local));
        }
        if (!activeOrder || activeOrder.id !== local[pendingIndex].id) {
          setActiveOrder(local[pendingIndex]);
          setShowAlert(true);
        }
      }
    }, 1000);

    return () => {
      supabase.removeChannel(orderSubscription);
      clearInterval(checkLocalInterval);
    };
  }, [isOnline, activeOrder, driverId, loadingUser]);

  const updateDriverLocation = async () => {
    const { error } = await supabase
      .from('delivery_partners')
      .upsert({
        id: driverId,
        is_online: isOnline,
        location: `POINT(${coords.longitude} ${coords.latitude})`,
      });
  };

  const handleToggleOnline = async () => {
    const nextVal = !isOnline;
    setIsOnline(nextVal);

    const { error } = await supabase
      .from('delivery_partners')
      .update({ is_online: nextVal })
      .eq('id', driverId);
  };

  const handleAcceptRequest = async () => {
    setShowAlert(false);
    if (!activeOrder) return;

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'out_for_delivery' })
        .eq('id', activeOrder.id);
      if (error) throw error;
    } catch (err) {
      // Mock transition inside localStorage
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
        status: 'picked_up',
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
    } catch (err) {
      // Mock transition inside localStorage
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

    setActiveOrder(prev => prev ? { ...prev, status: 'delivered' } : null);
    setTimeout(() => {
      setActiveOrder(null);
    }, 2000);
  };

  const simulateMovement = () => {
    setCoords(prev => {
      const next = {
        latitude: prev.latitude - 0.0005,
        longitude: prev.longitude + 0.0003,
      };
      return next;
    });
    updateDriverLocation();
  };

  // Drag handlers for Swipe-to-Accept Slider
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    startXRef.current = clientX - dragOffset;
  };

  const handleDragMove = (e: any) => {
    if (!isDragging || !trackRef.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const maxOffset = trackRef.current.clientWidth - 52; // Subtract handle width
    let offset = clientX - startXRef.current;

    if (offset < 0) offset = 0;
    if (offset > maxOffset) offset = maxOffset;

    setDragOffset(offset);

    // If swiped more than 85% of track, trigger accept
    if (offset >= maxOffset * 0.85) {
      setIsDragging(false);
      setDragOffset(0);
      handleAcceptRequest();
    }
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    // Slide back animation if let go before threshold
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

  return (
    <div className="min-h-screen text-white flex flex-col items-center justify-center p-4 md:p-6" style={{ backgroundColor: '#121212' }}>
      <div className="max-w-md w-full space-y-5">

        {/* Logo Header */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <Navigation size={28} style={{ color: '#F7D108' }} className="animate-pulse" />
          <span className="text-xl font-black" style={{ color: '#F7D108' }}>KDLGOODS RIDER</span>
        </div>
        <div className="text-center text-xs" style={{ color: '#8A8A8A' }}>Delivery Zone: {TOWN_NAME}</div>

        {/* Online Status Card */}
        <div className="p-5 rounded-2xl shadow-xl" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold">Duty Status</h2>
              <p className="text-xs mt-0.5" style={{ color: isOnline ? '#22C55E' : '#8A8A8A' }}>
                {isOnline ? 'ONLINE & READY FOR DISPATCH' : 'OFFLINE'}
              </p>
            </div>
            <button onClick={handleToggleOnline}>
              {isOnline ? (
                <ToggleRight size={48} style={{ color: '#F7D108', cursor: 'pointer' }} />
              ) : (
                <ToggleLeft size={48} style={{ color: '#444', cursor: 'pointer' }} />
              )}
            </button>
          </div>
        </div>

        {/* GPS Simulation Card */}
        {isOnline && (
          <div className="p-5 rounded-2xl shadow-xl space-y-3" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
            <h3 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: '#8A8A8A' }}>📍 GPS Telemetry Simulator</h3>
            <p className="text-xs font-mono" style={{ color: '#B0B0B0' }}>Coords: {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}</p>
            <button
              onClick={simulateMovement}
              className="w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
              style={{ background: '#222222', border: '1px solid rgba(247,209,8,0.2)', color: '#F7D108' }}
            >
              <RefreshCw size={14} /> Simulate GPS Movement
            </button>
          </div>
        )}

        {/* Coordinated dispatch modal card */}
        {showAlert && activeOrder && (
          <div className="p-5 rounded-2xl shadow-2xl relative overflow-hidden animate-bounce-subtle" style={{ background: 'rgba(247,209,8,0.06)', border: '2px solid rgba(247,209,8,0.4)' }}>
            <div className="absolute top-0 right-0 text-[9px] px-3 py-1 rounded-bl-lg font-black uppercase tracking-wider" style={{ background: '#F7D108', color: '#121212' }}>
              5km SLA Active
            </div>

            <h3 className="text-lg font-black mb-1 flex items-center gap-1.5" style={{ color: '#F7D108' }}>⚡ Dispatch Request Received!</h3>
            <p className="text-xs" style={{ color: '#8A8A8A' }}>Store needs instant pickup. Swipe slider below to accept.</p>

            <div className="border-t border-slate-800 my-4 pt-3 space-y-2">
              <span className="text-[10px] font-bold text-slate-500 block">DELIVERY ADDRESS:</span>
              <p className="text-slate-300 text-xs leading-relaxed">{activeOrder.delivery_address}</p>
            </div>

            {/* Premium Swipe to Accept Slider */}
            <div
              ref={trackRef}
              className="w-full h-12 rounded-xl relative select-none flex items-center justify-center"
              style={{ background: '#121212', border: '1px solid #2E2E2E' }}
            >
              <div
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
                style={{ transform: `translateX(${dragOffset}px)`, background: '#F7D108', color: '#121212' }}
                className="w-12 h-10 rounded-lg flex items-center justify-center cursor-grab active:cursor-grabbing absolute left-1 top-1 font-bold shadow-lg transition-transform duration-75 select-none"
              >
                <ArrowRight size={18} />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider pointer-events-none select-none pl-6" style={{ color: '#444' }}>
                Swipe to Accept
              </span>
            </div>

            <button
              onClick={handleRejectRequest}
              className="w-full text-center text-red-400 hover:text-red-300 text-xs font-bold mt-4"
            >
              Reject Assignment
            </button>
          </div>
        )}

        {/* Active Order execution panel */}
        {!showAlert && activeOrder && (
          <div className="p-5 rounded-2xl shadow-xl space-y-4" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
            <h3 className="font-bold flex items-center gap-2">📦 Order Progress Panel</h3>

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold" style={{ color: '#8A8A8A' }}>Current State:</span>
              <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase" style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B' }}>
                {activeOrder.status.replace('_', ' ')}
              </span>
            </div>

            <div className="border-y py-3 space-y-2 text-xs" style={{ borderColor: '#2E2E2E' }}>
              <p style={{ color: '#8A8A8A' }}><strong style={{ color: '#F5F5F5' }}>Deliver To:</strong> {activeOrder.delivery_address}</p>
              <p style={{ color: '#8A8A8A' }}><strong style={{ color: '#F5F5F5' }}>Order Total:</strong> {formatINR(activeOrder.total_amount)}</p>
            </div>

            {activeOrder.status === 'out_for_delivery' ? (
              <button
                onClick={handleMarkDelivered}
                className="w-full font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-2"
                style={{ background: '#22C55E', color: '#121212' }}
              >
                <Check size={16} /> Complete Delivery [Mark Delivered]
              </button>
            ) : activeOrder.status === 'delivered' ? (
              <div className="p-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#22C55E' }}>
                <Check size={16} /> Delivery successfully completed!
              </div>
            ) : (
              <p className="text-xs text-center" style={{ color: '#8A8A8A' }}>Food is prepared. Reach merchant for pickup.</p>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
