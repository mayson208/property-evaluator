import { useRef } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function SavedProperties() {
  const { savedProperties, loadProperty, deleteProperty, exportJson, importJson } = usePropertyStore()
  const fileRef = useRef<HTMLInputElement>(null)

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      importJson(text)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500 uppercase tracking-widest">
          {savedProperties.length} / 20 saved
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 rounded-lg transition font-semibold"
          >
            Import JSON
          </button>
          {savedProperties.length > 0 && (
            <button
              onClick={exportJson}
              className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 rounded-lg transition font-semibold"
            >
              Export JSON
            </button>
          )}
          <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
        </div>
      </div>

      {savedProperties.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <p className="text-4xl mb-3">💾</p>
          <p className="text-sm">No saved properties yet</p>
          <p className="text-xs mt-1 text-slate-600">Run a valuation and click "Save This Property" in the result panel</p>
        </div>
      ) : (
        <>
          {savedProperties.map(p => (
            <div key={p.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:border-slate-500 transition">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-200 truncate">{p.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(p.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {p.input.city && ` · ${p.input.city}, ${p.input.state}`}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-base font-black text-blue-400">{fmt(p.result.estimatedValue)}</p>
                  <p className="text-xs text-slate-500">${p.result.pricePerSqft}/sqft · {p.result.confidenceScore}% conf.</p>
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
                {p.input.hasPool && <><span>·</span><span>Pool</span></>}
              </div>

              {p.input.purchasePrice > 0 && (
                <div className="mt-2 text-xs">
                  <span className="text-slate-500">Bought {fmt(p.input.purchasePrice)} in {p.input.purchaseYear} → </span>
                  <span className={`font-semibold ${p.result.estimatedValue >= p.input.purchasePrice ? 'text-green-400' : 'text-red-400'}`}>
                    {p.result.estimatedValue >= p.input.purchasePrice ? '+' : ''}
                    {fmt(p.result.estimatedValue - p.input.purchasePrice)} gain
                  </span>
                </div>
              )}

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

          <p className="text-xs text-slate-600 text-center">
            Properties are saved in your browser's localStorage. Export JSON to back them up.
          </p>
        </>
      )}
    </div>
  )
}
