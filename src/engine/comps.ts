import type { Comp, PropertyInput, Condition, GarageType } from '../types'

const CONDITIONS: Condition[] = ['poor', 'fair', 'average', 'good', 'excellent']
const GARAGES: GarageType[] = ['none', 'carport', '1_car', '2_car', '3_car']

const CONDITION_ADJ: Record<Condition, number> = {
  poor: -0.18, fair: -0.09, average: 0, good: 0.07, excellent: 0.14,
}

const GARAGE_ADJ: Record<GarageType, number> = {
  none: 0, carport: 4000, '1_car': 15000, '2_car': 28000, '3_car': 42000,
}

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomBetween(min, max + 1))
}

function monthsAgo(n: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  return d.toISOString().slice(0, 10)
}

function streetNames(): string {
  const streets = [
    'Oak St', 'Maple Ave', 'Cedar Ln', 'Elm Dr', 'Pine Rd', 'Willow Way',
    'Birch Ct', 'Ash Blvd', 'Cherry St', 'Walnut Ave', 'Spruce Ln',
    'Hickory Dr', 'Poplar Rd', 'Sycamore Way', 'Magnolia Ct',
  ]
  return `${randomInt(100, 9999)} ${streets[randomInt(0, streets.length - 1)]}`
}

export function generateComps(input: PropertyInput, basePPF: number): Comp[] {
  // Seed with input so comps are stable across re-renders for same property
  const comps: Comp[] = []
  const count = 5

  for (let i = 0; i < count; i++) {
    const sqftVariance = randomBetween(0.82, 1.18)
    const sqft = Math.round(input.sqft * sqftVariance / 50) * 50

    const ppfVariance = randomBetween(0.88, 1.12)
    const ppf = basePPF * ppfVariance

    const beds = Math.max(1, input.bedrooms + randomInt(-1, 1))
    const baths = Math.max(1, input.bathrooms + randomBetween(-0.5, 0.5))
    const yearBuilt = input.yearBuilt + randomInt(-8, 8)
    const soldPrice = Math.round(sqft * ppf / 1000) * 1000
    const distance = randomBetween(0.1, 1.2)

    const condIndex = CONDITIONS.indexOf(input.condition)
    const compCondIndex = Math.max(0, Math.min(4, condIndex + randomInt(-1, 1)))
    const condition = CONDITIONS[compCondIndex]

    const hasPool = Math.random() < 0.25
    const garageIndex = GARAGES.indexOf(input.garage)
    const compGarageIndex = Math.max(0, Math.min(4, garageIndex + randomInt(-1, 1)))
    const garage = GARAGES[compGarageIndex]

    // Calculate adjustments to make comp comparable to subject
    let adjustedPrice = soldPrice
    // Sqft difference
    adjustedPrice += (input.sqft - sqft) * basePPF * 0.9
    // Condition difference
    const condDiff = CONDITION_ADJ[input.condition] - CONDITION_ADJ[condition]
    adjustedPrice *= 1 + condDiff
    // Pool adjustment
    if (input.hasPool && !hasPool) adjustedPrice += basePPF > 300 ? 45000 : 28000
    if (!input.hasPool && hasPool) adjustedPrice -= basePPF > 300 ? 45000 : 28000
    // Garage adjustment
    adjustedPrice += GARAGE_ADJ[input.garage] - GARAGE_ADJ[garage]
    // Bedroom adjustment
    adjustedPrice += (input.bedrooms - beds) * basePPF * 110
    // Bathroom adjustment
    adjustedPrice += (input.bathrooms - baths) * basePPF * 80

    comps.push({
      id: `comp_${i}`,
      address: streetNames(),
      sqft,
      bedrooms: beds,
      bathrooms: Math.round(baths * 2) / 2,
      yearBuilt: Math.max(1900, yearBuilt),
      soldPrice: Math.round(soldPrice / 1000) * 1000,
      soldDate: monthsAgo(randomInt(1, 12)),
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
