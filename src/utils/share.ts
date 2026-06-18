import type { PropertyInput } from '../types'

export function encodeProperty(input: PropertyInput): string {
  const compact = {
    a: input.address,
    c: input.city,
    s: input.state,
    z: input.zip,
    t: input.propertyType,
    sq: input.sqft,
    ls: input.lotSqft,
    b: input.bedrooms,
    ba: input.bathrooms,
    y: input.yearBuilt,
    co: input.condition,
    g: input.garage,
    p: input.hasPool ? 1 : 0,
    bm: input.hasBasement ? 1 : 0,
    bs: input.basementSqft,
    f: input.hasFireplace ? 1 : 0,
    st: input.stories,
    pp: input.purchasePrice,
    py: input.purchaseYear,
  }
  return btoa(JSON.stringify(compact))
}

export function decodeProperty(encoded: string): PropertyInput | null {
  try {
    const c = JSON.parse(atob(encoded))
    return {
      address: c.a ?? '',
      city: c.c ?? '',
      state: c.s ?? 'TX',
      zip: c.z ?? '',
      propertyType: c.t ?? 'single_family',
      sqft: c.sq ?? 0,
      lotSqft: c.ls ?? 6000,
      bedrooms: c.b ?? 3,
      bathrooms: c.ba ?? 2,
      yearBuilt: c.y ?? 2000,
      condition: c.co ?? 'average',
      garage: c.g ?? '2_car',
      hasPool: c.p === 1,
      hasBasement: c.bm === 1,
      basementSqft: c.bs ?? 0,
      hasFireplace: c.f === 1,
      stories: c.st ?? 1,
      purchasePrice: c.pp ?? 0,
      purchaseYear: c.py ?? 0,
    }
  } catch {
    return null
  }
}

export function buildShareUrl(input: PropertyInput): string {
  const encoded = encodeProperty(input)
  const url = new URL(window.location.href)
  url.searchParams.set('p', encoded)
  return url.toString()
}
