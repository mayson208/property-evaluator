import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend, ReferenceLine } from 'recharts'

interface Inputs {
  salePrice: number
  adjustedBasis: number
  mortgageRelieved: number
  depreciationRecapture: number
  sellingExpenses: number
  downPayment: number
  interestRate: number
  installmentTermYears: number
  sellerTaxRate: number
  filingStatus: 'single' | 'mfj'
  agi: number
  investNoteProceeds: boolean
  investmentReturn: number
  alternativeSaleRate: number
}

const DEF: Inputs = {
  salePrice: 800000,
  adjustedBasis: 250000,
  mortgageRelieved: 300000,
  depreciationRecapture: 85000,
  sellingExpenses: 48000,
  downPayment: 200000,
  interestRate: 6.5,
  installmentTermYears: 10,
  sellerTaxRate: 23.8,
  filingStatus: 'mfj',
  agi: 280000,
  investNoteProceeds: true,
  investmentReturn: 6.0,
  alternativeSaleRate: 23.8,
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const pct = (n: number) => `${n.toFixed(2)}%`
const N = (v: string) => parseFloat(v) || 0

export default function InstallmentSaleCalc() {
  const [inp, setInp] = useState<Inputs>(DEF)
  const set = (k: keyof Inputs, v: string | boolean | 'single' | 'mfj') =>
    setInp(p => ({ ...p, [k]: typeof DEF[k] === 'number' ? N(v as string) : v }))

  const calc = useMemo(() => {
    const { salePrice, adjustedBasis, mortgageRelieved, depreciationRecapture,
            sellingExpenses, downPayment, interestRate, installmentTermYears,
            sellerTaxRate, agi, filingStatus, investNoteProceeds, investmentReturn,
            alternativeSaleRate } = inp

    // Gain calculation
    const contractPrice = salePrice - mortgageRelieved
    const realizedGain = salePrice - adjustedBasis - sellingExpenses
    const totalGain = realizedGain
    const ltcgGain = Math.max(0, totalGain - depreciationRecapture)
    const recaptureGain = depreciationRecapture

    // Installment note
    const noteBalance = contractPrice - downPayment
    const niitApplies = agi > (filingStatus === 'mfj' ? 250000 : 200000)
    const effectiveTaxRate = sellerTaxRate + (niitApplies ? 3.8 : 0)

    // Gross profit ratio (GPR)
    const grossProfitRatio = totalGain > 0 ? ltcgGain / contractPrice : 0

    // Annual principal payment
    const r = interestRate / 100 / 12
    const n2 = installmentTermYears * 12
    const monthlyPmt = r > 0 ? noteBalance * r / (1 - Math.pow(1 + r, -n2)) : noteBalance / n2
    const annualPmt = monthlyPmt * 12

    // Year-by-year schedule
    interface YearRow {
      year: number
      principalCollected: number
      interestCollected: number
      gainRecognized: number
      taxPaid: number
      noteBalance: number
      cumTaxPaid: number
      cumNetCash: number
      investedWealth?: number
    }

    const rows: YearRow[] = []
    let remainingNote = noteBalance
    let cumTax = 0
    let cumNetCash = downPayment - (downPayment * grossProfitRatio * effectiveTaxRate / 100) - (recaptureGain * 0.25)
    let investedWealth = investNoteProceeds ? cumNetCash * 1 : 0

    // Year 0 — down payment
    const downPaymentTax = (downPayment * grossProfitRatio + recaptureGain) * effectiveTaxRate / 100
    cumTax += downPaymentTax

    for (let y = 1; y <= installmentTermYears; y++) {
      let principal = 0
      let interest = 0
      let runBal = remainingNote
      for (let m = 0; m < 12; m++) {
        const i2 = runBal * (interestRate / 100) / 12
        const p = Math.min(monthlyPmt - i2, runBal)
        interest += i2
        principal += p
        runBal = Math.max(0, runBal - p)
      }

      const gainRecognized = principal * grossProfitRatio
      const taxPaid = gainRecognized * effectiveTaxRate / 100
      const netCash = principal + interest - taxPaid
      cumTax += taxPaid
      cumNetCash += netCash

      if (investNoteProceeds) {
        investedWealth = (investedWealth + netCash) * (1 + investmentReturn / 100)
      }

      rows.push({
        year: y,
        principalCollected: principal,
        interestCollected: interest,
        gainRecognized,
        taxPaid,
        noteBalance: runBal,
        cumTaxPaid: cumTax,
        cumNetCash,
        investedWealth: investNoteProceeds ? investedWealth : undefined,
      })

      remainingNote = runBal
    }

    // Comparison: outright sale + invest
    const outrightTax = (ltcgGain * alternativeSaleRate / 100) + (recaptureGain * 0.25)
    const outrightNetProceeds = salePrice - adjustedBasis - sellingExpenses - outrightTax
    let outrightWealth = downPayment + outrightNetProceeds
    const outrightWealthGrowth = Array.from({ length: installmentTermYears + 1 }, (_, y) => ({
      year: y,
      outrightWealth: (downPayment + outrightNetProceeds) * Math.pow(1 + investmentReturn / 100, y),
    }))

    const installmentFinalWealth = rows[rows.length - 1]?.investedWealth ?? rows[rows.length - 1]?.cumNetCash ?? 0
    const installmentVsOutright = installmentFinalWealth - outrightWealthGrowth[installmentTermYears].outrightWealth

    // Total interest income
    const totalInterest = rows.reduce((s, r2) => s + r2.interestCollected, 0)
    const totalPrincipal = rows.reduce((s, r2) => s + r2.principalCollected, 0) + downPayment
    const totalTaxInstallment = rows.reduce((s, r2) => s + r2.taxPaid, 0) + downPaymentTax

    // Chart data
    const chartData = rows.map(r2 => ({
      year: r2.year,
      gainRecognized: r2.gainRecognized,
      taxPaid: r2.taxPaid,
      interestIncome: r2.interestCollected,
      installmentWealth: r2.investedWealth ?? r2.cumNetCash,
      outrightWealth: outrightWealthGrowth[r2.year]?.outrightWealth ?? 0,
    }))

    return {
      contractPrice, realizedGain, ltcgGain, recaptureGain,
      grossProfitRatio, noteBalance, annualPmt, monthlyPmt,
      niitApplies, effectiveTaxRate, downPaymentTax,
      rows, totalInterest, totalPrincipal, totalTaxInstallment,
      outrightTax, outrightNetProceeds, installmentFinalWealth,
      installmentVsOutright, chartData, outrightWealthGrowth,
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
        <h2 className="text-lg font-bold text-white">Installment Sale Calculator (IRC §453)</h2>
        <p className="text-slate-400 text-xs mt-1">Model seller-financed installment sales — spread gain recognition over years, reduce current-year tax, and compare to outright sale</p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Property &amp; Sale</p>
          {field('Sale Price', 'salePrice', '$')}
          {field('Adjusted Basis', 'adjustedBasis', '$')}
          {field('Mortgage Relieved (assumed)', 'mortgageRelieved', '$')}
          {field('Depreciation Recapture', 'depreciationRecapture', '$')}
          {field('Selling Expenses', 'sellingExpenses', '$')}
          <div className="p-3 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Realized Gain</span><span className="text-white font-bold">{fmt(calc.realizedGain)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">LTCG Portion</span><span className="text-green-400">{fmt(calc.ltcgGain)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Deprec Recapture (25%)</span><span className="text-orange-400">{fmt(calc.recaptureGain)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Gross Profit Ratio</span><span className="text-blue-400 font-bold">{pct(calc.grossProfitRatio * 100)}</span></div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Note Terms</p>
          {field('Down Payment', 'downPayment', '$')}
          {field('Interest Rate', 'interestRate', '', '%', '0.25')}
          {field('Term', 'installmentTermYears', '', 'years')}
          <div className="p-3 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Note Balance</span><span className="text-white">{fmt(calc.noteBalance)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Monthly Payment</span><span className="text-blue-400 font-bold">{fmt(calc.monthlyPmt)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Annual Payment</span><span className="text-blue-400">{fmt(calc.annualPmt)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Total Interest Income</span><span className="text-green-400">{fmt(calc.totalInterest)}</span></div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Tax &amp; Comparison</p>
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
          {field('AGI (excl. gain)', 'agi', '$')}
          {field('Combined LTCG + State Rate', 'sellerTaxRate', '', '%', '0.1')}
          {field('Alt. Outright Sale Rate', 'alternativeSaleRate', '', '%', '0.1')}
          {field('Investment Return on Proceeds', 'investmentReturn', '', '%', '0.5')}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Re-Invest Note Proceeds</span>
            <button onClick={() => set('investNoteProceeds', !inp.investNoteProceeds)}
              className={`w-11 h-6 rounded-full transition-colors ${inp.investNoteProceeds ? 'bg-blue-500' : 'bg-slate-700'}`}>
              <div className={`w-4 h-4 bg-white rounded-full mx-1 transition-transform ${inp.investNoteProceeds ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          <div className="p-3 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">NIIT (3.8%) Applies</span><span className={calc.niitApplies ? 'text-orange-400' : 'text-green-400'}>{calc.niitApplies ? 'Yes' : 'No'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Effective Rate</span><span className="text-red-400 font-bold">{pct(calc.effectiveTaxRate)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Outright Sale Tax</span><span className="text-red-400">{fmt(calc.outrightTax)}</span></div>
          </div>
        </div>
      </div>

      {/* Comparison Banner */}
      <div className={`rounded-xl p-5 border ${calc.installmentVsOutright > 0 ? 'bg-green-900/20 border-green-700/40' : 'bg-red-900/20 border-red-700/40'}`}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-black text-red-400">{fmt(calc.totalTaxInstallment)}</p>
            <p className="text-xs text-slate-400">Total Tax (Installment)</p>
          </div>
          <div>
            <p className="text-2xl font-black text-orange-400">{fmt(calc.outrightTax)}</p>
            <p className="text-xs text-slate-400">Tax (Outright Sale)</p>
          </div>
          <div>
            <p className="text-2xl font-black text-green-400">{fmt(calc.installmentFinalWealth)}</p>
            <p className="text-xs text-slate-400">Installment Final Wealth</p>
          </div>
          <div>
            <p className={`text-2xl font-black ${calc.installmentVsOutright > 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(calc.installmentVsOutright)}</p>
            <p className="text-xs text-slate-400">Installment vs Outright</p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Annual Gain Recognition &amp; Tax</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={calc.chartData}>
              <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={v => `Yr ${v}`} />
              <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="gainRecognized" name="Gain Recognized" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="taxPaid" name="Tax Paid" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Wealth: Installment vs Outright Sale</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={calc.chartData}>
              <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={v => `Yr ${v}`} />
              <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="installmentWealth" stroke="#22c55e" strokeWidth={2} dot={false} name="Installment" />
              <Line type="monotone" dataKey="outrightWealth" stroke="#64748b" strokeWidth={2} dot={false} name="Outright Sale" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Amortization Table */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 overflow-x-auto">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Year-by-Year Schedule</p>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700">
              {['Year', 'Principal', 'Interest', 'Gain Recognized', 'Tax Paid', 'Note Balance', 'Cum Tax'].map(h => (
                <th key={h} className="text-left py-2 px-2 text-slate-500 font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {calc.rows.map(r => (
              <tr key={r.year} className="border-b border-slate-800 hover:bg-slate-800/30">
                <td className="py-1.5 px-2 text-slate-400">Yr {r.year}</td>
                <td className="py-1.5 px-2 text-slate-200">{fmt(r.principalCollected)}</td>
                <td className="py-1.5 px-2 text-green-400">{fmt(r.interestCollected)}</td>
                <td className="py-1.5 px-2 text-blue-400">{fmt(r.gainRecognized)}</td>
                <td className="py-1.5 px-2 text-red-400">{fmt(r.taxPaid)}</td>
                <td className="py-1.5 px-2 text-slate-400">{fmt(r.noteBalance)}</td>
                <td className="py-1.5 px-2 text-orange-400">{fmt(r.cumTaxPaid)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Rules & Tips */}
      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Installment Sale Rules (IRC §453)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
          {[
            '✓ Spreads gain recognition over years payments are received — reduces bunching into one tax year',
            '⚠️ Depreciation recapture (§1245/§1250) is FULLY recognized in the year of sale — not spread',
            '⚠️ If buyer assumes existing mortgage > seller\'s basis, excess is "boot" taxed in Year 1',
            '⚠️ Installment sale election must be made on original return — late election requires IRS permission',
            '⚠️ If note is later sold/discounted, remaining deferred gain is accelerated immediately',
            '💡 Interest income is taxed as ordinary income — plan Adequate Stated Interest (AFR compliance)',
            '💡 Can be combined with 1031 exchange for the down payment portion in creative structures',
            '🔒 Must not be inventory property (dealer), publicly traded securities, or depreciation recapture',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>
    </div>
  )
}
