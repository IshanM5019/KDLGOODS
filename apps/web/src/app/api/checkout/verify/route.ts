import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();

    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    // Check if secret key is configured
    const hasSecret = keySecret && !keySecret.includes('YOUR_');

    if (!hasSecret) {
      // Return successful mock verification for the frontend sandbox simulator
      return NextResponse.json({ success: true, verified: true, is_mock: true });
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing required Razorpay payment signature fields' }, { status: 400 });
    }

    // Verify signature using crypto
    const hmacSource = razorpay_order_id + '|' + razorpay_payment_id;
    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(hmacSource)
      .digest('hex');

    if (generatedSignature === razorpay_signature) {
      return NextResponse.json({ success: true, verified: true, is_mock: false });
    } else {
      console.warn('Razorpay signature mismatch: generated vs received', generatedSignature, razorpay_signature);
      return NextResponse.json({ success: false, verified: false, error: 'Payment verification signature mismatch' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Razorpay Verification Route Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
