import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

// Use the provided test key if environment variable is not set
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_51RHMVW4ec3wxfwe9upMBdw5Csj7TtiydSEHmDzKOJDp7HScEqZ2Qee5hRnk9p5s0Rpv6xPvp7eQJ4chu8eJRLdUj00FIxpXkhX';

// Initialize Stripe with your secret key
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2022-11-15', // Use the compatible API version
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
    console.log(`Creating Stripe payment intent: amount=${params.amount}, currency=${params.currency}`);
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: params.amount,
      currency: params.currency,
      metadata: params.metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    console.log(`Payment intent created successfully: ${paymentIntent.id}`);
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
    console.log(`Verifying payment intent: ${paymentIntentId}`);
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    console.log(`Payment intent status: ${paymentIntent.status}`);
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