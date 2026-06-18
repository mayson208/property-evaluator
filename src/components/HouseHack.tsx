import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line, ReferenceLine } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

type HackType = 'multifamily' | 'adu' | 'roomrental'

export default function HouseHack() {
  const [hackType,       setHackType]       = useState<HackType>('multifamily')
  const [purchasePrice,  setPurchasePrice]  = useState(400000)
  const [loanType,       setLoanType]       = useState<'fha' | 'conv' | 'conv5'>('fha')
  const [interestRate,   setInterestRate]   = useState(7.0)
  const [numUnits,       setNumUnits]       = useState(3)          // total units (incl yours)
  const [rentPerUnit,    setRentPerUnit]    = useState(1400)       // avg rent per rented unit
  const [expensesPct,    setExpensesPct]    = useState(35)         // % of gross rent
  const [yourMarketRent, setYourMarketRent] = useState(1600)       // what you'd pay to rent elsewhere
  const [aduRent,        setAduRent]        = useState(1000)       // ADU / basement rent
  const [numRoomsRented, setNumRoomsRented] = useState(2)
  const [rentPerRoom,    setRentPerRoom]    = useState(700)
  const [propTaxMonthly, setPropTaxMonthly] = useState(350)
  const [insuranceMonthly, setInsuranceMonthly] = useState(150)
  const [appreciationRate, setAppreciationRate] = useState(4)

  const calc = useMemo(() => {
    // Down payment %
    const dpPct = loanType === 'fha' ? 0.035
      : loanType === 'conv' ? 0.20
      : 0.05

    const downPayment   = purchasePrice * dpPct
    const loanAmount    = purchasePrice - downPayment
    const r             = interestRate / 100 / 12
    const n             = 360   // 30-year
    const monthlyPI     = loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
    const pmi           = loanType !== 'conv' && loanAmount / purchasePrice > 0.80 ? loanAmount * 0.0085 / 12 : 0
    const fhaMIP        = loanType === 'fha' ? loanAmount * 0.0055 / 12 : 0   // FHA annual MIP
    const monthlyPITI   = monthlyPI + propTaxMonthly + insuranceMonthly + pmi + fhaMIP

    // Rental income by hack type
    let rentalIncome = 0
    let rentalDesc = ''
    if (hackType === 'multifamily') {
      const rentedUnits = numUnits - 1
      rentalIncome = rentedUnits * rentPerUnit
      rentalDesc   = `${rentedUnits} units × ${fmt(rentPerUnit)}/mo`
    } else if (hackType === 'adu') {
      rentalIncome = aduRent
      rentalDesc   = `ADU/basement: ${fmt(aduRent)}/mo`
    } else {
      rentalIncome = numRoomsRented * rentPerRoom
      rentalDesc   = `${numRoomsRented} rooms × ${fmt(rentPerRoom)}/mo`
    }

    const expenses          = rentalIncome * expensesPct / 100
    const netRental         = rentalIncome - expenses
    const effectiveHousingCost = monthlyPITI - netRental
    const savingsVsRenting  = yourMarketRent - effectiveHousingCost

    // Full occupancy (when you eventually move out)
    let fullRentalIncome = 0
    if (hackType === 'multifamily') fullRentalIncome = numUnits * rentPerUnit
    else if (hackType === 'adu')    fullRentalIncome = aduRent + yourMarketRent
    else                             fullRentalIncome = (numRoomsRented + 1) * rentPerRoom

    const fullExpenses = fullRentalIncome * expensesPct / 100
    const fullNOI      = fullRentalIncome - fullExpenses
    const fullCashFlow = fullNOI - monthlyPITI
    const capRate      = (fullNOI * 12) / purchasePrice * 100

    // Closing costs estimate
    const closingCosts = purchasePrice * (loanType === 'fha' ? 0.03 : 0.025)
    const totalCashNeeded = downPayment + closingCosts

    // Years to recoup down payment from savings + equity
    const equityPerYear = purchasePrice * (appreciationRate / 100)
    const annualSavings = Math.max(savingsVsRenting, 0) * 12
    const annualBenefit = equityPerYear + annualSavings
    const yearsToRecoup = annualBenefit > 0 ? totalCashNeeded / annualBenefit : Infinity

    // 10yr wealth
    const yr10Value      = purchasePrice * Math.pow(1 + appreciationRate / 100, 10)
    const yr10Equity     = yr10Value - loanAmount * Math.pow(1 - r, 120)  // approx remaining balance
    const yr10CumSavings = Math.max(savingsVsRenting, 0) * 12 * 10

    // Comparison chart: house hack vs renting
    const chartData = Array.from({ length: 11 }, (_, yr) => ({
      yr,
      'HH Equity': Math.round(purchasePrice * Math.pow(1 + appreciationRate / 100, yr) - loanAmount + Math.max(savingsVsRenting, 0) * 12 * yr),
      'Renter Savings': Math.round(yourMarketRent * 12 * yr * 0.1),  // renter saves 10% of rent
    }))

    // Loan programs
    const programs = [
      {
        name: 'FHA 3.5% Down', id: 'fha',
        dp: purchasePrice * 0.035, pros: ['Lowest down payment', 'Lower credit score OK (580+)', 'Owner-occupant eligible'],
        cons: ['Upfront MIP 1.75%', 'Annual MIP 0.55% forever (if < 10% down)', 'Seller concession limits'],
      },
      {
        name: 'Conv 5% Down', id: 'conv5',
        dp: purchasePrice * 0.05, pros: ['Lower MIP than FHA', 'PMI drops at 80% LTV', 'More seller concessions'],
        cons: ['PMI required', 'Higher rate vs FHA sometimes', '720+ score preferred'],
      },
      {
        name: 'Conv 20% Down', id: 'conv',
        dp: purchasePrice * 0.20, pros: ['No PMI', 'Best rate', 'Largest lender pool'],
        cons: ['$' + (purchasePrice * 0.20 / 1000).toFixed(0) + 'K down required', 'More cash tied up'],
      },
    ]

    return {
      downPayment, monthlyPI, pmi, fhaMIP, monthlyPITI, rentalIncome, expenses, netRental,
      effectiveHousingCost, savingsVsRenting, fullRentalIncome, fullNOI, fullCashFlow, capRate,
      closingCosts, totalCashNeeded, yearsToRecoup, yr10Value, yr10Equity, yr10CumSavings,
      chartData, programs, rentalDesc,
    }
  }, [hackType, purchasePrice, loanType, interestRate, numUnits, rentPerUnit, expensesPct,
      yourMarketRent, aduRent, numRoomsRented, rentPerRoom, propTaxMonthly, insuranceMonthly, appreciationRate])

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

  const hackOptions: { id: HackType; label: string; icon: string; desc: string }[] = [
    { id: 'multifamily', label: 'Multi-Family', icon: '🏘', desc: 'Buy 2-4 units, live in one, rent the others (FHA-eligible)' },
    { id: 'adu',         label: 'ADU / Basement', icon: '🏠', desc: 'Single-family with accessory dwelling unit or basement apartment' },
    { id: 'roomrental',  label: 'Room Rental', icon: '🛏', desc: 'Buy SFH, rent out individual rooms (highest $/sqft but more management)' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">House Hacking Calculator</h3>
        <p className="text-xs text-slate-500">
          House hacking = buy a property, live in part of it, and let tenants pay your mortgage.
          Compare strategies and loan options to find your lowest effective housing cost.
        </p>
      </div>

      {/* Strategy selector */}
      <div className="grid grid-cols-3 gap-3">
        {hackOptions.map(o => (
          <button key={o.id} onClick={() => setHackType(o.id)}
            className={`rounded-xl p-3 border text-left transition ${hackType === o.id ? 'bg-blue-900/30 border-blue-600' : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'}`}>
            <div className="text-xl mb-1">{o.icon}</div>
            <p className="text-xs font-bold text-slate-200 mb-1">{o.label}</p>
            <p className="text-xs text-slate-500 leading-snug">{o.desc}</p>
          </button>
        ))}
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Property & Loan</p>
          <Slider label="Purchase Price" value={purchasePrice} min={100000} max={2000000} step={10000} onChange={setPurchasePrice} prefix="$" />
          <div>
            <label className="text-xs text-slate-400">Loan Type</label>
            <select value={loanType} onChange={e => setLoanType(e.target.value as 'fha' | 'conv' | 'conv5')}
              className="mt-1 w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200">
              <option value="fha">FHA 3.5% Down</option>
              <option value="conv5">Conventional 5% Down</option>
              <option value="conv">Conventional 20% Down</option>
            </select>
          </div>
          <Slider label="Interest Rate" value={interestRate} min={4} max={12} step={0.125} onChange={setInterestRate} suffix="%" />
          <Slider label="Property Tax (monthly)" value={propTaxMonthly} min={0} max={2000} step={25} onChange={setPropTaxMonthly} prefix="$" />
          <Slider label="Insurance (monthly)" value={insuranceMonthly} min={50} max={500} step={10} onChange={setInsuranceMonthly} prefix="$" />
          <Slider label="Annual Appreciation" value={appreciationRate} min={0} max={10} step={0.5} onChange={setAppreciationRate} suffix="%" />
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Rental Income</p>
          {hackType === 'multifamily' && (
            <>
              <Slider label="Total Units (incl. yours)" value={numUnits} min={2} max={4} step={1} onChange={setNumUnits} />
              <Slider label="Avg Rent per Rented Unit" value={rentPerUnit} min={500} max={5000} step={50} onChange={setRentPerUnit} prefix="$" />
            </>
          )}
          {hackType === 'adu' && (
            <Slider label="ADU / Basement Rent" value={aduRent} min={300} max={3000} step={50} onChange={setAduRent} prefix="$" />
          )}
          {hackType === 'roomrental' && (
            <>
              <Slider label="Rooms Rented Out" value={numRoomsRented} min={1} max={6} step={1} onChange={setNumRoomsRented} />
              <Slider label="Rent per Room" value={rentPerRoom} min={300} max={1500} step={25} onChange={setRentPerRoom} prefix="$" />
            </>
          )}
          <Slider label="Operating Expenses (% of rent)" value={expensesPct} min={10} max={60} step={5} onChange={setExpensesPct} suffix="%" />
          <Slider label="Your Market Rent (to compare)" value={yourMarketRent} min={500} max={5000} step={50} onChange={setYourMarketRent} prefix="$" />
        </div>
      </div>

      {/* Key numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total PITI',                val: fmt(calc.monthlyPITI),              color: 'text-red-400' },
          { label: `Rental Income (${calc.rentalDesc.split(':')[0]})`, val: fmt(calc.rentalIncome), color: 'text-green-400' },
          { label: 'Effective Housing Cost',    val: fmt(calc.effectiveHousingCost),      color: calc.effectiveHousingCost <= 0 ? 'text-green-400' : 'text-blue-400' },
          { label: 'Savings vs Renting',        val: fmt(calc.savingsVsRenting),          color: calc.savingsVsRenting >= 0 ? 'text-green-400' : 'text-red-400' },
          { label: 'Cash Needed to Close',      val: fmt(calc.totalCashNeeded),           color: 'text-yellow-400' },
          { label: 'Down Payment',              val: fmt(calc.downPayment),               color: 'text-orange-400' },
          { label: 'Cash Flow (full occupancy)',val: fmt(calc.fullCashFlow),              color: calc.fullCashFlow >= 0 ? 'text-green-400' : 'text-red-400' },
          { label: 'Cap Rate (full occupancy)', val: calc.capRate.toFixed(1) + '%',        color: calc.capRate >= 6 ? 'text-green-400' : 'text-yellow-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 text-center">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={`text-lg font-black ${s.color}`}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Housing cost breakdown bar */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Monthly Housing Cost Breakdown</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart
            data={[
              { name: 'Principal + Interest', val: Math.round(calc.monthlyPI), fill: '#ef4444' },
              { name: 'Tax + Insurance',       val: Math.round(calc.monthlyPITI - calc.monthlyPI), fill: '#f59e0b' },
              { name: 'Rental Income',         val: -Math.round(calc.rentalIncome), fill: '#10b981' },
              { name: 'Net Housing Cost',      val: Math.round(calc.effectiveHousingCost), fill: '#3b82f6' },
            ]}
            margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 9 }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} tickFormatter={v => `$${Math.abs(v)}`} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v: number) => [fmt(v), 'Monthly']} />
            <Bar dataKey="val" radius={[4, 4, 0, 0]}>
              {[
                <Cell key="0" fill="#ef4444" />, <Cell key="1" fill="#f59e0b" />,
                <Cell key="2" fill="#10b981" />, <Cell key="3" fill="#3b82f6" />,
              ]}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 10yr wealth chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">10-Year Wealth: House Hacking vs Renting</p>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={calc.chartData} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="yr" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v: number) => [fmt(v)]} />
            <Line type="monotone" dataKey="HH Equity" stroke="#3b82f6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Renter Savings" stroke="#64748b" strokeWidth={2} dot={false} strokeDasharray="4 4" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Loan comparison */}
      <div className="space-y-3">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Loan Program Comparison</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {calc.programs.map(p => (
            <div key={p.id} className={`rounded-xl border p-3 ${loanType === p.id ? 'border-blue-600 bg-blue-900/10' : 'border-slate-700 bg-slate-800/50'}`}>
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs font-bold text-slate-200">{p.name}</p>
                <span className="text-xs font-black text-yellow-400">{fmt(p.dp)}</span>
              </div>
              <div className="space-y-0.5">
                {p.pros.map(pro => <p key={pro} className="text-xs text-green-400">✓ {pro}</p>)}
                {p.cons.map(con => <p key={con} className="text-xs text-slate-500">✗ {con}</p>)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tips */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">House Hacking Playbook</p>
        <div className="space-y-1.5 text-xs text-slate-400">
          {[
            '🏘 FHA allows 2-4 unit owner-occupied purchase at 3.5% down — the most powerful house hacking loan.',
            '📋 Document rental income carefully: rental agreements + 2 months bank statements for lender underwriting.',
            '🏠 ADU hack: add a separate entrance to your basement/garage first, then buy — or find existing ADU-ready homes.',
            '🛏 Room rental can cash-flow the best per dollar invested but is highest-management (think of a small hotel).',
            '⏱️ FHA occupancy requirement: must move in within 60 days and live there for 1+ year minimum.',
            '📈 Strategy: live there 1-2 years, build equity + rental history, then buy a new hack and convert to full rental.',
            '💡 "Self-sufficiency test" for FHA 3-4 units: 75% of market rents must cover the PITI — verify with your lender.',
            '🔑 The exit: once LTV drops to 80%, drop PMI/MIP and convert to full rental — now you own a cash-flowing asset.',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center">
        Cash-to-close and monthly payment estimates are approximations. Get pre-approved and request a Loan Estimate
        from your lender for exact figures. FHA guidelines change — verify current MIP rates with your lender.
      </p>
    </div>
  )
}
