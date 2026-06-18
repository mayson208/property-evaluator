import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  PropertyInput, ValuationResult, SavedProperty, RenovationItem,
} from '../types'
import { calculateValuation } from '../engine/valuation'

const DEFAULT_INPUT: PropertyInput = {
  address: '',
  city: '',
  state: 'TX',
  zip: '',
  propertyType: 'single_family',
  sqft: 0,
  lotSqft: 6000,
  bedrooms: 3,
  bathrooms: 2,
  yearBuilt: 2000,
  condition: 'average',
  garage: '2_car',
  hasPool: false,
  hasBasement: false,
  basementSqft: 0,
  hasFireplace: false,
  stories: 1,
  purchasePrice: 0,
  purchaseYear: 0,
}

const DEFAULT_RENOVATIONS: RenovationItem[] = [
  { id: 'kitchen',   name: 'Kitchen Remodel',      cost: 25000,  valueAdd: 35000,  roi: 40  },
  { id: 'bath',      name: 'Bathroom Update',       cost: 12000,  valueAdd: 16000,  roi: 33  },
  { id: 'roof',      name: 'Roof Replacement',      cost: 14000,  valueAdd: 17000,  roi: 21  },
  { id: 'hvac',      name: 'HVAC System',           cost: 8000,   valueAdd: 9500,   roi: 19  },
  { id: 'landscape', name: 'Landscaping / Curb',    cost: 6000,   valueAdd: 9000,   roi: 50  },
  { id: 'floors',    name: 'Hardwood Floors',       cost: 10000,  valueAdd: 14000,  roi: 40  },
  { id: 'windows',   name: 'Window Replacement',    cost: 9000,   valueAdd: 10800,  roi: 20  },
  { id: 'siding',    name: 'New Siding / Paint',    cost: 11000,  valueAdd: 14000,  roi: 27  },
  { id: 'addition',  name: 'Room Addition',         cost: 65000,  valueAdd: 55000,  roi: -15 },
  { id: 'solar',     name: 'Solar Panels',          cost: 20000,  valueAdd: 18000,  roi: -10 },
]

const DEMO_PROPERTIES: PropertyInput[] = [
  {
    address: '4821 Barton Creek Blvd', city: 'Austin', state: 'TX', zip: '78735',
    propertyType: 'single_family', sqft: 2400, lotSqft: 8500, bedrooms: 4, bathrooms: 2.5,
    yearBuilt: 2008, condition: 'good', garage: '2_car', hasPool: true, hasBasement: false,
    basementSqft: 0, hasFireplace: true, stories: 2, purchasePrice: 385000, purchaseYear: 2018,
  },
  {
    address: '2210 W Sunset Blvd', city: 'Los Angeles', state: 'CA', zip: '90026',
    propertyType: 'single_family', sqft: 1850, lotSqft: 6200, bedrooms: 3, bathrooms: 2,
    yearBuilt: 1965, condition: 'average', garage: '1_car', hasPool: false, hasBasement: false,
    basementSqft: 0, hasFireplace: true, stories: 1, purchasePrice: 780000, purchaseYear: 2020,
  },
  {
    address: '18 Harbor View Dr', city: 'Seattle', state: 'WA', zip: '98101',
    propertyType: 'condo', sqft: 1100, lotSqft: 0, bedrooms: 2, bathrooms: 2,
    yearBuilt: 2015, condition: 'excellent', garage: '1_car', hasPool: false, hasBasement: false,
    basementSqft: 0, hasFireplace: false, stories: 1, purchasePrice: 510000, purchaseYear: 2021,
  },
  {
    address: '543 Magnolia St', city: 'Nashville', state: 'TN', zip: '37203',
    propertyType: 'townhouse', sqft: 1750, lotSqft: 2200, bedrooms: 3, bathrooms: 2.5,
    yearBuilt: 2019, condition: 'excellent', garage: '1_car', hasPool: false, hasBasement: false,
    basementSqft: 0, hasFireplace: false, stories: 3, purchasePrice: 420000, purchaseYear: 2022,
  },
]

interface PropertyStore {
  // Input
  input: PropertyInput
  setInput: (patch: Partial<PropertyInput>) => void
  resetInput: () => void
  loadDemo: (index?: number) => void

  // Result
  result: ValuationResult | null
  isCalculating: boolean
  calculate: () => void

  // Renovations
  renovations: RenovationItem[]
  selectedRenovations: Set<string>
  toggleRenovation: (id: string) => void
  updateRenovation: (id: string, patch: Partial<RenovationItem>) => void

  // Investment
  monthlyRent: number
  setMonthlyRent: (v: number) => void
  downPaymentPct: number
  setDownPaymentPct: (v: number) => void
  interestRate: number
  setInterestRate: (v: number) => void

  // Saved properties
  savedProperties: SavedProperty[]
  saveProperty: (label: string) => void
  loadProperty: (id: string) => void
  deleteProperty: (id: string) => void
  exportJson: () => void
  importJson: (json: string) => void

  // Active tab
  activeTab: string
  setActiveTab: (tab: string) => void
}

export const usePropertyStore = create<PropertyStore>()(
  persist(
    (set, get) => ({
      input: DEFAULT_INPUT,
      result: null,
      isCalculating: false,
      renovations: DEFAULT_RENOVATIONS,
      selectedRenovations: new Set(),
      monthlyRent: 0,
      downPaymentPct: 20,
      interestRate: 7.25,
      savedProperties: [],
      activeTab: 'valuation',

      setInput: (patch) => set(s => ({ input: { ...s.input, ...patch } })),
      resetInput: () => set({ input: DEFAULT_INPUT, result: null }),
      loadDemo: (index) => {
        const i = index !== undefined ? index : Math.floor(Math.random() * DEMO_PROPERTIES.length)
        set({ input: DEMO_PROPERTIES[i], result: null })
        setTimeout(() => usePropertyStore.getState().calculate(), 50)
      },

      calculate: () => {
        const { input } = get()
        if (!input.sqft) return
        set({ isCalculating: true })
        setTimeout(() => {
          const result = calculateValuation(input)
          const rent = result.estimatedValue * 0.007 / 12 * 12
          set({
            result,
            isCalculating: false,
            monthlyRent: Math.round(result.estimatedValue * 0.007 / 100) * 100,
          })
        }, 600)
      },

      toggleRenovation: (id) => set(s => {
        const next = new Set(s.selectedRenovations)
        next.has(id) ? next.delete(id) : next.add(id)
        return { selectedRenovations: next }
      }),

      updateRenovation: (id, patch) => set(s => ({
        renovations: s.renovations.map(r => r.id === id ? { ...r, ...patch } : r),
      })),

      setMonthlyRent: (v) => set({ monthlyRent: v }),
      setDownPaymentPct: (v) => set({ downPaymentPct: v }),
      setInterestRate: (v) => set({ interestRate: v }),

      saveProperty: (label) => {
        const { input, result } = get()
        if (!result) return
        const entry: SavedProperty = {
          id: Date.now().toString(),
          label,
          input,
          result,
          savedAt: new Date().toISOString(),
        }
        set(s => ({ savedProperties: [entry, ...s.savedProperties].slice(0, 20) }))
      },

      loadProperty: (id) => {
        const { savedProperties } = get()
        const p = savedProperties.find(s => s.id === id)
        if (!p) return
        set({ input: p.input, result: p.result })
      },

      deleteProperty: (id) => set(s => ({
        savedProperties: s.savedProperties.filter(p => p.id !== id),
      })),

      exportJson: () => {
        const { savedProperties } = get()
        const blob = new Blob([JSON.stringify({ savedProperties, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' })
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement('a')
        a.href = url; a.download = 'propvalue-export.json'; a.click()
        URL.revokeObjectURL(url)
      },

      importJson: (json) => {
        try {
          const data = JSON.parse(json)
          if (!Array.isArray(data.savedProperties)) return
          set(s => ({
            savedProperties: [...data.savedProperties, ...s.savedProperties]
              .filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i)
              .slice(0, 20),
          }))
        } catch { /* ignore bad json */ }
      },

      setActiveTab: (tab) => set({ activeTab: tab }),
    }),
    {
      name: 'property-evaluator-store',
      partialize: (s) => ({
        savedProperties: s.savedProperties,
        input: s.input,
        downPaymentPct: s.downPaymentPct,
        interestRate: s.interestRate,
      }),
    },
  ),
)
