# TS.5.2 — Unit Tests

## Task
Write unit tests for encryption, rebalance engine partial/full modes, and pre-flight validation.

## Target
`tests/unit/`

## Process
1. `tests/unit/encryption.test.ts`:
   - Encrypt → decrypt → original value
   - Same plaintext → different ciphertexts (fresh IV)
   - Tampered ciphertext → DECRYPTION_FAILED
   - Missing ENCRYPTION_KEY → ENCRYPTION_KEY_MISSING
2. `tests/unit/rebalance-engine.test.ts`:
   - Partial mode: no buy exceeds available capital
   - Partial mode: residual drift ≤ 2%
   - Full mode: post-execution weights within ±0.01%
   - Full mode pre-flight: insufficient cash → balance_valid: false
   - Edge: single asset silo → no orders generated
   - Edge: all at target → empty order list
   - Edge: zero holdings → appropriate error
3. `tests/unit/manual-instructions.test.ts`:
   - Correct instruction text for buy/sell
   - Platform name substitution
   - Quantity formatting per asset type

## Outputs
- `tests/unit/encryption.test.ts`
- `tests/unit/rebalance-engine.test.ts`
- `tests/unit/manual-instructions.test.ts`

## Verify
- `pnpm test` — all pass

## Handoff
→ TS.5.3 (Integration tests)
