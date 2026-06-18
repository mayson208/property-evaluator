import { useState, useMemo } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import { getAnnualPropertyTax, getAnnualInsurance, getAnnualMaintenance } from '../engine/valuation'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function RentVsBuy() {
  const { result, input } = usePropertyStore()

  const homeValue  = result?.estimatedValue ?? 400000
  const state      = input.state || 'TX'
  const yearBuilt  = input.yearBuilt || 2000

  const [monthlyRent, setMonthlyRent]         = useState(Math.round(homeValue * 0.005 / 50) * 50)
  const [downPct, setDownPct]                 = useState(20)
  const [interestRate, setInterestRate]       = useState(7.25)
  const [hoa, setHoa]                         = useState(0)
  const [appreciationRate, setAppreciationRate] = useState(3.5)
  const [rentInflation, setRentInflation]     = useState(3.0)
  const [years, setYears]                     = useState(10)
  const [investmentReturn, setInvestmentReturn] = useState(7.0)

  const data = useMemo(() => {
    const downPayment    = homeValue * (downPct / 100)
    const loanAmount     = homeValue - downPayment
    const monthlyRate    = interestRate / 100 / 12
    const nPayments      = 30 * 12
    const monthlyPI      = loanAmount > 0 && monthlyRate > 0
      ? loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, nPayments)) / (Math.pow(1 + monthlyRate, nPayments) - 1)
      : loanAmount / nPayments

    const annualTax      = getAnnualPropertyTax(homeValue, state)
    const annualIns      = getAnnualInsurance(homeValue)
    const annualMaint    = getAnnualMaintenance(homeValue, yearBuilt)

    const points = []
    let buyEquity        = downPayment
    let buyTotalCost     = downPayment
    let rentTotalCost    = 0
    let rentSavings      = downPayment   // investing down payment instead
    let balance          = loanAmount
    let currentRent      = monthlyRent
    let currentHomeValue = homeValue

    for (let yr = 1; yr <= years; yr++) {
      // Buying: 12 months of payments
      let annualPI = 0
      for (let m = 0; m < 12; m++) {
        const interestPaid  = balance * monthlyRate
        const principalPaid = monthlyPI - interestPaid
        balance = Math.max(0, balance - principalPaid)
        annualPI += monthlyPI
      }
      currentHomeValue *= 1 + appreciationRate / 100
      buyEquity = currentHomeValue - balance
      const annualOwningCost = annualPI + annualTax + annualIns + annualMaint + hoa * 12
      buyTotalCost += annualOwningCost

      // Renting: track costs and investment of down payment
      const annualRent = currentRent * 12
      rentTotalCost += annualRent
      rentSavings  *= 1 + investmentReturn / 100
      rentSavings  += Math.max(0, annualOwningCost - annualRent)  // extra savings from renting cheaper
      currentRent  *= 1 + rentInflation / 100

      points.push({
        year: yr,
        buyNetWorth:  Math.round(buyEquity - buyTotalCost + downPayment + homeValue),
        rentNetWorth: Math.round(rentSavings - rentTotalCost),
        buyEquity:    Math.round(buyEquity),
        buyTotalPaid: Math.round(buyTotalCost),
        rentTotalPaid: Math.round(rentTotalCost),
      })
    }

    const breakEvenYear = points.findIndex(p => p.buyNetWorth > p.rentNetWorth)

    return { points, breakEvenYear: breakEvenYear >= 0 ? breakEvenYear + 1 : null, monthlyPI }
  }, [homeValue, state, yearBuilt, downPct, interestRate, hoa, appreciationRate, rentInflation, years, investmentReturn, monthlyRent])

  const finalPoint = data.points[data.points.length - 1]
  const buyWins    = finalPoint ? finalPoint.buyNetWorth > finalPoint.rentNetWorth : false

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Rent vs Buy</h3>
        <p className="text-xs text-slate-500">Compare total cost and net worth over time for each path</p>
      </div>

      {result && (
        <div className="bg-blue-900/30 border border-blue-800/50 rounded-xl p-3 text-xs text-blue-300">
          Using estimated value of <strong>{fmt(homeValue)}</strong>. Monthly rent pre-filled at 0.5% of value.
        </div>
      )}

      {/* Inputs */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-4">
        <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Scenario Parameters</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-slate-400 uppercase tracking-widest">Monthly Rent (alt.)</label>
              <span className="text-xs font-bold text-green-400">{fmt(monthlyRent)}/mo</span>
            </div>
            <input type="range" min={500} max={Math.round(homeValue * 0.012 / 100) * 100} step={50}
              value={monthlyRent} onChange={e => setMonthlyRent(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-green-500" />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-slate-400 uppercase tracking-widest">Down Payment</label>
              <span className="text-xs font-bold text-blue-400">{downPct}% ({fmt(homeValue * downPct / 100)})</span>
            </div>
            <input type="range" min={3} max={50} step={1} value={downPct}
              onChange={e => setDownPct(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-slate-400 uppercase tracking-widest">Mortgage Rate</label>
              <span className="text-xs font-bold text-blue-400">{interestRate}%</span>
            </div>
            <input type="range" min={3} max={12} step={0.125} value={interestRate}
              onChange={e => setInterestRate(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-slate-400 uppercase tracking-widest">HOA (monthly)</label>
              <span className="text-xs font-bold text-slate-300">{fmt(hoa)}/mo</span>
            </div>
            <input type="range" min={0} max={1500} step={25} value={hoa}
              onChange={e => setHoa(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-slate-400" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-slate-400 uppercase tracking-widest">Home Appreciation</label>
              <span className="text-xs font-bold text-orange-400">{appreciationRate}%/yr</span>
            </div>
            <input type="range" min={0} max={12} step={0.5} value={appreciationRate}
              onChange={e => setAppreciationRate(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-orange-500" />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-slate-400 uppercase tracking-widest">Rent Inflation</label>
              <span className="text-xs font-bold text-red-400">{rentInflation}%/yr</span>
            </div>
            <input type="range" min={0} max={8} step={0.5} value={rentInflation}
              onChange={e => setRentInflation(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-red-500" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-slate-400 uppercase tracking-widest">Investment Return (rent path)</label>
              <span className="text-xs font-bold text-purple-400">{investmentReturn}%/yr</span>
            </div>
            <input type="range" min={0} max={15} step={0.5} value={investmentReturn}
              onChange={e => setInvestmentReturn(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-purple-500" />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-slate-400 uppercase tracking-widest">Time Horizon</label>
              <span className="text-xs font-bold text-slate-300">{years} years</span>
            </div>
            <input type="range" min={1} max={30} step={1} value={years}
              onChange={e => setYears(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-slate-400" />
          </div>
        </div>
      </div>

      {/* Verdict */}
      <div className={`rounded-xl p-5 border ${buyWins ? 'bg-blue-900/20 border-blue-700/50' : 'bg-green-900/20 border-green-700/50'}`}>
        <p className={`text-lg font-black ${buyWins ? 'text-blue-400' : 'text-green-400'}`}>
          {buyWins ? '🏠 Buying wins' : '🏢 Renting wins'} after {years} years
        </p>
        {data.breakEvenYear && (
          <p className="text-sm text-slate-400 mt-1">
            Break-even year: <strong className="text-white">Year {data.breakEvenYear}</strong> — buying becomes financially superior at that point
          </p>
        )}
        {!data.breakEvenYear && !buyWins && (
          <p className="text-sm text-slate-400 mt-1">
            Renting remains better throughout the {years}-year window at these assumptions
          </p>
        )}
      </div>

      {/* Summary grid */}
      {finalPoint && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-900/20 rounded-xl p-4 border border-blue-800/40">
            <p className="text-xs text-blue-400 uppercase tracking-widest mb-2 font-bold">Buying Path</p>
            <p className="text-2xl font-black text-white">{fmt(finalPoint.buyNetWorth)}</p>
            <p className="text-xs text-slate-500 mt-1">Net worth after {years} yrs</p>
            <p className="text-xs text-slate-500 mt-0.5">Total paid: {fmt(finalPoint.buyTotalPaid)}</p>
            <p className="text-xs text-slate-500 mt-0.5">Equity built: {fmt(finalPoint.buyEquity)}</p>
            <p className="text-xs text-slate-500 mt-0.5">Monthly P&I: {fmt(Math.round(data.monthlyPI))}</p>
          </div>
          <div className="bg-green-900/20 rounded-xl p-4 border border-green-800/40">
            <p className="text-xs text-green-400 uppercase tracking-widest mb-2 font-bold">Renting Path</p>
            <p className="text-2xl font-black text-white">{fmt(finalPoint.rentNetWorth)}</p>
            <p className="text-xs text-slate-500 mt-1">Net worth after {years} yrs</p>
            <p className="text-xs text-slate-500 mt-0.5">Total rent paid: {fmt(finalPoint.rentTotalPaid)}</p>
            <p className="text-xs text-slate-500 mt-0.5">Starting rent: {fmt(monthlyRent)}/mo</p>
            <p className="text-xs text-slate-500 mt-0.5">Down invested at {investmentReturn}%</p>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">
          Net Worth Comparison — <span className="text-blue-400">Buy</span> vs <span className="text-green-400">Rent</span>
        </p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data.points} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false}
              label={{ value: 'Year', position: 'insideBottom', offset: -2, fill: '#475569', fontSize: 11 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} width={60} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
              formatter={(v: number, name: string) => [fmt(v), name === 'buyNetWorth' ? 'Buy net worth' : 'Rent net worth']}
              labelFormatter={l => `Year ${l}`}
            />
            <Legend formatter={v => v === 'buyNetWorth' ? 'Buy path' : 'Rent path'}
              wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            {data.breakEvenYear && (
              <ReferenceLine x={data.breakEvenYear} stroke="#64748b" strokeDasharray="4 4"
                label={{ value: 'Break-even', fill: '#94a3b8', fontSize: 10 }} />
            )}
            <Line type="monotone" dataKey="buyNetWorth"  stroke="#3b82f6" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="rentNetWorth" stroke="#22c55e" strokeWidth={2.5} dot={false} strokeDasharray="6 3" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-slate-600 text-center">
        Net worth model: Buy path = equity − cumulative costs. Rent path = invested down payment at {investmentReturn}% + surplus savings.
        Excludes tax deductions, PMI, and transaction costs on sale. Highly sensitive to appreciation and investment return assumptions.
      </p>
    </div>
  )
}
