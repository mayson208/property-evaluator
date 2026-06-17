import { usePropertyStore } from '../store/usePropertyStore'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function RoiBadge({ roi }: { roi: number }) {
  const color = roi >= 30 ? 'text-green-400 bg-green-900/40' :
                roi >= 0  ? 'text-yellow-400 bg-yellow-900/40' :
                            'text-red-400 bg-red-900/40'
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded ${color}`}>
      {roi >= 0 ? '+' : ''}{roi}% ROI
    </span>
  )
}

export default function RenovationCalc() {
  const { result, renovations, selectedRenovations, toggleRenovation, updateRenovation } = usePropertyStore()

  const selected = renovations.filter(r => selectedRenovations.has(r.id))
  const totalCost     = selected.reduce((s, r) => s + r.cost, 0)
  const totalValueAdd = selected.reduce((s, r) => s + r.valueAdd, 0)
  const netGain       = totalValueAdd - totalCost
  const blendedRoi    = totalCost > 0 ? ((totalValueAdd - totalCost) / totalCost) * 100 : 0
  const afterValue    = result ? result.estimatedValue + totalValueAdd : 0

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Renovation ROI Calculator</h3>
        <p className="text-xs text-slate-500">Select renovations to see their impact on estimated value</p>
      </div>

      {/* Summary bar */}
      {selected.length > 0 && (
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-4 border border-slate-700 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-slate-400">Total Cost</p>
            <p className="text-lg font-black text-red-400">-{fmt(totalCost)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Value Added</p>
            <p className="text-lg font-black text-green-400">+{fmt(totalValueAdd)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Net Gain</p>
            <p className={`text-lg font-black ${netGain >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
              {netGain >= 0 ? '+' : ''}{fmt(netGain)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">After-Reno Value</p>
            <p className="text-lg font-black text-white">{result ? fmt(afterValue) : '—'}</p>
          </div>
        </div>
      )}

      {/* Renovation list */}
      <div className="space-y-2">
        {renovations.map(reno => {
          const sel = selectedRenovations.has(reno.id)
          return (
            <div
              key={reno.id}
              className={`rounded-xl border transition-all ${
                sel ? 'border-blue-600/60 bg-blue-900/10' : 'border-slate-700 bg-slate-800/40'
              }`}
            >
              <div
                className="flex items-center gap-3 p-3 cursor-pointer"
                onClick={() => toggleRenovation(reno.id)}
              >
                {/* Checkbox */}
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${
                  sel ? 'bg-blue-600 border-blue-600' : 'border-slate-600'
                }`}>
                  {sel && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-200">{reno.name}</span>
                    <RoiBadge roi={reno.roi} />
                  </div>
                  <div className="flex gap-4 mt-0.5 text-xs text-slate-500">
                    <span>Cost: <span className="text-slate-300">{fmt(reno.cost)}</span></span>
                    <span>Value add: <span className="text-green-400">{fmt(reno.valueAdd)}</span></span>
                  </div>
                </div>
              </div>

              {/* Inline editing when selected */}
              {sel && (
                <div className="px-3 pb-3 grid grid-cols-2 gap-2 border-t border-slate-700/50 pt-2">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Est. Cost ($)</label>
                    <input
                      type="number"
                      value={reno.cost}
                      onChange={e => updateRenovation(reno.id, {
                        cost: Number(e.target.value),
                        roi: Math.round(((reno.valueAdd - Number(e.target.value)) / Number(e.target.value)) * 100),
                      })}
                      className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                      onClick={e => e.stopPropagation()}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Value Added ($)</label>
                    <input
                      type="number"
                      value={reno.valueAdd}
                      onChange={e => updateRenovation(reno.id, {
                        valueAdd: Number(e.target.value),
                        roi: Math.round(((Number(e.target.value) - reno.cost) / reno.cost) * 100),
                      })}
                      className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                      onClick={e => e.stopPropagation()}
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Blended ROI */}
      {selected.length > 0 && (
        <div className={`rounded-xl p-4 border text-center ${
          blendedRoi >= 0
            ? 'bg-green-900/20 border-green-700/50'
            : 'bg-red-900/20 border-red-700/50'
        }`}>
          <p className="text-xs text-slate-400 mb-1">Blended Return on Investment</p>
          <p className={`text-3xl font-black ${blendedRoi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {blendedRoi >= 0 ? '+' : ''}{blendedRoi.toFixed(1)}%
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Spend {fmt(totalCost)} → gain {fmt(totalValueAdd)} in home value
          </p>
        </div>
      )}
    </div>
  )
}
