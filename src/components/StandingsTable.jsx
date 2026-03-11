import { useMemo } from 'react';
import { useElection, useActiveRace } from '../ElectionContext';
import { calcThreshold } from '../constants';

export default function StandingsTable() {
  const { state, dispatch } = useElection();
  const race = useActiveRace();
  if (!race) return null;

  const round = state.activeRound;
  const colors = state.candidateColors;

  const { rows, threshold } = useMemo(() => {
    const roundData = (race.rounds[round] || [])
      .filter(d => !state.hiddenCandidates.has(d.candidate))
      .sort((a, b) => b.votes - a.votes);
    const totalVotes = roundData.reduce((s, d) => s + d.votes, 0);
    const threshold = calcThreshold(totalVotes, race.seats);
    const maxVotes = roundData[0]?.votes || 1;
    return { rows: roundData.map(d => ({ ...d, maxVotes })), threshold };
  }, [race, round, state.hiddenCandidates]);

  function getStatus(d) {
    if (d.votes === 0 && round > 1) return { label: 'Eliminated', className: 'status-eliminated' };
    if (d.votes >= threshold) {
      return race.winners.includes(d.candidate)
        ? { label: 'Winner', className: 'status-winner' }
        : { label: 'Elected', className: 'status-elected' };
    }
    return { label: 'Active', className: 'status-active' };
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Round {round} Standings</h2>
      </div>
      <div className="round-table-wrap">
        <table className="round-table">
          <thead>
            <tr><th>Candidate</th><th>Votes</th><th>%</th><th>Status</th></tr>
          </thead>
          <tbody>
            {rows.map(d => {
              const status = getStatus(d);
              const color = colors[d.candidate] || '#888';
              const barWidth = (d.votes / d.maxVotes) * 100;
              const isWinner = race.winners.includes(d.candidate);
              return (
                <tr
                  key={d.candidate}
                  className={isWinner ? 'winner-row' : ''}
                  onClick={() => dispatch({ type: 'TOGGLE_CANDIDATE', candidate: d.candidate })}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <span style={{
                      display: 'inline-block', width: 10, height: 10,
                      borderRadius: '50%', background: color, marginRight: 8,
                      verticalAlign: 'middle',
                    }} />
                    {d.candidate}
                  </td>
                  <td className="bar-cell">
                    <div className="bar-bg" style={{ width: `${barWidth}%`, background: color }} />
                    <span className="bar-val">{Math.round(d.votes).toLocaleString()}</span>
                  </td>
                  <td>{d.pct.toFixed(1)}%</td>
                  <td><span className={status.className}>{status.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
