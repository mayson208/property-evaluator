import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, ReferenceLine, AreaChart, Area } from 'recharts'

type StructureType = 'straightCarry' | 'wrap' | 'landContract'
type BalloonType = 'none' | '3yr' | '5yr' | '7yr' | '10yr'

interface Inputs {
  salePrice: number
  downPaymentPct: number
  noteRate: number
  amortTerm: number
  balloon: BalloonType
  structure: StructureType
  existingLoanBalance: number
  existingLoanRate: number
  existingLoanPayment: number
  taxBasis: number
  depreciationTaken: number
  ltcgRate: number
  sellerMarginalRate: number
  discountRate: number
  defaultRiskPct: number
  noteDiscountPct: number
}

const DEF: Inputs = {
  salePrice: 650000,
  downPaymentPct: 10,
  noteRate: 7.5,
  amortTerm: 30,
  balloon: '7yr',
  structure: 'straightCarry',
  existingLoanBalance: 180000,
  existingLoanRate: 3.25,
  existingLoanPayment: 1100,
  taxBasis: 280000,
  depreciationTaken: 85000,
  ltcgRate: 20,
  sellerMarginalRate: 37,
  discountRate: 12,
  defaultRiskPct: 3,
  noteDiscountPct: 15,
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const N = (v: string) => parseFloat(v) || 0

function monthlyPmt(principal: number, annualRate: number, termYears: number) {
  if (annualRate === 0) return principal / (termYears * 12)
  const r = annualRate / 100 / 12
  const n = termYears * 12
  return principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1)
}

const BALLOON_MONTHS: Record<BalloonType, number> = { none: 0, '3yr': 36, '5yr': 60, '7yr': 84, '10yr': 120 }

export default function SellerFinancing() {
  const [inp, setInp] = useState<Inputs>(DEF)
  const set = (k: keyof Inputs, v: string | StructureType | BalloonType) =>
    setInp(p => ({ ...p, [k]: typeof DEF[k] === 'number' ? N(v as string) : v }))

  const calc = useMemo(() => {
    const {
      salePrice, downPaymentPct, noteRate, amortTerm, balloon, structure,
      existingLoanBalance, existingLoanRate, existingLoanPayment,
      taxBasis, depreciationTaken, ltcgRate, sellerMarginalRate,
      discountRate, defaultRiskPct, noteDiscountPct,
    } = inp

    const downPayment = salePrice * downPaymentPct / 100
    const noteAmount = salePrice - downPayment - (structure === 'straightCarry' ? 0 : 0) // full carry
    const wrapNoteAmount = structure === 'wrap' ? noteAmount : 0

    // Note payments
    const notePayment = monthlyPmt(noteAmount, noteRate, amortTerm)
    const balloonMonths = BALLOON_MONTHS[balloon]
    const termMonths = balloon === 'none' ? amortTerm * 12 : balloonMonths

    // Amortization schedule
    let balance = noteAmount
    let totalInterest = 0
    let totalPrincipal = 0
    const schedule: { year: number; interest: number; principal: number; balance: number; cumInterest: number }[] = []
    let cumInterest = 0

    for (let m = 1; m <= Math.min(termMonths, amortTerm * 12); m++) {
      const r = noteRate / 100 / 12
      const interest = balance * r
      const principal = Math.min(notePayment - interest, balance)
      balance = Math.max(0, balance - principal)
      totalInterest += interest
      totalPrincipal += principal
      cumInterest += interest

      if (m % 12 === 0 || m === termMonths) {
        schedule.push({
          year: Math.ceil(m / 12),
          interest: Math.round(interest * 12),
          principal: Math.round(principal * 12),
          balance: Math.round(balance),
          cumInterest: Math.round(cumInterest),
        })
      }
    }

    const balloonBalance = balance
    const annualInterestIncome = notePayment * 12 - (notePayment * 12 - totalInterest / (termMonths / 12))

    // Wrap: seller's spread on underlying
    let wrapSpread = 0
    let wrapNetPayment = notePayment
    if (structure === 'wrap') {
      wrapSpread = notePayment - existingLoanPayment
      wrapNetPayment = wrapSpread
    }

    // Installment sale tax (IRC §453)
    const gainOnSale = salePrice - taxBasis
    const depRecapture = Math.min(depreciationTaken, gainOnSale) // recapture first
    const ltcgGain = Math.max(0, gainOnSale - depRecapture)
    const grossProfitRatio = salePrice > 0 ? ltcgGain / salePrice : 0

    // Year 1 tax: full recapture + GPR × downPayment
    const yr1RecaptureTax = depRecapture * 0.25
    const yr1LTCGTax = downPayment * grossProfitRatio * ltcgRate / 100
    const yr1TotalTax = yr1RecaptureTax + yr1LTCGTax

    // Annual interest income tax (ordinary)
    const annualInterest = notePayment * 12 * (totalInterest / (notePayment * termMonths || 1))
    const annualInterestTax = annualInterest * sellerMarginalRate / 100

    // vs Cash sale tax
    const cashSaleTax = depRecapture * 0.25 + ltcgGain * ltcgRate / 100 + ltcgGain * 0.038
    const cashNetProceeds = salePrice - cashSaleTax
    const cashAltInvestmentFV = cashNetProceeds * Math.pow(1 + 7 / 100, termMonths / 12) // 7% alt

    // Note present value (discounted at seller's required yield)
    let notePV = 0
    let tempBal = noteAmount
    for (let m = 1; m <= termMonths; m++) {
      const r2 = noteRate / 100 / 12
      const interest2 = tempBal * r2
      const principal2 = Math.min(notePayment - interest2, tempBal)
      tempBal = Math.max(0, tempBal - principal2)
      const cf = m === termMonths ? notePayment + tempBal : notePayment
      notePV += cf / Math.pow(1 + discountRate / 100 / 12, m)
    }
    const noteMarketValue = notePV
    const noteSaleValue = noteAmount * (1 - noteDiscountPct / 100) // if sold to note buyer

    // Year-by-year comparison (seller financing vs cash sale reinvested)
    const yearlyComp = schedule.map(row => {
      const sfCumulative = downPayment + row.cumInterest + (noteAmount - row.balance)
      const altFV = cashNetProceeds * Math.pow(1 + 7 / 100, row.year)
      return {
        year: `Yr ${row.year}`,
        sellerFinancing: Math.round(sfCumulative),
        cashSaleAlt: Math.round(altFV),
        balance: row.balance,
        cumInterest: row.cumInterest,
      }
    })

    return {
      downPayment, noteAmount, notePayment, balloonBalance, totalInterest,
      wrapSpread, wrapNetPayment,
      gainOnSale, depRecapture, ltcgGain, grossProfitRatio,
      yr1TotalTax, cashSaleTax, annualInterestIncome,
      noteMarketValue, noteSaleValue,
      schedule, yearlyComp, termMonths,
    }
  }, [inp])

  const field = (label: string, key: keyof Inputs, suffix = '', prefix = '', step = 'any') => (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{prefix}</span>}
        <input type="number" step={step} value={inp[key] as number} onChange={e => set(key, e.target.value)}
          className={`w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 ${prefix ? 'pl-5 pr-3' : suffix ? 'pl-3 pr-8' : 'px-3'}`} />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{suffix}</span>}
      </div>
    </div>
  )

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h2 className="text-lg font-bold text-white">Seller Financing Calculator</h2>
        <p className="text-slate-400 text-xs mt-1">Model owner carryback notes, wrap mortgages, installment sale tax deferral (IRC §453), note valuation, and cash-sale comparison</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Note Terms */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Note Terms</p>
          {field('Sale Price', 'salePrice', '', '$', '1000')}
          {field('Down Payment', 'downPaymentPct', '%')}
          {field('Note Interest Rate', 'noteRate', '%')}
          {field('Amortization Term', 'amortTerm', 'yr', '', '1')}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Balloon Payment</label>
            <select value={inp.balloon} onChange={e => set('balloon', e.target.value as BalloonType)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
              <option value="none">No Balloon (fully amortizing)</option>
              <option value="3yr">3-Year Balloon</option>
              <option value="5yr">5-Year Balloon</option>
              <option value="7yr">7-Year Balloon</option>
              <option value="10yr">10-Year Balloon</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Structure</label>
            <select value={inp.structure} onChange={e => set('structure', e.target.value as StructureType)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
              <option value="straightCarry">Straight Carry (1st position)</option>
              <option value="wrap">Wrap Mortgage / AITD</option>
              <option value="landContract">Land Contract / Contract for Deed</option>
            </select>
          </div>
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Down Payment</span><span className="text-white font-bold">{fmt(calc.downPayment)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Note Amount</span><span className="text-blue-400 font-bold">{fmt(calc.noteAmount)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Monthly Payment</span><span className="text-green-400 font-bold">{fmt(calc.notePayment)}</span></div>
            {inp.balloon !== 'none' && <div className="flex justify-between"><span className="text-slate-400">Balloon Balance</span><span className="text-orange-400 font-bold">{fmt(calc.balloonBalance)}</span></div>}
          </div>
        </div>

        {/* Wrap / Underlying */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">
            {inp.structure === 'wrap' ? 'Underlying Loan (Wrap)' : 'Tax & Basis'}
          </p>
          {inp.structure === 'wrap' && <>
            {field('Existing Loan Balance', 'existingLoanBalance', '', '$')}
            {field('Existing Loan Rate', 'existingLoanRate', '%')}
            {field('Existing Loan Payment/mo', 'existingLoanPayment', '', '$')}
            <div className="p-3 bg-blue-900/20 border border-blue-700/40 rounded-lg text-xs space-y-1">
              <p className="text-blue-300 font-semibold">Wrap Analysis</p>
              <div className="flex justify-between"><span className="text-slate-400">Seller Receives</span><span className="text-green-400 font-bold">{fmt(calc.notePayment)}/mo</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Pays Underlying</span><span className="text-red-400">{fmt(inp.existingLoanPayment)}/mo</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Net Spread</span><span className="text-green-400 font-bold">{fmt(calc.wrapSpread)}/mo</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Rate Arbitrage</span><span className="text-purple-400">{(inp.noteRate - inp.existingLoanRate).toFixed(2)}%</span></div>
            </div>
          </>}
          {field('Tax Basis (adjusted)', 'taxBasis', '', '$')}
          {field('Depreciation Taken', 'depreciationTaken', '', '$')}
          {field('LTCG Rate', 'ltcgRate', '%')}
          {field('Ordinary Income Rate', 'sellerMarginalRate', '%')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Total Gain</span><span className="text-slate-300">{fmt(calc.gainOnSale)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Depr Recapture</span><span className="text-red-400">{fmt(calc.depRecapture)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">LTCG (§453 spread)</span><span className="text-blue-400">{fmt(calc.ltcgGain)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Gross Profit Ratio</span><span className="text-purple-400 font-bold">{(calc.grossProfitRatio * 100).toFixed(1)}%</span></div>
          </div>
        </div>

        {/* Note Valuation */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Note Value & Tax Comparison</p>
          {field('Discount Rate (your yield target)', 'discountRate', '%')}
          {field('Default Risk Premium', 'defaultRiskPct', '%')}
          {field('Note Buyer Discount', 'noteDiscountPct', '%')}
          <div className="p-3 bg-slate-900/50 rounded-lg text-xs space-y-1.5">
            <p className="text-slate-300 font-semibold">Note Valuation</p>
            <div className="flex justify-between"><span className="text-slate-400">Face Value</span><span className="text-white font-bold">{fmt(calc.noteAmount)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">PV at {inp.discountRate}%</span><span className="text-blue-400 font-bold">{fmt(calc.noteMarketValue)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">If Sold to Note Buyer</span><span className="text-orange-400">{fmt(calc.noteSaleValue)} ({inp.noteDiscountPct}% disc)</span></div>
          </div>
          <div className="p-3 bg-slate-900/50 rounded-lg text-xs space-y-1.5">
            <p className="text-slate-300 font-semibold">Tax: Seller Financing vs Cash Sale</p>
            <div className="flex justify-between"><span className="text-slate-400">Seller Fin — Yr 1 Tax</span><span className="text-green-400 font-bold">{fmt(calc.yr1TotalTax)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Cash Sale Tax (all at once)</span><span className="text-red-400 font-bold">{fmt(calc.cashSaleTax)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Yr 1 Tax Deferred</span><span className="text-green-400 font-bold">{fmt(calc.cashSaleTax - calc.yr1TotalTax)}</span></div>
          </div>
        </div>
      </div>

      {/* Amortization + Balance Chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">
          Note Balance & Cumulative Interest
          {inp.balloon !== 'none' && <span className="text-orange-400 ml-2">— Balloon at Yr {BALLOON_MONTHS[inp.balloon] / 12}</span>}
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={calc.schedule}>
            <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={v => `Yr ${v}`} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="balance" stroke="#ef4444" strokeWidth={2} dot={false} name="Note Balance" />
            <Line type="monotone" dataKey="cumInterest" stroke="#22c55e" strokeWidth={2} dot={false} name="Cumulative Interest" />
            {inp.balloon !== 'none' && (
              <ReferenceLine x={BALLOON_MONTHS[inp.balloon] / 12} stroke="#f59e0b66" strokeDasharray="4 2"
                label={{ value: 'Balloon', fill: '#f59e0b', fontSize: 9 }} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Annual P&I Breakdown */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Annual Principal & Interest Income</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={calc.schedule.slice(0, 15)}>
            <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={v => `Yr ${v}`} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="interest" name="Interest Income" fill="#22c55e" radius={[4, 4, 0, 0]} stackId="a" />
            <Bar dataKey="principal" name="Principal Received" fill="#3b82f6" radius={[0, 0, 0, 0]} stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Rules & Structure Notes */}
      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Seller Financing Structures & Rules</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
          {[
            '📑 IRC §453 Installment Sale: spread LTCG recognition across payments using Gross Profit Ratio — cannot defer depreciation recapture',
            '⚠️ Dodd-Frank SAFE Act: seller financing on non-owner-occupied properties generally exempt; residential sellers: ≤3 deals/yr or use a licensed LO',
            '🔁 Wrap Mortgage (AITD): seller keeps underlying loan, wraps at higher rate — check for due-on-sale clause in underlying mortgage',
            '📋 Land Contract / Contract for Deed: buyer gets equitable title, seller retains legal title until payoff — state law governs foreclosure process',
            '💰 Seller note interest rate must be at least AFR (Applicable Federal Rate) or IRS imputes income at AFR — check irs.gov for current rates',
            '🏦 Note buyers (secondary market) typically discount at 15–35% for private seller notes — higher LTV = higher discount',
            '⚖️ Balloon mortgages: common to offer 30-yr amortization with 5–7 yr balloon, giving buyer time to qualify for conventional refi',
            '🔒 Secure the note with a Deed of Trust (or Mortgage) — record it to protect your lien position; require title insurance and hazard insurance',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>
    </div>
  )
}
