/**
 * Minimal deterministic assertion evaluation for the regression fixture:
 * the business effect for one order/event must be applied exactly once.
 * The canonical evaluator lives in the Scenario Runner (assertion phase);
 * this test-local version mirrors its simplest rule so the receiver can
 * prove its own idempotency in isolation.
 */

export const BUSINESS_EFFECT_ASSERTION = 'business_effect_applied_once';

export interface AssertionResult {
  name: string;
  expected: number;
  actual: number;
  passed: boolean;
}

export function evaluateBusinessEffectCount(actual: number): AssertionResult {
  return {
    name: BUSINESS_EFFECT_ASSERTION,
    expected: 1,
    actual,
    passed: actual === 1,
  };
}
