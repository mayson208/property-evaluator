import { useState, useMemo } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

// Federal CG rates (simplified for long-term)
function fedCGRate(income: number, status: string): number {
  if (status === 'mfj') {
    if (income <= 94050)  return 0
    if (income <= 583750) return 0.15
    return 0.20
  }
  if (income <= 47025)  return 0
  if (income <= 518900) return 0.15
  return 0.20
}

// Simplified state CG rates
const STATE_CG: Record<string, number> = {
  CA: 0.133, OR: 0.099, MN: 0.098, NJ: 0.1075, VT: 0.0875,
  NY: 0.109, ME: 0.075, WI: 0.0765, SC: 0.07, ID: 0.058,
  MT: 0.059, GA: 0.055, LA: 0.06, AR: 0.055, NE: 0.0684,
  IN: 0.032, PA: 0.0307, IL: 0.0495, MI: 0.0425, OH: 0.04,
  TX: 0, FL: 0, WA: 0.07, NV: 0, AK: 0, WY: 0,
  SD: 0, TN: 0, NH: 0, CO: 0.044, AZ: 0.025, UT: 0.0485,
  KY: 0.05, MD: 0.055, MA: 0.05, CT: 0.07, RI: 0.0599,
  AL: 0.05, MS: 0.05, KS: 0.057, MO: 0.054, IA: 0.06,
  ND: 0.025, WV: 0.065, VA: 0.0575, NC: 0.0525, HI: 0.11,
  DE: 0.066, DC: 0.0895, OK: 0.05, NM: 0.059,
}

export default function Exchange1031() {
  const { result, input } = usePropertyStore()

  const salePrice = result?.estimatedValue ?? 500000

  const [purchasePrice,    setPurchasePrice]    = useState(input.purchasePrice || Math.round(salePrice * 0.65))
  const [depreciationTaken, setDepreciationTaken] = useState(Math.round(salePrice * 0.1))
  const [sellingCostsPct,  setSellingCostsPct]  = useState(6.0)
  const [newPropertyPrice, setNewPropertyPrice] = useState(Math.round(salePrice * 1.3))
  const [filingStatus,     setFilingStatus]     = useState<'single' | 'mfj'>('mfj')
  const [annualIncome,     setAnnualIncome]     = useState(150000)
  const [stateKey,         setStateKey]         = useState(input.state || 'TX')
  const [bootAmount,       setBootAmount]       = useState(0)

  const analysis = useMemo(() => {
    const sellingCosts    = salePrice * sellingCostsPct / 100
    const adjustedBasis   = purchasePrice - depreciationTaken
    const gainOnSale      = salePrice - sellingCosts - adjustedBasis
    const deprecRecapture = Math.min(depreciationTaken, gainOnSale)
    const longTermGain    = Math.max(0, gainOnSale - deprecRecapture)
    const niit            = annualIncome > (filingStatus === 'mfj' ? 250000 : 200000) ? longTermGain * 0.038 : 0

    const fedCG    = fedCGRate(annualIncome, filingStatus)
    const stateCG  = STATE_CG[stateKey] ?? 0.05

    const taxOnDeprec    = deprecRecapture * 0.25
    const taxOnLTCG      = longTermGain * fedCG
    const stateCapGains  = gainOnSale * stateCG
    const totalTaxNow    = taxOnDeprec + taxOnLTCG + stateCapGains + niit

    // 1031 scenario: defer all federal + potentially state
    const bootTax         = bootAmount > 0 ? bootAmount * (fedCG + stateCG) : 0
    const deferredTax     = totalTaxNow - bootTax
    const totalTaxWith1031 = bootTax

    // Net equity for each path
    const cashFromSale   = salePrice - sellingCosts - purchasePrice + purchasePrice - totalTaxNow // net after tax
    const netAfterTax    = salePrice - sellingCosts - totalTaxNow
    const netWith1031    = salePrice - sellingCosts - bootTax

    return {
      sellingCosts, adjustedBasis, gainOnSale, deprecRecapture, longTermGain,
      taxOnDeprec, taxOnLTCG, stateCapGains, niit, totalTaxNow,
      bootTax, deferredTax, totalTaxWith1031,
      netAfterTax, netWith1031, fedCG, stateCG,
    }
  }, [salePrice, purchasePrice, depreciationTaken, sellingCostsPct, newPropertyPrice, filingStatus, annualIncome, stateKey, bootAmount])

  const chartData = [
    { label: 'Sale Outright',  net: Math.max(0, analysis.netAfterTax), tax: analysis.totalTaxNow,    color: '#ef4444' },
    { label: '1031 Exchange',  net: Math.max(0, analysis.netWith1031), tax: analysis.totalTaxWith1031, color: '#22c55e' },
  ]

  if (!result) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p className="text-4xl mb-3">🔄</p>
        <p>Run a valuation first to analyze a 1031 exchange</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">1031 Like-Kind Exchange Analyzer</h3>
        <p className="text-xs text-slate-500">
          Compare selling outright vs deferring capital gains tax through a §1031 exchange into a new investment property.
        </p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Relinquished Property</p>
          {[
            { label: 'Original Purchase Price', value: purchasePrice,     min: 50000,  max: 5000000, step: 5000,  set: setPurchasePrice,     fmt: fmt },
            { label: 'Depreciation Taken',      value: depreciationTaken, min: 0,      max: 1000000, step: 1000,  set: setDepreciationTaken, fmt: fmt },
            { label: 'Selling Costs %',         value: sellingCostsPct,   min: 0,      max: 10,      step: 0.25,  set: setSellingCostsPct,   fmt: (v: number) => `${v.toFixed(2)}%` },
            { label: 'Boot Received (Cash)',     value: bootAmount,        min: 0,      max: 500000,  step: 5000,  set: setBootAmount,        fmt: fmt },
          ].map(s => (
            <div key={s.label}>
              <div className="flex justify-between mb-1">
                <label className="text-xs text-slate-400 uppercase tracking-widest">{s.label}</label>
                <span className="text-xs font-bold text-blue-400">{s.fmt(s.value)}</span>
              </div>
              <input type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                onChange={e => s.set(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
            </div>
          ))}
          <div className="bg-slate-900/60 rounded-lg p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-500">Estimated sale price</span><span className="font-bold text-white">{fmt(salePrice)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Adjusted basis</span><span className="text-slate-300">{fmt(analysis.adjustedBasis)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Total gain on sale</span><span className="text-yellow-400 font-bold">{fmt(analysis.gainOnSale)}</span></div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Taxpayer Profile</p>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Filing Status</p>
            <div className="flex gap-2">
              {[{ id: 'single', label: 'Single' }, { id: 'mfj', label: 'Married Filing Jointly' }].map(s => (
                <button key={s.id}
                  onClick={() => setFilingStatus(s.id as typeof filingStatus)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${filingStatus === s.id ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          {[
            { label: 'Annual Income', value: annualIncome, min: 20000, max: 1000000, step: 5000, set: setAnnualIncome, fmt: fmt },
          ].map(s => (
            <div key={s.label}>
              <div className="flex justify-between mb-1">
                <label className="text-xs text-slate-400 uppercase tracking-widest">{s.label}</label>
                <span className="text-xs font-bold text-blue-400">{s.fmt(s.value)}</span>
              </div>
              <input type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                onChange={e => s.set(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
            </div>
          ))}
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-widest mb-1 block">Property State</label>
            <select value={stateKey} onChange={e => setStateKey(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs rounded-lg px-3 py-2">
              {Object.keys(STATE_CG).sort().map(s => (
                <option key={s} value={s}>{s} — {((STATE_CG[s] ?? 0) * 100).toFixed(1)}% CG rate</option>
              ))}
            </select>
          </div>
          <div className="bg-slate-900/60 rounded-lg p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-500">Federal LT CG rate</span><span className="text-blue-400 font-bold">{(analysis.fedCG * 100).toFixed(0)}%</span></div>
            <div className="flex justify-between"><span className="text-slate-500">State CG rate ({stateKey})</span><span className="text-purple-400 font-bold">{(analysis.stateCG * 100).toFixed(1)}%</span></div>
            <div className="flex justify-between"><span className="text-slate-500">NIIT (3.8%)</span><span className={analysis.niit > 0 ? 'text-orange-400 font-bold' : 'text-slate-600'}>{analysis.niit > 0 ? fmt(analysis.niit) : 'N/A'}</span></div>
          </div>
        </div>
      </div>

      {/* Tax comparison */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-5 text-center">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-3">Sell Outright (No 1031)</p>
          <p className="text-3xl font-black text-red-400 mb-1">{fmt(analysis.totalTaxNow)}</p>
          <p className="text-xs text-slate-500">total tax owed</p>
          <div className="mt-3 space-y-1 text-xs text-left">
            <div className="flex justify-between"><span className="text-slate-500">Depreciation Recapture (25%)</span><span className="text-red-400">{fmt(analysis.taxOnDeprec)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Federal CG Tax ({(analysis.fedCG * 100).toFixed(0)}%)</span><span className="text-red-400">{fmt(analysis.taxOnLTCG)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">State CG Tax ({(analysis.stateCG * 100).toFixed(1)}%)</span><span className="text-red-400">{fmt(analysis.stateCapGains)}</span></div>
            {analysis.niit > 0 && <div className="flex justify-between"><span className="text-slate-500">NIIT (3.8%)</span><span className="text-red-400">{fmt(analysis.niit)}</span></div>}
          </div>
          <div className="mt-3 pt-3 border-t border-red-900/50">
            <p className="text-xs text-slate-500">Net after tax + costs</p>
            <p className="text-xl font-black text-white">{fmt(analysis.netAfterTax)}</p>
          </div>
        </div>

        <div className="bg-green-900/20 border border-green-700/30 rounded-xl p-5 text-center">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-3">1031 Exchange</p>
          <p className="text-3xl font-black text-green-400 mb-1">{fmt(analysis.deferredTax)}</p>
          <p className="text-xs text-slate-500">deferred (not owed now)</p>
          <div className="mt-3 space-y-1 text-xs text-left">
            <div className="flex justify-between"><span className="text-slate-500">Tax on boot (if any)</span><span className={analysis.bootTax > 0 ? 'text-orange-400' : 'text-slate-600'}>{analysis.bootTax > 0 ? fmt(analysis.bootTax) : 'None'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Tax deferred to future</span><span className="text-green-400 font-bold">{fmt(analysis.deferredTax)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">ID period</span><span className="text-blue-400">45 days</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Exchange period</span><span className="text-blue-400">180 days</span></div>
          </div>
          <div className="mt-3 pt-3 border-t border-green-900/50">
            <p className="text-xs text-slate-500">Capital deployed into new property</p>
            <p className="text-xl font-black text-white">{fmt(analysis.netWith1031)}</p>
          </div>
        </div>
      </div>

      {/* Visual comparison */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Net Proceeds Comparison</p>
        <p className="text-xs text-slate-600 mb-4">
          1031 lets you redeploy {fmt(analysis.deferredTax)} more capital into the next property.
        </p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 60, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
            <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
            <YAxis type="category" dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} width={110} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
              formatter={(v: number, name: string) => [fmt(v), name]} />
            <Bar dataKey="net" name="Net Capital" radius={[0, 4, 4, 0]}>
              {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Rules */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">1031 Exchange Rules</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { title: '45-Day ID Period',      desc: 'Must identify replacement property within 45 days of closing the sale.',                     ok: true },
            { title: '180-Day Close Period',  desc: 'Must close on the replacement property within 180 days of selling the relinquished one.',     ok: true },
            { title: 'Like-Kind Requirement', desc: 'Both properties must be held for investment or business use. Primary residences do not qualify.', ok: true },
            { title: 'Equal or Greater Value', desc: `New property must cost ≥ ${fmt(salePrice)} to defer all taxes. Current target: ${fmt(newPropertyPrice)}.`, ok: newPropertyPrice >= salePrice },
            { title: 'Qualified Intermediary', desc: 'A QI must hold funds between transactions. You cannot receive the sale proceeds directly.',   ok: true },
            { title: 'Boot = Taxable',        desc: `Any cash or unlike property (boot) received is taxable. Boot set to: ${fmt(bootAmount)}.`,   ok: bootAmount === 0 },
          ].map(r => (
            <div key={r.title} className="flex gap-3 items-start">
              <span className={`text-base flex-shrink-0 ${r.ok ? 'text-green-400' : 'text-red-400'}`}>{r.ok ? '✓' : '✗'}</span>
              <div>
                <p className="text-xs font-semibold text-slate-300">{r.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{r.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center">
        This is an estimate only. §1031 rules are complex and fact-specific. Consult a qualified intermediary and tax professional
        before executing an exchange. State conformity to §1031 varies.
      </p>
    </div>
  )
}
