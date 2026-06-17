import { usePropertyStore } from '../store/usePropertyStore'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function badge(condition: string) {
  const colors: Record<string, string> = {
    poor: 'bg-red-900/50 text-red-300',
    fair: 'bg-orange-900/50 text-orange-300',
    average: 'bg-slate-700 text-slate-300',
    good: 'bg-green-900/50 text-green-300',
    excellent: 'bg-emerald-900/50 text-emerald-300',
  }
  return colors[condition] ?? 'bg-slate-700 text-slate-300'
}

export default function CompsTable() {
  const { result, input } = usePropertyStore()

  if (!result || result.comps.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p className="text-4xl mb-3">🏘</p>
        <p>Run a valuation to see comparable sales</p>
      </div>
    )
  }

  const subjectPPF = result.pricePerSqft

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 uppercase tracking-widest">
        {result.comps.length} comparable sales within 1.2 miles • sorted by distance
      </p>

      {/* Subject property row */}
      <div className="bg-blue-900/20 border border-blue-700/50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold bg-blue-600 text-white px-2 py-0.5 rounded">SUBJECT</span>
          <span className="text-sm text-slate-300 font-medium">{input.address || 'Subject Property'}</span>
        </div>
        <div className="grid grid-cols-5 gap-3 text-sm">
          <div><p className="text-xs text-slate-500">Est. Value</p><p className="font-bold text-blue-400">{fmt(result.estimatedValue)}</p></div>
          <div><p className="text-xs text-slate-500">Sqft</p><p className="font-bold text-slate-200">{input.sqft.toLocaleString()}</p></div>
          <div><p className="text-xs text-slate-500">Bed/Bath</p><p className="font-bold text-slate-200">{input.bedrooms}/{input.bathrooms}</p></div>
          <div><p className="text-xs text-slate-500">$/sqft</p><p className="font-bold text-slate-200">${subjectPPF}</p></div>
          <div><p className="text-xs text-slate-500">Condition</p><p className={`text-xs font-bold px-2 py-0.5 rounded inline-block ${badge(input.condition)}`}>{input.condition}</p></div>
        </div>
      </div>

      {/* Comp rows */}
      {result.comps.map((comp, i) => {
        const priceDiff = comp.adjustedPrice - result.estimatedValue
        const pctDiff = (priceDiff / result.estimatedValue) * 100

        return (
          <div key={comp.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-mono">#{i + 1}</span>
                <span className="text-sm text-slate-200 font-medium">{comp.address}</span>
                <span className="text-xs text-slate-500">{comp.distance} mi</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Sold {comp.soldDate}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${pctDiff >= 0 ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
                  {pctDiff >= 0 ? '+' : ''}{pctDiff.toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-500">Sale Price</p>
                <p className="font-semibold text-slate-200">{fmt(comp.soldPrice)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Sqft</p>
                <p className="font-semibold text-slate-200">{comp.sqft.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Bed/Bath</p>
                <p className="font-semibold text-slate-200">{comp.bedrooms}/{comp.bathrooms}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">$/sqft</p>
                <p className="font-semibold text-slate-200">${comp.pricePerSqft}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Condition</p>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${badge(comp.condition)}`}>{comp.condition}</span>
              </div>
            </div>

            {/* Adjusted price */}
            <div className="mt-2 pt-2 border-t border-slate-700 flex items-center justify-between">
              <span className="text-xs text-slate-500">Adjusted for subject differences</span>
              <span className="text-sm font-bold text-blue-400">{fmt(comp.adjustedPrice)}</span>
            </div>
          </div>
        )
      })}

      {/* Summary row */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-600">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">Average Adjusted Comp Value</p>
            <p className="text-xl font-black text-white">
              {fmt(Math.round(result.comps.reduce((s, c) => s + c.adjustedPrice, 0) / result.comps.length / 1000) * 1000)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Average $/sqft</p>
            <p className="text-xl font-black text-white">
              ${Math.round(result.comps.reduce((s, c) => s + c.pricePerSqft, 0) / result.comps.length)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
