import { useState } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'
import { calculateValuation } from '../engine/valuation'
import type { PropertyInput, ValuationResult } from '../types'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

const BLANK: PropertyInput = {
  address: '', city: '', state: 'TX', zip: '',
  propertyType: 'single_family', sqft: 0, lotSqft: 6000,
  bedrooms: 3, bathrooms: 2, yearBuilt: 2000, condition: 'average',
  garage: '2_car', hasPool: false, hasBasement: false, basementSqft: 0,
  hasFireplace: false, stories: 1, purchasePrice: 0, purchaseYear: 0,
}

function QuickForm({
  label, input, onChange, onEval,
}: {
  label: string
  input: PropertyInput
  onChange: (p: Partial<PropertyInput>) => void
  onEval: () => void
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</h4>
      <input placeholder="Address" value={input.address} onChange={e => onChange({ address: e.target.value })}
        className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
      <div className="grid grid-cols-2 gap-2">
        <input type="number" placeholder="Sqft" value={input.sqft || ''} onChange={e => onChange({ sqft: Number(e.target.value) })}
          className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
        <input type="number" placeholder="Year built" value={input.yearBuilt || ''} onChange={e => onChange({ yearBuilt: Number(e.target.value) })}
          className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
        <input type="number" placeholder="Beds" value={input.bedrooms || ''} onChange={e => onChange({ bedrooms: Number(e.target.value) })}
          className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
        <input type="number" placeholder="Baths" step={0.5} value={input.bathrooms || ''} onChange={e => onChange({ bathrooms: Number(e.target.value) })}
          className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
        <select value={input.state} onChange={e => onChange({ state: e.target.value })}
          className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
          {['TX','CA','FL','NY','WA','CO','AZ','GA','NC','TN','VA','OH','PA','IL','MI'].map(s =>
            <option key={s} value={s}>{s}</option>
          )}
        </select>
        <select value={input.condition} onChange={e => onChange({ condition: e.target.value as any })}
          className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
          {['poor','fair','average','good','excellent'].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <button onClick={onEval} disabled={!input.sqft}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-bold py-2 rounded-xl transition">
        Estimate
      </button>
    </div>
  )
}

function ResultCol({ result, label, vs }: { result: ValuationResult; label: string; vs?: ValuationResult }) {
  const diff = vs ? result.estimatedValue - vs.estimatedValue : 0
  return (
    <div className="space-y-3">
      <div className="bg-blue-900/20 border border-blue-700/50 rounded-xl p-4 text-center">
        <p className="text-xs text-slate-400 mb-1">{label}</p>
        <p className="text-2xl font-black text-white">{fmt(result.estimatedValue)}</p>
        {vs && (
          <p className={`text-sm font-bold mt-1 ${diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {diff >= 0 ? '+' : ''}{fmt(diff)} vs other
          </p>
        )}
        <p className="text-xs text-slate-500 mt-1">${result.pricePerSqft}/sqft · {result.confidenceScore}% conf</p>
      </div>
    </div>
  )
}

export default function PropertyComparison() {
  const { result: mainResult, input: mainInput } = usePropertyStore()
  const [propA, setPropA] = useState<PropertyInput>({ ...BLANK })
  const [propB, setPropB] = useState<PropertyInput>({ ...BLANK })
  const [resultA, setResultA] = useState<ValuationResult | null>(null)
  const [resultB, setResultB] = useState<ValuationResult | null>(null)

  const evalA = () => setResultA(calculateValuation(propA))
  const evalB = () => setResultB(calculateValuation(propB))

  const ROWS = [
    { label: 'Est. Value',    fn: (r: ValuationResult) => fmt(r.estimatedValue) },
    { label: '$/sqft',        fn: (r: ValuationResult) => `$${r.pricePerSqft}` },
    { label: 'Range',         fn: (r: ValuationResult) => `${fmt(r.lowValue)} – ${fmt(r.highValue)}` },
    { label: 'Confidence',    fn: (r: ValuationResult) => `${r.confidenceScore}%` },
    { label: '# Comps',       fn: (r: ValuationResult) => r.comps.length },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Property Comparison</h3>
        <p className="text-xs text-slate-500">Compare two properties side-by-side</p>
      </div>

      {/* Inputs side by side */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <QuickForm label="Property A" input={propA} onChange={p => setPropA(s => ({ ...s, ...p }))} onEval={evalA} />
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <QuickForm label="Property B" input={propB} onChange={p => setPropB(s => ({ ...s, ...p }))} onEval={evalB} />
        </div>
      </div>

      {/* Results */}
      {(resultA || resultB) && (
        <>
          <div className="grid grid-cols-2 gap-4">
            {resultA && <ResultCol result={resultA} label="Property A" vs={resultB ?? undefined} />}
            {resultB && <ResultCol result={resultB} label="Property B" vs={resultA ?? undefined} />}
          </div>

          {/* Comparison table */}
          {resultA && resultB && (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 px-4 text-xs text-slate-400 uppercase tracking-widest">Metric</th>
                    <th className="text-right py-2 px-4 text-xs text-blue-400 uppercase tracking-widest">Property A</th>
                    <th className="text-right py-2 px-4 text-xs text-purple-400 uppercase tracking-widest">Property B</th>
                    <th className="text-right py-2 px-4 text-xs text-slate-400 uppercase tracking-widest">Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map(row => {
                    const vA = String(row.fn(resultA))
                    const vB = String(row.fn(resultB))
                    const numA = resultA.estimatedValue
                    const numB = resultB.estimatedValue
                    const isBetter = numA >= numB
                    return (
                      <tr key={row.label} className="border-b border-slate-700/50">
                        <td className="py-2 px-4 text-slate-400">{row.label}</td>
                        <td className={`py-2 px-4 text-right font-semibold ${isBetter ? 'text-green-400' : 'text-slate-200'}`}>{vA}</td>
                        <td className={`py-2 px-4 text-right font-semibold ${!isBetter ? 'text-green-400' : 'text-slate-200'}`}>{vB}</td>
                        <td className="py-2 px-4 text-right text-slate-500 text-xs">
                          {row.label === 'Est. Value' ? (
                            <span className={resultA.estimatedValue > resultB.estimatedValue ? 'text-blue-400' : 'text-purple-400'}>
                              {resultA.estimatedValue > resultB.estimatedValue ? 'A +' : 'B +'}{fmt(Math.abs(resultA.estimatedValue - resultB.estimatedValue))}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    )
                  })}

                  {/* Per-attr comparison */}
                  {[
                    ['Sqft',     propA.sqft.toLocaleString(),    propB.sqft.toLocaleString(),    propA.sqft > propB.sqft ? 'A' : 'B'],
                    ['Beds',     propA.bedrooms,                  propB.bedrooms,                  propA.bedrooms > propB.bedrooms ? 'A' : 'B'],
                    ['Baths',    propA.bathrooms,                 propB.bathrooms,                 propA.bathrooms > propB.bathrooms ? 'A' : 'B'],
                    ['Year',     propA.yearBuilt,                 propB.yearBuilt,                 propA.yearBuilt > propB.yearBuilt ? 'A' : 'B'],
                    ['Condition',propA.condition,                  propB.condition,                  '—'],
                  ].map(([l, vA, vB, better]) => (
                    <tr key={String(l)} className="border-b border-slate-700/50">
                      <td className="py-2 px-4 text-slate-400">{l}</td>
                      <td className={`py-2 px-4 text-right font-semibold ${better === 'A' ? 'text-green-400' : 'text-slate-200'}`}>{String(vA)}</td>
                      <td className={`py-2 px-4 text-right font-semibold ${better === 'B' ? 'text-green-400' : 'text-slate-200'}`}>{String(vB)}</td>
                      <td className="py-2 px-4 text-right text-slate-500 text-xs">—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Also compare against current main property */}
      {mainResult && (
        <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Your Current Property (from form)</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-300">{mainInput.address || `${mainInput.bedrooms}bd/${mainInput.bathrooms}ba`}</p>
              <p className="text-xs text-slate-500">{mainInput.sqft.toLocaleString()} sqft · {mainInput.state}</p>
            </div>
            <p className="text-lg font-black text-blue-400">{fmt(mainResult.estimatedValue)}</p>
          </div>
        </div>
      )}
    </div>
  )
}
