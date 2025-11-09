"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.constructEvent = exports.verifyPaymentIntent = exports.stripePaymentIntent = void 0;
const stripe_1 = __importDefault(require("stripe"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Stripe Secret Key - 環境変数から読み込み（.envファイルに設定、絶対にコミットしない）
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
    console.error('⚠️  STRIPE_SECRET_KEY が設定されていません。server/.envファイルを確認してください。');
    throw new Error('Stripe Secret Key が設定されていません');
}
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
        // 前端已经发送分为单位的金额，直接使用
        const amountInCents = Math.round(params.amount);
        console.log(`Amount for Stripe (already in cents): ${amountInCents}`);
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
