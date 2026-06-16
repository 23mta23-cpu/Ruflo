// Web stub — @stripe/stripe-react-native is native-only.
// On web, payments go through Stripe.js (out of scope for MVP).
import React from 'react';

export function StripeProvider({ children }: { children: React.ReactNode; publishableKey?: string; merchantIdentifier?: string }) {
  return children as React.ReactElement;
}

export function useStripe() {
  return {
    initPaymentSheet: async () => ({ error: { message: 'Stripe not available on web' } }),
    presentPaymentSheet: async () => ({ error: { code: 'Unsupported', message: 'Stripe not available on web' } }),
  };
}
