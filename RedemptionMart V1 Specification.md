# RedemptionMart — V1 Product & Technical Specification

**Status:** V1 Beta — partial implementation (live demo: https://redemptionmart.vercel.app)  
**Scope:** Redemption City only (not Lagos, not nationwide)

---

## 1. What This Is

A local marketplace where people in Redemption City can buy and sell products
without physically walking around to find sellers. Sellers list products,
buyers browse and order, and the buyer either gets it delivered or picks it
up directly from the seller.

---

## 2. Platform Type

**Progressive Web App (PWA).**

No app store download required. Users open a link (easily shareable via
WhatsApp) and it behaves like an app — installable, works offline for basic
browsing, can send push notifications.

Reasoning: nothing in V1 needs native-only capability (no background GPS, no
wake-word audio capture). Link-based sharing matches how local commerce
already spreads in Nigeria. A native wrapper (e.g. Capacitor) can be added
later for Play Store presence if sellers want the legitimacy of a "real app,"
without rebuilding anything.

---

## 3. Tech Stack (as built)

- **Frontend:** React 19 + Vite 6, TypeScript, installable PWA (`vite-plugin-pwa`)
- **Styling:** Custom CSS (mobile-first)
- **State:** React Context (auth, cart)
- **Production API:** Vercel serverless functions in `frontend/api/` (payments)
- **Local dev API:** Node.js + Express (`backend/`, proxied via Vite)
- **Database:** PostgreSQL via Supabase — SQL migrations (not an ORM)
- **Auth:** Supabase Auth + `profiles` table with RLS
- **Payments:** Paystack inline checkout + server-side verify (Transfers API planned)
- **File storage:** Product image URL field today; Supabase Storage planned
- **Notifications:** Web Push planned (not yet implemented)
- **Hosting:** Vercel (frontend + payment API) + Supabase (database/auth)

---

## 4. User Roles

1. **Buyer**
2. **Seller**
3. **Admin** (you — handles disputes and refunds manually in V1)

---

## 5. Core Data Models

- `User` — base account, flag for buyer/seller/admin
- `SellerProfile` — shop name, description, location (lat/lng + address), bank details for payout
- `Product` — name, description, price, images, seller_id, status (active/sold out)
- `Order` — buyer_id, items, total, fulfillment_type (delivery/pickup), status
- `OrderStatus` values: `pending` → `confirmed` → `shipped/ready_for_pickup` → `delivered` (buyer-confirmed) → `completed` | `cancelled` | `disputed`
- `Transaction` — order_id, amount, Paystack reference, commission_amount, payout_status
- `Review` — order_id, buyer_id, rating (1–5), comment, tied only to completed orders
- `Dispute` — order_id, buyer_message, admin_notes, resolution, status

---

## 6. Buyer Flow

1. Create account / log in
2. Browse or search products
3. View product details, price, seller info, seller location
4. Add to cart, place order
5. Pay via Paystack (full amount, held by platform — not yet sent to seller)
6. Choose fulfillment: **Delivery** or **Pickup**
7. Receive item → inspect it → tap **"Confirm Received"**
8. Confirmation triggers payout to seller (minus commission)
9. Leave a star rating + optional comment

If something's wrong: buyer taps **"Report a Problem"** instead of confirming.

---

## 7. Seller Flow

1. Create account, set up shop profile (name, description, location)
2. Add products (name, description, price, photos)
3. Get notified (push) when an order comes in
4. Mark order as "Shipped" (delivery) or "Ready for Pickup"
5. Get paid automatically once buyer confirms receipt

---

## 8. Order Fulfillment

**Delivery:** Item is delivered to the buyer's address.

**Pickup (V1 version — direct, no pickup station):** Buyer goes straight to
the seller's location (shown on the platform). The buyer inspecting the item
in person *is* the safety check — no separate drop-off/verification point
needed for V1. Pickup stations (a separate verified drop point) are a
possible **future** upgrade once there's enough volume to justify the
physical infrastructure and staffing.

---

## 9. Payment Flow (Hold-and-Release Model)

1. Buyer pays the full order amount via Paystack at checkout.
2. Funds are received into the platform's Paystack balance — **not** sent to
   the seller yet.
3. Order moves through `shipped` / `ready_for_pickup`.
4. Buyer inspects and taps **"Confirm Received."**
5. Backend triggers a Paystack Transfer to the seller's bank account
   (order amount minus 3% commission).
6. **Auto-cancellation rule:** if an order sits in `shipped`/`ready_for_pickup`
   for more than 120 hours (5 days) without buyer confirmation, the system
   auto-cancels it. Refund = product price only; payment processing fees are
   withheld to cover admin/logistics overhead.
7. **Pending-stage cancellation:** if buyer or seller cancels while the order
   is still `pending` (before seller confirms), full refund including any
   delivery fee.

**⚠️ Needs confirmation before building:** which Paystack account
configuration legally supports this hold-then-release pattern (vs. using
Paystack Subaccounts, which split payment automatically at the time of
payment instead of holding it). This should be confirmed directly with
Paystack's business/compliance team — not something to assume.

---

## 10. Commission & Fees

- **Listing is free.** No charge to sellers just for joining or adding products.
- **3% commission** on the order amount, charged only on completed transactions that go through the platform's payment system.
- **No commission** on off-platform cash payments (e.g. cash handed over at pickup) — these aren't trackable.
- Paystack's own processing fees are passed through transparently, not hidden inside the commission.

---

## 11. Reviews

Simple 1–5 star rating + optional short comment. Only buyers with a
*completed* order for that seller can leave one. No moderation system needed
for V1 — just a report/flag option for abusive comments.

---

## 12. Dispute & Refund Handling (Manual, V1)

1. Buyer taps "Report a Problem" on an order instead of confirming receipt.
2. This creates a `Dispute` record and notifies the admin (you).
3. Admin reviews: order details, product photos, any in-app messages.
4. Admin manually decides: full refund, partial refund, or release payment to seller.
5. No automated resolution engine in V1 — this is intentionally manual until real dispute patterns are understood.

---

## 13. Explicitly Out of Scope for V1

- Services marketplace (tailors, cobblers, printers, etc.) — different UX pattern, deferred to a fast-follow phase
- Live streaming of programs — unrelated to the commerce core, far future
- Pickup stations — future upgrade once volume justifies it
- Automated/algorithmic dispute resolution
- Premium or featured seller placements — only makes sense once there's real buyer traffic

---

## 14. Geographic Scope

Redemption City only at launch. Explicitly not Lagos, not Ogun State broadly,
not nationwide.

---

## 15. Go-to-Market Note (not technical, but important)

Recruit a small number of known, trusted sellers first — don't wait for
organic buyer discovery. Their existing customers are the fastest path to
your first real buyers. Consider a founding-seller incentive (e.g. free
premium placement for the first few months) to get early supply onto the
platform.

---

## 16. Open Items Still Needing a Decision

- Exact delivery fee structure / who arranges delivery (platform-coordinated riders vs. seller-arranged)
- Whether sellers need ID/bank verification (BVN/NIN) before receiving payouts — likely required by Paystack regardless
- Final Paystack account type/setup for the hold-and-release payment model
- Terms of Service and Prohibited Items list (can largely be written before development starts)

---

## 17. Implementation Status (June 2026)

Aligned with `RedemptionMart_Architecture.md`. Summary for judges and stakeholders.

### Live in the demo

| Area | What works |
|---|---|
| Accounts | Email/password signup and login via Supabase Auth |
| Sellers | Create shop, add products (name, price, description, image URL), mark sold out |
| Buyers | Browse and search products, view details, add to cart |
| Orders | Place order (delivery or pickup), cancel while pending/unpaid |
| Payments | Paystack inline popup, server verify, payment receipt |
| Seller fulfillment | Confirm paid orders → mark shipped or ready for pickup |
| Buyer completion | Confirm received → order `completed`, 3% commission recorded on transaction |
| Security | RLS on database tables; Paystack secret server-side only |

### Built but not fully automated yet

- **Seller payout:** `transactions.payout_status` is set to `pending` on confirm;
  Paystack Transfers to seller bank is the next step (spec Section 9 step 5).
- **Escrow:** Payment is collected to platform Paystack balance before buyer confirms;
  hold-and-release *intent* matches spec; transfer automation pending.

### V1 spec items not yet built

- Reviews after completed orders (Section 11)
- Disputes / “Report a Problem” UI (Section 12)
- Push notifications for sellers (Section 7)
- Admin dispute panel (Section 4, role 3)
- Maps for seller location display (Section 6 step 3)
- Supabase Storage for photo uploads (Section 7 step 2)
- Paystack webhooks as backup to verify endpoint
- Auto-cancel after 120 hours without buyer confirmation (Section 9 step 6)
