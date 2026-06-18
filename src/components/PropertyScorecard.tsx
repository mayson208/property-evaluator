import { useMemo } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'
import { getAnnualPropertyTax, STATE_TAX_RATE } from '../engine/valuation'
import { generateNeighborhoodScore } from '../engine/market'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'

function ScoreBar({ label, score, max = 100, color = 'bg-blue-500' }: {
  label: string; score: number; max?: number; color?: string
}) {
  const pct = Math.min(100, (score / max) * 100)
  const text = score >= 70 ? 'text-green-400' : score >= 45 ? 'text-yellow-400' : 'text-red-400'
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-400">{label}</span>
        <span className={`font-bold ${text}`}>{score}/{max}</span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function GradeChip({ grade, color }: { grade: string; color: string }) {
  return (
    <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl text-3xl font-black border-2 ${color}`}>
      {grade}
    </div>
  )
}

function getLetterGrade(score: number): { grade: string; color: string } {
  if (score >= 90) return { grade: 'A+', color: 'text-emerald-400 border-emerald-500 bg-emerald-900/20' }
  if (score >= 80) return { grade: 'A',  color: 'text-green-400 border-green-500 bg-green-900/20' }
  if (score >= 70) return { grade: 'B+', color: 'text-lime-400 border-lime-500 bg-lime-900/20' }
  if (score >= 60) return { grade: 'B',  color: 'text-yellow-400 border-yellow-500 bg-yellow-900/20' }
  if (score >= 50) return { grade: 'C+', color: 'text-orange-400 border-orange-500 bg-orange-900/20' }
  if (score >= 40) return { grade: 'C',  color: 'text-orange-400 border-orange-500 bg-orange-900/20' }
  return { grade: 'D', color: 'text-red-400 border-red-500 bg-red-900/20' }
}

export default function PropertyScorecard() {
  const { result, input } = usePropertyStore()

  const scores = useMemo(() => {
    if (!result) return null

    const neighborhood = generateNeighborhoodScore(input.zip || input.city || input.state || '00000')
    const annualTax   = getAnnualPropertyTax(result.estimatedValue, input.state)
    const taxBurden   = (annualTax / result.estimatedValue) * 100

    // Condition score (0-100)
    const conditionScore = { poor: 20, fair: 45, average: 65, good: 82, excellent: 95 }[input.condition] ?? 65

    // Age score (newer = better, but vintage can be charming)
    const age = new Date().getFullYear() - input.yearBuilt
    const ageScore = age <= 5 ? 95 : age <= 15 ? 85 : age <= 30 ? 72 : age <= 50 ? 58 : 42

    // Size score (relative to typical 3/2 = 1500-2500 sqft)
    const sizeScore = input.sqft >= 2000 && input.sqft <= 3500 ? 85
      : input.sqft >= 1200 && input.sqft < 2000 ? 70
      : input.sqft > 3500 ? 75
      : 50

    // Features score
    const featureScore = Math.min(100,
      65 +
      (input.hasPool ? 10 : 0) +
      (input.hasFireplace ? 5 : 0) +
      (input.hasBasement ? 8 : 0) +
      ({ none: 0, carport: 3, '1_car': 7, '2_car': 12, '3_car': 15 }[input.garage] ?? 0)
    )

    // Tax efficiency (lower tax rate = better score)
    const taxScore = taxBurden < 0.5 ? 95 : taxBurden < 0.8 ? 82 : taxBurden < 1.2 ? 65 : taxBurden < 1.8 ? 45 : 25

    // Confidence score
    const dataScore = result.confidenceScore

    // Weighted overall
    const overall = Math.round(
      conditionScore     * 0.20 +
      ageScore           * 0.15 +
      sizeScore          * 0.10 +
      featureScore       * 0.10 +
      neighborhood.overall * 0.25 +
      taxScore           * 0.10 +
      dataScore          * 0.10
    )

    return {
      overall, conditionScore, ageScore, sizeScore, featureScore,
      taxScore, dataScore, neighborhood, taxBurden, age,
    }
  }, [result, input])

  if (!result || !scores) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p className="text-4xl mb-3">🏆</p>
        <p>Run a valuation to generate a property scorecard</p>
      </div>
    )
  }

  const { grade, color } = getLetterGrade(scores.overall)

  const radarData = [
    { subject: 'Condition',   A: scores.conditionScore },
    { subject: 'Age',         A: scores.ageScore },
    { subject: 'Size',        A: scores.sizeScore },
    { subject: 'Features',    A: scores.featureScore },
    { subject: 'Location',    A: scores.neighborhood.overall },
    { subject: 'Tax',         A: scores.taxScore },
  ]

  const pros: string[] = []
  const cons: string[] = []

  if (scores.conditionScore >= 80)   pros.push(`${input.condition.charAt(0).toUpperCase() + input.condition.slice(1)} condition home`)
  else if (scores.conditionScore < 50) cons.push(`${input.condition} condition may require work`)
  if (scores.age <= 10)              pros.push(`Modern construction (${input.yearBuilt})`)
  else if (scores.age > 50)          cons.push(`Older home (${scores.age} years) may have deferred maintenance`)
  if (input.hasPool)                 pros.push('Inground pool is a desirable feature')
  if (input.hasBasement)             pros.push(`Finished basement adds usable space`)
  if (scores.neighborhood.safety >= 75) pros.push(`Above-average safety score (${scores.neighborhood.safety}/100)`)
  if (scores.neighborhood.schools >= 75) pros.push(`Strong school ratings (${scores.neighborhood.schools}/100)`)
  if (scores.neighborhood.schools < 50) cons.push(`Below-average school ratings (${scores.neighborhood.schools}/100)`)
  if (scores.taxBurden > 1.5)        cons.push(`High property tax burden (${scores.taxBurden.toFixed(1)}% eff. rate)`)
  else if (scores.taxBurden < 0.7)   pros.push(`Favorable property tax rate (${scores.taxBurden.toFixed(1)}%)`)
  if (input.garage === '2_car' || input.garage === '3_car') pros.push('Multi-car garage is highly valued')
  if (input.garage === 'none')       cons.push('No garage may limit buyer appeal')
  if (result.confidenceScore >= 85)  pros.push(`High data confidence (${result.confidenceScore}%)`)
  else if (result.confidenceScore < 60) cons.push(`Low confidence score — add more property details`)

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Property Scorecard</h3>
        <p className="text-xs text-slate-500">Holistic rating across condition, location, features, and tax efficiency</p>
      </div>

      {/* Hero grade */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700">
        <div className="flex items-center gap-6">
          <GradeChip grade={grade} color={color} />
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Overall Score</p>
            <p className="text-5xl font-black text-white">{scores.overall}<span className="text-2xl text-slate-500">/100</span></p>
            <p className="text-sm text-slate-400 mt-1">{
              scores.overall >= 80 ? 'Strong property with above-average appeal'
              : scores.overall >= 65 ? 'Good property with room for improvement'
              : scores.overall >= 50 ? 'Average property — some significant trade-offs'
              : 'Below-average — multiple factors need attention'
            }</p>
          </div>
        </div>
      </div>

      {/* Radar chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3">Score Breakdown</p>
        <ResponsiveContainer width="100%" height={220}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="#334155" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Radar dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} strokeWidth={2} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
              formatter={(v: number) => [`${v}/100`, 'Score']} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Score bars */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
        <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-2">Category Scores</p>
        <ScoreBar label="Condition"           score={scores.conditionScore}          color="bg-blue-500" />
        <ScoreBar label={`Age (${scores.age} yrs)`} score={scores.ageScore}          color="bg-purple-500" />
        <ScoreBar label={`Size (${input.sqft.toLocaleString()} sqft)`} score={scores.sizeScore} color="bg-cyan-500" />
        <ScoreBar label="Features"            score={scores.featureScore}            color="bg-green-500" />
        <ScoreBar label="Neighborhood"        score={scores.neighborhood.overall}    color="bg-yellow-500" />
        <ScoreBar label="Tax Efficiency"      score={scores.taxScore}                color="bg-orange-500" />
        <ScoreBar label="Data Quality"        score={scores.dataScore}               color="bg-pink-500" />
      </div>

      {/* Pros and cons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {pros.length > 0 && (
          <div className="bg-green-900/10 rounded-xl p-4 border border-green-800/40">
            <p className="text-xs text-green-400 uppercase tracking-widest font-bold mb-3">Strengths</p>
            <ul className="space-y-1.5">
              {pros.map((p, i) => (
                <li key={i} className="flex gap-2 text-xs text-slate-300">
                  <span className="text-green-400 flex-shrink-0">✓</span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        )}
        {cons.length > 0 && (
          <div className="bg-red-900/10 rounded-xl p-4 border border-red-800/40">
            <p className="text-xs text-red-400 uppercase tracking-widest font-bold mb-3">Considerations</p>
            <ul className="space-y-1.5">
              {cons.map((c, i) => (
                <li key={i} className="flex gap-2 text-xs text-slate-300">
                  <span className="text-red-400 flex-shrink-0">✗</span>
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-600 text-center">
        Scorecard is a relative assessment tool, not a financial valuation. Scores are weighted approximations based on the data entered.
      </p>
    </div>
  )
}
