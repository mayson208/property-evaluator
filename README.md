# PropValue — Property Value Evaluator

A comprehensive property valuation and real estate analysis tool built with React, TypeScript, and Recharts.

**Repo:** https://github.com/mayson208/property-evaluator

---

## Features (21 Tabs)

| Tab | What it does |
|-----|-------------|
| 🏠 Valuation | Estimates property value using sales comparison + cost approach hybrid |
| 🏘 Comps | 5 comparable sales with per-attribute adjustments, sortable by any column |
| 📈 Market | 24-month price trends, days-on-market, inventory, market timing indicator |
| 📅 History | Year-by-year appreciation using US NAR/FHFA data + future projection |
| 🏆 Scorecard | Holistic property grade (A+–D) across condition, age, size, features, location, tax |
| 🔨 Renovation | ROI calculator for 15 renovations with editable cost/value |
| 💰 Investment | Cap rate, cash-on-cash, gross/net yield, monthly cash flow, HOA, 5yr equity |
| 🔄 Flip | House flip analyzer: purchase, rehab, hold, ARV, net profit, 70% rule MAO |
| 💸 Ownership | Annual cost breakdown: property tax, insurance, maintenance, HOA, utilities, interest |
| ⚖️ Rent vs Buy | Net worth comparison over time, break-even year, line chart |
| 📍 Area | Neighborhood scores: schools, safety, walkability, transit, amenities |
| 🏦 Mortgage | Full PITI breakdown, 10/15/20/30yr terms, amortisation chart + CSV export |
| 🔮 What-If | Rate sensitivity, buy-now vs later, down payment comparison |
| 📋 Closing | Buyer and seller closing costs with itemized breakdown |
| 📊 Cap Gains | Capital gains tax estimator: federal + state, §121 exclusion, NIIT |
| ⚡ Stress Test | Investment stress test: rent sensitivity, vacancy curves, rate sensitivity |
| 🔀 Compare | Side-by-side comparison of two properties, load from saved, winner tracking |
| 💾 Saved | Save up to 20 properties to localStorage with JSON export/import |
| 🖨 Report | Print-ready PDF with valuation, comps, neighborhood, renovation plan, ownership costs |

---

## Valuation Methodology

1. **Base value** — Living area × state-level price-per-sqft median (all 50 states + DC)
2. **Adjustments** — Condition, age depreciation, lot premium, garage, pool, basement, fireplace, bed/bath normalisation, property type
3. **Comp blend** — 5 seeded comparable sales (stable across re-renders); final value = 45% cost approach + 55% comp approach
4. **Confidence score** — Data completeness rating (0–97%)

---

## Key Features

### Stability
- Seeded PRNG for comps and market data — same property always generates the same comps

### Property Tax
- State-level effective tax rates for all 50 states + DC
- Annual ownership cost estimates built into the valuation result

### Share
- Click **🔗 Share** in the header to copy a URL with your property as a base64 query param

### Demo
- Click **✨ Load Demo** in the property form to instantly load one of 4 preset properties and calculate

### Export
- JSON export/import for saved properties
- CSV export for full amortization schedule (Mortgage tab)

---

## Stack

- React 18 + TypeScript + Vite
- Tailwind CSS
- Zustand (state + localStorage persistence)
- Recharts (AreaChart, LineChart, BarChart, RadarChart)

---

## Run locally

```bash
npm install
npm run dev
```
