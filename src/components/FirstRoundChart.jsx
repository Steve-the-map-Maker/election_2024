import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, Tooltip, Legend,
} from 'chart.js';
import { useElection, useActiveRace } from '../ElectionContext';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function FirstRoundChart() {
  const { state } = useElection();
  const race = useActiveRace();
  if (!race) return null;

  const { data, options } = useMemo(() => {
    let r1 = (race.rounds[1] || [])
      .filter(d => !state.hiddenCandidates.has(d.candidate))
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 10);

    const colors = state.candidateColors;

    return {
      data: {
        labels: r1.map(d => d.candidate),
        datasets: [{
          data: r1.map(d => d.votes),
          backgroundColor: r1.map(d => (colors[d.candidate] || '#888') + 'cc'),
          borderColor: r1.map(d => colors[d.candidate] || '#888'),
          borderWidth: 1, borderRadius: 4,
        }],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1a1d27', borderColor: '#2e3346', borderWidth: 1,
            titleColor: '#e4e6ef', bodyColor: '#e4e6ef',
            bodyFont: { family: 'Inter' },
            callbacks: { label: ctx => `${Math.round(ctx.raw).toLocaleString()} votes` },
          },
        },
        scales: {
          x: {
            grid: { color: '#2e334633' },
            ticks: {
              color: '#8b8fa3', font: { size: 10, family: 'Inter' },
              callback: v => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v,
            },
          },
          y: { grid: { display: false }, ticks: { color: '#e4e6ef', font: { size: 11, family: 'Inter' } } },
        },
      },
    };
  }, [race, state.hiddenCandidates, state.candidateColors]);

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>{race.label} — First Round Vote Share</h2>
      </div>
      <div className="first-round-chart">
        <Bar data={data} options={options} />
      </div>
    </div>
  );
}
