import { useMemo } from 'react'
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts'
import { usePropertyStore } from '../store/usePropertyStore'
import { generateNeighborhoodScore } from '../engine/market'

function ScoreBar({ label, score, icon }: { label: string; score: number; icon: string }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-blue-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500'
  const textColor = score >= 80 ? 'text-green-400' : score >= 60 ? 'text-blue-400' : score >= 40 ? 'text-yellow-400' : 'text-red-400'
  const label2 = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Poor'

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-slate-300 flex items-center gap-1.5">
          <span>{icon}</span>{label}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{label2}</span>
          <span className={`text-sm font-black w-8 text-right ${textColor}`}>{score}</span>
        </div>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}

export default function NeighborhoodScore() {
  const { input } = usePropertyStore()

  const scores = useMemo(
    () => generateNeighborhoodScore(input.zip || input.city || input.state || '00000'),
    [input.zip, input.city, input.state],
  )

  const radarData = [
    { subject: 'Schools',     A: scores.schools },
    { subject: 'Safety',      A: scores.safety },
    { subject: 'Walk',        A: scores.walkability },
    { subject: 'Transit',     A: scores.transit },
    { subject: 'Amenities',   A: scores.amenities },
  ]

  const tier = scores.overall >= 80 ? { label: 'Excellent', color: 'text-green-400', bg: 'bg-green-900/20 border-green-700/50' }
             : scores.overall >= 65 ? { label: 'Good',      color: 'text-blue-400',  bg: 'bg-blue-900/20 border-blue-700/50' }
             : scores.overall >= 45 ? { label: 'Fair',      color: 'text-yellow-400',bg: 'bg-yellow-900/20 border-yellow-700/50' }
             :                        { label: 'Poor',       color: 'text-red-400',   bg: 'bg-red-900/20 border-red-700/50' }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Neighborhood Score</h3>
        <p className="text-xs text-slate-500">
          {input.city ? `${input.city}, ${input.state}` : input.state || 'Enter location for score'} · Estimated scores
        </p>
      </div>

      {/* Overall score */}
      <div className={`rounded-2xl p-6 border ${tier.bg} flex items-center gap-6`}>
        <div className="text-center">
          <div className={`text-6xl font-black ${tier.color}`}>{scores.overall}</div>
          <div className={`text-sm font-bold ${tier.color}`}>{tier.label}</div>
          <div className="text-xs text-slate-500 mt-1">Overall</div>
        </div>
        <div className="flex-1">
          <ResponsiveContainer width="100%" height={160}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#1e293b" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 11 }} />
              <Radar dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(v: number) => [v, 'Score']}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Individual scores */}
      <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700 space-y-4">
        <ScoreBar label="Schools"     score={scores.schools}     icon="🏫" />
        <ScoreBar label="Safety"      score={scores.safety}      icon="🛡" />
        <ScoreBar label="Walkability" score={scores.walkability} icon="🚶" />
        <ScoreBar label="Transit"     score={scores.transit}     icon="🚌" />
        <ScoreBar label="Amenities"   score={scores.amenities}   icon="🛍" />
      </div>

      {/* What the scores mean */}
      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50 space-y-2">
        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-2">Score Breakdown</p>
        {[
          { range: '80–100', label: 'Excellent', desc: 'Top-tier neighborhood, strong demand', color: 'text-green-400' },
          { range: '65–79',  label: 'Good',      desc: 'Above average, solid fundamentals',   color: 'text-blue-400' },
          { range: '45–64',  label: 'Fair',      desc: 'Average area, mixed characteristics',  color: 'text-yellow-400' },
          { range: '0–44',   label: 'Poor',      desc: 'Below average, may affect value',      color: 'text-red-400' },
        ].map(r => (
          <div key={r.range} className="flex items-center gap-3 text-xs">
            <span className={`font-mono font-bold w-16 ${r.color}`}>{r.range}</span>
            <span className={`font-bold w-16 ${r.color}`}>{r.label}</span>
            <span className="text-slate-500">{r.desc}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-600 text-center">
        Scores are estimated from ZIP code · For verified data use Walk Score®, GreatSchools.org, or NeighborhoodScout
      </p>
    </div>
  )
}
