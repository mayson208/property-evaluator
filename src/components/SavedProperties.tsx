import { usePropertyStore } from '../store/usePropertyStore'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function SavedProperties() {
  const { savedProperties, loadProperty, deleteProperty } = usePropertyStore()

  if (savedProperties.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p className="text-4xl mb-3">💾</p>
        <p className="text-sm">No saved properties yet</p>
        <p className="text-xs mt-1 text-slate-600">Run a valuation and click "Save This Property"</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 uppercase tracking-widest">{savedProperties.length} saved propert{savedProperties.length === 1 ? 'y' : 'ies'}</p>
      {savedProperties.map(p => (
        <div key={p.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:border-slate-500 transition">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-200 truncate">{p.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {new Date(p.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-base font-black text-blue-400">{fmt(p.result.estimatedValue)}</p>
              <p className="text-xs text-slate-500">${p.result.pricePerSqft}/sqft</p>
            </div>
          </div>

          <div className="flex gap-3 mt-2 text-xs text-slate-500">
            <span>{p.input.sqft.toLocaleString()} sqft</span>
            <span>·</span>
            <span>{p.input.bedrooms}bd / {p.input.bathrooms}ba</span>
            <span>·</span>
            <span>{p.input.yearBuilt}</span>
            <span>·</span>
            <span className="capitalize">{p.input.condition}</span>
          </div>

          <div className="flex gap-2 mt-3">
            <button
              onClick={() => loadProperty(p.id)}
              className="flex-1 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-700/50 text-blue-400 text-xs font-semibold rounded-lg transition"
            >
              Load
            </button>
            <button
              onClick={() => deleteProperty(p.id)}
              className="px-3 py-1.5 bg-red-900/20 hover:bg-red-900/40 border border-red-800/50 text-red-400 text-xs font-semibold rounded-lg transition"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
