import { createContext, useContext, useReducer, useEffect, useMemo } from 'react';
import { RACE_KEYS, assignColors } from './constants';

const ElectionContext = createContext(null);

const initialState = {
  // Data (loaded once)
  rcvData: null,
  precinctResults: null,
  summary: null,
  precinctsGeo: null,
  districtsGeo: null,
  voteFlows: null,
  candidateColors: {},
  loading: true,

  // UI state (synced across all components)
  activeRace: 'Mayor',
  activeRound: 1,
  mapMode: 'choropleth',
  hiddenCandidates: new Set(),
};

function reducer(state, action) {
  switch (action.type) {
    case 'DATA_LOADED':
      return {
        ...state,
        ...action.payload,
        loading: false,
      };

    case 'SELECT_RACE': {
      const race = state.rcvData[action.race];
      return {
        ...state,
        activeRace: action.race,
        activeRound: race ? race.total_rounds : 1,
        hiddenCandidates: new Set(),
      };
    }

    case 'SET_ROUND':
      return { ...state, activeRound: action.round };

    case 'SET_MAP_MODE':
      return { ...state, mapMode: action.mode };

    case 'TOGGLE_CANDIDATE': {
      const next = new Set(state.hiddenCandidates);
      if (next.has(action.candidate)) next.delete(action.candidate);
      else next.add(action.candidate);
      return { ...state, hiddenCandidates: next };
    }

    default:
      return state;
  }
}

export function ElectionProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    Promise.all([
      fetch('/data/rcv_results.json').then(r => r.json()),
      fetch('/data/precinct_results.json').then(r => r.json()),
      fetch('/data/summary.json').then(r => r.json()),
      fetch('/data/precincts.geojson').then(r => r.json()),
      fetch('/data/districts.geojson').then(r => r.json()),
      fetch('/data/vote_flows.json').then(r => r.json()).catch(() => null),
    ]).then(([rcvData, precinctResults, summary, precinctsGeo, districtsGeo, voteFlows]) => {
      let colors = {};
      for (const key of RACE_KEYS) {
        if (rcvData[key]) colors = assignColors(rcvData[key].top_candidates, colors);
      }
      const totalRounds = rcvData['Mayor']?.total_rounds || 1;
      dispatch({
        type: 'DATA_LOADED',
        payload: {
          rcvData, precinctResults, summary,
          precinctsGeo, districtsGeo, voteFlows,
          candidateColors: colors,
          activeRound: totalRounds,
        },
      });
    });
  }, []);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return (
    <ElectionContext.Provider value={value}>
      {children}
    </ElectionContext.Provider>
  );
}

export function useElection() {
  return useContext(ElectionContext);
}

// Convenience selectors
export function useActiveRace() {
  const { state } = useElection();
  return state.rcvData?.[state.activeRace] || null;
}
