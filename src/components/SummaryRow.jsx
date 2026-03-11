import { useElection } from '../ElectionContext';
import { RACE_KEYS } from '../constants';

export default function SummaryRow() {
  const { state, dispatch } = useElection();
  if (!state.summary) return null;

  return (
    <div className="summary-row">
      {RACE_KEYS.map(key => {
        const race = state.summary.races[key];
        if (!race) return null;
        return (
          <div
            key={key}
            className={`summary-card${state.activeRace === key ? ' active' : ''}`}
            onClick={() => dispatch({ type: 'SELECT_RACE', race: key })}
          >
            <div className="race-label">{race.label}</div>
            <div className="winners">
              {race.winners.map(w => (
                <div className="winner-name" key={w}>
                  <span className="check">✓</span> {w}
                </div>
              ))}
            </div>
            <div className="meta">
              {race.total_candidates} candidates · {race.total_rounds} rounds
            </div>
          </div>
        );
      })}
    </div>
  );
}
