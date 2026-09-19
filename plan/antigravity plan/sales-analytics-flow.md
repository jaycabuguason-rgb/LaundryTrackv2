# Sales Analytics & Revenue Calculation Flow

## 1. Overview

This document explains how **Sales Analytics** and **Revenue Tracking** work across LaundryTrack, specifically addressing how customer orders, claiming, and payment statuses affect the numbers.

---

## 2. Does an Order Need to be Claimed and Paid to Count?

### In Sales Analytics (`Reports` Page)
* **No.** Sales Analytics does **not** wait for an order to be claimed or paid.
* All transactions booked within the chosen date range (`dropOffDate`) are included immediately.
* **Sales in Range (`totalFilteredRevenue`):** Sums the `fee` of **all** orders in the selected period, regardless of whether the laundry is `Received`, `Washing`, `Ready`, or `Claimed`, and regardless of whether it is `paid` or `unpaid`.
* **Payment Split:** Provides a breakdown showing how much of that total is collected (`Paid`) versus outstanding (`Unpaid`).
* **Sales Trend:** Groups total sales and order count into time buckets (Hourly for Day view, Daily for Week/Month, Monthly for Year) based on `dropOffDate`.
* **Status Mix:** Shows the distribution of orders across current operational stages.

### On the Main Dashboard
* **Realized Revenue Only:** The Dashboard **Revenue** card specifically calculates:
  $$\text{Revenue} = \sum_{\text{paymentStatus} = \text{"paid"}, \, \text{status} \neq \text{"Voided"}} \text{fee}$$
* It only counts money that has actually been marked **`Paid`**.
* It does **not** wait for an order to be claimed. If a customer pays upfront at drop-off (while still `Received` or `Washing`), that money is immediately recognized in Dashboard Revenue.

---

## 3. Claiming & Payment Rule

While Sales Analytics tracks all created orders, the application enforces a strict guardrail at the counter:

* **Claim Verification Block:** An order **cannot be marked as `Claimed` while `Unpaid`**.
  * In `claim-verification.tsx`: Attempting to claim an unpaid ticket triggers the block:  
    `"Mark payment as Paid first before claiming this ticket."`
  * In `transactions.tsx`: Attempting to change status to `Claimed` while `unpaid` is similarly rejected.
* **Result:** Every order with status `Claimed` is guaranteed to be `Paid`, but an order does not need to be `Claimed` to be counted in sales.

---

## 4. Summary Matrix

| Metric / Screen | Counts Unpaid Orders? | Requires "Claimed" Status? | Filter Criteria |
| :--- | :---: | :---: | :--- |
| **Reports: Sales in Range** | **Yes** (total amount booked) | **No** (all active stages) | `dropOffDate` within selected period |
| **Reports: Payment Split** | **Separated** (Paid vs. Unpaid) | **No** | `dropOffDate` within selected period |
| **Reports: Sales Trend** | **Yes** (accumulates total fee) | **No** | `dropOffDate` within selected period |
| **Dashboard: Revenue Card** | **No** (Paid transactions only) | **No** (upfront payments count) | Active cycle transactions |
| **Claim Verification** | **Blocked** if unpaid | **Transitions to Claimed** | Customer pickup |
