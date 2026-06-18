import { useState, useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts'

interface Inputs {
  originalGain: number
  investmentYear: number
  qozInvestment: number
  annualAppreciation: number
  holdYears: number
  deferredTaxRate: number
  ltcgRate: number
  alternativeReturn: number
}

const DEFER_DEADLINE = 2026

const DEF: Inputs = {
  originalGain: 500000,
  investmentYear: 2025,
  qozInvestment: 500000,
  annualAppreciation: 8,
  holdYears: 12,
  deferredTaxRate: 23.8,
  ltcgRate: 23.8,
  alternativeReturn: 8,
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const N = (v: string) => parseFloat(v) || 0

export default function OpportunityZone() {
  const [inp, setInp] = useState<Inputs>(DEF)
  const set = (k: keyof Inputs, v: string) => setInp(p => ({ ...p, [k]: N(v) }))

  const calc = useMemo(() => {
    const { originalGain, investmentYear, qozInvestment, annualAppreciation,
            holdYears, deferredTaxRate, ltcgRate, alternativeReturn } = inp

    const exitYear = investmentYear + holdYears
    const qualifiesFor10YrExclusion = holdYears >= 10
    const deferralRecognitionYear = Math.min(exitYear, DEFER_DEADLINE + 1)
    const deferredTaxDue = originalGain * deferredTaxRate / 100
    const yearsUntilDeferredTax = Math.max(0, deferralRecognitionYear - investmentYear)

    const qozFV = qozInvestment * Math.pow(1 + annualAppreciation / 100, holdYears)
    const qozAppreciation = qozFV - qozInvestment
    const appreciationTax = qualifiesFor10YrExclusion ? 0 : qozAppreciation * ltcgRate / 100
    const netQOZ = qozFV - deferredTaxDue - appreciationTax

    const taxPaidNow = originalGain * deferredTaxRate / 100
    const altCapital = qozInvestment - taxPaidNow
    const altFV = altCapital > 0 ? altCapital * Math.pow(1 + alternativeReturn / 100, holdYears) : 0
    const altCapGain = Math.max(0, altFV - altCapital)
    const altTax = altCapGain * ltcgRate / 100
    const netAlt = altFV - altTax

    const advantage = netQOZ - netAlt
    const advantagePct = netAlt > 0 ? advantage / netAlt * 100 : 0
    const npvDeferral = deferredTaxDue - deferredTaxDue / Math.pow(1 + alternativeReturn / 100, yearsUntilDeferredTax)

    const years = Array.from({ length: holdYears + 1 }, (_, i) => i)
    const yearlyData = years.map(y => {
      const curYear = investmentYear + y
      const qozValue = qozInvestment * Math.pow(1 + annualAppreciation / 100, y)
      const altValue = altCapital > 0 ? altCapital * Math.pow(1 + alternativeReturn / 100, y) : 0
      return {
        year: curYear,
        qozGross: Math.round(qozValue),
        altNet: Math.round(altValue),
      }
    })

    const scenarios = [
      { label: 'Hold < 5 years', hold: 4, note: 'Deferred + appreciation tax both owed' },
      { label: 'Hold 5–9 years', hold: 7, note: 'Deferred gain owed in 2027, no app exclusion' },
      { label: 'Hold 10 years', hold: 10, note: '10-yr exclusion: $0 tax on OZ appreciation' },
      { label: 'Hold 15 years', hold: 15, note: 'Maximum appreciation exclusion' },
    ].map(s => {
      const fv = qozInvestment * Math.pow(1 + annualAppreciation / 100, s.hold)
      const appGain = fv - qozInvestment
      const appTax = s.hold >= 10 ? 0 : appGain * ltcgRate / 100
      const net = fv - deferredTaxDue - appTax
      const altFV2 = altCapital > 0 ? altCapital * Math.pow(1 + alternativeReturn / 100, s.hold) : 0
      const altNet2 = altFV2 - Math.max(0, altFV2 - altCapital) * ltcgRate / 100
      return { ...s, fv, net, altNet: altNet2, advantage: net - altNet2, appTax }
    })

    return {
      deferredTaxDue, qualifiesFor10YrExclusion, appreciationTax,
      qozFV, netQOZ, netAlt, advantage, advantagePct,
      npvDeferral, yearsUntilDeferredTax, exitYear,
      altCapital, yearlyData, scenarios, deferralRecognitionYear,
    }
  }, [inp])

  const field = (label: string, key: keyof Inputs, suffix = '', prefix = '') => (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{prefix}</span>}
        <input type="number" step="any" value={inp[key] as number} onChange={e => set(key, e.target.value)}
          className={`w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 ${prefix ? 'pl-5 pr-3' : suffix ? 'pl-3 pr-8' : 'px-3'}`} />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{suffix}</span>}
      </div>
    </div>
  )

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h2 className="text-lg font-bold text-white">Qualified Opportunity Zone (QOZ) Calculator</h2>
        <p className="text-slate-400 text-xs mt-1">Model OZ tax deferral, 10-year appreciation exclusion, and total advantage vs paying tax and reinvesting</p>
      </div>

      <div className="bg-blue-900/20 border border-blue-700/40 rounded-xl p-4 text-xs">
        <p className="text-blue-300 font-bold mb-2">How Qualified Opportunity Zones Work</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-slate-400">
          <div><span className="text-blue-400 font-bold">Step 1 — Defer:</span> Reinvest capital gain into a QOZ fund within 180 days. Original gain deferred until exit or 12/31/2026.</div>
          <div><span className="text-blue-400 font-bold">Step 2 — Grow:</span> Investment grows inside the QOZ fund. Original deferred tax is still owed at the deadline.</div>
          <div><span className="text-blue-400 font-bold">Step 3 — Exclude:</span> Hold 10+ years → basis steps up to FMV → zero tax on all QOZ appreciation at exit.</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Gain & Investment</p>
          {field('Capital Gain Being Deferred', 'originalGain', '', '$')}
          {field('QOZ Fund Investment Amount', 'qozInvestment', '', '$')}
          {field('Year of Investment', 'investmentYear')}
          {field('Planned Hold Period (years)', 'holdYears', 'yr')}
          <div className={`p-2 rounded-lg text-xs ${inp.holdYears >= 10 ? 'bg-green-900/30 border border-green-700/40' : 'bg-orange-900/20 border border-orange-700/40'}`}>
            {inp.holdYears >= 10
              ? <p className="text-green-300">✓ 10+ year hold qualifies for full appreciation exclusion</p>
              : <p className="text-orange-300">⚠️ Hold at least 10 years to exclude OZ appreciation from tax</p>}
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Growth & Tax Rates</p>
          {field('QOZ Fund Annual Return', 'annualAppreciation', '%')}
          {field('Alternative Investment Return', 'alternativeReturn', '%')}
          {field('Tax Rate on Deferred Gain', 'deferredTaxRate', '%')}
          {field('LTCG Rate (alt investment)', 'ltcgRate', '%')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Deferred Tax Owed</span><span className="text-red-400 font-bold">{fmt(calc.deferredTaxDue)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Due Date</span><span className="text-slate-300">2027 (2026 deadline)</span></div>
            <div className="flex justify-between"><span className="text-slate-400">NPV Benefit of Deferral</span><span className="text-green-400 font-bold">{fmt(calc.npvDeferral)}</span></div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Exit Summary (Yr {inp.holdYears})</p>
          <div className="space-y-2">
            {[
              { label: 'QOZ Fund Value at Exit', val: calc.qozFV, color: 'text-white' },
              { label: 'Tax on Deferred Gain', val: -calc.deferredTaxDue, color: 'text-red-400' },
              { label: 'Tax on Appreciation', val: -calc.appreciationTax, color: calc.appreciationTax === 0 ? 'text-green-400' : 'text-red-400' },
              { label: 'Net QOZ Proceeds', val: calc.netQOZ, color: 'text-blue-400 font-bold' },
            ].map(row => (
              <div key={row.label} className="flex justify-between text-xs border-b border-slate-700/50 pb-1">
                <span className="text-slate-400">{row.label}</span>
                <span className={row.color}>{row.val < 0 ? `-${fmt(Math.abs(row.val))}` : fmt(row.val)}</span>
              </div>
            ))}
            <div className="flex justify-between text-xs pt-1">
              <span className="text-slate-400">Alt: pay tax now, invest remainder</span>
              <span className="text-slate-300">{fmt(calc.netAlt)}</span>
            </div>
            <div className={`flex justify-between text-xs font-bold ${calc.advantage > 0 ? 'text-green-400' : 'text-red-400'}`}>
              <span>QOZ Advantage</span>
              <span>{calc.advantage > 0 ? '+' : ''}{fmt(calc.advantage)} ({calc.advantagePct.toFixed(1)}%)</span>
            </div>
          </div>
          {calc.appreciationTax === 0 && (
            <div className="p-2 bg-green-900/20 border border-green-600/40 rounded-lg text-xs text-green-300">
              🎉 $0 tax on {fmt(calc.qozFV - inp.qozInvestment)} of appreciation — 10-yr exclusion active
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">QOZ Gross Value vs Alternative Net (After Tax)</p>
        <ResponsiveContainer width="100%" height={230}>
          <AreaChart data={calc.yearlyData}>
            <defs>
              <linearGradient id="ozGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="altGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="qozGross" stroke="#3b82f6" fill="url(#ozGrad)" strokeWidth={2} dot={false} name="QOZ Gross Value" />
            <Area type="monotone" dataKey="altNet" stroke="#94a3b8" fill="url(#altGrad)" strokeWidth={2} dot={false} name="Alt Net (after tax)" />
            <ReferenceLine x={calc.deferralRecognitionYear} stroke="#ef444466" strokeDasharray="4 2"
              label={{ value: '2026 Tax Due', fill: '#ef4444', fontSize: 9 }} />
            {inp.holdYears >= 10 && (
              <ReferenceLine x={inp.investmentYear + 10} stroke="#22c55e66" strokeDasharray="4 2"
                label={{ value: '10-yr Exclusion', fill: '#22c55e', fontSize: 9 }} />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Hold Period Scenarios</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="text-left py-1.5 pr-4">Scenario</th>
                <th className="text-right py-1.5 pr-4">QOZ Value</th>
                <th className="text-right py-1.5 pr-4">App Tax</th>
                <th className="text-right py-1.5 pr-4">Net Proceeds</th>
                <th className="text-right py-1.5 pr-4">Alt Strategy</th>
                <th className="text-right py-1.5">OZ Advantage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {calc.scenarios.map(s => (
                <tr key={s.label} className={s.hold === inp.holdYears ? 'bg-blue-900/20' : ''}>
                  <td className="py-1.5 pr-4">
                    <p className="font-semibold text-slate-200">{s.label}</p>
                    <p className="text-slate-500">{s.note}</p>
                  </td>
                  <td className="text-right py-1.5 pr-4 text-slate-300">{fmt(s.fv)}</td>
                  <td className="text-right py-1.5 pr-4">{s.appTax === 0 ? <span className="text-green-400">$0 ✓</span> : <span className="text-red-400">{fmt(s.appTax)}</span>}</td>
                  <td className="text-right py-1.5 pr-4 text-blue-400 font-bold">{fmt(s.net)}</td>
                  <td className="text-right py-1.5 pr-4 text-slate-400">{fmt(s.altNet)}</td>
                  <td className={`text-right py-1.5 font-bold ${s.advantage > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {s.advantage > 0 ? '+' : ''}{fmt(s.advantage)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">QOZ Rules & Key Requirements</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
          {[
            '⏱️ Must invest within 180 days of the gain event (sale or fiscal year-end for pass-throughs)',
            '📅 Deferred gain recognized 12/31/2026 — tax due in 2027 even if still holding the fund',
            '🏗️ QOZ Business must hold 90% of assets in qualified opportunity zone property (tested semi-annually)',
            '🔨 Substantial improvement required: must double the depreciable basis within 30 months',
            '💰 Fund must be a corporation or partnership — individuals cannot hold QOZ property directly',
            '📋 File Form 8949 to elect deferral and Form 8997 annually while holding',
            '🔄 Any capital gain qualifies: stocks, real estate, business sales, crypto, collectibles',
            '⚠️ Investors in 2025+ have very limited deferral window — appreciation exclusion is now the primary benefit',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>
    </div>
  )
}
