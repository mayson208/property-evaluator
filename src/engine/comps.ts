import type { Comp, PropertyInput, Condition, GarageType } from '../types'

const CONDITIONS: Condition[] = ['poor', 'fair', 'average', 'good', 'excellent']
const GARAGES: GarageType[] = ['none', 'carport', '1_car', '2_car', '3_car']

const CONDITION_ADJ: Record<Condition, number> = {
  poor: -0.18, fair: -0.09, average: 0, good: 0.07, excellent: 0.14,
}

const GARAGE_ADJ: Record<GarageType, number> = {
  none: 0, carport: 4000, '1_car': 15000, '2_car': 28000, '3_car': 42000,
}

// Seeded PRNG — mulberry32. Same seed → same sequence every time.
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = seed + 0x6d2b79f5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

function makeSeed(input: PropertyInput): number {
  return (
    input.sqft * 7 +
    input.bedrooms * 31 +
    Math.round(input.bathrooms * 10) * 97 +
    input.yearBuilt +
    input.state.charCodeAt(0) * 13 +
    (input.zip ? parseInt(input.zip.replace(/\D/g, '') || '0') % 997 : 0)
  )
}

function monthsAgo(n: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  return d.toISOString().slice(0, 10)
}

const STREET_NAMES = [
  'Oak St', 'Maple Ave', 'Cedar Ln', 'Elm Dr', 'Pine Rd', 'Willow Way',
  'Birch Ct', 'Ash Blvd', 'Cherry St', 'Walnut Ave', 'Spruce Ln',
  'Hickory Dr', 'Poplar Rd', 'Sycamore Way', 'Magnolia Ct',
]

export function generateComps(input: PropertyInput, basePPF: number): Comp[] {
  const rand = mulberry32(makeSeed(input))
  const between = (min: number, max: number) => rand() * (max - min) + min
  const randInt  = (min: number, max: number) => Math.floor(between(min, max + 1))

  const comps: Comp[] = []

  for (let i = 0; i < 5; i++) {
    const sqftVariance = between(0.82, 1.18)
    const sqft = Math.round(input.sqft * sqftVariance / 50) * 50

    const ppfVariance = between(0.88, 1.12)
    const ppf = basePPF * ppfVariance

    const beds   = Math.max(1, input.bedrooms + randInt(-1, 1))
    const baths  = Math.max(1, input.bathrooms + between(-0.5, 0.5))
    const yearBuilt = input.yearBuilt + randInt(-8, 8)
    const soldPrice = Math.round(sqft * ppf / 1000) * 1000
    const distance  = between(0.1, 1.2)

    const condIndex     = CONDITIONS.indexOf(input.condition)
    const compCondIndex = Math.max(0, Math.min(4, condIndex + randInt(-1, 1)))
    const condition     = CONDITIONS[compCondIndex]

    const hasPool    = rand() < 0.25
    const garageIndex     = GARAGES.indexOf(input.garage)
    const compGarageIndex = Math.max(0, Math.min(4, garageIndex + randInt(-1, 1)))
    const garage     = GARAGES[compGarageIndex]

    const streetNum  = randInt(100, 9999)
    const streetName = STREET_NAMES[randInt(0, STREET_NAMES.length - 1)]

    let adjustedPrice = soldPrice
    adjustedPrice += (input.sqft - sqft) * basePPF * 0.9
    const condDiff = CONDITION_ADJ[input.condition] - CONDITION_ADJ[condition]
    adjustedPrice *= 1 + condDiff
    if (input.hasPool && !hasPool) adjustedPrice += basePPF > 300 ? 45000 : 28000
    if (!input.hasPool && hasPool) adjustedPrice -= basePPF > 300 ? 45000 : 28000
    adjustedPrice += GARAGE_ADJ[input.garage] - GARAGE_ADJ[garage]
    adjustedPrice += (input.bedrooms - beds) * basePPF * 110
    adjustedPrice += (input.bathrooms - baths) * basePPF * 80

    comps.push({
      id: `comp_${i}`,
      address: `${streetNum} ${streetName}`,
      sqft,
      bedrooms: beds,
      bathrooms: Math.round(baths * 2) / 2,
      yearBuilt: Math.max(1900, yearBuilt),
      soldPrice: Math.round(soldPrice / 1000) * 1000,
      soldDate: monthsAgo(randInt(1, 12)),
      pricePerSqft: Math.round(ppf),
      distance: Math.round(distance * 10) / 10,
      condition,
      hasPool,
      garage,
      adjustedPrice: Math.round(adjustedPrice / 1000) * 1000,
    })
  }

  return comps.sort((a, b) => a.distance - b.distance)
}
