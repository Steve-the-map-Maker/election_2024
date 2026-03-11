import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Tooltip, Legend,
} from 'chart.js';
import { useElection, useActiveRace } from '../ElectionContext';
import { calcThreshold } from '../constants';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

export default function RCVChart() {
  const { state, dispatch } = useElection();
  const race = useActiveRace();
  if (!race) return null;

  const { data, options } = useMemo(() => {
    const labels = Array.from({ length: race.total_rounds }, (_, i) => `R${i + 1}`);
    const datasets = [];
    const colors = state.candidateColors;

    for (const cand of race.top_candidates) {
      const d = [];
      for (let r = 1; r <= race.total_rounds; r++) {
        const entry = (race.rounds[r] || []).find(x => x.candidate === cand);
        d.push(entry ? entry.votes : 0);
      }
      const isWinner = race.winners.includes(cand);
      datasets.push({
        label: cand,
        data: d,
        hidden: state.hiddenCandidates.has(cand),
        borderColor: colors[cand],
        backgroundColor: (colors[cand] || '#888') + '20',
        borderWidth: isWinner ? 3 : 1.5,
        pointRadius: 0, pointHoverRadius: 5,
        tension: 0.3,
        borderDash: isWinner ? [] : [4, 3],
      });
    }

    // Threshold line
    if (race.seats > 0) {
      const r1 = race.rounds[1] || [];
      const total = r1.reduce((s, d) => s + d.votes, 0);
      const threshold = calcThreshold(total, race.seats);
      datasets.push({
        label: 'Election Threshold',
        data: Array(race.total_rounds).fill(threshold),
        borderColor: '#f1c40f',
        borderWidth: 2,
        borderDash: [8, 4],
        pointRadius: 0,
        fill: false,
      });
    }

    return {
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'bottom',
            onClick(e, legendItem) {
              if (legendItem.text !== 'Election Threshold') {
                dispatch({ type: 'TOGGLE_CANDIDATE', candidate: legendItem.text });
              }
            },
            labels: {
              color: '#8b8fa3', font: { size: 11, family: 'Inter' },
              boxWidth: 14, padding: 12, usePointStyle: true,
            },
          },
          tooltip: {
            backgroundColor: '#1a1d27', borderColor: '#2e3346', borderWidth: 1,
            titleColor: '#e4e6ef', bodyColor: '#e4e6ef',
            bodyFont: { family: 'Inter' },
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${Math.round(ctx.raw).toLocaleString()} votes`,
            },
          },
        },
        scales: {
          x: { grid: { color: '#2e334633' }, ticks: { color: '#8b8fa3', font: { size: 10, family: 'Inter' } } },
          y: {
            grid: { color: '#2e334633' },
            ticks: {
              color: '#8b8fa3', font: { size: 10, family: 'Inter' },
              callback: v => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v,
            },
          },
        },
      },
    };
  }, [race, state.hiddenCandidates, state.candidateColors, dispatch]);

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>RCV Rounds — {race.label}</h2>
      </div>
      <div className="chart-container">
        <Line data={data} options={options} />
      </div>
      <div className="slider-wrap">
        <label>Animate through rounds</label>
        <input
          type="range" min={1} max={race.total_rounds}
          value={state.activeRound}
          onChange={e => dispatch({ type: 'SET_ROUND', round: parseInt(e.target.value) })}
        />
        <div className="round-indicator">
          Round {state.activeRound} / {race.total_rounds}
        </div>
      </div>
    </div>
  );
}
