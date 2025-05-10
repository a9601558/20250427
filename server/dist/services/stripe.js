"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.constructEvent = exports.verifyPaymentIntent = exports.stripePaymentIntent = void 0;
const stripe_1 = __importDefault(require("stripe"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Use the provided test key if environment variable is not set
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_51RHMVW4ec3wxfwe9upMBdw5Csj7TtiydSEHmDzKOJDp7HScEqZ2Qee5hRnk9p5s0Rpv6xPvp7eQJ4chu8eJRLdUj00FIxpXkhX';
// Initialize Stripe with your secret key
const stripe = new stripe_1.default(STRIPE_SECRET_KEY, {
    apiVersion: '2022-11-15', // Use the compatible API version
});
/**
 * Create a payment intent with Stripe
 */
const stripePaymentIntent = async (params) => {
    try {
        console.log(`Creating Stripe payment intent: amount=${params.amount}, currency=${params.currency}`);
        // 确保金额是整数（Stripe要求以分为单位）
        const amountInCents = Math.round(params.amount * 100);
        console.log(`Converted amount for Stripe: ${params.amount} ${params.currency} -> ${amountInCents} cents`);
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountInCents,
            currency: params.currency,
            metadata: params.metadata,
            automatic_payment_methods: {
                enabled: true,
            },
        });
        console.log(`Payment intent created successfully: ${paymentIntent.id}`);
        return paymentIntent;
    }
    catch (error) {
        console.error('Stripe payment intent error:', error);
        throw error;
    }
};
exports.stripePaymentIntent = stripePaymentIntent;
/**
 * Verify a payment intent status
 */
const verifyPaymentIntent = async (paymentIntentId) => {
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
    }
    catch (error) {
        console.error('Stripe verify payment intent error:', error);
        throw error;
    }
};
exports.verifyPaymentIntent = verifyPaymentIntent;
/**
 * Create a webhook event from payload
 */
const constructEvent = (payload, signature) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        throw new Error('Missing Stripe webhook secret');
    }
    try {
        return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    }
    catch (error) {
        console.error('Stripe webhook construction error:', error);
        throw error;
    }
};
exports.constructEvent = constructEvent;
exports.default = stripe;
