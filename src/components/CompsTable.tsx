import { useState } from 'react'
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

type SortKey = 'distance' | 'soldPrice' | 'adjustedPrice' | 'pricePerSqft' | 'sqft' | 'soldDate'

function SortButton({ label, active, asc, onClick }: { label: string; active: boolean; asc: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2 py-1 rounded font-semibold transition flex items-center gap-1 ${
        active ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
      }`}
    >
      {label}
      {active && <span>{asc ? '↑' : '↓'}</span>}
    </button>
  )
}

export default function CompsTable() {
  const { result, input } = usePropertyStore()
  const [sortKey, setSortKey] = useState<SortKey>('distance')
  const [sortAsc, setSortAsc] = useState(true)

  if (!result || result.comps.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p className="text-4xl mb-3">🏘</p>
        <p>Run a valuation to see comparable sales</p>
      </div>
    )
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(true) }
  }

  const sorted = [...result.comps].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey]
    const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)
    return sortAsc ? cmp : -cmp
  })

  const avgAdjusted = Math.round(result.comps.reduce((s, c) => s + c.adjustedPrice, 0) / result.comps.length / 1000) * 1000
  const avgPPF = Math.round(result.comps.reduce((s, c) => s + c.pricePerSqft, 0) / result.comps.length)
  const subjectPPF = result.pricePerSqft

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500 uppercase tracking-widest">
          {result.comps.length} comparable sales within 1.2 miles
        </p>
        <div className="flex gap-1 flex-wrap justify-end">
          <SortButton label="Dist" active={sortKey === 'distance'}      asc={sortAsc} onClick={() => handleSort('distance')} />
          <SortButton label="Price" active={sortKey === 'soldPrice'}    asc={sortAsc} onClick={() => handleSort('soldPrice')} />
          <SortButton label="Adj" active={sortKey === 'adjustedPrice'}  asc={sortAsc} onClick={() => handleSort('adjustedPrice')} />
          <SortButton label="$/ft" active={sortKey === 'pricePerSqft'} asc={sortAsc} onClick={() => handleSort('pricePerSqft')} />
          <SortButton label="Sqft" active={sortKey === 'sqft'}          asc={sortAsc} onClick={() => handleSort('sqft')} />
          <SortButton label="Date" active={sortKey === 'soldDate'}      asc={sortAsc} onClick={() => handleSort('soldDate')} />
        </div>
      </div>

      {/* Subject property */}
      <div className="bg-blue-900/20 border border-blue-700/50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold bg-blue-600 text-white px-2 py-0.5 rounded">SUBJECT</span>
          <span className="text-sm text-slate-300 font-medium">{input.address || 'Subject Property'}</span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-sm">
          <div><p className="text-xs text-slate-500">Est. Value</p><p className="font-bold text-blue-400">{fmt(result.estimatedValue)}</p></div>
          <div><p className="text-xs text-slate-500">Sqft</p><p className="font-bold text-slate-200">{input.sqft.toLocaleString()}</p></div>
          <div><p className="text-xs text-slate-500">Bed/Bath</p><p className="font-bold text-slate-200">{input.bedrooms}/{input.bathrooms}</p></div>
          <div><p className="text-xs text-slate-500">$/sqft</p><p className="font-bold text-slate-200">${subjectPPF}</p></div>
          <div><p className="text-xs text-slate-500">Cond.</p><span className={`text-xs font-bold px-2 py-0.5 rounded inline-block ${badge(input.condition)}`}>{input.condition}</span></div>
          <div><p className="text-xs text-slate-500">Pool</p><p className="font-bold text-slate-200">{input.hasPool ? 'Yes' : 'No'}</p></div>
        </div>
      </div>

      {/* Comp rows */}
      {sorted.map((comp, i) => {
        const priceDiff = comp.adjustedPrice - result.estimatedValue
        const pctDiff   = (priceDiff / result.estimatedValue) * 100
        const ppfDiff   = comp.pricePerSqft - subjectPPF

        return (
          <div key={comp.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-mono">#{i + 1}</span>
                <span className="text-sm text-slate-200 font-medium">{comp.address}</span>
                <span className="text-xs text-slate-500">{comp.distance} mi</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{comp.soldDate}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${pctDiff >= 0 ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
                  {pctDiff >= 0 ? '+' : ''}{pctDiff.toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-sm">
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
                <p className={`font-semibold ${ppfDiff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${comp.pricePerSqft} <span className="text-xs">({ppfDiff >= 0 ? '+' : ''}{ppfDiff})</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Cond.</p>
                <span className={`text-xs font-bold px-2 py-0.5 rounded inline-block ${badge(comp.condition)}`}>{comp.condition}</span>
              </div>
              <div>
                <p className="text-xs text-slate-500">Pool / Garage</p>
                <p className="font-semibold text-slate-200 text-xs">
                  {comp.hasPool ? 'Pool' : '—'} / {comp.garage.replace('_', ' ')}
                </p>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-700 flex items-center justify-between">
              <span className="text-xs text-slate-500">Adjusted for subject differences</span>
              <span className="text-sm font-bold text-blue-400">{fmt(comp.adjustedPrice)}</span>
            </div>
          </div>
        )
      })}

      {/* Summary */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-600">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-slate-400 mb-1">Avg Adjusted Value</p>
            <p className="text-xl font-black text-white">{fmt(avgAdjusted)}</p>
            <p className={`text-xs mt-0.5 ${avgAdjusted >= result.estimatedValue ? 'text-green-400' : 'text-red-400'}`}>
              {avgAdjusted >= result.estimatedValue ? '+' : ''}{((avgAdjusted - result.estimatedValue) / result.estimatedValue * 100).toFixed(1)}% vs estimate
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Avg $/sqft</p>
            <p className="text-xl font-black text-white">${avgPPF}</p>
            <p className={`text-xs mt-0.5 ${avgPPF >= subjectPPF ? 'text-green-400' : 'text-red-400'}`}>
              {avgPPF >= subjectPPF ? '+' : ''}{avgPPF - subjectPPF} vs subject
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Comp Spread</p>
            <p className="text-xl font-black text-white">
              {Math.round(((Math.max(...result.comps.map(c => c.adjustedPrice)) - Math.min(...result.comps.map(c => c.adjustedPrice))) / avgAdjusted) * 100)}%
            </p>
            <p className="text-xs text-slate-500 mt-0.5">price range / avg</p>
          </div>
        </div>
      </div>
    </div>
  )
}
