import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}
function monthlyPayment(principal: number, annualRate: number) {
  if (annualRate === 0) return principal / 360
  const r = annualRate / 100 / 12
  return principal * (r * Math.pow(1 + r, 360)) / (Math.pow(1 + r, 360) - 1)
}

export default function BuyNowVsWait() {
  const [homePrice,     setHomePrice]     = useState(450000)
  const [currentRate,   setCurrentRate]   = useState(7.0)
  const [downPct,       setDownPct]       = useState(20)
  const [monthlyRent,   setMonthlyRent]   = useState(2200)   // rent while waiting
  const [waitMonths,    setWaitMonths]    = useState(12)
  const [hysa,          setHysa]          = useState(5.2)    // HYSA rate on down payment
  const [rateChange,    setRateChange]    = useState(-0.5)   // expected rate change
  const [priceChange,   setPriceChange]   = useState(4)      // expected price change % annual
  const [pmiRate,       setPmiRate]       = useState(0.85)   // PMI % if < 20% down

  const calc = useMemo(() => {
    const downPayment     = homePrice * downPct / 100
    const loanNow         = homePrice - downPayment
    const pmtNow          = monthlyPayment(loanNow, currentRate)
    const pmiNow          = downPct < 20 ? loanNow * pmiRate / 100 / 12 : 0
    const totalPmtNow     = pmtNow + pmiNow

    // Wait scenario
    const futureRate      = Math.max(currentRate + rateChange, 1)
    const futurePricePct  = priceChange / 100
    const futurePrice     = homePrice * Math.pow(1 + futurePricePct, waitMonths / 12)
    const futureDown      = futurePrice * downPct / 100
    const futureLoan      = futurePrice - futureDown
    const pmtThen         = monthlyPayment(futureLoan, futureRate)
    const pmiThen         = downPct < 20 ? futureLoan * pmiRate / 100 / 12 : 0
    const totalPmtThen    = pmtThen + pmiThen

    // Down payment growth in HYSA while waiting
    const hysaGrowth      = downPayment * (hysa / 100 / 12) * waitMonths
    const extraDownFromHYSA = hysaGrowth

    // Rent cost while waiting
    const totalRentPaid   = monthlyRent * waitMonths

    // Appreciation missed
    const appreciationMissed = homePrice * (Math.pow(1 + futurePricePct, waitMonths / 12) - 1)

    // Net cost comparison
    // "Buy now" cost after waitMonths: principal paid, interest paid
    let buyNowEquity = 0
    let buyNowInterestPaid = 0
    let bal = loanNow
    for (let mo = 0; mo < waitMonths; mo++) {
      const interest = bal * currentRate / 100 / 12
      const principal = totalPmtNow - interest - pmiNow
      buyNowInterestPaid += interest
      buyNowEquity += principal
      bal -= principal
    }
    const buyNowHomeValue  = homePrice * Math.pow(1 + futurePricePct, waitMonths / 12)
    const buyNowNetWorth   = buyNowHomeValue - bal - downPayment
    const buyNowTotalSpent = totalPmtNow * waitMonths
    const buyNowTotalPaid  = buyNowTotalSpent

    // "Wait" cost: rent + HYSA gain – missed appreciation
    const waitNetWorth      = extraDownFromHYSA - totalRentPaid  // opportunity cost framing
    const waitTotalSpent    = totalRentPaid

    // Monthly payment delta at purchase
    const monthlyDelta      = totalPmtThen - totalPmtNow

    // 10-year wealth projection (buy now vs wait then buy)
    const chartData = Array.from({ length: 10 * 12 + 1 }, (_, mo) => {
      // Buy now: home appreciates
      const buyNowVal  = homePrice * Math.pow(1 + futurePricePct, mo / 12)
      let buyNowBal = loanNow
      for (let m = 0; m < mo; m++) {
        const interest = buyNowBal * currentRate / 100 / 12
        buyNowBal -= (totalPmtNow - interest - pmiNow)
      }
      const buyNowEq = buyNowVal - Math.max(buyNowBal, 0) - downPayment

      // Wait then buy: renting for waitMonths, then buying at futureRate/futurePrice
      let waitEq = 0
      if (mo < waitMonths) {
        // Still renting — HYSA growth
        waitEq = downPayment * (1 + hysa / 100 / 12) ** mo - totalRentPaid * (mo / waitMonths)
      } else {
        const moSinceBought = mo - waitMonths
        const waitHomeVal = futurePrice * Math.pow(1 + futurePricePct, moSinceBought / 12)
        let waitBal = futureLoan
        for (let m = 0; m < moSinceBought; m++) {
          const interest = waitBal * futureRate / 100 / 12
          waitBal -= (totalPmtThen - interest - pmiThen)
        }
        waitEq = waitHomeVal - Math.max(waitBal, 0) - futureDown - totalRentPaid + extraDownFromHYSA
      }

      if (mo % 6 !== 0) return null
      return { mo: `Mo ${mo}`, 'Buy Now': Math.round(buyNowEq), 'Wait & Buy': Math.round(waitEq) }
    }).filter(Boolean) as { mo: string; 'Buy Now': number; 'Wait & Buy': number }[]

    // Scenario matrix: price change × rate change
    const priceChanges = [-5, -2, 0, 3, 5, 8, 10]
    const rateChanges  = [-2, -1, -0.5, 0, 0.5, 1, 2]
    const matrix = priceChanges.map(pc => rateChanges.map(rc => {
      const fp  = homePrice * (1 + pc / 100)
      const fr  = Math.max(currentRate + rc, 1)
      const fl  = fp - fp * downPct / 100
      const fpmt = monthlyPayment(fl, fr) + (downPct < 20 ? fl * pmiRate / 100 / 12 : 0)
      return {
        priceChange: pc,
        rateChange:  rc,
        futurePmt:   Math.round(fpmt),
        delta:       Math.round(fpmt - totalPmtNow),
        betterToWait: fpmt < totalPmtNow - monthlyRent * 0.5,
      }
    }))

    return {
      downPayment, loanNow, pmtNow, pmiNow, totalPmtNow,
      futurePrice, futureRate, futureLoan, pmtThen, pmiThen, totalPmtThen,
      monthlyDelta, hysaGrowth, totalRentPaid, appreciationMissed,
      buyNowTotalPaid, waitTotalSpent, chartData, matrix, priceChanges, rateChanges,
    }
  }, [homePrice, currentRate, downPct, monthlyRent, waitMonths, hysa, rateChange, priceChange, pmiRate])

  const Slider = ({ label, value, min, max, step, onChange, prefix = '', suffix = '' }: {
    label: string; value: number; min: number; max: number; step: number;
    onChange: (v: number) => void; prefix?: string; suffix?: string
  }) => (
    <div>
      <div className="flex justify-between mb-1">
        <label className="text-xs text-slate-400">{label}</label>
        <span className="text-xs font-bold text-blue-400">{prefix}{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
    </div>
  )

  const matrixCellColor = (delta: number) => {
    if (delta > 500)  return 'bg-red-900/60 text-red-300'
    if (delta > 200)  return 'bg-orange-900/50 text-orange-300'
    if (delta > 0)    return 'bg-yellow-900/40 text-yellow-300'
    if (delta > -200) return 'bg-blue-900/40 text-blue-300'
    return 'bg-green-900/50 text-green-300'
  }

  const buyNowBetter  = calc.monthlyDelta > 0
  const appreciBetter = calc.appreciationMissed > calc.hysaGrowth - calc.totalRentPaid

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Buy Now vs Wait</h3>
        <p className="text-xs text-slate-500">
          Should you buy now or wait for rates to drop / prices to fall? Model the tradeoff between rent paid
          while waiting, appreciation missed, and future payment changes.
        </p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Today</p>
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-slate-400">Home Price</label>
              <span className="text-xs font-bold text-blue-400">{fmt(homePrice)}</span>
            </div>
            <input type="range" min={100000} max={2000000} step={10000} value={homePrice}
              onChange={e => setHomePrice(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
          </div>
          <Slider label="Down Payment" value={downPct} min={3} max={40} step={1} onChange={setDownPct} suffix="%" />
          <Slider label="Current Mortgage Rate" value={currentRate} min={4} max={12} step={0.125} onChange={setCurrentRate} suffix="%" />
          <Slider label="PMI Rate (if < 20% down)" value={pmiRate} min={0.3} max={1.5} step={0.05} onChange={setPmiRate} suffix="%" />
          <Slider label="Rent While Waiting (monthly)" value={monthlyRent} min={500} max={5000} step={50} onChange={setMonthlyRent} prefix="$" />
          <Slider label="Down Payment HYSA Rate" value={hysa} min={0} max={6} step={0.1} onChange={setHysa} suffix="%" />
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Wait Scenario</p>
          <Slider label="Wait Period" value={waitMonths} min={3} max={36} step={3} onChange={setWaitMonths} suffix=" months" />
          <Slider label="Expected Rate Change" value={rateChange} min={-3} max={3} step={0.25} onChange={setRateChange} suffix="%" />
          <Slider label="Expected Price Change (annualized)" value={priceChange} min={-15} max={20} step={0.5} onChange={setPriceChange} suffix="%" />

          {/* Summary */}
          <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-700 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Buy now payment</span>
              <span className="text-blue-400 font-bold">{fmt(calc.totalPmtNow)}/mo</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Buy in {waitMonths}mo payment</span>
              <span className={`font-bold ${calc.monthlyDelta > 0 ? 'text-red-400' : 'text-green-400'}`}>{fmt(calc.totalPmtThen)}/mo</span>
            </div>
            <div className="flex justify-between border-t border-slate-700 pt-2">
              <span className="text-slate-500">Payment difference</span>
              <span className={`font-black ${calc.monthlyDelta > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {calc.monthlyDelta > 0 ? '+' : ''}{fmt(calc.monthlyDelta)}/mo
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Verdict */}
      <div className={`rounded-xl p-4 border ${buyNowBetter ? 'bg-green-900/20 border-green-700/50' : 'bg-blue-900/20 border-blue-700/50'}`}>
        <p className="text-xs font-bold uppercase tracking-widest mb-3 text-slate-300">Wait Period Summary</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
          <div>
            <p className="text-slate-500 mb-1">Future Price</p>
            <p className="text-white font-black text-base">{fmt(calc.futurePrice)}</p>
            <p className={`mt-0.5 ${priceChange > 0 ? 'text-red-400' : 'text-green-400'}`}>{priceChange > 0 ? '+' : ''}{fmt(calc.futurePrice - homePrice)}</p>
          </div>
          <div>
            <p className="text-slate-500 mb-1">Rent Paid</p>
            <p className="text-red-400 font-black text-base">{fmt(calc.totalRentPaid)}</p>
            <p className="text-slate-600 mt-0.5">{waitMonths} months</p>
          </div>
          <div>
            <p className="text-slate-500 mb-1">HYSA Earned</p>
            <p className="text-green-400 font-black text-base">{fmt(calc.hysaGrowth)}</p>
            <p className="text-slate-600 mt-0.5">{hysa}% on {fmt(calc.downPayment)}</p>
          </div>
          <div>
            <p className="text-slate-500 mb-1">Appreciation Missed</p>
            <p className="text-orange-400 font-black text-base">{fmt(calc.appreciationMissed)}</p>
            <p className="text-slate-600 mt-0.5">if you had bought</p>
          </div>
        </div>
        <p className="text-xs text-slate-400 text-center mt-3">
          {buyNowBetter
            ? `Buying now saves ${fmt(-calc.monthlyDelta)}/mo vs waiting. After ${waitMonths} months, you'd spend ${fmt(calc.totalRentPaid)} in rent and miss ${fmt(calc.appreciationMissed)} in appreciation.`
            : `Waiting may save ${fmt(calc.monthlyDelta)}/mo on your payment, but you'll pay ${fmt(calc.totalRentPaid)} in rent and miss ${fmt(calc.appreciationMissed)} in appreciation. Net cost of waiting: ${fmt(calc.totalRentPaid + calc.appreciationMissed - calc.hysaGrowth)}.`}
        </p>
      </div>

      {/* 10-year wealth chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">10-Year Equity Buildup: Buy Now vs Wait {waitMonths} Months</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={calc.chartData} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="mo" tick={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v: number) => [fmt(v)]} />
            <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
            <ReferenceLine x={`Mo ${waitMonths}`} stroke="#f59e0b" strokeDasharray="4 4"
              label={{ value: 'Wait ends', position: 'top', fill: '#f59e0b', fontSize: 9 }} />
            <Line type="monotone" dataKey="Buy Now"    stroke="#3b82f6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Wait & Buy" stroke="#10b981" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Scenario matrix */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">
          Payment Delta Matrix: Future Payment vs Today's Payment
        </p>
        <p className="text-xs text-slate-600 mb-3">Green = wait was better (lower payment). Red = buying now was better. Assumes {downPct}% down payment.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-slate-500 px-2 py-1 text-left">Price Δ ↓ / Rate Δ →</th>
                {calc.rateChanges.map(rc => (
                  <th key={rc} className="text-slate-500 px-2 py-1 text-center">{rc > 0 ? '+' : ''}{rc}%</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calc.matrix.map((row, ri) => (
                <tr key={ri}>
                  <td className="text-slate-400 px-2 py-1 font-semibold">
                    {calc.priceChanges[ri] > 0 ? '+' : ''}{calc.priceChanges[ri]}%
                  </td>
                  {row.map((cell, ci) => (
                    <td key={ci} className={`px-2 py-1.5 text-center rounded font-bold ${matrixCellColor(cell.delta)}`}>
                      {cell.delta > 0 ? '+' : ''}{fmt(cell.delta)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-600 mt-2">Values show monthly payment change vs buying today at {fmt(homePrice)} / {currentRate}% ({fmt(calc.totalPmtNow)}/mo)</p>
      </div>

      {/* Wisdom */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">The Real Math</p>
        <div className="space-y-1.5 text-xs text-slate-400">
          {[
            '📅 "Time in the market" vs "timing the market": every month you wait is a month you\'re paying rent and not building equity.',
            '🔁 "Marry the house, date the rate": if you find the right home at the right price, you can refinance later — you can\'t un-overpay for a house.',
            '💡 Rates drop → prices rise: when rates fall, buyer demand surges. That "cheaper" payment may come with a higher purchase price.',
            '📊 Break-even on lower rate: if waiting 12 months gets you a 1% lower rate, the payment saving (~$150/mo on $300K) takes years to offset rent paid ($26K).',
            '🏠 Renting isn\'t "throwing money away" — it buys flexibility, but it also means you miss appreciation in rising markets.',
            '🎯 Best strategy: buy when you\'re financially ready (stable income, 20% down if possible, 6-month emergency fund, plan to stay 5+ years).',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>
    </div>
  )
}
