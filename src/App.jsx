import { ElectionProvider, useElection } from './ElectionContext';
import SummaryRow from './components/SummaryRow';
import ElectionMap from './components/ElectionMap';
import RCVChart from './components/RCVChart';
import SankeyChart from './components/SankeyChart';
import StandingsTable from './components/StandingsTable';
import FirstRoundChart from './components/FirstRoundChart';

function Dashboard() {
  const { state } = useElection();

  if (state.loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-dim)', fontSize: '1.1rem' }}>
        Loading election data…
      </div>
    );
  }

  return (
    <>
      <div className="header">
        <h1>Portland 2024 General Election Results</h1>
        <div className="subtitle">
          November 5, 2024 &middot; Ranked Choice Voting &middot; Official Final Results
        </div>
      </div>

      <div className="dashboard">
        <SummaryRow />

        <div className="main-grid">
          <ElectionMap />
          <RCVChart />
        </div>

        <SankeyChart />

        <div className="race-detail-row">
          <StandingsTable />
          <FirstRoundChart />
        </div>
      </div>
    </>
  );
}

export default function App() {
  return (
    <ElectionProvider>
      <Dashboard />
    </ElectionProvider>
  );
}
