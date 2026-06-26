import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { amount, currency = 'INR' } = await req.json();

    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid checkout amount' }, { status: 400 });
    }

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    // Check if valid credentials are set
    const hasKeys = keyId && keySecret && !keyId.includes('YOUR_') && !keySecret.includes('YOUR_');

    if (!hasKeys) {
      // Return a simulated Razorpay Order structure for sandbox testing
      return NextResponse.json({
        id: 'order_mock_' + Math.random().toString(36).substring(2, 12),
        entity: 'order',
        amount: Math.round(amount * 100), // in paise
        amount_paid: 0,
        amount_due: Math.round(amount * 100),
        currency,
        receipt: 'receipt_mock_' + Date.now(),
        status: 'created',
        attempts: 0,
        notes: [],
        created_at: Math.floor(Date.now() / 1000),
        is_mock: true
      });
    }

    // Call Real Razorpay API via native fetch
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64'),
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // Razorpay accepts amount in paise (1 INR = 100 paise)
        currency,
        receipt: 'receipt_' + Date.now(),
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Razorpay Order API Error:', errText);
      return NextResponse.json({ error: 'Razorpay API returned error: ' + errText }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json({ ...data, is_mock: false });
  } catch (error: any) {
    console.error('Razorpay Checkout Route Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
