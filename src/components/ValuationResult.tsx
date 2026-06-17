import { usePropertyStore } from '../store/usePropertyStore'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function ConfidenceRing({ score }: { score: number }) {
  const r = 36
  const circ = 2 * Math.PI * r
  const fill = (score / 100) * circ
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444'

  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" width={96} height={96}>
        <circle cx={48} cy={48} r={r} fill="none" stroke="#1e293b" strokeWidth={8} />
        <circle
          cx={48} cy={48} r={r} fill="none"
          stroke={color} strokeWidth={8}
          strokeDasharray={`${fill} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
      </svg>
      <div className="text-center">
        <div className="text-xl font-black text-white">{score}</div>
        <div className="text-xs text-slate-400">conf</div>
      </div>
    </div>
  )
}

export default function ValuationResult() {
  const { result, input, saveProperty } = usePropertyStore()

  if (!result) return null

  const appreciation = input.purchasePrice && input.purchaseYear
    ? ((result.estimatedValue - input.purchasePrice) / input.purchasePrice) * 100
    : null

  const equity = input.purchasePrice
    ? result.estimatedValue - input.purchasePrice
    : null

  return (
    <div className="space-y-4">

      {/* Hero value */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Estimated Value</p>
            <p className="text-4xl font-black text-white tracking-tight">
              {fmt(result.estimatedValue)}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              Range: {fmt(result.lowValue)} — {fmt(result.highValue)}
            </p>
            <div className="flex items-center gap-3 mt-3">
              <span className="text-sm text-slate-300">
                <span className="font-bold text-blue-400">${result.pricePerSqft.toLocaleString()}</span>/sqft
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-xs text-slate-500">{result.methodology}</span>
            </div>
          </div>
          <ConfidenceRing score={result.confidenceScore} />
        </div>

        {/* Appreciation */}
        {appreciation !== null && (
          <div className={`mt-4 pt-4 border-t border-slate-700 flex items-center gap-4`}>
            <div>
              <p className="text-xs text-slate-400">Total Gain</p>
              <p className={`text-lg font-bold ${equity! > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {equity! > 0 ? '+' : ''}{fmt(equity!)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Appreciation</p>
              <p className={`text-lg font-bold ${appreciation > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {appreciation > 0 ? '+' : ''}{appreciation.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Paid</p>
              <p className="text-lg font-bold text-slate-300">{fmt(input.purchasePrice)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Value gauge */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 mb-3 uppercase tracking-widest">Value Range</p>
        <div className="relative h-3 bg-slate-700 rounded-full overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900 via-blue-500 to-blue-900 rounded-full" />
          <div
            className="absolute top-0 bottom-0 w-1 bg-white rounded-full shadow-lg shadow-white/50"
            style={{
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-slate-500">
          <span>{fmt(result.lowValue)}</span>
          <span className="text-blue-400 font-bold">{fmt(result.estimatedValue)}</span>
          <span>{fmt(result.highValue)}</span>
        </div>
      </div>

      {/* Adjustments breakdown */}
      {result.adjustments.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs text-slate-400 mb-3 uppercase tracking-widest">Value Adjustments</p>
          <div className="space-y-2">
            {result.adjustments.map((adj, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">{adj.label}</span>
                <span className={`font-mono font-semibold ${adj.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {adj.amount >= 0 ? '+' : ''}{fmt(adj.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Beds', value: input.bedrooms },
          { label: 'Baths', value: input.bathrooms },
          { label: 'Year', value: input.yearBuilt },
          { label: 'Sqft', value: input.sqft.toLocaleString() },
          { label: 'Lot', value: `${(input.lotSqft / 1000).toFixed(1)}k` },
          { label: 'Cond', value: input.condition.charAt(0).toUpperCase() + input.condition.slice(1) },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700 text-center">
            <p className="text-xs text-slate-500 uppercase tracking-wide">{s.label}</p>
            <p className="text-base font-bold text-slate-200 mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Save button */}
      <button
        onClick={() => {
          const label = input.address || `${input.city}, ${input.state} — ${fmt(result.estimatedValue)}`
          saveProperty(label)
        }}
        className="w-full py-2 rounded-xl border border-slate-600 text-slate-400 hover:border-blue-500 hover:text-blue-400 text-sm transition"
      >
        💾 Save This Property
      </button>
    </div>
  )
}
