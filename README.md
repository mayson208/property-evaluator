# PropValue — Property Value Evaluator

A full-featured property value estimation tool built with React, TypeScript, and Recharts.

**Live:** https://github.com/mayson208/property-evaluator

---

## Features

| Tab | What it does |
|-----|-------------|
| 🏠 Valuation | Estimates property value using sales comparison + cost approach hybrid |
| 🏘 Comps | Shows 5 comparable sales with per-attribute adjustments |
| 📈 Market | 24-month area price trends, days-on-market, inventory charts |
| 📅 History | Year-by-year appreciation using US NAR/FHFA data + future projection |
| 🔨 Renovation | ROI calculator for 10 common renovations with editable cost/value |
| 💰 Investment | Cap rate, cash-on-cash, gross/net yield, monthly cash flow, 5yr equity |
| 📍 Area | Neighborhood scores (schools, safety, walkability, transit, amenities) |
| 🏦 Mortgage | Full PITI breakdown, 15/30yr comparison, amortisation chart |
| ⚖️ Compare | Side-by-side comparison of two properties |
| 💾 Saved | Save up to 20 properties to localStorage |
| 🖨 Report | Print-ready PDF report with full valuation summary |

## Valuation Methodology

1. **Base value** — Living area × state-level price-per-sqft median
2. **Adjustments** — Condition, age depreciation, lot premium, garage, pool, basement, fireplace, bed/bath normalisation, property type
3. **Comp blend** — 5 comparable sales generated with per-attribute adjustments; final value = 45% cost approach + 55% comp approach
4. **Confidence score** — Data completeness rating (0–97%)

## Share

Click **🔗 Share** in the header to copy a URL with your property encoded as a base64 query param. Recipients open the link and the property auto-loads and calculates.

## Stack

- React 18 + TypeScript + Vite
- Tailwind CSS
- Zustand (state + localStorage persistence)
- Recharts (AreaChart, LineChart, BarChart, RadarChart)

## Run locally

```bash
npm install
npm run dev
```
