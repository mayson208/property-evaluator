import { useState } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'
import { calculateValuation } from '../engine/valuation'
import type { PropertyInput, ValuationResult } from '../types'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
]

const BLANK: PropertyInput = {
  address: '', city: '', state: 'TX', zip: '',
  propertyType: 'single_family', sqft: 0, lotSqft: 6000,
  bedrooms: 3, bathrooms: 2, yearBuilt: 2000, condition: 'average',
  garage: '2_car', hasPool: false, hasBasement: false, basementSqft: 0,
  hasFireplace: false, stories: 1, purchasePrice: 0, purchaseYear: 0,
}

const fieldCls = 'w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500'

function QuickForm({
  label, input, onChange, onEval, onLoadSaved, savedLabels, accentColor,
}: {
  label: string
  input: PropertyInput
  onChange: (p: Partial<PropertyInput>) => void
  onEval: () => void
  onLoadSaved: (i: PropertyInput) => void
  savedLabels: { label: string; input: PropertyInput }[]
  accentColor: string
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className={`text-xs font-bold uppercase tracking-widest ${accentColor}`}>{label}</h4>
        {savedLabels.length > 0 && (
          <select
            onChange={e => {
              if (!e.target.value) return
              const found = savedLabels[Number(e.target.value)]
              if (found) onLoadSaved(found.input)
              e.target.value = ''
            }}
            className="text-xs bg-slate-800 border border-slate-700 text-slate-400 rounded px-2 py-1 focus:outline-none"
          >
            <option value="">Load saved…</option>
            {savedLabels.map((s, i) => <option key={i} value={i}>{s.label.slice(0, 30)}</option>)}
          </select>
        )}
      </div>
      <input placeholder="Address (optional)" value={input.address} onChange={e => onChange({ address: e.target.value })}
        className={fieldCls} />
      <div className="grid grid-cols-2 gap-2">
        <input type="number" placeholder="Sqft *" value={input.sqft || ''} onChange={e => onChange({ sqft: Number(e.target.value) })}
          className={fieldCls} />
        <input type="number" placeholder="Year built" value={input.yearBuilt || ''} onChange={e => onChange({ yearBuilt: Number(e.target.value) })}
          className={fieldCls} />
        <input type="number" placeholder="Beds" value={input.bedrooms || ''} onChange={e => onChange({ bedrooms: Number(e.target.value) })}
          className={fieldCls} />
        <input type="number" placeholder="Baths" step={0.5} value={input.bathrooms || ''} onChange={e => onChange({ bathrooms: Number(e.target.value) })}
          className={fieldCls} />
        <select value={input.state} onChange={e => onChange({ state: e.target.value })} className={fieldCls}>
          {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={input.condition} onChange={e => onChange({ condition: e.target.value as any })} className={fieldCls}>
          {['poor','fair','average','good','excellent'].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={input.garage} onChange={e => onChange({ garage: e.target.value as any })} className={`${fieldCls} col-span-2`}>
          <option value="none">No Garage</option>
          <option value="carport">Carport</option>
          <option value="1_car">1-Car</option>
          <option value="2_car">2-Car</option>
          <option value="3_car">3-Car</option>
        </select>
      </div>
      <div className="flex gap-3 text-xs">
        {[['Pool', 'hasPool'], ['Basement', 'hasBasement'], ['Fireplace', 'hasFireplace']].map(([l, k]) => (
          <label key={k} className="flex items-center gap-1.5 cursor-pointer text-slate-400">
            <input type="checkbox" checked={!!(input as any)[k]} onChange={e => onChange({ [k]: e.target.checked })}
              className="w-3 h-3 accent-blue-500" />
            {l}
          </label>
        ))}
      </div>
      <button onClick={onEval} disabled={!input.sqft}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-bold py-2 rounded-xl transition">
        Estimate
      </button>
    </div>
  )
}

type MetricRow = {
  label: string
  fnA: (r: ValuationResult, i: PropertyInput) => string | number
  fnB: (r: ValuationResult, i: PropertyInput) => string | number
  winner: (rA: ValuationResult, pA: PropertyInput, rB: ValuationResult, pB: PropertyInput) => 'A' | 'B' | 'tie'
}

const COMPARISON_ROWS: MetricRow[] = [
  { label: 'Est. Value',     fnA: r => fmt(r.estimatedValue),       fnB: r => fmt(r.estimatedValue),        winner: (rA,_,rB) => rA.estimatedValue > rB.estimatedValue ? 'A' : rA.estimatedValue < rB.estimatedValue ? 'B' : 'tie' },
  { label: '$/sqft',         fnA: r => `$${r.pricePerSqft}`,        fnB: r => `$${r.pricePerSqft}`,         winner: (rA,_,rB) => rA.pricePerSqft > rB.pricePerSqft ? 'A' : rA.pricePerSqft < rB.pricePerSqft ? 'B' : 'tie' },
  { label: 'Value Range',    fnA: r => `${fmt(r.lowValue)}–${fmt(r.highValue)}`, fnB: r => `${fmt(r.lowValue)}–${fmt(r.highValue)}`, winner: () => 'tie' },
  { label: 'Confidence',     fnA: r => `${r.confidenceScore}%`,     fnB: r => `${r.confidenceScore}%`,      winner: (rA,_,rB) => rA.confidenceScore > rB.confidenceScore ? 'A' : rA.confidenceScore < rB.confidenceScore ? 'B' : 'tie' },
  { label: 'Sqft',           fnA: (_,p) => p.sqft.toLocaleString(), fnB: (_,p) => p.sqft.toLocaleString(), winner: (_,pA,__,pB) => pA.sqft > pB.sqft ? 'A' : pA.sqft < pB.sqft ? 'B' : 'tie' },
  { label: 'Bed / Bath',     fnA: (_,p) => `${p.bedrooms}/${p.bathrooms}`, fnB: (_,p) => `${p.bedrooms}/${p.bathrooms}`, winner: (_,pA,__,pB) => (pA.bedrooms + pA.bathrooms) > (pB.bedrooms + pB.bathrooms) ? 'A' : 'B' },
  { label: 'Year Built',     fnA: (_,p) => p.yearBuilt,             fnB: (_,p) => p.yearBuilt,              winner: (_,pA,__,pB) => pA.yearBuilt > pB.yearBuilt ? 'A' : pA.yearBuilt < pB.yearBuilt ? 'B' : 'tie' },
  { label: 'Condition',      fnA: (_,p) => p.condition,             fnB: (_,p) => p.condition,              winner: (_,pA,__,pB) => { const o = ['poor','fair','average','good','excellent']; return o.indexOf(pA.condition) > o.indexOf(pB.condition) ? 'A' : o.indexOf(pA.condition) < o.indexOf(pB.condition) ? 'B' : 'tie' }},
  { label: 'Garage',         fnA: (_,p) => p.garage.replace('_',' '), fnB: (_,p) => p.garage.replace('_',' '), winner: (_,pA,__,pB) => { const o = ['none','carport','1_car','2_car','3_car']; return o.indexOf(pA.garage) > o.indexOf(pB.garage) ? 'A' : o.indexOf(pA.garage) < o.indexOf(pB.garage) ? 'B' : 'tie' }},
  { label: 'Pool',           fnA: (_,p) => p.hasPool ? 'Yes' : 'No', fnB: (_,p) => p.hasPool ? 'Yes' : 'No', winner: (_,pA,__,pB) => pA.hasPool && !pB.hasPool ? 'A' : !pA.hasPool && pB.hasPool ? 'B' : 'tie' },
]

export default function PropertyComparison() {
  const { result: mainResult, input: mainInput, savedProperties } = usePropertyStore()
  const [propA, setPropA] = useState<PropertyInput>({ ...BLANK })
  const [propB, setPropB] = useState<PropertyInput>({ ...BLANK })
  const [resultA, setResultA] = useState<ValuationResult | null>(null)
  const [resultB, setResultB] = useState<ValuationResult | null>(null)

  const evalA = () => { if (propA.sqft) setResultA(calculateValuation(propA)) }
  const evalB = () => { if (propB.sqft) setResultB(calculateValuation(propB)) }

  const savedLabels = savedProperties.map(s => ({ label: s.label, input: s.input }))

  const winsA = resultA && resultB
    ? COMPARISON_ROWS.filter(r => r.winner(resultA, propA, resultB, propB) === 'A').length
    : 0
  const winsB = resultA && resultB
    ? COMPARISON_ROWS.filter(r => r.winner(resultA, propA, resultB, propB) === 'B').length
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Property Comparison</h3>
        <p className="text-xs text-slate-500">Enter two properties to compare side-by-side — or load from saved</p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <QuickForm label="Property A" accentColor="text-blue-400"
            input={propA} onChange={p => setPropA(s => ({ ...s, ...p }))} onEval={evalA}
            onLoadSaved={i => { setPropA(i); setResultA(calculateValuation(i)) }}
            savedLabels={savedLabels} />
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <QuickForm label="Property B" accentColor="text-purple-400"
            input={propB} onChange={p => setPropB(s => ({ ...s, ...p }))} onEval={evalB}
            onLoadSaved={i => { setPropB(i); setResultB(calculateValuation(i)) }}
            savedLabels={savedLabels} />
        </div>
      </div>

      {/* Hero values */}
      {(resultA || resultB) && (
        <div className="grid grid-cols-2 gap-4">
          <div className={`rounded-xl p-4 text-center border ${resultA ? 'bg-blue-900/20 border-blue-700/50' : 'bg-slate-800/30 border-slate-700'}`}>
            <p className="text-xs text-blue-400 font-bold uppercase tracking-widest mb-1">Property A</p>
            {resultA ? (
              <>
                <p className="text-2xl font-black text-white">{fmt(resultA.estimatedValue)}</p>
                <p className="text-xs text-slate-400 mt-1">${resultA.pricePerSqft}/sqft · {resultA.confidenceScore}% conf</p>
                {resultB && <p className={`text-sm font-bold mt-1 ${resultA.estimatedValue >= resultB.estimatedValue ? 'text-green-400' : 'text-red-400'}`}>
                  {resultA.estimatedValue >= resultB.estimatedValue ? `+${fmt(resultA.estimatedValue - resultB.estimatedValue)}` : `-${fmt(resultB.estimatedValue - resultA.estimatedValue)}`} vs B
                </p>}
              </>
            ) : <p className="text-slate-500 text-sm">Estimate to compare</p>}
          </div>
          <div className={`rounded-xl p-4 text-center border ${resultB ? 'bg-purple-900/20 border-purple-700/50' : 'bg-slate-800/30 border-slate-700'}`}>
            <p className="text-xs text-purple-400 font-bold uppercase tracking-widest mb-1">Property B</p>
            {resultB ? (
              <>
                <p className="text-2xl font-black text-white">{fmt(resultB.estimatedValue)}</p>
                <p className="text-xs text-slate-400 mt-1">${resultB.pricePerSqft}/sqft · {resultB.confidenceScore}% conf</p>
                {resultA && <p className={`text-sm font-bold mt-1 ${resultB.estimatedValue >= resultA.estimatedValue ? 'text-green-400' : 'text-red-400'}`}>
                  {resultB.estimatedValue >= resultA.estimatedValue ? `+${fmt(resultB.estimatedValue - resultA.estimatedValue)}` : `-${fmt(resultA.estimatedValue - resultB.estimatedValue)}`} vs A
                </p>}
              </>
            ) : <p className="text-slate-500 text-sm">Estimate to compare</p>}
          </div>
        </div>
      )}

      {/* Winner banner */}
      {resultA && resultB && (
        <div className={`rounded-xl p-4 text-center border ${
          winsA > winsB ? 'bg-blue-900/20 border-blue-700/50' :
          winsB > winsA ? 'bg-purple-900/20 border-purple-700/50' :
          'bg-slate-800/50 border-slate-700'
        }`}>
          <p className="text-sm font-bold text-white">
            {winsA > winsB ? `Property A wins ${winsA}–${winsB} across all metrics` :
             winsB > winsA ? `Property B wins ${winsB}–${winsA} across all metrics` :
             `Tied ${winsA}–${winsB} — a close comparison`}
          </p>
        </div>
      )}

      {/* Full comparison table */}
      {resultA && resultB && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          <div className="grid grid-cols-[1fr_1fr_1fr_60px] bg-slate-800 px-4 py-2 gap-2">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest">Metric</p>
            <p className="text-xs text-blue-400 font-semibold uppercase tracking-widest text-right">A</p>
            <p className="text-xs text-purple-400 font-semibold uppercase tracking-widest text-right">B</p>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest text-center">Winner</p>
          </div>
          {COMPARISON_ROWS.map(row => {
            const w = row.winner(resultA, propA, resultB, propB)
            return (
              <div key={row.label} className="grid grid-cols-[1fr_1fr_1fr_60px] px-4 py-2.5 gap-2 border-t border-slate-700/50 text-sm">
                <span className="text-slate-400">{row.label}</span>
                <span className={`text-right font-semibold ${w === 'A' ? 'text-green-400' : 'text-slate-200'}`}>
                  {String(row.fnA(resultA, propA))}
                </span>
                <span className={`text-right font-semibold ${w === 'B' ? 'text-green-400' : 'text-slate-200'}`}>
                  {String(row.fnB(resultB, propB))}
                </span>
                <span className="text-center text-xs font-bold">
                  {w === 'A' ? <span className="text-blue-400">A</span> :
                   w === 'B' ? <span className="text-purple-400">B</span> :
                   <span className="text-slate-600">—</span>}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Current property */}
      {mainResult && (
        <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Your Current Property (from main form)</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-300">{mainInput.address || `${mainInput.bedrooms}bd/${mainInput.bathrooms}ba`}</p>
              <p className="text-xs text-slate-500">{mainInput.sqft.toLocaleString()} sqft · {mainInput.state} · {mainInput.condition}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-blue-400">{fmt(mainResult.estimatedValue)}</p>
              <button onClick={() => { setPropA({ ...mainInput }); setResultA(mainResult) }}
                className="text-xs text-blue-400 hover:text-blue-300 underline mt-1">
                Use as A
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
