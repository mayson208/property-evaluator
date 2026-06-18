import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}
function fmt2(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function EscrowAnalysis() {
  // Current escrow items
  const [annualTax,        setAnnualTax]        = useState(4800)
  const [annualInsurance,  setAnnualInsurance]   = useState(1800)
  const [annualFlood,      setAnnualFlood]       = useState(0)
  const [annualMIP,        setAnnualMIP]         = useState(0)         // FHA MIP or PMI
  const [currentEscrowPmt, setCurrentEscrowPmt]  = useState(550)       // what you're currently paying
  const [escrowBalance,    setEscrowBalance]     = useState(1100)      // current balance on statement
  const [analysisDone,     setAnalysisDone]      = useState(true)      // analysis period ended

  // Upcoming year projections
  const [taxChangePercent, setTaxChangePercent]  = useState(5)         // % increase
  const [insuranceChangePct, setInsuranceChangePct] = useState(8)
  const [floodChangePct,   setFloodChangePct]    = useState(0)
  const [startMonth,       setStartMonth]        = useState(4)         // what month escrow year starts (April = 4)

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  const calc = useMemo(() => {
    // Current year totals
    const currentTotal     = annualTax + annualInsurance + annualFlood + annualMIP
    const currentMonthly   = currentTotal / 12

    // Required cushion = 2 months of escrow items (RESPA requirement)
    const requiredCushion  = currentMonthly * 2
    const requiredBalance  = requiredCushion  // minimum balance at lowest point

    // Upcoming year projections
    const newTax          = annualTax      * (1 + taxChangePercent / 100)
    const newInsurance    = annualInsurance * (1 + insuranceChangePct / 100)
    const newFlood        = annualFlood    * (1 + floodChangePct / 100)
    const newTotal        = newTax + newInsurance + newFlood + annualMIP
    const newMonthly      = newTotal / 12

    // New required cushion based on upcoming year
    const newCushion      = newMonthly * 2

    // Escrow analysis computation (RESPA §10)
    // Expected starting balance = current balance (from statement)
    // Run through 12 months of payments and disbursements
    // Tax: typically paid in lump sums (semi-annual or annual)
    // Insurance: typically annual
    // We'll model: insurance in month 3 (March), taxes in months 4 and 10 (semi-annual)
    const disbursements = Array(12).fill(0)
    disbursements[2]  = newInsurance             // insurance in month 3 (index 2)
    disbursements[3]  = newTax / 2               // property tax 1st half (index 3 = 4th month)
    disbursements[9]  = newTax / 2               // property tax 2nd half (index 9 = 10th month)
    if (newFlood > 0)   disbursements[5] = newFlood  // flood in June
    if (annualMIP > 0) {
      // MIP paid monthly directly, not escrowed separately usually, but model it
      for (let i = 0; i < 12; i++) disbursements[i] += annualMIP / 12
    }

    // Calculate: what should the monthly deposit be?
    // RESPA: the monthly deposit must ensure the lowest balance is exactly = 2-month cushion
    let minBalance = Infinity
    let testBalance = escrowBalance
    const testData = []
    for (let mo = 0; mo < 12; mo++) {
      testBalance += newMonthly - disbursements[mo]
      testData.push(testBalance)
      if (testBalance < minBalance) minBalance = testBalance
    }
    const deficit = Math.max(requiredCushion - minBalance, 0)

    // Now recalculate with correct monthly amount
    const correctMonthly = newMonthly + deficit / 12
    let balance = escrowBalance
    const monthData = []
    for (let mo = 0; mo < 12; mo++) {
      const deposit  = correctMonthly
      const disb     = disbursements[mo]
      const opening  = balance
      balance += deposit - disb
      monthData.push({
        month:    MONTHS[mo],
        balance:  Math.round(balance),
        deposit:  Math.round(deposit),
        disb:     disb > 0 ? Math.round(disb) : 0,
        opening:  Math.round(opening),
      })
    }

    // Surplus or deficiency
    const targetMonthlyNew  = correctMonthly
    const surplus           = currentEscrowPmt > targetMonthlyNew ? currentEscrowPmt - targetMonthlyNew : 0
    const deficiency        = currentEscrowPmt < targetMonthlyNew ? targetMonthlyNew - currentEscrowPmt : 0
    const paymentChange     = targetMonthlyNew - currentEscrowPmt

    // Escrow balance adequacy
    const adequacyPct = escrowBalance / requiredCushion * 100
    const adequacyStatus = adequacyPct >= 100 ? 'Adequate' : adequacyPct >= 50 ? 'Low' : 'Deficient'
    const adequacyColor  = adequacyPct >= 100 ? 'text-green-400' : adequacyPct >= 50 ? 'text-yellow-400' : 'text-red-400'

    // Escrow waiver: could you opt out?
    // Usually allowed at 20% LTV conventional, but requires lender permission and may have a fee
    const escrowWaiverFee = newTotal * 0.0025  // roughly 0.25% of loan amount (proxy)
    const annualSavingFromWaiver = 0  // no direct saving — you just pay directly

    // Year-over-year items
    const itemChange = [
      { name: 'Property Tax', current: annualTax, next: newTax, change: newTax - annualTax },
      { name: 'Homeowners Ins.', current: annualInsurance, next: newInsurance, change: newInsurance - annualInsurance },
      { name: 'Flood Insurance', current: annualFlood, next: newFlood, change: newFlood - annualFlood },
      { name: 'MIP / PMI', current: annualMIP, next: annualMIP, change: 0 },
    ].filter(i => i.current > 0 || i.next > 0)

    return {
      currentTotal, currentMonthly, newTotal, newMonthly, newCushion, requiredCushion,
      targetMonthlyNew, surplus, deficiency, paymentChange,
      monthData, disbursements, adequacyPct, adequacyStatus, adequacyColor,
      escrowWaiverFee, itemChange, newTax, newInsurance, newFlood,
    }
  }, [annualTax, annualInsurance, annualFlood, annualMIP, currentEscrowPmt, escrowBalance,
      taxChangePercent, insuranceChangePct, floodChangePct])

  const Slider = ({ label, value, min, max, step, onChange, prefix = '', suffix = '' }: {
    label: string; value: number; min: number; max: number; step: number;
    onChange: (v: number) => void; prefix?: string; suffix?: string
  }) => (
    <div>
      <div className="flex justify-between mb-1">
        <label className="text-xs text-slate-400">{label}</label>
        <span className="text-xs font-bold text-blue-400">{prefix}{value.toLocaleString()}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Escrow Account Analyzer</h3>
        <p className="text-xs text-slate-500">
          Understand why your mortgage payment changes every year, whether you have a surplus or deficiency,
          and what your new monthly escrow amount will be after the annual analysis.
        </p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Current Escrow Items</p>
          <Slider label="Annual Property Taxes" value={annualTax} min={0} max={30000} step={100} onChange={setAnnualTax} prefix="$" />
          <Slider label="Annual Homeowners Insurance" value={annualInsurance} min={0} max={10000} step={50} onChange={setAnnualInsurance} prefix="$" />
          <Slider label="Annual Flood Insurance" value={annualFlood} min={0} max={10000} step={100} onChange={setAnnualFlood} prefix="$" />
          <Slider label="Annual PMI / MIP" value={annualMIP} min={0} max={5000} step={50} onChange={setAnnualMIP} prefix="$" />
          <Slider label="Current Escrow Monthly Payment" value={currentEscrowPmt} min={0} max={3000} step={10} onChange={setCurrentEscrowPmt} prefix="$" />
          <Slider label="Current Escrow Balance (from statement)" value={escrowBalance} min={0} max={15000} step={50} onChange={setEscrowBalance} prefix="$" />
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Upcoming Year Changes</p>
          <Slider label="Property Tax Increase" value={taxChangePercent} min={-10} max={20} step={0.5} onChange={setTaxChangePercent} suffix="%" />
          <Slider label="Insurance Premium Change" value={insuranceChangePct} min={-10} max={40} step={0.5} onChange={setInsuranceChangePct} suffix="%" />
          {annualFlood > 0 && (
            <Slider label="Flood Insurance Change" value={floodChangePct} min={-10} max={30} step={0.5} onChange={setFloodChangePct} suffix="%" />
          )}

          {/* Current balance adequacy */}
          <div className={`rounded-xl p-3 border ${calc.adequacyPct >= 100 ? 'bg-green-900/20 border-green-700/50' : 'bg-yellow-900/20 border-yellow-700/50'}`}>
            <div className="flex justify-between mb-1">
              <span className="text-xs text-slate-400">Escrow Balance Adequacy</span>
              <span className={`text-sm font-black ${calc.adequacyColor}`}>{calc.adequacyStatus}</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-1.5">
              <div className={`h-1.5 rounded-full ${calc.adequacyPct >= 100 ? 'bg-green-500' : 'bg-yellow-500'}`}
                style={{ width: `${Math.min(calc.adequacyPct, 100)}%` }} />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Required 2-month cushion: {fmt(calc.requiredCushion)} | Have: {fmt(escrowBalance)}
            </p>
          </div>
        </div>
      </div>

      {/* Payment change summary */}
      <div className={`rounded-xl p-4 border ${calc.paymentChange > 0 ? 'bg-red-900/20 border-red-700/50' : 'bg-green-900/20 border-green-700/50'}`}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Escrow Payment Change</p>
          <span className={`text-xl font-black ${calc.paymentChange > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {calc.paymentChange > 0 ? '+' : ''}{fmt2(calc.paymentChange)}/mo
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center text-xs mt-2">
          <div>
            <p className="text-slate-500">Current Escrow</p>
            <p className="text-white font-black text-base">{fmt2(currentEscrowPmt)}/mo</p>
          </div>
          <div className="text-2xl flex items-center justify-center text-slate-500">→</div>
          <div>
            <p className="text-slate-500">New Escrow</p>
            <p className={`font-black text-base ${calc.paymentChange > 0 ? 'text-red-400' : 'text-green-400'}`}>{fmt2(calc.targetMonthlyNew)}/mo</p>
          </div>
        </div>
        {calc.deficiency > 0 && (
          <p className="text-xs text-red-400 mt-2 text-center">
            Shortfall: lender may spread the {fmt(calc.deficiency * 12)} deficiency over 12 months (+{fmt2(calc.deficiency)}/mo)
          </p>
        )}
        {calc.surplus > 0 && (
          <p className="text-xs text-green-400 mt-2 text-center">
            Surplus: you may receive a refund check of up to {fmt(calc.surplus * 12)} (amounts ≥ $50 must be refunded per RESPA)
          </p>
        )}
      </div>

      {/* Year-over-year items */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Item-by-Item Change</p>
        <div className="space-y-2">
          {calc.itemChange.map(item => (
            <div key={item.name} className="flex items-center gap-3 text-xs">
              <span className="text-slate-400 w-36 flex-shrink-0">{item.name}</span>
              <span className="text-slate-500 w-24">{fmt(item.current)}/yr</span>
              <span className="text-slate-300">→</span>
              <span className="font-bold text-slate-200 w-24">{fmt(item.next)}/yr</span>
              <span className={`font-semibold ${item.change > 0 ? 'text-red-400' : item.change < 0 ? 'text-green-400' : 'text-slate-500'}`}>
                {item.change > 0 ? '+' : ''}{fmt(item.change)}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-3 text-xs pt-2 border-t border-slate-700">
            <span className="font-bold text-slate-300 w-36">Total</span>
            <span className="text-slate-300 w-24 font-bold">{fmt(calc.currentTotal)}/yr</span>
            <span className="text-slate-300">→</span>
            <span className="font-black text-white w-24">{fmt(calc.newTotal)}/yr</span>
            <span className={`font-bold ${calc.newTotal > calc.currentTotal ? 'text-red-400' : 'text-green-400'}`}>
              {calc.newTotal > calc.currentTotal ? '+' : ''}{fmt(calc.newTotal - calc.currentTotal)}
            </span>
          </div>
        </div>
      </div>

      {/* 12-month balance projection */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">12-Month Escrow Balance Projection</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={calc.monthData} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(1)}K`} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v: number, name: string) => [fmt(v), name]} />
            <Bar dataKey="balance" name="Escrow Balance" radius={[4, 4, 0, 0]}>
              {calc.monthData.map((d, i) => (
                <Cell key={i} fill={d.balance < calc.requiredCushion ? '#ef4444' : '#3b82f6'} />
              ))}
            </Bar>
            <Bar dataKey="disb" name="Disbursement" radius={[4, 4, 0, 0]} fill="#f59e0b" fillOpacity={0.7} />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-3 mt-2 justify-center text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500 rounded-sm inline-block" /> Balance</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded-sm inline-block" /> Below cushion</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-500 rounded-sm inline-block" /> Disbursement</span>
        </div>
      </div>

      {/* How escrow works */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">How Escrow Works (RESPA §10)</p>
        <div className="space-y-1.5 text-xs text-slate-400">
          {[
            '💳 You pay 1/12th of annual taxes + insurance with each monthly mortgage payment into the escrow account.',
            '🏦 The servicer holds these funds and pays your tax bills and insurance premiums on your behalf.',
            '📋 Annual Escrow Analysis: every 12 months, your servicer recalculates what the payment should be for the upcoming year.',
            '💰 Surplus (overpaid): if escrow balance is $50+ above the required cushion, the lender MUST send you a refund check.',
            '❌ Deficiency (underpaid): if balance is below the 2-month cushion, you owe the difference — lender can spread it over 12 months.',
            '📌 Required cushion = 2 months × monthly escrow items (the "initial deposit" equivalent). This is your minimum low-water balance.',
            '🔍 Read your Escrow Account Disclosure Statement carefully — it shows exactly when each payment was made and received.',
            '📞 You can dispute the analysis: if your tax bill changed, send the servicer documentation and request a re-analysis.',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>

      {/* Waiver info */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-2 font-bold">Should You Waive Escrow?</p>
        <div className="grid grid-cols-2 gap-4 text-xs text-slate-400">
          <div>
            <p className="text-green-400 font-bold mb-1">Pros (waiving)</p>
            <ul className="space-y-1">
              <li>• Control over when you pay taxes/insurance</li>
              <li>• Earn interest on funds in your own HYSA</li>
              <li>• No risk of servicer paying late or wrong amount</li>
              <li>• Simpler payment management</li>
            </ul>
          </div>
          <div>
            <p className="text-red-400 font-bold mb-1">Cons (waiving)</p>
            <ul className="space-y-1">
              <li>• Lender fee: ~0.25% of loan (often $800-2000)</li>
              <li>• Must have ≥20% equity / 80% LTV</li>
              <li>• Tax lien risk if you forget to pay</li>
              <li>• Requires discipline to set aside each month</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
