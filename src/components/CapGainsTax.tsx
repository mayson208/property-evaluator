import { useState, useMemo } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

// Federal long-term capital gains rates (2024)
const FEDERAL_RATES = [
  { bracket: 'Single: 0 – $47,025',         rate: 0,  label: '0%' },
  { bracket: 'Single: $47,026 – $518,900',  rate: 15, label: '15%' },
  { bracket: 'Single: $518,901+',           rate: 20, label: '20%' },
]

// State capital gains rates (approximate — many use income tax rate)
const STATE_CG_RATE: Record<string, number> = {
  AK: 0,  FL: 0,  NV: 0,  NH: 0,  SD: 0,  TN: 0,  TX: 0,  WA: 7,  WY: 0,
  AL: 5, AR: 4.9, AZ: 2.5, CA: 13.3, CO: 4.4, CT: 6.99, DC: 10.75,
  DE: 6.6, GA: 5.49, HI: 7.25, IA: 6, ID: 5.8, IL: 4.95, IN: 3.15,
  KS: 5.7, KY: 4, LA: 4.25, MA: 5, MD: 5.75, ME: 7.15, MI: 4.25,
  MN: 9.85, MO: 4.8, MS: 4.7, MT: 6.75, NC: 5.25, ND: 2.5, NE: 5.84,
  NJ: 10.75, NM: 5.9, NY: 10.9, OH: 3.99, OK: 4.75, OR: 9.9,
  PA: 3.07, RI: 5.99, SC: 6.4, UT: 4.85, VA: 5.75, VT: 8.75,
  WI: 7.65, WV: 6.5,
}

type FilingStatus = 'single' | 'mfj' | 'hoh'
type TermType = 'short' | 'long'

const EXCLUSIONS: Record<FilingStatus, number> = {
  single: 250000, mfj: 500000, hoh: 250000,
}

const THRESHOLDS: Record<FilingStatus, [number, number]> = {
  single: [47025, 518900],
  mfj:    [94050, 583750],
  hoh:    [63000, 551350],
}

export default function CapGainsTax() {
  const { result, input } = usePropertyStore()

  const purchasePrice = input.purchasePrice || 0
  const purchaseYear  = input.purchaseYear  || (new Date().getFullYear() - 5)
  const salePrice     = result?.estimatedValue ?? 500000
  const state         = input.state || 'TX'

  const [salePriceOverride, setSalePriceOverride] = useState(salePrice)
  const [purchasePriceOverride, setPurchasePriceOverride] = useState(purchasePrice || Math.round(salePrice * 0.65))
  const [purchaseYearOverride, setPurchaseYearOverride]   = useState(purchaseYear || new Date().getFullYear() - 5)
  const [improvements, setImprovements] = useState(0)
  const [closingCostsPaid, setClosingCostsPaid] = useState(Math.round(salePrice * 0.015))
  const [filingStatus, setFilingStatus] = useState<FilingStatus>('single')
  const [annualIncome, setAnnualIncome] = useState(100000)
  const [primaryResidence, setPrimaryResidence] = useState(true)
  const [yearsOwned, setYearsOwned] = useState(new Date().getFullYear() - (purchaseYear || new Date().getFullYear() - 5))

  const analysis = useMemo(() => {
    const costBasis = purchasePriceOverride + improvements + closingCostsPaid
    const grossGain = salePriceOverride - costBasis
    const term: TermType = yearsOwned >= 1 ? 'long' : 'short'

    const exclusion = (primaryResidence && yearsOwned >= 2) ? EXCLUSIONS[filingStatus] : 0
    const taxableGain = Math.max(0, grossGain - exclusion)

    // Federal rate
    const [th1, th2] = THRESHOLDS[filingStatus]
    const fedRate = term === 'short'
      ? (annualIncome < 47150 ? 10 : annualIncome < 100525 ? 22 : annualIncome < 201050 ? 24 : annualIncome < 383900 ? 32 : 35)
      : (annualIncome < th1 ? 0 : annualIncome < th2 ? 15 : 20)

    // NIIT (net investment income tax: 3.8% if income > $200K single / $250K MFJ)
    const niitThreshold = filingStatus === 'mfj' ? 250000 : 200000
    const niitRate = (annualIncome + taxableGain) > niitThreshold ? 3.8 : 0

    const stateRate = STATE_CG_RATE[state.toUpperCase()] ?? 0
    const totalRate = fedRate + niitRate + stateRate

    const federalTax = Math.round(taxableGain * fedRate / 100)
    const niitTax    = Math.round(taxableGain * niitRate / 100)
    const stateTax   = Math.round(taxableGain * stateRate / 100)
    const totalTax   = federalTax + niitTax + stateTax
    const netProceeds = salePriceOverride - costBasis - totalTax

    return {
      costBasis, grossGain, exclusion, taxableGain, term,
      fedRate, niitRate, stateRate, totalRate,
      federalTax, niitTax, stateTax, totalTax, netProceeds,
    }
  }, [salePriceOverride, purchasePriceOverride, improvements, closingCostsPaid, filingStatus, annualIncome, primaryResidence, yearsOwned, state])

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Capital Gains Tax Estimator</h3>
        <p className="text-xs text-slate-500">Estimate federal + state tax on your home sale profit</p>
      </div>

      {result && (
        <div className="bg-blue-900/30 border border-blue-800/50 rounded-xl p-3 text-xs text-blue-300">
          Using estimated value of <strong>{fmt(result.estimatedValue)}</strong> as sale price.
          {input.purchasePrice > 0 && <> Purchase price from form: <strong>{fmt(input.purchasePrice)}</strong>.</>}
        </div>
      )}

      {/* Inputs */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-4">
        <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Transaction Details</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-widest block mb-1">Sale Price</label>
            <input type="number" value={salePriceOverride}
              onChange={e => setSalePriceOverride(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-widest block mb-1">Original Purchase Price</label>
            <input type="number" value={purchasePriceOverride}
              onChange={e => setPurchasePriceOverride(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-widest block mb-1">Capital Improvements ($)</label>
            <input type="number" value={improvements}
              onChange={e => setImprovements(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-widest block mb-1">Closing Costs Paid at Purchase</label>
            <input type="number" value={closingCostsPaid}
              onChange={e => setClosingCostsPaid(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-slate-400 uppercase tracking-widest">Years Owned</label>
              <span className="text-xs font-bold text-blue-400">{yearsOwned} yrs ({yearsOwned >= 1 ? 'Long-term' : 'Short-term'})</span>
            </div>
            <input type="range" min={0} max={40} step={1} value={yearsOwned}
              onChange={e => setYearsOwned(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-slate-400 uppercase tracking-widest">Annual Income</label>
              <span className="text-xs font-bold text-blue-400">{fmt(annualIncome)}</span>
            </div>
            <input type="range" min={0} max={600000} step={5000} value={annualIncome}
              onChange={e => setAnnualIncome(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-widest block mb-1">Filing Status</label>
            <select value={filingStatus} onChange={e => setFilingStatus(e.target.value as FilingStatus)}
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
              <option value="single">Single</option>
              <option value="mfj">Married Filing Jointly</option>
              <option value="hoh">Head of Household</option>
            </select>
          </div>
          <div className="flex items-center gap-2 pt-5">
            <input type="checkbox" id="primary" checked={primaryResidence} onChange={e => setPrimaryResidence(e.target.checked)}
              className="w-4 h-4 accent-blue-500" />
            <label htmlFor="primary" className="text-sm text-slate-300 cursor-pointer">
              Primary residence (§121 exclusion)
            </label>
          </div>
        </div>
      </div>

      {/* Hero result */}
      <div className={`rounded-xl p-5 border ${analysis.taxableGain > 0 ? 'bg-red-900/20 border-red-700/50' : 'bg-green-900/20 border-green-700/50'}`}>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Total Tax Owed</p>
            <p className={`text-4xl font-black ${analysis.totalTax > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {fmt(analysis.totalTax)}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              Effective rate: {analysis.taxableGain > 0 ? ((analysis.totalTax / analysis.taxableGain) * 100).toFixed(1) : 0}%
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Net After-Tax Proceeds</p>
            <p className="text-3xl font-black text-green-400">{fmt(analysis.netProceeds)}</p>
            <p className="text-sm text-slate-400 mt-1">After tax + cost basis</p>
          </div>
        </div>
      </div>

      {/* Gain breakdown */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
        <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-2">Gain Calculation</p>
        {[
          { label: 'Sale Price',                      amount: analysis.grossGain + analysis.costBasis, color: 'text-green-400' },
          { label: `Cost Basis (purchase + improvements + closing)`, amount: -analysis.costBasis, color: 'text-red-400' },
          { label: 'Gross Gain',                      amount: analysis.grossGain, color: 'text-white', bold: true },
          ...(analysis.exclusion > 0 ? [{ label: `§121 Exclusion (${filingStatus === 'mfj' ? 'MFJ' : 'Single'})`, amount: -analysis.exclusion, color: 'text-green-400', bold: false }] : []),
          { label: `Taxable Gain (${analysis.term === 'long' ? 'Long-term' : 'Short-term'})`, amount: analysis.taxableGain, color: 'text-orange-400', bold: true },
        ].map((row, i) => (
          <div key={i} className={`flex justify-between text-sm ${row.bold ? 'border-t border-slate-600 pt-2 font-bold' : ''}`}>
            <span className="text-slate-400">{row.label}</span>
            <span className={`font-mono ${row.color}`}>
              {row.amount >= 0 ? '' : ''}{fmt(Math.abs(row.amount))}
            </span>
          </div>
        ))}
      </div>

      {/* Tax breakdown */}
      {analysis.taxableGain > 0 && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700">
            <p className="text-xs text-slate-400 uppercase tracking-widest">Tax Breakdown</p>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {[
                { label: `Federal ${analysis.term === 'long' ? 'Long-term CG' : 'Ordinary Income'}`, rate: analysis.fedRate, amount: analysis.federalTax },
                ...(analysis.niitRate > 0 ? [{ label: 'Net Investment Income Tax (NIIT)', rate: analysis.niitRate, amount: analysis.niitTax }] : []),
                { label: `${state} State Tax`, rate: analysis.stateRate, amount: analysis.stateTax },
              ].map(row => (
                <tr key={row.label} className="border-t border-slate-700/50">
                  <td className="py-2 px-4 text-slate-400">{row.label}</td>
                  <td className="py-2 px-4 text-right text-slate-500">{row.rate}%</td>
                  <td className="py-2 px-4 text-right font-mono font-semibold text-red-400">{fmt(row.amount)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-600 bg-slate-800/50">
                <td className="py-2.5 px-4 font-bold text-white">Total Tax</td>
                <td className="py-2.5 px-4 text-right text-slate-400">{analysis.totalRate.toFixed(1)}%</td>
                <td className="py-2.5 px-4 text-right font-mono font-black text-red-400">{fmt(analysis.totalTax)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Tips */}
      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50 space-y-2">
        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-2">Tax-Saving Tips</p>
        {[
          primaryResidence && yearsOwned >= 2 && `§121 exclusion shields up to ${fmt(EXCLUSIONS[filingStatus])} of your gain tax-free.`,
          yearsOwned < 1 && 'Wait until 12+ months of ownership for long-term rates — typically 15% vs ordinary income rates.',
          improvements > 0 && `${fmt(improvements)} in capital improvements increases your cost basis and reduces taxable gain.`,
          analysis.stateRate === 0 && `${state} has no state capital gains tax — a significant advantage.`,
          analysis.stateRate > 8 && `${state} has a high state CG rate (${analysis.stateRate}%). Consult a CPA about strategies.`,
          analysis.totalTax > 50000 && 'Consider a 1031 exchange if reinvesting in another investment property to defer taxes.',
        ].filter(Boolean).map((tip, i) => (
          <p key={i} className="text-xs text-slate-400 flex gap-2">
            <span className="text-blue-400 flex-shrink-0">→</span>
            {tip}
          </p>
        ))}
      </div>

      <p className="text-xs text-slate-600 text-center">
        Estimates only. Tax law is complex and varies by individual situation.
        Consult a CPA or tax attorney before making financial decisions based on this estimate.
      </p>
    </div>
  )
}
