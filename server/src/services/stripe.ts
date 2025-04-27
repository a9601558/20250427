import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Stripe with secret key from env
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16', // Use the latest API version
});

interface PaymentIntentParams {
  amount: number;
  currency: string;
  metadata?: Record<string, string>;
}

/**
 * Create a payment intent with Stripe
 */
export const stripePaymentIntent = async (params: PaymentIntentParams) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: params.amount,
      currency: params.currency,
      metadata: params.metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return paymentIntent;
  } catch (error) {
    console.error('Stripe payment intent error:', error);
    throw error;
  }
};

/**
 * Verify a payment intent status
 */
export const verifyPaymentIntent = async (paymentIntentId: string) => {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    return {
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      metadata: paymentIntent.metadata,
      isSuccessful: paymentIntent.status === 'succeeded'
    };
  } catch (error) {
    console.error('Stripe verify payment intent error:', error);
    throw error;
  }
};

/**
 * Create a webhook event from payload
 */
export const constructEvent = (payload: string, signature: string) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    throw new Error('Missing Stripe webhook secret');
  }

  try {
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    console.error('Stripe webhook construction error:', error);
    throw error;
  }
};

export default stripe; 