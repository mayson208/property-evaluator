import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend, AreaChart, Area } from 'recharts'

interface Inputs {
  accountType: 'traditional' | 'roth'
  currentBalance: number
  annualContribution: number
  propertyPrice: number
  downPct: number
  annualRent: number
  vacancyPct: number
  opexPct: number
  appreciationPct: number
  years: number
  marginalTaxRate: number
  leveraged: boolean
  loanRate: number
  loanTermYears: number
}

const DEF: Inputs = {
  accountType: 'roth',
  currentBalance: 150000,
  annualContribution: 7000,
  propertyPrice: 200000,
  downPct: 30,
  annualRent: 18000,
  vacancyPct: 8,
  opexPct: 35,
  appreciationPct: 4,
  years: 20,
  marginalTaxRate: 32,
  leveraged: false,
  loanRate: 8.5,
  loanTermYears: 25,
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const pct = (n: number) => `${n.toFixed(1)}%`
const N = (v: string) => parseFloat(v) || 0

export default function SDIRACalc() {
  const [inp, setInp] = useState<Inputs>(DEF)
  const set = (k: keyof Inputs, v: string | boolean | 'traditional' | 'roth') =>
    setInp(p => ({ ...p, [k]: typeof DEF[k] === 'number' ? N(v as string) : v }))

  const calc = useMemo(() => {
    const { accountType, currentBalance, annualContribution, propertyPrice, downPct,
            annualRent, vacancyPct, opexPct, appreciationPct, years,
            marginalTaxRate, leveraged, loanRate, loanTermYears } = inp

    const downPayment = propertyPrice * downPct / 100
    const loanAmount = propertyPrice - downPayment

    // Monthly mortgage (UBIT-exposed if leveraged)
    let annualDebtService = 0
    if (leveraged && loanAmount > 0) {
      const r = loanRate / 100 / 12
      const n2 = loanTermYears * 12
      const pmt = loanAmount * r / (1 - Math.pow(1 + r, -n2))
      annualDebtService = pmt * 12
    }

    // Annual NOI
    const effectiveRent = annualRent * (1 - vacancyPct / 100)
    const opex = effectiveRent * opexPct / 100
    const noi = effectiveRent - opex
    const annualCashFlow = noi - annualDebtService

    // UDFI (Unrelated Debt-Financed Income) — only if leveraged
    // UDFI = net income × (debt / FMV)
    const debtRatio = leveraged ? loanAmount / propertyPrice : 0
    const udfiFraction = debtRatio
    const udfiIncome = noi * udfiFraction
    // UBIT tax rate approximates trust rates (top 37% over ~$14,450)
    const ubitTax = leveraged ? udfiIncome * 0.37 : 0

    // Year-by-year projection
    interface YearRow {
      year: number
      propertyValue: number
      cashFlow: number
      ubitTax: number
      netCashFlow: number
      iRABalance: number
      taxableAccountBalance: number
      equityInProperty: number
    }

    const rows: YearRow[] = []
    let balance = currentBalance
    let taxBalance = currentBalance
    let propValue = propertyPrice
    let loanBal = loanAmount

    for (let y = 1; y <= years; y++) {
      propValue *= (1 + appreciationPct / 100)

      // Amortize loan if leveraged
      if (leveraged && loanAmount > 0) {
        const r = loanRate / 100 / 12
        const n2 = loanTermYears * 12
        const pmt = loanAmount * r / (1 - Math.pow(1 + r, -n2))
        for (let m = 0; m < 12; m++) {
          const interest = loanBal * r
          const principal = Math.min(pmt - interest, loanBal)
          loanBal = Math.max(0, loanBal - principal)
        }
      }

      const yearNoi = effectiveRent * Math.pow(1 + appreciationPct / 100, y - 1)
      const yearCF = yearNoi - annualDebtService
      const yearUDFI = leveraged ? yearNoi * udfiFraction * 0.37 : 0
      const netCF = yearCF - yearUDFI
      const equity = propValue - loanBal

      // SDIRA: contributions grow tax-sheltered, cash flow reinvested
      balance += annualContribution + Math.max(0, netCF)
      balance *= 1.03 // conservative 3% on idle cash

      // Taxable equivalent
      const afterTaxContrib = annualContribution * (1 - marginalTaxRate / 100)
      const afterTaxCF = yearCF * (1 - marginalTaxRate / 100)
      taxBalance += afterTaxContrib + Math.max(0, afterTaxCF)
      taxBalance *= 1.025 // 2.5% after-tax return on idle cash

      rows.push({
        year: y,
        propertyValue: propValue,
        cashFlow: yearCF,
        ubitTax: yearUDFI,
        netCashFlow: netCF,
        iRABalance: balance + equity,
        taxableAccountBalance: taxBalance + equity * (1 - 0.238), // cap gains on equity in taxable
        equityInProperty: equity,
      })
    }

    const finalIRA = rows[rows.length - 1]?.iRABalance ?? 0
    const finalTaxable = rows[rows.length - 1]?.taxableAccountBalance ?? 0
    const taxAdvantageDollars = finalIRA - finalTaxable

    // Distribution tax (Roth = 0, Traditional = marginalTaxRate)
    const distributionTax = accountType === 'roth' ? 0 : marginalTaxRate / 100
    const afterDistributionIRA = finalIRA * (1 - distributionTax)

    // Prohibited transaction rules summary
    const prohibitedExamples = [
      'Self-dealing: you or disqualified persons cannot live in or use the property',
      'Cannot do repair work yourself — must hire third parties',
      'Disqualified persons: spouse, lineal descendants, ancestors, fiduciaries',
      'Cannot guarantee IRA loan personally (non-recourse only)',
      'All income and expenses must flow through the IRA account',
    ]

    return {
      downPayment, loanAmount, noi, annualCashFlow, ubitTax, debtRatio,
      rows, finalIRA, finalTaxable, taxAdvantageDollars, afterDistributionIRA,
      distributionTax, prohibitedExamples,
    }
  }, [inp])

  const field = (label: string, key: keyof Inputs, prefix = '', suffix = '', step = '1') => (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{prefix}</span>}
        <input
          type="number" step={step}
          value={inp[key] as number}
          onChange={e => set(key, e.target.value)}
          className={`w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 ${prefix ? 'pl-5 pr-3' : suffix ? 'pl-3 pr-7' : 'px-3'}`}
        />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{suffix}</span>}
      </div>
    </div>
  )

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h2 className="text-lg font-bold text-white">Self-Directed IRA (SDIRA) Real Estate</h2>
        <p className="text-slate-400 text-xs mt-1">Model tax-sheltered real estate investing inside a Traditional or Roth SDIRA — including UDFI/UBIT exposure from leverage</p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">IRA Setup</p>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Account Type</label>
            <div className="flex gap-2">
              {(['traditional', 'roth'] as const).map(t => (
                <button key={t} onClick={() => set('accountType', t)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition capitalize ${inp.accountType === t ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          {field('Current Balance', 'currentBalance', '$')}
          {field('Annual Contribution', 'annualContribution', '$')}
          {field('Marginal Tax Rate', 'marginalTaxRate', '', '%')}
          {field('Projection Years', 'years', '', 'yrs')}
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Property</p>
          {field('Purchase Price', 'propertyPrice', '$')}
          {field('Down Payment %', 'downPct', '', '%')}
          {field('Gross Annual Rent', 'annualRent', '$')}
          {field('Vacancy Rate', 'vacancyPct', '', '%')}
          {field('Operating Expenses', 'opexPct', '', '% of EGR')}
          {field('Annual Appreciation', 'appreciationPct', '', '%', '0.5')}
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Leverage (UBIT Risk)</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Use Non-Recourse Loan</span>
            <button onClick={() => set('leveraged', !inp.leveraged)}
              className={`w-11 h-6 rounded-full transition-colors ${inp.leveraged ? 'bg-orange-500' : 'bg-slate-700'}`}>
              <div className={`w-4 h-4 bg-white rounded-full mx-1 transition-transform ${inp.leveraged ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          {inp.leveraged && <>
            <div className="p-3 bg-orange-900/20 border border-orange-700/40 rounded-lg">
              <p className="text-xs text-orange-300 font-semibold">⚠️ UDFI / UBIT Alert</p>
              <p className="text-xs text-orange-200/70 mt-1">Leverage creates Unrelated Debt-Financed Income (UDFI). Rental income proportional to the debt ratio is subject to Unrelated Business Income Tax (UBIT) at trust rates (up to 37%).</p>
            </div>
            {field('Loan Interest Rate', 'loanRate', '', '%', '0.125')}
            {field('Loan Term', 'loanTermYears', '', 'yrs')}
            <p className="text-xs text-slate-500">Must use non-recourse financing only — no personal guarantee allowed</p>
          </>}
          {!inp.leveraged && (
            <div className="p-3 bg-green-900/20 border border-green-700/40 rounded-lg">
              <p className="text-xs text-green-300 font-semibold">✓ No UBIT</p>
              <p className="text-xs text-green-200/70 mt-1">All-cash purchases avoid UDFI/UBIT entirely — 100% of rental income grows tax-sheltered.</p>
            </div>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Down Payment', value: fmt(calc.downPayment), sub: `${inp.downPct}% of purchase`, color: 'text-blue-400' },
          { label: 'Annual NOI', value: fmt(calc.noi), sub: 'Before debt service', color: 'text-green-400' },
          { label: inp.leveraged ? 'Net Cash Flow (after UBIT)' : 'Annual Cash Flow', value: fmt(calc.annualCashFlow), sub: inp.leveraged ? `UBIT: ${fmt(calc.ubitTax)}/yr` : 'No UBIT drag', color: calc.annualCashFlow > 0 ? 'text-green-400' : 'text-red-400' },
          { label: 'Tax Advantage (20yr)', value: fmt(calc.taxAdvantageDollars), sub: 'vs taxable account', color: 'text-purple-400' },
        ].map(c => (
          <div key={c.label} className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 text-center">
            <p className={`text-xl font-black ${c.color}`}>{c.value}</p>
            <p className="text-xs font-semibold text-slate-300 mt-1">{c.label}</p>
            <p className="text-xs text-slate-500">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Final Outcome */}
      <div className={`rounded-xl p-5 border ${inp.accountType === 'roth' ? 'bg-green-900/20 border-green-700/40' : 'bg-blue-900/20 border-blue-700/40'}`}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-widest">SDIRA Total ({inp.years} yrs)</p>
            <p className="text-2xl font-black text-white mt-1">{fmt(calc.finalIRA)}</p>
            <p className="text-xs text-slate-500 mt-0.5">Property equity + IRA cash</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-widest">After Distribution Tax</p>
            <p className={`text-2xl font-black mt-1 ${inp.accountType === 'roth' ? 'text-green-400' : 'text-yellow-400'}`}>{fmt(calc.afterDistributionIRA)}</p>
            <p className="text-xs text-slate-500 mt-0.5">{inp.accountType === 'roth' ? 'Roth: 0% distribution tax' : `Traditional: ${inp.marginalTaxRate}% on withdrawal`}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-widest">Taxable Account</p>
            <p className="text-2xl font-black text-slate-300 mt-1">{fmt(calc.finalTaxable)}</p>
            <p className="text-xs text-slate-500 mt-0.5">After cap gains on equity</p>
          </div>
        </div>
      </div>

      {/* Growth Chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Wealth Growth Comparison</p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={calc.rows}>
            <defs>
              <linearGradient id="iraGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="taxGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#64748b" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#64748b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} label={{ value: 'Year', position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 10 }} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            <Area type="monotone" dataKey="iRABalance" stroke="#8b5cf6" fill="url(#iraGrad)" strokeWidth={2} name="SDIRA Total" />
            <Area type="monotone" dataKey="taxableAccountBalance" stroke="#64748b" fill="url(#taxGrad)" strokeWidth={2} name="Taxable Account" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Prohibited Transactions */}
      <div className="bg-red-900/20 rounded-xl p-4 border border-red-700/40">
        <p className="text-xs font-bold text-red-300 uppercase tracking-widest mb-3">⛔ Prohibited Transaction Rules (IRS §4975)</p>
        <div className="space-y-2">
          {calc.prohibitedExamples.map((r, i) => (
            <div key={i} className="flex gap-2 text-xs text-red-200/80">
              <span className="text-red-500 mt-0.5">•</span>
              <span>{r}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-red-300/60 mt-3">Violation = immediate distribution of entire IRA balance + taxes + 15% excise penalty. Consult a tax attorney before proceeding.</p>
      </div>

      {/* SDIRA Setup Tips */}
      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">SDIRA Setup Checklist</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { icon: '🏛', text: 'Open SDIRA with a custodian that allows real estate (Equity Trust, Entrust, Alto, etc.)' },
            { icon: '💸', text: 'All rent checks must be made payable to the IRA, not to you personally' },
            { icon: '🔧', text: 'All expenses (taxes, insurance, repairs) must be paid from IRA funds, not your pocket' },
            { icon: '📑', text: 'Title goes in the name of the IRA: "XYZ Trust Co. FBO Your Name IRA"' },
            { icon: '🏦', text: 'For leverage: use non-recourse lenders (specialized portfolio lenders, not conventional banks)' },
            { icon: '📊', text: 'File Form 990-T if UDFI/UBIT exceeds $1,000 in a year (due with custodian\'s EIN)' },
          ].map(t => (
            <div key={t.icon} className="flex gap-2 text-xs text-slate-400">
              <span>{t.icon}</span>
              <span>{t.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
