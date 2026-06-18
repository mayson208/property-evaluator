import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface Property {
  id: string
  name: string
  netRentalIncome: number
  depreciation: number
  w2Wages: number
  qualifiedPropertyBasis: number
}

interface Inputs {
  filingStatus: 'single' | 'mfj'
  taxableIncome: number
  ordinaryIncome: number
  properties: Property[]
  isRealEstatePro: boolean
  isGroupedEnterprise: boolean
  hasSCorpPassthrough: boolean
  scorporationQBI: number
  scorporationW2: number
}

const DEF_PROPS: Property[] = [
  { id: '1', name: 'Single Family Rental', netRentalIncome: 18000, depreciation: 8500, w2Wages: 0, qualifiedPropertyBasis: 320000 },
  { id: '2', name: 'Small Apartment (8 units)', netRentalIncome: 42000, depreciation: 22000, w2Wages: 24000, qualifiedPropertyBasis: 850000 },
]

const DEF: Inputs = {
  filingStatus: 'mfj',
  taxableIncome: 285000,
  ordinaryIncome: 185000,
  properties: DEF_PROPS,
  isRealEstatePro: false,
  isGroupedEnterprise: false,
  hasSCorpPassthrough: false,
  scorporationQBI: 0,
  scorporationW2: 0,
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const N = (v: string) => parseFloat(v) || 0

export default function QBIDeduction() {
  const [inp, setInp] = useState<Inputs>(DEF)
  const [newPropName, setNewPropName] = useState('')

  const addProperty = () => {
    const prop: Property = {
      id: Date.now().toString(),
      name: newPropName || `Property ${inp.properties.length + 1}`,
      netRentalIncome: 0, depreciation: 0, w2Wages: 0, qualifiedPropertyBasis: 0,
    }
    setInp(p => ({ ...p, properties: [...p.properties, prop] }))
    setNewPropName('')
  }

  const removeProperty = (id: string) => setInp(p => ({ ...p, properties: p.properties.filter(x => x.id !== id) }))

  const updateProp = (id: string, k: keyof Property, v: string) =>
    setInp(p => ({ ...p, properties: p.properties.map(x => x.id === id ? { ...x, [k]: N(v) } : x) }))

  const calc = useMemo(() => {
    const { filingStatus, taxableIncome, ordinaryIncome, properties,
            isRealEstatePro, isGroupedEnterprise, hasSCorpPassthrough,
            scorporationQBI, scorporationW2 } = inp

    // IRS thresholds 2024
    const threshold = filingStatus === 'mfj' ? 383900 : 191950
    const phaseOutEnd = filingStatus === 'mfj' ? 483900 : 291950
    const inPhaseOut = taxableIncome > threshold && taxableIncome < phaseOutEnd
    const overThreshold = taxableIncome >= phaseOutEnd
    const phaseOutFraction = inPhaseOut ? (taxableIncome - threshold) / (phaseOutEnd - threshold) : overThreshold ? 1 : 0

    // Per-property QBI
    const propResults = properties.map(prop => {
      const qbi = prop.netRentalIncome - prop.depreciation
      const initialDeduction = Math.max(0, qbi * 0.20)

      // W-2 / UBIA limitation (applies above threshold)
      const w2Limit = prop.w2Wages * 0.50
      const w2PlusBasisLimit = prop.w2Wages * 0.25 + prop.qualifiedPropertyBasis * 0.025
      const limitCapW2 = Math.max(w2Limit, w2PlusBasisLimit)

      let deduction = initialDeduction
      if (overThreshold) {
        deduction = Math.min(initialDeduction, limitCapW2)
      } else if (inPhaseOut) {
        const limitedDeduction = Math.min(initialDeduction, limitCapW2)
        deduction = initialDeduction - phaseOutFraction * (initialDeduction - limitedDeduction)
      }

      const safe250k = (isRealEstatePro || isGroupedEnterprise) ? false :
        prop.netRentalIncome > 0 && prop.w2Wages === 0

      return { ...prop, qbi, initialDeduction, w2Limit, w2PlusBasisLimit, limitCapW2, deduction, safe250k }
    })

    // Aggregate
    const totalQBI = propResults.reduce((s, p) => s + p.qbi, 0)
    const aggregateDeduction = propResults.reduce((s, p) => s + p.deduction, 0)

    // Add S-Corp passthrough if applicable
    let scorpDeduction = 0
    if (hasSCorpPassthrough) {
      const scorpInitial = scorporationQBI * 0.20
      const scorpW2Cap = scorporationW2 * 0.50
      scorpDeduction = overThreshold ? Math.min(scorpInitial, scorpW2Cap) :
                       inPhaseOut ? scorpInitial - phaseOutFraction * Math.max(0, scorpInitial - scorpW2Cap) :
                       scorpInitial
    }

    // Total deduction
    const totalGrossDeduction = aggregateDeduction + scorpDeduction
    // Cap at 20% of (taxable income - net cap gains)
    const qualifiedIncomeCap = (taxableIncome - Math.max(0, taxableIncome - ordinaryIncome)) * 0.20
    const finalDeduction = Math.min(totalGrossDeduction, Math.max(0, qualifiedIncomeCap))

    // Tax savings
    const marginalRate = taxableIncome > (filingStatus === 'mfj' ? 731200 : 609350) ? 0.37 :
                         taxableIncome > (filingStatus === 'mfj' ? 487450 : 243725) ? 0.35 :
                         taxableIncome > (filingStatus === 'mfj' ? 383900 : 191950) ? 0.32 :
                         taxableIncome > (filingStatus === 'mfj' ? 201050 : 100525) ? 0.24 :
                         taxableIncome > (filingStatus === 'mfj' ? 94050 : 47150) ? 0.22 : 0.12

    const taxSavings = finalDeduction * marginalRate
    const effectiveDeductionPct = totalQBI > 0 ? finalDeduction / totalQBI * 100 : 0

    // Chart data
    const propChart = propResults.map(p => ({
      name: p.name.length > 16 ? p.name.slice(0, 14) + '…' : p.name,
      QBI: Math.max(0, p.qbi),
      Deduction: p.deduction,
      'W-2 Cap': p.limitCapW2,
    }))

    // Grouping impact: if all properties grouped as enterprise
    const groupedW2Total = properties.reduce((s, p) => s + p.w2Wages, 0)
    const groupedBasisTotal = properties.reduce((s, p) => s + p.qualifiedPropertyBasis, 0)
    const groupedW2Cap = Math.max(groupedW2Total * 0.50, groupedW2Total * 0.25 + groupedBasisTotal * 0.025)
    const groupedTotalQBI = propResults.reduce((s, p) => s + Math.max(0, p.qbi), 0)
    const groupedInitialDeduction = groupedTotalQBI * 0.20
    const groupedDeduction = overThreshold ? Math.min(groupedInitialDeduction, groupedW2Cap) : groupedInitialDeduction
    const groupingBenefit = groupedDeduction - aggregateDeduction

    return {
      threshold, phaseOutEnd, inPhaseOut, overThreshold, phaseOutFraction,
      propResults, totalQBI, aggregateDeduction, scorpDeduction,
      totalGrossDeduction, finalDeduction, taxSavings, marginalRate, effectiveDeductionPct,
      propChart, groupedDeduction, groupingBenefit,
    }
  }, [inp])

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h2 className="text-lg font-bold text-white">Section 199A QBI Deduction — Real Estate</h2>
        <p className="text-slate-400 text-xs mt-1">Calculate the 20% qualified business income deduction for rental properties — W-2 wage limits, UBIA, phase-out, and grouping elections</p>
      </div>

      {/* Taxpayer Profile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Taxpayer Profile</p>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Filing Status</label>
            <div className="flex gap-2">
              {(['single', 'mfj'] as const).map(s => (
                <button key={s} onClick={() => setInp(p => ({ ...p, filingStatus: s }))}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition ${inp.filingStatus === s ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                  {s === 'single' ? 'Single' : 'Married/MFJ'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Taxable Income</label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
              <input type="number" value={inp.taxableIncome} onChange={e => setInp(p => ({ ...p, taxableIncome: N(e.target.value) }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-5 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Ordinary Income (excl. rentals)</label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
              <input type="number" value={inp.ordinaryIncome} onChange={e => setInp(p => ({ ...p, ordinaryIncome: N(e.target.value) }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-5 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          <div className={`p-3 rounded-lg border text-xs ${calc.overThreshold ? 'bg-red-900/20 border-red-700/40' : calc.inPhaseOut ? 'bg-yellow-900/20 border-yellow-700/40' : 'bg-green-900/20 border-green-700/40'}`}>
            <p className={`font-bold ${calc.overThreshold ? 'text-red-300' : calc.inPhaseOut ? 'text-yellow-300' : 'text-green-300'}`}>
              {calc.overThreshold ? '⚠️ Above Phase-Out — W-2/UBIA limits apply fully' :
               calc.inPhaseOut ? `⚡ In Phase-Out Zone (${(calc.phaseOutFraction * 100).toFixed(0)}% of limitation)` :
               '✓ Below Threshold — Full 20% deduction (no W-2 limit)'}
            </p>
            <p className="text-slate-500 mt-1">{inp.filingStatus === 'mfj' ? 'MFJ' : 'Single'} threshold: ${calc.threshold.toLocaleString()} | Phase-out ends: ${calc.phaseOutEnd.toLocaleString()}</p>
          </div>

          <div className="space-y-2">
            {[
              { label: 'Real Estate Professional Status', key: 'isRealEstatePro' as const },
              { label: 'Group All Properties as Enterprise', key: 'isGroupedEnterprise' as const },
              { label: 'Include S-Corp Passthrough', key: 'hasSCorpPassthrough' as const },
            ].map(t => (
              <div key={t.key} className="flex items-center justify-between">
                <span className="text-xs text-slate-400">{t.label}</span>
                <button onClick={() => setInp(p => ({ ...p, [t.key]: !p[t.key] }))}
                  className={`w-11 h-6 rounded-full transition-colors ${inp[t.key] ? 'bg-blue-500' : 'bg-slate-700'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full mx-1 transition-transform ${inp[t.key] ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            ))}
          </div>
          {inp.hasSCorpPassthrough && (
            <div className="space-y-2 pt-1">
              <div>
                <label className="block text-xs text-slate-400 mb-1">S-Corp QBI</label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
                  <input type="number" value={inp.scorporationQBI} onChange={e => setInp(p => ({ ...p, scorporationQBI: N(e.target.value) }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-5 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">S-Corp W-2 Wages</label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
                  <input type="number" value={inp.scorporationW2} onChange={e => setInp(p => ({ ...p, scorporationW2: N(e.target.value) }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-5 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="space-y-3">
          <div className="bg-blue-900/20 rounded-xl p-5 border border-blue-700/40 text-center">
            <p className="text-xs text-slate-400 uppercase tracking-widest">§199A QBI Deduction</p>
            <p className="text-4xl font-black text-white mt-2">{fmt(calc.finalDeduction)}</p>
            <p className="text-sm text-green-400 font-bold mt-1">Tax Savings: {fmt(calc.taxSavings)}</p>
            <p className="text-xs text-slate-500 mt-1">At {(calc.marginalRate * 100).toFixed(0)}% marginal rate</p>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-slate-400">Total QBI (all properties)</span><span className="text-slate-200 font-bold">{fmt(calc.totalQBI)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">20% Initial Deduction</span><span className="text-blue-400">{fmt(calc.aggregateDeduction + calc.scorpDeduction)}</span></div>
            {calc.overThreshold && <div className="flex justify-between"><span className="text-slate-400">After W-2/UBIA Cap</span><span className="text-yellow-400">{fmt(calc.totalGrossDeduction)}</span></div>}
            <div className="flex justify-between"><span className="text-slate-400">20% of Taxable Income Cap</span><span className="text-slate-400">{fmt(inp.taxableIncome * 0.20)}</span></div>
            <div className="flex justify-between border-t border-slate-700 pt-1.5 mt-1.5"><span className="text-white font-bold">Final §199A Deduction</span><span className="text-green-400 font-black">{fmt(calc.finalDeduction)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Effective Deduction / QBI</span><span className="text-purple-400">{calc.effectiveDeductionPct.toFixed(1)}%</span></div>
          </div>

          {calc.groupingBenefit > 1000 && !inp.isGroupedEnterprise && (
            <div className="bg-green-900/20 rounded-xl p-4 border border-green-700/40">
              <p className="text-xs font-bold text-green-300 uppercase tracking-widest">💡 Grouping Opportunity</p>
              <p className="text-sm text-white mt-1">Grouping all properties as one enterprise adds <span className="text-green-400 font-black">{fmt(calc.groupingBenefit)}</span> to your deduction by pooling W-2 wages across properties.</p>
            </div>
          )}
        </div>
      </div>

      {/* Per-Property Table */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 overflow-x-auto">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Per-Property Analysis</p>
          <div className="flex gap-2">
            <input value={newPropName} onChange={e => setNewPropName(e.target.value)} placeholder="Property name"
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-xs text-white focus:outline-none focus:border-blue-500 w-36" />
            <button onClick={addProperty} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-lg text-xs font-bold transition">+ Add</button>
          </div>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700">
              {['Property', 'Net Income', 'Depreciation', 'QBI', 'W-2 Wages', 'UBIA', 'W-2 Cap', 'Deduction', ''].map(h => (
                <th key={h} className="text-left py-2 px-2 text-slate-500 font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {calc.propResults.map(p => (
              <tr key={p.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                <td className="py-2 px-2">
                  <input value={p.name} onChange={e => updateProp(p.id, 'name', e.target.value)}
                    className="bg-transparent text-slate-200 focus:outline-none w-36 focus:bg-slate-800 rounded px-1" />
                </td>
                {(['netRentalIncome', 'depreciation'] as const).map(k => (
                  <td key={k} className="py-2 px-2">
                    <div className="relative">
                      <span className="absolute left-1 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
                      <input type="number" value={p[k]} onChange={e => updateProp(p.id, k, e.target.value)}
                        className="w-24 bg-slate-800 border border-slate-700 rounded pl-4 pr-2 py-1 text-white focus:outline-none focus:border-blue-500" />
                    </div>
                  </td>
                ))}
                <td className="py-2 px-2 font-semibold text-blue-400">{fmt(p.qbi)}</td>
                {(['w2Wages', 'qualifiedPropertyBasis'] as const).map(k => (
                  <td key={k} className="py-2 px-2">
                    <div className="relative">
                      <span className="absolute left-1 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
                      <input type="number" value={p[k]} onChange={e => updateProp(p.id, k, e.target.value)}
                        className="w-24 bg-slate-800 border border-slate-700 rounded pl-4 pr-2 py-1 text-white focus:outline-none focus:border-blue-500" />
                    </div>
                  </td>
                ))}
                <td className="py-2 px-2 text-yellow-400">{fmt(p.limitCapW2)}</td>
                <td className="py-2 px-2 text-green-400 font-bold">{fmt(p.deduction)}</td>
                <td className="py-2 px-2">
                  <button onClick={() => removeProperty(p.id)} className="text-slate-600 hover:text-red-400 transition text-lg">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bar Chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">QBI vs Deduction vs W-2 Cap per Property</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={calc.propChart}>
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="QBI" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Deduction" fill="#22c55e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="W-2 Cap" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tips */}
      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">§199A Planning Strategies</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
          {[
            '✓ REP (Real Estate Professional) status: 750+ hrs/yr & most personal services in RE → no W-2 limit',
            '✓ Hire property management employees to create W-2 wages and unlock the deduction',
            '✓ Cost segregation studies increase UBIA qualified property basis, expanding the 2.5% limitation',
            '✓ Group properties under Reg §1.469-4 — combine W-2 wages from all properties in the enterprise',
            '⚠️ Self-rental (lease to own business): generally qualifies if REP or grouping election is made',
            '⚠️ Triple-net (NNN) leases may not qualify as a trade/business unless significant services are provided',
            '📋 Prop. Reg. 1.199A-1: rental activity qualifies as a trade/business if 250+ hours of rental services/yr',
            '🏦 S-Corp election can increase the QBI deduction for high-income SSTB owners via wage strategies',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>
    </div>
  )
}
