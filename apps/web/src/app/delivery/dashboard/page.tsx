'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { Order, OrderStatus, DANTEWADA_CENTER, TOWN_NAME, formatINR } from '@kdlgoods/shared';
import {
  Navigation, Loader2, Award, Check, MapPin,
  ToggleLeft, ToggleRight, ShieldAlert, ArrowRight, RefreshCw,
  MessageSquare, DollarSign, LifeBuoy, CreditCard, ChevronRight,
  TrendingUp, Send, CheckCircle2, User, Landmark, HelpCircle, PhoneCall,
  ChevronDown, MessageCircle, AlertTriangle
} from 'lucide-react';

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

// Preset GPS Simulation Steps (Store -> Customer)
const ROUTE_STEPS = [
  { latitude: 18.8475, longitude: 81.2135, instruction: "Head north toward Merchant store", dist: "1.2 km" },
  { latitude: 18.8480, longitude: 81.2140, instruction: "Turn right onto Store Lane", dist: "850 m" },
  { latitude: 18.8490, longitude: 81.2150, instruction: "Arriving at Merchant Store on left", dist: "300 m" },
  { latitude: 18.8492, longitude: 81.2155, instruction: "Arrived at Merchant! Awaiting pick up.", dist: "0 m" }, // Step 3
  { latitude: 18.8492, longitude: 81.2155, instruction: "Depart Merchant. Head toward Customer location.", dist: "2.4 km" },
  { latitude: 18.8482, longitude: 81.2165, instruction: "Make a U-turn at Main Junction", dist: "1.8 km" },
  { latitude: 18.8465, longitude: 81.2175, instruction: "Continue straight on Town Highway", dist: "1.2 km" },
  { latitude: 18.8450, longitude: 81.2185, instruction: "Turn left at Clock Tower", dist: "600 m" },
  { latitude: 18.8440, longitude: 81.2190, instruction: "Arriving at customer address", dist: "150 m" },
  { latitude: 18.8435, longitude: 81.2195, instruction: "Arrived! Deliver the parcel to customer.", dist: "0 m" } // Step 9
];

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
  const [activeTab, setActiveTab] = useState<'jobs' | 'earnings' | 'support'>('jobs');
  const [isOnline, setIsOnline] = useState(false);
  const [driverId, setDriverId] = useState('driver-uuid-placeholder-123');
  const [loadingUser, setLoadingUser] = useState(true);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [showAlert, setShowAlert] = useState(false);

  // GPS Simulation State
  const [coords, setCoords] = useState(DANTEWADA_CENTER);
  const [simStep, setSimStep] = useState(0);

  // Drag-to-Accept Slider State
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);

  // Chat Drawer State
  const [showChat, setShowChat] = useState(false);
  const [chatPartner, setChatPartner] = useState<'customer' | 'merchant'>('customer');
  const [chatInput, setChatInput] = useState('');
  const [customerMessages, setCustomerMessages] = useState<ChatMessage[]>([
    { id: '1', sender: 'partner', text: 'Hi! Please make sure the food is packed hot.', timestamp: '10:05 PM' }
  ]);
  const [merchantMessages, setMerchantMessages] = useState<ChatMessage[]>([
    { id: '1', sender: 'partner', text: 'Order is being prepared. It will take 10 minutes.', timestamp: '10:02 PM' }
  ]);

  // Earnings & Cashout State
  const [balance, setBalance] = useState(950);
  const [showCashoutModal, setShowCashoutModal] = useState(false);
  const [cashoutProcessing, setCashoutProcessing] = useState(false);
  const [cashoutSuccess, setCashoutSuccess] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([
    { id: 'TXN-9982', type: 'delivery', amount: 55, description: 'Order #291A (Base + Tip)', date: 'Today, 08:30 PM' },
    { id: 'TXN-9981', type: 'delivery', amount: 75, description: 'Order #182B (Distance Bonus)', date: 'Today, 07:15 PM' },
    { id: 'TXN-9980', type: 'delivery', amount: 120, description: 'Order #884C (Rain Surge Pay)', date: 'Yesterday, 09:10 PM' }
  ]);

  // Support Chatbot State
  const [supportMessages, setSupportMessages] = useState<ChatMessage[]>([
    { id: '1', sender: 'partner', text: 'Hello! I am your KDL Support Assistant. How can I help you today?', timestamp: '10:15 PM' }
  ]);
  const [supportInput, setSupportInput] = useState('');
  const [supportLoading, setSupportLoading] = useState(false);

  useEffect(() => {
    // Request notification permission on mount
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }

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
          const isAssignedToMe = updatedOrder.delivery_partner_id === driverId;
          const isAwaitingAction = ['accepted', 'preparing', 'awaiting_pickup'].includes(updatedOrder.status);
          
          if (isAssignedToMe && isAwaitingAction) {
            setActiveOrder(updatedOrder);
            setShowAlert(true);
            setSimStep(0);
            setCoords(ROUTE_STEPS[0]);
            
            // Trigger alerts
            playNotificationSound();
            triggerBrowserNotification(
              '⚡ New Dispatch Request!',
              `Deliver to: ${updatedOrder.delivery_address}. Swipe to accept.`
            );
          }
        }
      )
      .subscribe();

    // Local Storage Offline Poll Fallback
    const checkLocalInterval = setInterval(() => {
      const local = JSON.parse(localStorage.getItem('kdlgoods_orders') || '[]');
      
      const ongoingOrder = local.find((o: any) => o.delivery_partner_id === driverId && o.status === 'out_for_delivery');
      if (ongoingOrder && (!activeOrder || activeOrder.status !== 'out_for_delivery')) {
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
          setSimStep(0);
          setCoords(ROUTE_STEPS[0]);
          
          // Trigger alerts
          playNotificationSound();
          triggerBrowserNotification(
            '⚡ New Dispatch Request!',
            `Deliver to: ${matchedOrder.delivery_address}. Swipe to accept.`
          );
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

    await supabase
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
      // Mock transition in localStorage
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
    
    // Jump route simulator step after pickup accepted
    setSimStep(4);
    setCoords(ROUTE_STEPS[4]);
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
    const jobPayout = 65; 
    setBalance(prev => prev + jobPayout);
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
    setTimeout(() => {
      setActiveOrder(null);
      setSimStep(0);
    }, 2000);
  };

  const simulateMovement = () => {
    let nextStep = simStep + 1;
    if (nextStep >= ROUTE_STEPS.length) {
      nextStep = ROUTE_STEPS.length - 1;
    }
    setSimStep(nextStep);
    const newCoords = ROUTE_STEPS[nextStep];
    setCoords({ latitude: newCoords.latitude, longitude: newCoords.longitude });
    updateDriverLocation();

    // Auto-update order status if driver simulates arriving at merchant/customer
    if (activeOrder) {
      if (nextStep === 3 && activeOrder.status === 'accepted') {
        // Driver reached Merchant - simulate preparing / ready
        setActiveOrder(prev => prev ? { ...prev, status: 'awaiting_pickup' } : null);
      } else if (nextStep === 9 && activeOrder.status === 'out_for_delivery') {
        // Driver reached Customer
        triggerBrowserNotification('📍 Arrival Notification', 'You have arrived at the customer location.');
      }
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
  const sendMessage = () => {
    if (!chatInput.trim()) return;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newMsg: ChatMessage = {
      id: Math.random().toString(),
      sender: 'driver',
      text: chatInput,
      timestamp
    };

    if (chatPartner === 'customer') {
      setCustomerMessages(prev => [...prev, newMsg]);
      setChatInput('');
      
      // Simulate Customer Reply
      setTimeout(() => {
        setCustomerMessages(prev => [
          ...prev,
          {
            id: Math.random().toString(),
            sender: 'partner',
            text: 'Sounds good, see you soon!',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        playNotificationSound();
      }, 2500);
    } else {
      setMerchantMessages(prev => [...prev, newMsg]);
      setChatInput('');

      // Simulate Merchant Reply
      setTimeout(() => {
        setMerchantMessages(prev => [
          ...prev,
          {
            id: Math.random().toString(),
            sender: 'partner',
            text: 'Sure, we have double packed the food package.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        playNotificationSound();
      }, 2500);
    }
  };

  // Instant Cashout Action
  const triggerCashout = () => {
    if (balance <= 0) return;
    setCashoutProcessing(true);
    setShowCashoutModal(true);

    setTimeout(() => {
      setCashoutProcessing(false);
      setCashoutSuccess(true);
      
      const cashoutAmt = balance;
      setBalance(0);
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
                    <span className="font-bold text-yellow-500">Est. Payout: +₹65.00</span>
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
                      d={simStep < 4 ? "M 30 65 L 50 35" : "M 50 35 L 75 60"} 
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

                    {/* Rider marker (Updates relative to simStep) */}
                    {(() => {
                      // Interpolate coordinates for SVG rendering
                      let rx = 30, ry = 65;
                      if (simStep <= 3) {
                        // Rider heading to merchant
                        const pct = simStep / 3;
                        rx = 30 + (50 - 30) * pct;
                        ry = 65 + (35 - 65) * pct;
                      } else {
                        // Rider heading to customer
                        const pct = (simStep - 4) / 5;
                        rx = 50 + (75 - 50) * pct;
                        ry = 35 + (60 - 35) * pct;
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
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                      <Navigation size={18} className="rotate-45" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-yellow-500">{ROUTE_STEPS[simStep].instruction}</h4>
                      <p className="text-[10px] mt-0.5" style={{ color: '#8A8A8A' }}>Remaining distance: {ROUTE_STEPS[simStep].dist}</p>
                    </div>
                  </div>
                  <button 
                    onClick={simulateMovement}
                    className="p-2.5 rounded-xl border border-zinc-800 bg-[#222] text-[#F7D108] hover:bg-zinc-800 transition flex items-center gap-1 text-[11px] font-bold"
                  >
                    <RefreshCw size={12} />
                    SIM GPS
                  </button>
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
                  </div>

                  {/* Actions depending on simulated route progress */}
                  <div className="border-t border-zinc-800 pt-4 mt-2">
                    {activeOrder.status === 'out_for_delivery' ? (
                      <button
                        onClick={handleMarkDelivered}
                        className="w-full font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 bg-[#22C55E] text-[#121212] text-xs uppercase tracking-wider"
                      >
                        <Check size={16} /> Complete Delivery
                      </button>
                    ) : activeOrder.status === 'delivered' ? (
                      <div className="p-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold border border-green-500/20 bg-green-500/5 text-[#22C55E]">
                        <CheckCircle2 size={16} /> Delivery successfully completed!
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold border border-yellow-500/20 bg-yellow-500/5 text-yellow-500">
                        <Loader2 className="animate-spin" size={14} /> 
                        {simStep < 3 
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
                {transactions.map(txn => (
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
                ))}
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
      </nav>

    </div>
  );
}
