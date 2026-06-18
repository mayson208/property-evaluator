import { useState, useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from 'recharts'

interface DSTOffering {
  name: string
  assetType: string
  targetCashYield: number
  appreciationTarget: number
  holdYears: number
  leverage: number
  minInvestment: number
  dstFee: number
}

const SAMPLE_DSTS: DSTOffering[] = [
  { name: 'Multifamily DST — Sunbelt', assetType: 'Multi-Family', targetCashYield: 5.2, appreciationTarget: 3.5, holdYears: 7, leverage: 55, minInvestment: 100000, dstFee: 8.5 },
  { name: 'Net Lease Industrial DST', assetType: 'Industrial NNN', targetCashYield: 4.8, appreciationTarget: 2.8, holdYears: 10, leverage: 40, minInvestment: 100000, dstFee: 7.0 },
  { name: 'Self Storage Portfolio DST', assetType: 'Self Storage', targetCashYield: 5.5, appreciationTarget: 4.0, holdYears: 5, leverage: 45, minInvestment: 100000, dstFee: 9.0 },
  { name: 'Medical Office DST', assetType: 'Medical Office', targetCashYield: 5.0, appreciationTarget: 2.5, holdYears: 8, leverage: 50, minInvestment: 250000, dstFee: 8.0 },
  { name: 'Core Plus Retail NNN DST', assetType: 'Retail NNN', targetCashYield: 5.8, appreciationTarget: 2.0, holdYears: 12, leverage: 35, minInvestment: 100000, dstFee: 6.5 },
]

interface Inputs {
  exchangeGain: number
  deferredTaxRate: number
  investmentAmount: number
  selectedDSTIndex: number
  customYield: number
  customAppreciation: number
  customHoldYears: number
  customLeverage: number
  customFee: number
  useCustom: boolean
  filingStatus: 'single' | 'mfj'
  agi: number
  currentPropertyNOI: number
}

const DEF: Inputs = {
  exchangeGain: 450000,
  deferredTaxRate: 23.8,
  investmentAmount: 500000,
  selectedDSTIndex: 0,
  customYield: 5.0,
  customAppreciation: 3.5,
  customHoldYears: 7,
  customLeverage: 50,
  customFee: 8.0,
  useCustom: false,
  filingStatus: 'mfj',
  agi: 350000,
  currentPropertyNOI: 28000,
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const pct = (n: number) => `${n.toFixed(2)}%`
const N = (v: string) => parseFloat(v) || 0
const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7']

export default function DSTCalc() {
  const [inp, setInp] = useState<Inputs>(DEF)
  const set = (k: keyof Inputs, v: string | boolean | 'single' | 'mfj') =>
    setInp(p => ({ ...p, [k]: typeof DEF[k] === 'number' ? N(v as string) : v }))

  const calc = useMemo(() => {
    const { exchangeGain, deferredTaxRate, investmentAmount, selectedDSTIndex,
            customYield, customAppreciation, customHoldYears, customLeverage,
            customFee, useCustom, agi, filingStatus, currentPropertyNOI } = inp

    const offering = useCustom
      ? { name: 'Custom DST', assetType: 'Custom', targetCashYield: customYield, appreciationTarget: customAppreciation, holdYears: customHoldYears, leverage: customLeverage, minInvestment: 100000, dstFee: customFee }
      : SAMPLE_DSTS[selectedDSTIndex]

    // Tax deferral value
    const taxDeferred = exchangeGain * deferredTaxRate / 100
    const capitalDeployed = investmentAmount // all equity proceeds reinvested

    // DST sponsor fee impact
    const afterFeeCapital = capitalDeployed * (1 - offering.dstFee / 100)

    // Annual distributions
    const annualCash = afterFeeCapital * offering.targetCashYield / 100
    const niitApplies = agi > (filingStatus === 'mfj' ? 250000 : 200000)

    // Tax on distributions (passive income)
    const ordinaryIncomeTax = annualCash * 0.37 * 0.6 // mix of return of capital + ordinary
    const niitOnCash = niitApplies ? annualCash * 0.038 : 0
    const afterTaxAnnualCash = annualCash - ordinaryIncomeTax - niitOnCash

    // Leverage amplification
    const totalAssetValue = afterFeeCapital / (1 - offering.leverage / 100)
    const totalDebt = totalAssetValue * offering.leverage / 100

    // Exit value at end of hold
    const exitAssetValue = totalAssetValue * Math.pow(1 + offering.appreciationTarget / 100, offering.holdYears)
    const exitEquity = exitAssetValue - totalDebt
    const exitProfit = exitEquity - afterFeeCapital
    const totalCashReceived = annualCash * offering.holdYears

    // Total return
    const totalReturn = exitEquity + totalCashReceived
    const totalROI = (totalReturn - capitalDeployed) / capitalDeployed * 100
    const annualizedReturn = Math.pow(totalReturn / capitalDeployed, 1 / offering.holdYears) * 100 - 100

    // vs NOT doing 1031 (paying tax now, investing rest)
    const afterTaxCapital = capitalDeployed - taxDeferred
    const stockMarketReturn = 8.0 / 100 // 8% S&P assumption
    const noExchangeWealth = afterTaxCapital * Math.pow(1 + stockMarketReturn, offering.holdYears)
    const noExchangeAfterCGTax = noExchangeWealth - (noExchangeWealth - afterTaxCapital) * 0.238
    const dstAdvantage = totalReturn - noExchangeAfterCGTax

    // Comparison with own active property
    const activePropertyCash = currentPropertyNOI * offering.holdYears
    const activePropertyWealth = capitalDeployed * Math.pow(1 + (offering.appreciationTarget + 0.5) / 100, offering.holdYears)

    // Year-by-year
    const yearData = Array.from({ length: offering.holdYears + 1 }, (_, y) => {
      const cumCash = annualCash * y
      const assetVal = totalAssetValue * Math.pow(1 + offering.appreciationTarget / 100, y)
      const equity = assetVal - totalDebt
      const noExch = afterTaxCapital * Math.pow(1 + stockMarketReturn, y)
      return {
        year: y,
        dstTotal: equity + cumCash,
        noExchange: noExch,
        dstCumCash: cumCash,
        dstEquity: equity,
      }
    })

    // Fee impact pie
    const feePie = [
      { name: 'Invested Capital', value: afterFeeCapital },
      { name: 'Sponsor Fee', value: capitalDeployed * offering.dstFee / 100 },
    ]

    return {
      offering, taxDeferred, capitalDeployed, afterFeeCapital,
      annualCash, niitApplies, afterTaxAnnualCash,
      totalAssetValue, totalDebt, exitAssetValue, exitEquity, exitProfit,
      totalCashReceived, totalReturn, totalROI, annualizedReturn,
      afterTaxCapital, noExchangeWealth, noExchangeAfterCGTax, dstAdvantage,
      activePropertyCash, activePropertyWealth, yearData, feePie,
    }
  }, [inp])

  const field = (label: string, key: keyof Inputs, prefix = '', suffix = '', step = '1') => (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{prefix}</span>}
        <input type="number" step={step} value={inp[key] as number} onChange={e => set(key, e.target.value)}
          className={`w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 ${prefix ? 'pl-5 pr-3' : suffix ? 'pl-3 pr-7' : 'px-3'}`} />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{suffix}</span>}
      </div>
    </div>
  )

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h2 className="text-lg font-bold text-white">Delaware Statutory Trust (DST) Analyzer</h2>
        <p className="text-slate-400 text-xs mt-1">Model passive 1031 exchange into a DST — tax deferral value, cash yield, exit proceeds, and comparison to active ownership</p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">1031 Exchange Details</p>
          {field('Recognized Gain Being Deferred', 'exchangeGain', '$')}
          {field('Combined Tax Rate on Gain', 'deferredTaxRate', '', '%', '0.1')}
          {field('Investment Amount (equity)', 'investmentAmount', '$')}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Filing Status</label>
            <div className="flex gap-2">
              {(['single', 'mfj'] as const).map(s => (
                <button key={s} onClick={() => set('filingStatus', s)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition ${inp.filingStatus === s ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                  {s === 'single' ? 'Single' : 'Married'}
                </button>
              ))}
            </div>
          </div>
          {field('AGI (excl. real estate gains)', 'agi', '$')}
          {field('Current Property Annual NOI', 'currentPropertyNOI', '$')}
          <div className="p-3 bg-blue-900/20 rounded-lg border border-blue-700/40">
            <p className="text-xs text-blue-300 font-semibold">Tax Deferred</p>
            <p className="text-xl font-black text-white">{fmt(calc.taxDeferred)}</p>
            <p className="text-xs text-blue-200/70 mt-1">Available to compound in DST vs paying to IRS now</p>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">DST Selection</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Use Custom Inputs</span>
            <button onClick={() => set('useCustom', !inp.useCustom)}
              className={`w-11 h-6 rounded-full transition-colors ${inp.useCustom ? 'bg-blue-500' : 'bg-slate-700'}`}>
              <div className={`w-4 h-4 bg-white rounded-full mx-1 transition-transform ${inp.useCustom ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          {!inp.useCustom ? (
            <div className="space-y-2">
              {SAMPLE_DSTS.map((dst, i) => (
                <button key={i} onClick={() => setInp(p => ({ ...p, selectedDSTIndex: i }))}
                  className={`w-full text-left p-3 rounded-lg border text-xs transition ${inp.selectedDSTIndex === i ? 'bg-blue-900/30 border-blue-600 text-white' : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                  <p className="font-bold text-sm">{dst.name}</p>
                  <p className="text-slate-500 mt-0.5">{dst.targetCashYield}% yield · {dst.holdYears}yr hold · {dst.leverage}% LTV · {dst.dstFee}% fee</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {field('Target Cash Yield', 'customYield', '', '%', '0.25')}
              {field('Appreciation Target', 'customAppreciation', '', '%', '0.25')}
              {field('Hold Period', 'customHoldYears', '', 'years')}
              {field('Leverage (LTV)', 'customLeverage', '', '%')}
              {field('Sponsor Fee', 'customFee', '', '%', '0.5')}
            </div>
          )}
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Selected DST Summary</p>
          <div className="space-y-2 text-xs">
            {[
              { label: 'Asset Type', value: calc.offering.assetType },
              { label: 'Target Cash Yield', value: `${calc.offering.targetCashYield}%` },
              { label: 'Appreciation Target', value: `${calc.offering.appreciationTarget}%/yr` },
              { label: 'Hold Period', value: `${calc.offering.holdYears} years` },
              { label: 'Leverage (LTV)', value: `${calc.offering.leverage}%` },
              { label: 'Total Asset Value', value: fmt(calc.totalAssetValue) },
              { label: 'Debt on Asset', value: fmt(calc.totalDebt) },
              { label: 'Sponsor Fee', value: `${calc.offering.dstFee}% (${fmt(calc.capitalDeployed * calc.offering.dstFee / 100)})` },
              { label: 'Net Invested Capital', value: fmt(calc.afterFeeCapital) },
              { label: 'Annual Cash Distribution', value: fmt(calc.annualCash) },
              { label: 'NIIT Applies', value: calc.niitApplies ? 'Yes (3.8%)' : 'No' },
            ].map(r => (
              <div key={r.label} className="flex justify-between">
                <span className="text-slate-400">{r.label}</span>
                <span className="text-slate-200 font-semibold">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Results Banner */}
      <div className="bg-green-900/20 rounded-xl p-5 border border-green-700/40">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-black text-green-400">{fmt(calc.annualCash)}</p>
            <p className="text-xs text-slate-400">Annual Cash Distribution</p>
            <p className="text-xs text-slate-500">{pct(calc.offering.targetCashYield)} yield</p>
          </div>
          <div>
            <p className="text-2xl font-black text-blue-400">{fmt(calc.exitEquity)}</p>
            <p className="text-xs text-slate-400">Exit Equity ({calc.offering.holdYears} yr)</p>
          </div>
          <div>
            <p className="text-2xl font-black text-purple-400">{pct(calc.annualizedReturn)}</p>
            <p className="text-xs text-slate-400">Annualized Return</p>
          </div>
          <div>
            <p className={`text-2xl font-black ${calc.dstAdvantage > 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(calc.dstAdvantage)}</p>
            <p className="text-xs text-slate-400">DST vs Pay Tax + S&amp;P 500</p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">DST vs No-Exchange Wealth</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={calc.yearData}>
              <defs>
                <linearGradient id="dstGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="spGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#64748b" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#64748b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={v => `Yr ${v}`} />
              <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="dstTotal" stroke="#22c55e" fill="url(#dstGrad)" strokeWidth={2} name="DST Total Return" />
              <Area type="monotone" dataKey="noExchange" stroke="#64748b" fill="url(#spGrad)" strokeWidth={2} name="Pay Tax + S&P 500" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Annual Cash + Equity Buildup</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={calc.yearData.slice(1)}>
              <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={v => `Yr ${v}`} />
              <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="dstCumCash" stackId="a" fill="#22c55e" name="Cumulative Cash" />
              <Bar dataKey="dstEquity" stackId="a" fill="#3b82f6" name="Equity" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Seven Deadly Sins of DST */}
      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">DST Rules &amp; Restrictions (IRS Rev. Rul. 2004-86)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
          {[
            { icon: '⛔', text: 'Once the offering is closed, no new capital contributions from DST investors allowed' },
            { icon: '⛔', text: 'Trustee cannot renegotiate existing loans or take on new financing' },
            { icon: '⛔', text: 'Trustee cannot reinvest proceeds from property sales — must distribute them' },
            { icon: '⛔', text: 'Trustee cannot make capital expenditures beyond normal maintenance and minor improvements' },
            { icon: '⛔', text: 'Trustee cannot enter into new leases or modify existing leases' },
            { icon: '⛔', text: 'Investor has no right to transfer interest except within the DST structure' },
            { icon: '⛔', text: 'DST investors are passive — no voting rights or day-to-day control' },
            { icon: '✓', text: 'Beneficial interests in a DST ARE like-kind property — eligible for future 1031 exchange' },
          ].map((t, i) => (
            <div key={i} className="flex gap-2">
              <span>{t.icon}</span>
              <span>{t.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
