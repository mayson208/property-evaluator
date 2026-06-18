import { usePropertyStore } from '../store/usePropertyStore'
import type { Condition, GarageType, PropertyType } from '../types'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
]

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{children}</label>
}

function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition ${className}`}
    />
  )
}

function Select({ children, className = '', ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select
      {...props}
      className={`w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition ${className}`}
    >
      {children}
    </select>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition ${
        checked
          ? 'bg-blue-600 border-blue-500 text-white'
          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
      }`}
    >
      <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${checked ? 'bg-white border-white' : 'border-slate-500'}`}>
        {checked && <span className="block w-2 h-2 bg-blue-600 rounded-sm" />}
      </span>
      {label}
    </button>
  )
}

export default function PropertyForm() {
  const { input, setInput, calculate, isCalculating, resetInput, loadDemo } = usePropertyStore()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    calculate()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Location */}
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-3 flex items-center gap-2">
          <span className="w-5 h-5 bg-blue-600 rounded text-white text-xs flex items-center justify-center">1</span>
          Location
        </h3>
        <div className="space-y-3">
          <div>
            <Label>Street Address</Label>
            <Input
              placeholder="123 Main St"
              value={input.address}
              onChange={e => setInput({ address: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <Label>City</Label>
              <Input
                placeholder="Austin"
                value={input.city}
                onChange={e => setInput({ city: e.target.value })}
              />
            </div>
            <div>
              <Label>State</Label>
              <Select value={input.state} onChange={e => setInput({ state: e.target.value })}>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <div>
              <Label>ZIP</Label>
              <Input
                placeholder="78701"
                value={input.zip}
                maxLength={5}
                onChange={e => setInput({ zip: e.target.value.replace(/\D/g, '') })}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Property Details */}
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-3 flex items-center gap-2">
          <span className="w-5 h-5 bg-blue-600 rounded text-white text-xs flex items-center justify-center">2</span>
          Property Details
        </h3>
        <div className="space-y-3">
          <div>
            <Label>Property Type</Label>
            <Select
              value={input.propertyType}
              onChange={e => setInput({ propertyType: e.target.value as PropertyType })}
            >
              <option value="single_family">Single Family Home</option>
              <option value="condo">Condominium</option>
              <option value="townhouse">Townhouse</option>
              <option value="multi_family">Multi-Family (2-4 units)</option>
              <option value="land">Vacant Land</option>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Living Area (sqft)</Label>
              <Input
                type="number"
                placeholder="2000"
                min={100}
                value={input.sqft || ''}
                onChange={e => setInput({ sqft: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Lot Size (sqft)</Label>
              <Input
                type="number"
                placeholder="6000"
                min={0}
                value={input.lotSqft || ''}
                onChange={e => setInput({ lotSqft: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Bedrooms</Label>
              <Input
                type="number"
                min={0}
                max={20}
                value={input.bedrooms || ''}
                onChange={e => setInput({ bedrooms: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Bathrooms</Label>
              <Input
                type="number"
                min={0}
                max={20}
                step={0.5}
                value={input.bathrooms || ''}
                onChange={e => setInput({ bathrooms: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Stories</Label>
              <Input
                type="number"
                min={1}
                max={5}
                value={input.stories || ''}
                onChange={e => setInput({ stories: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Year Built</Label>
              <Input
                type="number"
                placeholder="2000"
                min={1800}
                max={new Date().getFullYear()}
                value={input.yearBuilt || ''}
                onChange={e => setInput({ yearBuilt: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Condition</Label>
              <Select value={input.condition} onChange={e => setInput({ condition: e.target.value as Condition })}>
                <option value="poor">Poor</option>
                <option value="fair">Fair</option>
                <option value="average">Average</option>
                <option value="good">Good</option>
                <option value="excellent">Excellent</option>
              </Select>
            </div>
          </div>

          <div>
            <Label>Garage</Label>
            <Select value={input.garage} onChange={e => setInput({ garage: e.target.value as GarageType })}>
              <option value="none">No Garage</option>
              <option value="carport">Carport</option>
              <option value="1_car">1-Car Garage</option>
              <option value="2_car">2-Car Garage</option>
              <option value="3_car">3-Car Garage</option>
            </Select>
          </div>
        </div>
      </div>

      {/* Features */}
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-3 flex items-center gap-2">
          <span className="w-5 h-5 bg-blue-600 rounded text-white text-xs flex items-center justify-center">3</span>
          Features
        </h3>
        <div className="flex flex-wrap gap-2">
          <Toggle checked={input.hasPool} onChange={v => setInput({ hasPool: v })} label="Pool" />
          <Toggle checked={input.hasFireplace} onChange={v => setInput({ hasFireplace: v })} label="Fireplace" />
          <Toggle checked={input.hasBasement} onChange={v => setInput({ hasBasement: v })} label="Basement" />
        </div>
        {input.hasBasement && (
          <div className="mt-2">
            <Label>Basement Area (sqft)</Label>
            <Input
              type="number"
              placeholder="800"
              value={input.basementSqft || ''}
              onChange={e => setInput({ basementSqft: Number(e.target.value) })}
            />
          </div>
        )}
      </div>

      {/* Purchase Info */}
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-3 flex items-center gap-2">
          <span className="w-5 h-5 bg-slate-600 rounded text-white text-xs flex items-center justify-center">4</span>
          Purchase Info <span className="text-slate-500 normal-case font-normal">(optional)</span>
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Purchase Price ($)</Label>
            <Input
              type="number"
              placeholder="350000"
              value={input.purchasePrice || ''}
              onChange={e => setInput({ purchasePrice: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Purchase Year</Label>
            <Input
              type="number"
              placeholder="2018"
              min={1900}
              max={new Date().getFullYear()}
              value={input.purchaseYear || ''}
              onChange={e => setInput({ purchaseYear: Number(e.target.value) })}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2 pt-2">
        <button
          type="submit"
          disabled={!input.sqft || isCalculating}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
        >
          {isCalculating ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Analyzing…
            </>
          ) : '🏠 Estimate Value'}
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => loadDemo()}
            className="flex-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl transition text-xs font-semibold"
          >
            ✨ Load Demo
          </button>
          <button
            type="button"
            onClick={resetInput}
            className="flex-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-500 rounded-xl transition text-xs font-semibold"
          >
            Reset
          </button>
        </div>
      </div>
    </form>
  )
}
