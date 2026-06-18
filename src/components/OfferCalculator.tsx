import { useState, useMemo } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

interface OfferFactor {
  label: string
  score: number
  max: number
  weight: number
  tip: string
}

export default function OfferCalculator() {
  const { result, input } = usePropertyStore()

  const listPrice = result?.estimatedValue ?? 400000
  const daysOnMarket = 14

  // Offer price
  const [offerPrice,         setOfferPrice]         = useState(listPrice)
  const [earnestPct,         setEarnestPct]         = useState(1)
  const [downPct,            setDownPct]            = useState(input.downPaymentPct ?? 20)
  const [closeInDays,        setCloseInDays]        = useState(30)
  const [sellerRentBack,     setSellerRentBack]     = useState(0)  // days

  // Contingencies
  const [hasFinancing,       setHasFinancing]       = useState(true)
  const [hasInspection,      setHasInspection]      = useState(true)
  const [hasAppraisal,       setHasAppraisal]       = useState(true)
  const [hasSaleContingency, setHasSaleContingency] = useState(false)

  // Market context
  const [dom,                setDom]                = useState(daysOnMarket)
  const [numOffers,          setNumOffers]          = useState(3)
  const [listPriceInput,     setListPriceInput]     = useState(listPrice)
  const [priceDropHistory,   setPriceDropHistory]   = useState(0)  // # of drops

  // Escalation clause
  const [useEscalation,      setUseEscalation]      = useState(false)
  const [escalationCap,      setEscalationCap]      = useState(Math.round(listPrice * 1.08))
  const [escalationIncrement,setEscalationIncrement] = useState(2000)

  const analysis = useMemo(() => {
    const pricePremium    = ((offerPrice - listPriceInput) / listPriceInput) * 100
    const earnestAmount   = offerPrice * earnestPct / 100
    const contingencyCount = [hasFinancing, hasInspection, hasAppraisal, hasSaleContingency].filter(Boolean).length
    const sellerStrength  = dom < 7 ? 'hot' : dom < 21 ? 'warm' : dom < 45 ? 'neutral' : 'buyer'

    // Offer scoring (0-100)
    const priceScore = Math.min(100, Math.max(0,
      pricePremium >= 5 ? 100 :
      pricePremium >= 0 ? 60 + pricePremium * 8 :
      Math.max(0, 60 + pricePremium * 3)
    ))
    const earnestScore    = Math.min(100, earnestPct * 33)
    const closingScore    = closeInDays <= 21 ? 100 : closeInDays <= 30 ? 80 : closeInDays <= 45 ? 60 : 40
    const contingencyScore = (4 - contingencyCount) * 25
    const financingScore  = downPct >= 20 ? 100 : downPct >= 10 ? 70 : 50
    const rentBackScore   = sellerRentBack >= 30 ? 100 : sellerRentBack >= 15 ? 70 : sellerRentBack > 0 ? 50 : 0

    const weights = { price: 0.40, earnest: 0.10, closing: 0.20, contingency: 0.15, financing: 0.10, rentback: 0.05 }
    const totalScore = (
      priceScore * weights.price +
      earnestScore * weights.earnest +
      closingScore * weights.closing +
      contingencyScore * weights.contingency +
      financingScore * weights.financing +
      rentBackScore * weights.rentback
    )

    const strength = totalScore >= 80 ? 'Very Strong' : totalScore >= 65 ? 'Strong' : totalScore >= 50 ? 'Competitive' : 'Weak'
    const strengthColor = totalScore >= 80 ? '#22c55e' : totalScore >= 65 ? '#84cc16' : totalScore >= 50 ? '#f59e0b' : '#ef4444'

    return {
      pricePremium, earnestAmount, contingencyCount, sellerStrength,
      priceScore, earnestScore, closingScore, contingencyScore, financingScore, rentBackScore,
      totalScore, strength, strengthColor,
    }
  }, [offerPrice, listPriceInput, earnestPct, downPct, closeInDays, hasFinancing, hasInspection, hasAppraisal, hasSaleContingency, sellerRentBack, dom])

  const radarData = [
    { subject: 'Price',        score: Math.round(analysis.priceScore) },
    { subject: 'Earnest $',    score: Math.round(analysis.earnestScore) },
    { subject: 'Close Speed',  score: Math.round(analysis.closingScore) },
    { subject: 'Contingencies',score: Math.round(analysis.contingencyScore) },
    { subject: 'Down Pmt',     score: Math.round(analysis.financingScore) },
    { subject: 'Rent-Back',    score: Math.round(analysis.rentBackScore) },
  ]

  const suggestions: string[] = []
  if (analysis.priceScore < 70)      suggestions.push(`⬆️ Increase offer price closer to or above list (${fmt(listPriceInput)})`)
  if (analysis.earnestScore < 60)    suggestions.push(`💰 Raise earnest money deposit to 2–3% (${fmt(offerPrice * 0.02)}–${fmt(offerPrice * 0.03)})`)
  if (analysis.closingScore < 80)    suggestions.push(`⚡ Shorten close to 21–25 days to stand out if you have financing ready`)
  if (hasInspection && numOffers > 2) suggestions.push(`🔍 Consider a pre-inspection to waive the contingency — less risk, stronger offer`)
  if (hasAppraisal && analysis.totalScore < 70) suggestions.push(`📐 Add an appraisal gap clause covering the first ${fmt(Math.round(listPrice * 0.03))} to protect the seller`)
  if (hasSaleContingency)            suggestions.push(`🏠 Sale contingencies are dealbreakers in competitive markets — bridge loan or sell first`)
  if (!useEscalation && numOffers > 3) suggestions.push(`📈 Use an escalation clause to automatically beat competing offers up to ${fmt(escalationCap)}`)
  if (analysis.rentBackScore === 0 && dom < 21) suggestions.push(`🔑 Offer seller a free 2-week rent-back — gives them time to move, costs you nothing`)

  if (!result) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p className="text-4xl mb-3">📝</p>
        <p>Run a valuation first to build your offer strategy</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Offer Strength Calculator</h3>
        <p className="text-xs text-slate-500">
          Score your purchase offer across 6 dimensions sellers care about most.
          Get actionable suggestions to make your offer more competitive.
        </p>
      </div>

      {/* Score display */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-1 bg-slate-800/50 rounded-xl p-5 border border-slate-700 flex flex-col items-center justify-center">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">Offer Score</p>
          <div className="relative w-28 h-28 flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#1e293b" strokeWidth="12" />
              <circle cx="50" cy="50" r="40" fill="none" stroke={analysis.strengthColor}
                strokeWidth="12" strokeDasharray={`${analysis.totalScore * 2.513} 251.3`}
                strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.5s ease' }} />
            </svg>
            <div className="z-10 text-center">
              <p className="text-3xl font-black text-white">{Math.round(analysis.totalScore)}</p>
              <p className="text-xs text-slate-500">/ 100</p>
            </div>
          </div>
          <p className="text-sm font-bold mt-2" style={{ color: analysis.strengthColor }}>{analysis.strength}</p>
        </div>

        <div className="sm:col-span-2">
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
              <PolarGrid stroke="#1e293b" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Radar name="Score" dataKey="score" stroke={analysis.strengthColor}
                fill={analysis.strengthColor} fillOpacity={0.2} strokeWidth={2} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(v: number) => [`${v}/100`]} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Offer terms */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Offer Terms</p>
          {[
            { label: 'List Price',         value: listPriceInput,  min: 50000, max: 5000000, step: 1000,  set: setListPriceInput, fmt: fmt },
            { label: 'Your Offer Price',   value: offerPrice,      min: listPriceInput * 0.8, max: listPriceInput * 1.25, step: 1000, set: setOfferPrice, fmt: (v: number) => `${fmt(v)} (${analysis.pricePremium >= 0 ? '+' : ''}${analysis.pricePremium.toFixed(1)}%)` },
            { label: 'Earnest Money %',    value: earnestPct,      min: 0.5,   max: 5,       step: 0.25,  set: setEarnestPct,     fmt: (v: number) => `${v}% = ${fmt(offerPrice * v / 100)}` },
            { label: 'Down Payment %',     value: downPct,         min: 3,     max: 60,      step: 1,     set: setDownPct,        fmt: (v: number) => `${v}%` },
            { label: 'Close in (days)',    value: closeInDays,     min: 14,    max: 60,      step: 1,     set: setCloseInDays,    fmt: (v: number) => `${v} days` },
            { label: 'Seller Rent-Back',   value: sellerRentBack,  min: 0,     max: 60,      step: 7,     set: setSellerRentBack, fmt: (v: number) => v === 0 ? 'None' : `${v} days free` },
          ].map(s => (
            <div key={s.label}>
              <div className="flex justify-between mb-1">
                <label className="text-xs text-slate-400 uppercase tracking-widest">{s.label}</label>
                <span className="text-xs font-bold text-blue-400">{s.fmt(s.value)}</span>
              </div>
              <input type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                onChange={e => s.set(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {/* Contingencies */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
            <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Contingencies</p>
            {[
              { label: 'Financing Contingency',    desc: 'Protects you if loan falls through',         val: hasFinancing,       set: setHasFinancing },
              { label: 'Inspection Contingency',   desc: 'Right to inspect and renegotiate',            val: hasInspection,      set: setHasInspection },
              { label: 'Appraisal Contingency',    desc: 'Walk away if home appraises low',             val: hasAppraisal,       set: setHasAppraisal },
              { label: 'Home Sale Contingency',    desc: 'Must sell your home first (big negative)',    val: hasSaleContingency, set: setHasSaleContingency },
            ].map(c => (
              <label key={c.label} className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-xs text-slate-300 font-semibold">{c.label}</p>
                  <p className="text-xs text-slate-600">{c.desc}</p>
                </div>
                <div
                  className={`w-10 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 ml-3 ${c.val ? 'bg-blue-600' : 'bg-slate-700'}`}
                  onClick={() => c.set(!c.val)}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${c.val ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
              </label>
            ))}
          </div>

          {/* Market context */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
            <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Market Context</p>
            {[
              { label: 'Days on Market',    value: dom,         min: 0,   max: 180, step: 1,  set: setDom,          fmt: (v: number) => v === 0 ? 'Just listed' : `${v} days` },
              { label: 'Competing Offers',  value: numOffers,   min: 0,   max: 20,  step: 1,  set: setNumOffers,    fmt: (v: number) => `${v} offer${v !== 1 ? 's' : ''}` },
              { label: 'Price Drops',       value: priceDropHistory, min: 0, max: 5, step: 1, set: setPriceDropHistory, fmt: (v: number) => v === 0 ? 'None' : `${v} drop${v > 1 ? 's' : ''}` },
            ].map(s => (
              <div key={s.label}>
                <div className="flex justify-between mb-1">
                  <label className="text-xs text-slate-400 uppercase tracking-widest">{s.label}</label>
                  <span className="text-xs font-bold text-purple-400">{s.fmt(s.value)}</span>
                </div>
                <input type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                  onChange={e => s.set(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-purple-500" />
              </div>
            ))}
            <div className={`text-xs rounded-lg px-3 py-2 font-bold text-center ${
              analysis.sellerStrength === 'hot'    ? 'bg-red-900/40 text-red-400' :
              analysis.sellerStrength === 'warm'   ? 'bg-yellow-900/40 text-yellow-400' :
              analysis.sellerStrength === 'neutral'? 'bg-blue-900/40 text-blue-400' :
                                                      'bg-green-900/40 text-green-400'
            }`}>
              {analysis.sellerStrength === 'hot'    ? '🔥 Seller\'s Market — offer aggressively' :
               analysis.sellerStrength === 'warm'   ? '🌤 Warm Market — competitive offer needed' :
               analysis.sellerStrength === 'neutral'? '⚖️ Neutral Market — fair offer is competitive' :
                                                      '❄️ Buyer\'s Market — negotiate from strength'}
            </div>
          </div>

          {/* Escalation clause */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Escalation Clause</p>
              <div className={`w-10 h-5 rounded-full cursor-pointer flex-shrink-0 ${useEscalation ? 'bg-blue-600' : 'bg-slate-700'}`}
                onClick={() => setUseEscalation(!useEscalation)}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${useEscalation ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
            </div>
            {useEscalation && (
              <div className="space-y-3">
                {[
                  { label: 'Escalation Cap',       value: escalationCap,       min: offerPrice, max: listPrice * 1.3, step: 1000, set: setEscalationCap,       fmt: fmt },
                  { label: 'Beat Other Offers By', value: escalationIncrement, min: 500,         max: 10000,           step: 500,  set: setEscalationIncrement, fmt: fmt },
                ].map(s => (
                  <div key={s.label}>
                    <div className="flex justify-between mb-1">
                      <label className="text-xs text-slate-400 uppercase tracking-widest">{s.label}</label>
                      <span className="text-xs font-bold text-green-400">{s.fmt(s.value)}</span>
                    </div>
                    <input type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                      onChange={e => s.set(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-green-500" />
                  </div>
                ))}
                <p className="text-xs text-slate-500 bg-slate-900/60 rounded-lg p-2">
                  "I offer {fmt(offerPrice)}, escalating by {fmt(escalationIncrement)} above any bona fide competing offer,
                  up to a maximum of {fmt(escalationCap)}."
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">
            Suggestions to Strengthen Your Offer ({suggestions.length})
          </p>
          <div className="space-y-2 text-xs text-slate-300">
            {suggestions.map((s, i) => (
              <div key={i} className="flex gap-2 items-start bg-slate-900/40 rounded-lg p-2">
                <span className="flex-shrink-0 text-base">{s.charAt(0) === '⬆' ? '⬆️' : ''}</span>
                <span>{s.slice(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {suggestions.length === 0 && (
        <div className="bg-green-900/20 border border-green-700/40 rounded-xl p-4 text-center">
          <p className="text-sm font-bold text-green-400">Your offer looks very strong — no major improvements suggested.</p>
        </div>
      )}

      <p className="text-xs text-slate-600 text-center">
        Offer strength is subjective and varies by seller motivation, local market, and listing agent style.
        Consult your buyer's agent before waiving any contingency — some protections are critical.
      </p>
    </div>
  )
}
