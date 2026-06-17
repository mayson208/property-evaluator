export type PropertyType = 'single_family' | 'condo' | 'townhouse' | 'multi_family' | 'land'
export type Condition = 'poor' | 'fair' | 'average' | 'good' | 'excellent'
export type GarageType = 'none' | 'carport' | '1_car' | '2_car' | '3_car'

export interface PropertyInput {
  address: string
  city: string
  state: string
  zip: string
  propertyType: PropertyType
  sqft: number
  lotSqft: number
  bedrooms: number
  bathrooms: number
  yearBuilt: number
  condition: Condition
  garage: GarageType
  hasPool: boolean
  hasBasement: boolean
  basementSqft: number
  hasFireplace: boolean
  stories: number
  purchasePrice: number   // 0 if unknown
  purchaseYear: number    // 0 if unknown
}

export interface Comp {
  id: string
  address: string
  sqft: number
  bedrooms: number
  bathrooms: number
  yearBuilt: number
  soldPrice: number
  soldDate: string        // ISO date
  pricePerSqft: number
  distance: number        // miles
  condition: Condition
  hasPool: boolean
  garage: GarageType
  adjustedPrice: number
}

export interface Adjustment {
  label: string
  amount: number
}

export interface ValuationResult {
  estimatedValue: number
  lowValue: number
  highValue: number
  confidenceScore: number   // 0-100
  pricePerSqft: number
  adjustments: Adjustment[]
  comps: Comp[]
  methodology: string
}

export interface MarketDataPoint {
  month: string
  medianPrice: number
  pricePerSqft: number
  daysOnMarket: number
  inventory: number
}

export interface RenovationItem {
  id: string
  name: string
  cost: number
  valueAdd: number
  roi: number
}

export interface InvestmentAnalysis {
  monthlyRent: number
  grossYield: number
  netYield: number
  capRate: number
  cashOnCash: number
  monthlyCashFlow: number
  breakEvenYears: number
  totalReturn5yr: number
}

export interface NeighborhoodScore {
  overall: number
  schools: number
  safety: number
  walkability: number
  transit: number
  amenities: number
}

export interface SavedProperty {
  id: string
  label: string
  input: PropertyInput
  result: ValuationResult
  savedAt: string
}
