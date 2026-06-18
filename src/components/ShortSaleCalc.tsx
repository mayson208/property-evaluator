import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

type FilingStatus = 'single' | 'mfj' | 'mfs' | 'hoh'
type LoanType = 'purchase_money' | 'refi_cashout' | 'refi_rateterm' | 'heloc'
type State = 'anti_deficiency' | 'one_action' | 'full_recourse'
type Perspective = 'seller' | 'buyer'

interface SellerInputs {
  loanBalance: number
  secondLoanBalance: number
  currentMarketValue: number
  sellingCosts: number
  arrearsMonths: number
  monthlyPayment: number
  loanType: LoanType
  state: State
  fileStatus: FilingStatus
  annualIncome: number
  otherAssets: number
  otherDebts: number
  insolvencyExclusion: boolean
  primaryResidence: boolean
  yearsOwned: number
}

interface BuyerInputs {
  offerPrice: number
  arv: number
  rehabCost: number
  holdMonths: number
  carryMonthlyCost: number
  sellingCostPct: number
  exitStrategy: 'flip' | 'rental' | 'live'
  rentalMonthlyRent: number
  rentalExpenseRatio: number
  rentalCapRate: number
}

const DEF_SELLER: SellerInputs = {
  loanBalance: 385000,
  secondLoanBalance: 45000,
  currentMarketValue: 295000,
  sellingCosts: 21000,
  arrearsMonths: 6,
  monthlyPayment: 2340,
  loanType: 'purchase_money',
  state: 'full_recourse',
  fileStatus: 'mfj',
  annualIncome: 95000,
  otherAssets: 48000,
  otherDebts: 22000,
  insolvencyExclusion: false,
  primaryResidence: true,
  yearsOwned: 7,
}

const DEF_BUYER: BuyerInputs = {
  offerPrice: 265000,
  arv: 310000,
  rehabCost: 18000,
  holdMonths: 6,
  carryMonthlyCost: 1800,
  sellingCostPct: 6,
  exitStrategy: 'flip',
  rentalMonthlyRent: 1950,
  rentalExpenseRatio: 40,
  rentalCapRate: 6.5,
}

const TAX_BRACKETS_MFJ: [number, number][] = [[23200, 0.10], [94300, 0.12], [201050, 0.22], [383900, 0.24], [487450, 0.32], [731200, 0.35], [Infinity, 0.37]]
const TAX_BRACKETS_SINGLE: [number, number][] = [[11600, 0.10], [47150, 0.12], [100525, 0.22], [191950, 0.24], [243725, 0.32], [609350, 0.35], [Infinity, 0.37]]
const TAX_BRACKETS_HOH: [number, number][] = [[16550, 0.10], [63100, 0.12], [100500, 0.22], [191950, 0.24], [243700, 0.32], [609350, 0.35], [Infinity, 0.37]]

function marginalRate(income: number, status: FilingStatus): number {
  const brackets = status === 'mfj' ? TAX_BRACKETS_MFJ : status === 'hoh' ? TAX_BRACKETS_HOH : TAX_BRACKETS_SINGLE
  for (const [limit, rate] of brackets) if (income <= limit) return rate
  return 0.37
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const N = (v: string) => parseFloat(v) || 0

const LOAN_TYPE_NOTES: Record<LoanType, string> = {
  purchase_money: 'Original purchase money mortgage — many states bar deficiency on these',
  refi_cashout: 'Cash-out refinance — treated as recourse debt in most states; deficiency risk high',
  refi_rateterm: 'Rate/term refi (no cash out) — some states treat as non-recourse like original',
  heloc: 'HELOC — typically recourse; lender may separately pursue deficiency',
}

const STATE_NOTES: Record<State, string> = {
  anti_deficiency: 'Anti-deficiency state (AZ, CA, MN, etc.) — lender CANNOT pursue deficiency after non-judicial foreclosure/short sale on primary residence',
  one_action: 'One-action state (CA) — lender can only take one action; judicial foreclosure opens deficiency but rare',
  full_recourse: 'Full recourse state (FL, TX, NY, etc.) — lender CAN sue for deficiency judgment; negotiate waiver in short sale agreement',
}

export default function ShortSaleCalc() {
  const [perspective, setPerspective] = useState<Perspective>('seller')
  const [sel, setSel] = useState<SellerInputs>(DEF_SELLER)
  const [buy, setBuy] = useState<BuyerInputs>(DEF_BUYER)
  const setSN = (k: keyof SellerInputs, v: string) => setSel(p => ({ ...p, [k]: N(v) }))
  const setBN = (k: keyof BuyerInputs, v: string) => setBuy(p => ({ ...p, [k]: N(v) }))

  const sellerCalc = useMemo(() => {
    const { loanBalance, secondLoanBalance, currentMarketValue, sellingCosts, arrearsMonths,
      monthlyPayment, state, fileStatus, annualIncome, otherAssets, otherDebts,
      insolvencyExclusion, primaryResidence, loanType } = sel

    const totalOwed = loanBalance + secondLoanBalance
    const netSaleProceeds = currentMarketValue - sellingCosts
    const shortfallFirst = Math.max(0, loanBalance - netSaleProceeds)
    const shortfallTotal = Math.max(0, totalOwed - netSaleProceeds)
    const forgiven1st = shortfallFirst
    const forgiven2nd = Math.max(0, secondLoanBalance - Math.max(0, netSaleProceeds - loanBalance))
    const totalForgiven = Math.max(0, totalOwed - netSaleProceeds)
    const arrearsOwed = arrearsMonths * monthlyPayment

    // Tax on forgiven debt
    const insolvencyBuffer = Math.max(0, otherDebts - otherAssets)
    let taxableForgivenDebt = totalForgiven
    if (primaryResidence && state !== 'full_recourse' && loanType === 'purchase_money') taxableForgivenDebt = 0 // anti-deficiency — no forgiven debt legally
    else if (insolvencyExclusion) taxableForgivenDebt = Math.max(0, totalForgiven - insolvencyBuffer)
    else if (primaryResidence && loanType === 'purchase_money') taxableForgivenDebt = 0 // MFDRA

    const margRate = marginalRate(annualIncome, fileStatus)
    const taxOn1099C = taxableForgivenDebt * margRate
    const netDeficiencyRisk = state === 'anti_deficiency' ? 0 : shortfallTotal

    // Alternative paths comparison
    const foreclosureImpactYears = 7
    const shortSaleImpactYears = 4
    const deedInLieuImpactYears = 4

    // Cost comparison
    const compareData = [
      { path: 'Short Sale', deficiency: state === 'anti_deficiency' ? 0 : Math.round(shortfallTotal * 0.3), taxBurden: Math.round(taxOn1099C), creditYears: shortSaleImpactYears, totalCost: Math.round(taxOn1099C + (state === 'anti_deficiency' ? 0 : shortfallTotal * 0.3)) },
      { path: 'Foreclosure', deficiency: state === 'anti_deficiency' ? 0 : Math.round(shortfallTotal * 0.5), taxBurden: Math.round(taxOn1099C * 0.8), creditYears: foreclosureImpactYears, totalCost: Math.round(taxOn1099C * 0.8 + (state === 'anti_deficiency' ? 0 : shortfallTotal * 0.5)) },
      { path: 'Deed-in-Lieu', deficiency: Math.round(shortfallTotal * 0.2), taxBurden: Math.round(taxOn1099C), creditYears: deedInLieuImpactYears, totalCost: Math.round(taxOn1099C + shortfallTotal * 0.2) },
      { path: 'Modification', deficiency: 0, taxBurden: 0, creditYears: 2, totalCost: Math.round(arrearsOwed) },
    ]

    return {
      totalOwed, netSaleProceeds, shortfallFirst, shortfallTotal,
      forgiven1st, forgiven2nd, totalForgiven, arrearsOwed,
      taxableForgivenDebt, taxOn1099C, margRate, netDeficiencyRisk,
      insolvencyBuffer, compareData, foreclosureImpactYears, shortSaleImpactYears,
    }
  }, [sel])

  const buyerCalc = useMemo(() => {
    const { offerPrice, arv, rehabCost, holdMonths, carryMonthlyCost, sellingCostPct, exitStrategy, rentalMonthlyRent, rentalExpenseRatio, rentalCapRate } = buy

    const discount = arv > 0 ? (arv - offerPrice) / arv * 100 : 0
    const totalCarry = carryMonthlyCost * holdMonths
    let exitValue = arv, exitCost = arv * sellingCostPct / 100
    if (exitStrategy === 'rental') {
      const annualNOI = rentalMonthlyRent * 12 * (1 - rentalExpenseRatio / 100)
      exitValue = rentalCapRate > 0 ? annualNOI / (rentalCapRate / 100) : arv
      exitCost = exitValue * 0.02
    } else if (exitStrategy === 'live') {
      exitValue = arv; exitCost = 0
    }

    const allIn = offerPrice + rehabCost + totalCarry
    const netExit = exitValue - exitCost
    const profit = netExit - allIn
    const profitPct = allIn > 0 ? profit / allIn * 100 : 0

    // Short sale timeline cost (holding during 3-6 month approval)
    const shortSaleWaitMonths = 4
    const waitCost = carryMonthlyCost * shortSaleWaitMonths
    const profitAfterWait = profit - waitCost

    // Bid scenarios for buyer
    const scenarios = [0.80, 0.85, 0.875, 0.90, 0.925].map(pct => {
      const bid = Math.round(arv * pct)
      const ai = bid + rehabCost + totalCarry
      const p = netExit - ai
      return { label: `${(pct * 100).toFixed(1)}% ARV`, bid, allIn: ai, profit: Math.round(p), profitPct: parseFloat((ai > 0 ? p / ai * 100 : 0).toFixed(1)) }
    })

    // Lender approval likelihood
    const discountPct = discount
    const approvalOdds = discountPct >= 20 ? 'High (>70%)' : discountPct >= 10 ? 'Moderate (40-70%)' : 'Low (<40%)'

    return { discount, totalCarry, allIn, exitValue, exitCost, netExit, profit, profitPct, waitCost, profitAfterWait, scenarios, approvalOdds }
  }, [buy])

  const sf = (label: string, key: keyof SellerInputs, suffix = '', prefix = '') => (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{prefix}</span>}
        <input type="number" value={sel[key] as number} onChange={e => setSN(key, e.target.value)}
          className={`w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 ${prefix ? 'pl-5 pr-3' : suffix ? 'pl-3 pr-8' : 'px-3'}`} />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{suffix}</span>}
      </div>
    </div>
  )

  const bf = (label: string, key: keyof BuyerInputs, suffix = '', prefix = '') => (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{prefix}</span>}
        <input type="number" value={buy[key] as number} onChange={e => setBN(key, e.target.value)}
          className={`w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 ${prefix ? 'pl-5 pr-3' : suffix ? 'pl-3 pr-8' : 'px-3'}`} />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{suffix}</span>}
      </div>
    </div>
  )

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h2 className="text-lg font-bold text-white">Short Sale Analyzer</h2>
        <p className="text-slate-400 text-xs mt-1">Distressed seller — deficiency, 1099-C, tax consequences, path comparison · Buyer — discount, approval odds, profit by bid level</p>
      </div>

      <div className="flex gap-2">
        {(['seller', 'buyer'] as const).map(p => (
          <button key={p} onClick={() => setPerspective(p)}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition ${perspective === p ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
            {p === 'seller' ? '🏠 Distressed Seller' : '💰 Buyer / Investor'}
          </button>
        ))}
      </div>

      {perspective === 'seller' && (
        <>
          {/* Seller KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Owed', value: fmt(sellerCalc.totalOwed), color: 'text-red-400' },
              { label: 'Shortfall', value: fmt(sellerCalc.shortfallTotal), color: 'text-red-400' },
              { label: 'Forgiven Debt (1099-C)', value: fmt(sellerCalc.totalForgiven), color: 'text-orange-400' },
              { label: 'Tax on Forgiven Debt', value: fmt(sellerCalc.taxOn1099C), color: sellerCalc.taxOn1099C > 0 ? 'text-red-400' : 'text-green-400' },
            ].map(m => (
              <div key={m.label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
                <p className={`text-2xl font-black ${m.color}`}>{m.value}</p>
                <p className="text-xs text-slate-400 mt-1">{m.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Deal Basics */}
            <div className="space-y-4">
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
                <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Property & Loans</p>
                {sf('1st Loan Balance', 'loanBalance', '', '$')}
                {sf('2nd Loan / HELOC Balance', 'secondLoanBalance', '', '$')}
                {sf('Current Market Value', 'currentMarketValue', '', '$')}
                {sf('Estimated Selling Costs', 'sellingCosts', '', '$')}
                {sf('Months Behind on Payments', 'arrearsMonths', 'mo')}
                {sf('Monthly Payment', 'monthlyPayment', '/mo', '$')}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Primary Loan Type</label>
                  <select value={sel.loanType} onChange={e => setSel(p => ({ ...p, loanType: e.target.value as LoanType }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
                    <option value="purchase_money">Purchase Money (original)</option>
                    <option value="refi_cashout">Refinance — Cash-Out</option>
                    <option value="refi_rateterm">Refinance — Rate/Term Only</option>
                    <option value="heloc">HELOC / 2nd Mortgage</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">{LOAN_TYPE_NOTES[sel.loanType]}</p>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">State Deficiency Law</label>
                  <select value={sel.state} onChange={e => setSel(p => ({ ...p, state: e.target.value as State }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
                    <option value="anti_deficiency">Anti-Deficiency State</option>
                    <option value="one_action">One-Action State</option>
                    <option value="full_recourse">Full Recourse State</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">{STATE_NOTES[sel.state]}</p>
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
                <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Tax / Insolvency Analysis</p>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Filing Status</label>
                  <select value={sel.fileStatus} onChange={e => setSel(p => ({ ...p, fileStatus: e.target.value as FilingStatus }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
                    <option value="mfj">Married Filing Jointly</option>
                    <option value="single">Single</option>
                    <option value="mfs">Married Filing Separately</option>
                    <option value="hoh">Head of Household</option>
                  </select>
                </div>
                {sf('Annual Household Income', 'annualIncome', '', '$')}
                {sf('Other Assets (savings, stocks)', 'otherAssets', '', '$')}
                {sf('Other Debts (cards, auto, etc.)', 'otherDebts', '', '$')}
                <div className="space-y-2">
                  {([['primaryResidence', 'Primary residence (MFDRA may apply)'], ['insolvencyExclusion', 'Claim insolvency exclusion (assets < debts)']] as const).map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input type="checkbox" checked={sel[k as 'primaryResidence' | 'insolvencyExclusion']} onChange={e => setSel(p => ({ ...p, [k]: e.target.checked }))} className="w-3.5 h-3.5" />
                      <span className="text-slate-300">{label}</span>
                    </label>
                  ))}
                </div>
                <div className="p-3 bg-slate-900/50 rounded-lg text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-slate-400">Insolvency Buffer</span><span className="text-blue-400">{fmt(sellerCalc.insolvencyBuffer)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Taxable Forgiven Debt</span><span className={sellerCalc.taxableForgivenDebt > 0 ? 'text-red-400' : 'text-green-400'}>{fmt(sellerCalc.taxableForgivenDebt)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Marginal Tax Rate</span><span className="text-orange-400">{(sellerCalc.margRate * 100).toFixed(0)}%</span></div>
                  <div className="flex justify-between border-t border-slate-700 pt-1"><span className="text-white font-bold">Tax Bill from 1099-C</span><span className={`font-bold ${sellerCalc.taxOn1099C > 0 ? 'text-red-400' : 'text-green-400'}`}>{fmt(sellerCalc.taxOn1099C)}</span></div>
                </div>
              </div>
            </div>

            {/* Right: Analysis */}
            <div className="space-y-4">
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-2">
                <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Short Sale Math</p>
                {[
                  { label: 'Total Owed (1st + 2nd)', value: fmt(sellerCalc.totalOwed), color: 'text-red-400' },
                  { label: 'Net Sale Proceeds', value: fmt(sellerCalc.netSaleProceeds), color: 'text-blue-400' },
                  { label: 'Shortfall (1st lien)', value: `(${fmt(sellerCalc.shortfallFirst)})`, color: 'text-red-300' },
                  { label: 'Shortfall (2nd lien)', value: `(${fmt(Math.max(0, sel.secondLoanBalance - Math.max(0, sellerCalc.netSaleProceeds - sel.loanBalance)))})`, color: 'text-red-300' },
                  { label: 'Total Forgiven Debt', value: fmt(sellerCalc.totalForgiven), color: 'text-orange-400', bold: true },
                  { label: 'Arrears Owed', value: fmt(sellerCalc.arrearsOwed), color: 'text-slate-400' },
                  { label: 'Deficiency Exposure', value: sel.state === 'anti_deficiency' ? 'NONE (protected)' : fmt(sellerCalc.netDeficiencyRisk), color: sel.state === 'anti_deficiency' ? 'text-green-400' : 'text-red-400', bold: true },
                ].map(m => (
                  <div key={m.label} className={`flex justify-between items-center p-2 rounded-lg ${(m as {bold?: boolean}).bold ? 'bg-slate-700/30 border border-slate-600' : ''}`}>
                    <span className="text-xs text-slate-400">{m.label}</span>
                    <span className={`text-xs font-bold ${m.color}`}>{m.value}</span>
                  </div>
                ))}
              </div>

              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Path Comparison — Total Cost</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={sellerCalc.compareData} layout="vertical">
                    <XAxis type="number" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 9 }} />
                    <YAxis type="category" dataKey="path" tick={{ fill: '#94a3b8', fontSize: 10 }} width={80} />
                    <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="deficiency" name="Deficiency Risk" fill="#ef4444" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="taxBurden" name="Tax (1099-C)" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-4 gap-1 mt-3">
                  {sellerCalc.compareData.map(d => (
                    <div key={d.path} className="bg-slate-900/50 rounded-lg p-2 text-center">
                      <p className="text-xs font-bold text-slate-300">{d.path}</p>
                      <p className="text-xs text-purple-400">{d.creditYears}yr credit</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Seller Guide</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
              {[
                '📝 Always get deficiency waiver in writing from lender — verbal agreements are not enforceable',
                '🏛 MFDRA (Mortgage Forgiveness Debt Relief Act): Congress periodically extends — verify current year coverage for primary residence forgiven debt',
                '💳 Credit impact: short sale typically reports as "settled for less than owed" — 3-4 year recovery vs 7 years for foreclosure',
                '⏰ Timeline: 90-180 days typical from lender submission to approval; 30+ days for closing after approval',
                '🤝 Hire a licensed short sale negotiator — lenders have specific processes; experienced negotiators dramatically improve odds',
                '📊 Insolvency test: if total debts exceed total assets at time of forgiveness, forgiven amount = excluded up to insolvency amount (Form 982)',
                '2nd lien holders: 2nd lenders get little/nothing in short sale — they often hold out or settle for pennies; negotiate separately',
                '⚖️ Consult a tax attorney before closing — 1099-C consequences can create unexpected 5-6 figure tax bills if not excluded',
              ].map((t, i) => <p key={i}>{t}</p>)}
            </div>
          </div>
        </>
      )}

      {perspective === 'buyer' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Discount to ARV', value: `${buyerCalc.discount.toFixed(1)}%`, color: buyerCalc.discount >= 15 ? 'text-green-400' : 'text-yellow-400' },
              { label: 'All-In Cost', value: fmt(buyerCalc.allIn), color: 'text-orange-400' },
              { label: 'Net Profit', value: fmt(buyerCalc.profit), color: buyerCalc.profit > 0 ? 'text-green-400' : 'text-red-400' },
              { label: 'Lender Approval Odds', value: buyerCalc.approvalOdds, color: buyerCalc.discount >= 20 ? 'text-green-400' : buyerCalc.discount >= 10 ? 'text-yellow-400' : 'text-red-400' },
            ].map(m => (
              <div key={m.label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
                <p className={`text-xl font-black ${m.color}`}>{m.value}</p>
                <p className="text-xs text-slate-400 mt-1">{m.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
              <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Offer Analysis</p>
              {bf('Your Offer Price', 'offerPrice', '', '$')}
              {bf('After-Repair Value (ARV)', 'arv', '', '$')}
              {bf('Rehab / Repair Cost', 'rehabCost', '', '$')}
              {bf('Hold Period (incl. SS wait)', 'holdMonths', 'mo')}
              {bf('Monthly Carry Cost', 'carryMonthlyCost', '/mo', '$')}
              <div>
                <label className="block text-xs text-slate-400 mb-2">Exit Strategy</label>
                <div className="space-y-1">
                  {([['flip', '🔨 Flip after SS closes + rehab'], ['rental', '🏠 Buy and Hold / Rental'], ['live', '🏡 Primary Residence']] as const).map(([v, label]) => (
                    <label key={v} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs transition ${buy.exitStrategy === v ? 'border-blue-500 bg-blue-900/20' : 'border-slate-700'}`}>
                      <input type="radio" name="exit" value={v} checked={buy.exitStrategy === v} onChange={() => setBuy(p => ({ ...p, exitStrategy: v }))} />
                      <span className="text-slate-200">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              {buy.exitStrategy === 'flip' && bf('Selling Costs', 'sellingCostPct', '% ARV')}
              {buy.exitStrategy === 'rental' && (
                <>{bf('Monthly Rent', 'rentalMonthlyRent', '/mo', '$')}{bf('Expense Ratio', 'rentalExpenseRatio', '%')}{bf('Cap Rate (valuation)', 'rentalCapRate', '%')}</>
              )}
            </div>

            <div className="space-y-4">
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-2">
                <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Profit Breakdown</p>
                {[
                  { label: 'Offer Price', value: `(${fmt(buy.offerPrice)})`, color: 'text-red-400' },
                  { label: 'Rehab Cost', value: `(${fmt(buy.rehabCost)})`, color: 'text-red-300' },
                  { label: `Carry (${buy.holdMonths}mo × ${fmt(buy.carryMonthlyCost)})`, value: `(${fmt(buyerCalc.totalCarry)})`, color: 'text-red-300' },
                  { label: 'Exit Value', value: fmt(buyerCalc.exitValue), color: 'text-blue-400' },
                  { label: 'Exit Costs', value: `(${fmt(buyerCalc.exitCost)})`, color: 'text-red-300' },
                  { label: 'Net Profit', value: fmt(buyerCalc.profit), color: buyerCalc.profit > 0 ? 'text-green-400' : 'text-red-400', bold: true },
                  { label: 'Profit %', value: `${buyerCalc.profitPct.toFixed(1)}%`, color: buyerCalc.profitPct >= 15 ? 'text-green-400' : 'text-yellow-400' },
                  { label: 'After SS Approval Wait (+4mo)', value: fmt(buyerCalc.profitAfterWait), color: 'text-slate-400' },
                ].map(m => (
                  <div key={m.label} className={`flex justify-between p-1.5 rounded-lg ${(m as {bold?: boolean}).bold ? 'bg-slate-700/30 border border-slate-600' : ''}`}>
                    <span className="text-xs text-slate-400">{m.label}</span>
                    <span className={`text-xs font-bold ${m.color}`}>{m.value}</span>
                  </div>
                ))}
              </div>

              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Bid Scenarios vs ARV</p>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={buyerCalc.scenarios}>
                    <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 9 }} />
                    <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
                    <Tooltip formatter={(v: number, n: string) => n === 'Profit %' ? `${v}%` : fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
                    <Bar dataKey="profit" name="Profit" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Buyer Guide — Short Sales</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
              {[
                '⏰ Timeline: 3-6+ months from offer to close — lenders move slowly; secure financing pre-approval early',
                '💰 Discount sweet spot: 15-25% below ARV — enough for lender to approve, enough for you to profit after costs',
                '📋 Lender BPO (Broker Price Opinion): lender orders their own value estimate — if BPO > your offer, they reject; submit comps supporting your price',
                '🏦 Financing: conventional, FHA, VA all work for short sales — some lenders add addendums, review before signing',
                '🤝 Seller cooperation: distressed seller must submit hardship letter, financial docs — vet their motivation before wasting 6 months',
                '2nd lien strategy: 2nds often settle for 5-10 cents on the dollar — factor this into your offer; coordinate between lenders',
                '📆 Expiration: short sale approval letters expire (30-90 days) — if you can\'t close in time, request extension immediately',
                '⚠️ No contingency on lender approval: if lender rejects and rejects again, deal is dead — only bid what you\'d still profit on if stuck holding',
              ].map((t, i) => <p key={i}>{t}</p>)}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
