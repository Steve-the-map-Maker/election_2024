import { useMemo, useState } from 'react';
import { useElection, useActiveRace } from '../ElectionContext';

/* ── helpers ─────────────────────────────────────────────────── */

function buildTimeline(flowData) {
  if (!flowData?.rounds) return [];

  const events = [];

  for (const rnd of flowData.rounds) {
    for (const action of rnd.actions) {
      const transfers = action.transfers || {};

      // Separate exhausted / residual from candidate transfers
      const exhausted = (transfers.exhausted || 0) + (transfers['residual surplus'] || 0);
      const candidateTransfers = Object.entries(transfers)
        .filter(([k]) => k !== 'exhausted' && k !== 'residual surplus')
        .sort((a, b) => b[1] - a[1]);

      const totalTransferred = candidateTransfers.reduce((s, [, v]) => s + v, 0) + exhausted;

      events.push({
        round: rnd.round,
        type: action.type,
        candidate: action.candidate,
        votes: rnd.tally?.[action.candidate] ?? totalTransferred,
        totalTransferred,
        exhausted,
        recipients: candidateTransfers,
      });
    }
  }

  return events;
}

function fmt(n) {
  return Math.round(n).toLocaleString();
}

function pct(n, total) {
  if (!total) return '0';
  return ((n / total) * 100).toFixed(1);
}

/* ── TransferBar: stacked bar for one elimination ────────────── */

function TransferBar({ recipients, exhausted, totalTransferred, colors }) {
  if (totalTransferred === 0) return null;

  // Show top recipients + group the rest into "Others"
  const maxSegments = 8;
  const shown = recipients.slice(0, maxSegments);
  const othersVotes = recipients.slice(maxSegments).reduce((s, [, v]) => s + v, 0);

  const segments = [
    ...shown.map(([cand, votes]) => ({
      label: cand, votes, color: colors[cand] || '#555',
    })),
  ];
  if (othersVotes > 0) {
    segments.push({ label: 'Others', votes: othersVotes, color: '#444' });
  }
  if (exhausted > 0) {
    segments.push({ label: 'Exhausted', votes: exhausted, color: '#2a2a2a' });
  }

  return (
    <div className="transfer-bar-wrap">
      <div className="transfer-bar">
        {segments.map((seg, i) => {
          const widthPct = (seg.votes / totalTransferred) * 100;
          if (widthPct < 0.5) return null;
          return (
            <div
              key={i}
              className="transfer-segment"
              style={{ width: `${widthPct}%`, background: seg.color }}
              title={`${seg.label}: ${fmt(seg.votes)} (${pct(seg.votes, totalTransferred)}%)`}
            />
          );
        })}
      </div>
      <div className="transfer-recipients">
        {segments.filter(s => s.votes / totalTransferred > 0.03).map((seg, i) => (
          <span key={i} className="transfer-recipient">
            <span className="transfer-dot" style={{ background: seg.color }} />
            <span className="transfer-recipient-name">{seg.label}</span>
            <span className="transfer-recipient-val">{fmt(seg.votes)} ({pct(seg.votes, totalTransferred)}%)</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────── */

export default function SankeyChart() {
  const { state } = useElection();
  const race = useActiveRace();
  const [expandedRound, setExpandedRound] = useState(null);

  const flowData = state.voteFlows?.[state.activeRace];
  const colors = state.candidateColors;

  const events = useMemo(() => buildTimeline(flowData), [flowData]);

  if (!race || !events.length) return null;

  const eliminations = events.filter(e => e.type === 'eliminated');
  const elections = events.filter(e => e.type === 'elected');

  // Build a set of elected rounds for timeline markers
  const electedRounds = new Map();
  for (const e of elections) {
    electedRounds.set(e.round, e.candidate);
  }

  return (
    <div className="panel sankey-panel">
      <div className="panel-header">
        <h2>Vote Transfers &mdash; {race.label}</h2>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
          {eliminations.length} eliminations &middot; {elections.length} elected &middot;
          Click a row to expand transfer details
        </span>
      </div>

      <div className="transfers-timeline">
        {events.map((event, idx) => {
          if (event.type === 'elected') {
            return (
              <div key={`elected-${idx}`} className="transfer-card transfer-elected">
                <div className="transfer-header">
                  <span className="round-badge round-elected">R{event.round}</span>
                  <span className="elected-icon">✓</span>
                  <span className="transfer-name elected-name">{event.candidate}</span>
                  <span className="transfer-votes">Elected with {fmt(event.votes)} votes</span>
                </div>
              </div>
            );
          }

          const isExpanded = expandedRound === idx;

          return (
            <div
              key={`elim-${idx}`}
              className={`transfer-card${isExpanded ? ' expanded' : ''}`}
              onClick={() => setExpandedRound(isExpanded ? null : idx)}
            >
              <div className="transfer-header">
                <span className="round-badge">R{event.round}</span>
                <span className="elim-icon">✗</span>
                <span className="transfer-name">{event.candidate}</span>
                <span className="transfer-votes">{fmt(event.totalTransferred)} votes redistributed</span>
                <span className="expand-arrow">{isExpanded ? '▾' : '▸'}</span>
              </div>

              {/* Compact stacked bar always visible */}
              <TransferBar
                recipients={event.recipients}
                exhausted={event.exhausted}
                totalTransferred={event.totalTransferred}
                colors={colors}
              />

              {/* Expanded detail table */}
              {isExpanded && event.recipients.length > 0 && (
                <div className="transfer-detail-table">
                  <table>
                    <thead>
                      <tr><th>Recipient</th><th>Votes Received</th><th>Share</th></tr>
                    </thead>
                    <tbody>
                      {event.recipients.map(([cand, votes]) => (
                        <tr key={cand}>
                          <td>
                            <span className="transfer-dot" style={{ background: colors[cand] || '#555' }} />
                            {cand}
                          </td>
                          <td>{fmt(votes)}</td>
                          <td>{pct(votes, event.totalTransferred)}%</td>
                        </tr>
                      ))}
                      {event.exhausted > 0 && (
                        <tr className="exhausted-row">
                          <td>
                            <span className="transfer-dot" style={{ background: '#2a2a2a' }} />
                            Exhausted
                          </td>
                          <td>{fmt(event.exhausted)}</td>
                          <td>{pct(event.exhausted, event.totalTransferred)}%</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
