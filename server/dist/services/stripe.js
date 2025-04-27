"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.constructEvent = exports.verifyPaymentIntent = exports.stripePaymentIntent = void 0;
const stripe_1 = __importDefault(require("stripe"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Initialize Stripe with secret key from env
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16', // Use the latest API version
});
/**
 * Create a payment intent with Stripe
 */
const stripePaymentIntent = async (params) => {
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
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
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
