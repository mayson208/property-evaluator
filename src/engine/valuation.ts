import type {
  PropertyInput, ValuationResult, Comp, Adjustment, Condition, GarageType,
} from '../types'
import { generateComps } from './comps'

// ─── Condition multipliers ────────────────────────────────────────────────────

const CONDITION_MULT: Record<Condition, number> = {
  poor:      0.82,
  fair:      0.91,
  average:   1.00,
  good:      1.07,
  excellent: 1.14,
}

// ─── Base price-per-sqft by state (rough market medians) ─────────────────────

const STATE_PPF: Record<string, number> = {
  CA: 520, NY: 480, WA: 420, MA: 410, CO: 380, TX: 195, FL: 265,
  IL: 195, AZ: 230, NV: 245, OR: 310, GA: 190, NC: 185, OH: 165,
  PA: 175, MI: 160, MN: 195, WI: 155, MO: 145, TN: 195, VA: 240,
  SC: 185, AL: 148, KY: 148, IN: 155, UT: 280, ID: 250, MT: 255,
  WY: 215, NM: 180, OK: 145, KS: 145, NE: 165, SD: 185, ND: 185,
  IA: 148, AR: 135, LA: 148, MS: 130, WV: 120, ME: 265, NH: 295,
  VT: 265, RI: 310, CT: 285, NJ: 360, DE: 245, MD: 295, HI: 650,
  AK: 285, DC: 620,
}

function basePPF(state: string): number {
  return STATE_PPF[state.toUpperCase()] ?? 200
}

// ─── Garage value ─────────────────────────────────────────────────────────────

const GARAGE_VALUE: Record<GarageType, number> = {
  none: 0, carport: 4000, '1_car': 15000, '2_car': 28000, '3_car': 42000,
}

// ─── Age depreciation ─────────────────────────────────────────────────────────

function ageDepreciation(yearBuilt: number): number {
  const age = new Date().getFullYear() - yearBuilt
  if (age <= 5)  return 1.06
  if (age <= 10) return 1.02
  if (age <= 20) return 0.98
  if (age <= 30) return 0.95
  if (age <= 50) return 0.91
  return 0.87
}

// ─── Bedroom / bathroom adjustments ──────────────────────────────────────────

function bedroomAdj(beds: number, ppf: number, sqft: number): number {
  const expected = Math.round(sqft / 400)
  const diff = beds - expected
  return diff * ppf * 120   // each extra bed above norm adds ~120 sqft value
}

function bathroomAdj(baths: number, sqft: number, ppf: number): number {
  const expected = Math.max(1, Math.round(sqft / 700))
  const diff = baths - expected
  return diff * ppf * 85
}

// ─── Main valuation ───────────────────────────────────────────────────────────

export function calculateValuation(input: PropertyInput): ValuationResult {
  const ppf     = basePPF(input.state)
  const condMul = CONDITION_MULT[input.condition]
  const ageMul  = ageDepreciation(input.yearBuilt)

  // Base value from sqft
  let base = input.sqft * ppf * condMul * ageMul

  const adjustments: Adjustment[] = []

  // Lot premium (above 6000 sqft typical suburban lot)
  const lotBonus = Math.max(0, (input.lotSqft - 6000) * (ppf * 0.08))
  if (lotBonus > 0) {
    adjustments.push({ label: 'Lot size premium', amount: lotBonus })
    base += lotBonus
  }

  // Garage
  const garageVal = GARAGE_VALUE[input.garage]
  if (garageVal > 0) {
    adjustments.push({ label: `Garage (${input.garage.replace('_', ' ')})`, amount: garageVal })
    base += garageVal
  }

  // Pool
  if (input.hasPool) {
    const poolVal = ppf > 300 ? 45000 : 28000
    adjustments.push({ label: 'Swimming pool', amount: poolVal })
    base += poolVal
  }

  // Basement
  if (input.hasBasement && input.basementSqft > 0) {
    const bsmtVal = input.basementSqft * ppf * 0.45
    adjustments.push({ label: `Basement (${input.basementSqft} sqft)`, amount: bsmtVal })
    base += bsmtVal
  }

  // Fireplace
  if (input.hasFireplace) {
    const fpVal = 5500
    adjustments.push({ label: 'Fireplace', amount: fpVal })
    base += fpVal
  }

  // Bedroom adjustment
  const bedAdj = bedroomAdj(input.bedrooms, ppf, input.sqft)
  if (Math.abs(bedAdj) > 500) {
    adjustments.push({ label: 'Bedroom count adjustment', amount: bedAdj })
    base += bedAdj
  }

  // Bathroom adjustment
  const bathAdj = bathroomAdj(input.bathrooms, input.sqft, ppf)
  if (Math.abs(bathAdj) > 500) {
    adjustments.push({ label: 'Bathroom count adjustment', amount: bathAdj })
    base += bathAdj
  }

  // Property type discount
  if (input.propertyType === 'condo') {
    const condoAdj = -(base * 0.08)
    adjustments.push({ label: 'Condo discount (HOA, shared walls)', amount: condoAdj })
    base += condoAdj
  }
  if (input.propertyType === 'townhouse') {
    const thAdj = -(base * 0.04)
    adjustments.push({ label: 'Townhouse discount', amount: thAdj })
    base += thAdj
  }
  if (input.propertyType === 'multi_family') {
    const mfAdj = base * 0.12
    adjustments.push({ label: 'Multi-family income premium', amount: mfAdj })
    base += mfAdj
  }

  // Generate comps and blend
  const comps = generateComps(input, ppf)
  let blended = base
  if (comps.length > 0) {
    const compAvg = comps.reduce((s, c) => s + c.adjustedPrice, 0) / comps.length
    blended = base * 0.45 + compAvg * 0.55
    adjustments.push({ label: 'Comparable sales blend', amount: compAvg - base })
  }

  const estimatedValue = Math.round(blended / 1000) * 1000

  // Confidence: more comps + complete data = higher confidence
  const dataCompleteness =
    (input.sqft > 0 ? 20 : 0) +
    (input.yearBuilt > 0 ? 15 : 0) +
    (input.lotSqft > 0 ? 10 : 0) +
    (input.address ? 10 : 0) +
    (comps.length >= 3 ? 25 : comps.length * 8) +
    (input.bedrooms > 0 ? 10 : 0) +
    (input.bathrooms > 0 ? 10 : 0)

  const confidenceScore = Math.min(97, dataCompleteness)

  return {
    estimatedValue,
    lowValue:  Math.round(estimatedValue * 0.92 / 1000) * 1000,
    highValue: Math.round(estimatedValue * 1.08 / 1000) * 1000,
    confidenceScore,
    pricePerSqft: Math.round(estimatedValue / input.sqft),
    adjustments,
    comps,
    methodology: 'Sales Comparison + Cost Approach Hybrid',
  }
}
