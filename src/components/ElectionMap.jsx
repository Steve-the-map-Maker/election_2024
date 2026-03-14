import { useRef, useEffect, useCallback, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import * as turf from '@turf/turf';
import 'leaflet/dist/leaflet.css';
import { useElection } from '../ElectionContext';
import { RACE_KEYS } from '../constants';

const CENTER = [45.52, -122.68];
const ZOOM = 11;
const RACE_LABELS = { Mayor: 'Mayor', D1: 'District 1', D2: 'District 2', D3: 'District 3', D4: 'District 4' };
const DOTS_PER_VOTE = 5;
const DOT_RADIUS = 1.1;
const DOT_OPACITY = 1;

function resolveRound(raceData, requestedRound) {
  if (!raceData?.rounds) return requestedRound || 1;

  const rounds = Object.keys(raceData.rounds).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!rounds.length) return requestedRound || 1;

  const requested = requestedRound || 1;
  if (raceData.rounds[requested]) return requested;

  for (let i = rounds.length - 1; i >= 0; i -= 1) {
    if (rounds[i] <= requested) return rounds[i];
  }
  return rounds[0];
}

function resolveDotRound(history, requestedRound) {
  if (!history) return 1;
  if (history[requestedRound] !== undefined) return requestedRound;

  for (let round = requestedRound; round >= 1; round -= 1) {
    if (history[round] !== undefined) return round;
  }
  return 1;
}

function getLeaderForPrecinct(precinct, race, precinctResults, activeRound) {
  const data = precinctResults[precinct];
  if (!data || !data[race]) return null;

  const requestedRound = activeRound || 1;
  if (data[race].rounds) {
    const displayRound = resolveRound(data[race], requestedRound);
    const rndInfo = data[race].rounds[displayRound];
    if (!rndInfo) return null;
    return {
      leader: rndInfo.leader,
      leader_votes: rndInfo.leader_votes,
      candidates: rndInfo.candidates,
      total_ballots: data[race].total_ballots,
      undervotes: data[race].undervotes,
      display_round: displayRound,
      requested_round: requestedRound,
    };
  }

  return {
    ...data[race],
    display_round: requestedRound,
    requested_round: requestedRound,
  };
}

function randomPointsInFeature(feature, count) {
  if (!feature || count <= 0) return [];

  const bbox = turf.bbox(feature);
  const dLng = bbox[2] - bbox[0];
  const dLat = bbox[3] - bbox[1];
  const points = [];
  let attempts = 0;
  const maxAttempts = count * 50;

  while (points.length < count && attempts < maxAttempts) {
    const lng = bbox[0] + Math.random() * dLng;
    const lat = bbox[1] + Math.random() * dLat;
    if (turf.booleanPointInPolygon(turf.point([lng, lat]), feature)) {
      points.push([lat, lng]);
    }
    attempts += 1;
  }

  return points;
}

function preparePrecinctDots(feature, raceData) {
  if (!raceData?.rounds || !raceData.rounds[1]) return [];

  const roundNumbers = Object.keys(raceData.rounds).map(Number);
  const maxRound = Math.max(...roundNumbers);
  const roundTargets = [];

  for (let round = 1; round <= maxRound; round += 1) {
    const target = {};
    const candidates = raceData.rounds[round]?.candidates || {};
    for (const [candidate, votes] of Object.entries(candidates)) {
      const count = Math.round(Number(votes || 0) / DOTS_PER_VOTE);
      if (count > 0) target[candidate] = count;
    }
    roundTargets[round] = target;
  }

  const initialOwners = [];
  for (const [candidate, count] of Object.entries(roundTargets[1] || {})) {
    for (let i = 0; i < count; i += 1) initialOwners.push(candidate);
  }

  const points = randomPointsInFeature(feature, initialOwners.length);

  // Shuffle points so candidate colors are spatially mixed.
  for (let i = points.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [points[i], points[j]] = [points[j], points[i]];
  }

  const dots = points.map((latLng) => ({ latLng, history: [] }));
  for (let i = 0; i < dots.length; i += 1) {
    dots[i].history[1] = initialOwners[i] || null;
  }

  let currentOwners = [...initialOwners];

  for (let round = 2; round <= maxRound; round += 1) {
    const targets = roundTargets[round] || {};
    const nextOwners = [...currentOwners];
    const currentCounts = {};

    for (const owner of nextOwners) {
      if (!owner) continue;
      currentCounts[owner] = (currentCounts[owner] || 0) + 1;
    }

    const releasedIndices = [];

    for (const [candidate, currentCount] of Object.entries(currentCounts)) {
      let diff = currentCount - (targets[candidate] || 0);
      if (diff <= 0) continue;

      for (let i = 0; i < nextOwners.length && diff > 0; i += 1) {
        if (nextOwners[i] === candidate) {
          nextOwners[i] = null;
          releasedIndices.push(i);
          diff -= 1;
        }
      }
    }

    for (const [candidate, targetCount] of Object.entries(targets)) {
      const currentCount = currentCounts[candidate] || 0;
      let diff = targetCount - currentCount;
      while (diff > 0 && releasedIndices.length > 0) {
        const idx = releasedIndices.pop();
        nextOwners[idx] = candidate;
        diff -= 1;
      }
    }

    for (let i = 0; i < dots.length; i += 1) {
      dots[i].history[round] = nextOwners[i] || null;
    }
    currentOwners = nextOwners;
  }

  return dots;
}

function buildPopupHTML(precinct, activeRace, precinctResults, activeRound) {
  const info = getLeaderForPrecinct(precinct, activeRace, precinctResults, activeRound);
  if (!info) {
    return `<div class="popup-title">Precinct ${precinct}</div><div class="popup-row"><span>No data available</span></div>`;
  }
  const raceLabel = RACE_LABELS[activeRace] || activeRace;
  let html = `<div class="popup-title">Precinct ${precinct}</div>`;
  html += `<div class="popup-row"><span>Race</span><span>${raceLabel}</span></div>`;
  html += `<div class="popup-row"><span>Round</span><span>${info.display_round}</span></div>`;
  if (info.display_round !== (activeRound || 1)) {
    html += `<div class="popup-row"><span>Requested</span><span>R${activeRound}</span></div>`;
  }
  html += `<div class="popup-row"><span>Total ballots</span><span>${info.total_ballots.toLocaleString()}</span></div>`;
  html += `<div class="popup-row"><span>Undervotes</span><span>${info.undervotes.toLocaleString()}</span></div>`;
  html += `<hr style="border-color:var(--border);margin:4px 0;">`;
  const sorted = Object.entries(info.candidates).sort((a, b) => b[1] - a[1]);
  for (const [cand, votes] of sorted) {
    if (votes === 0) continue;
    const isLeader = cand === info.leader;
    html += `<div class="popup-row ${isLeader ? 'leader' : ''}"><span>${isLeader ? '★ ' : ''}${cand}</span><span>${Math.round(votes).toLocaleString()}</span></div>`;
  }
  return html;
}

/* 
  Precinct layer that reactively updates styles.
  CRITICAL: Do not remove openPopupRef (reactive popup content) 
  or selectedPrecinct (gold border highlight) logic. 
  See MAP_INTERACTIONS.md for details.
*/
function PrecinctLayer() {
  const { state } = useElection();
  const map = useMap();
  const layerRef = useRef(null);
  const districtsRef = useRef(null);
  const dotsLayerRef = useRef(null);
  const dotsCacheRef = useRef(new Map());
  const dotsRendererRef = useRef(null);
  const stateRef = useRef(state);
  const openPopupRef = useRef(null);
  const [selectedPrecinct, setSelectedPrecinct] = useState(null);
  stateRef.current = state;

  const { activeRace, activeRound, hiddenCandidates, mapMode,
          precinctsGeo, districtsGeo, precinctResults, candidateColors } = state;

  /* --- style callback (changes every state update) --- */
  const getStyle = useCallback((feature) => {
    const precinct = feature.properties.Precinct;
    const info = getLeaderForPrecinct(precinct, activeRace, precinctResults, activeRound);

    if (mapMode === 'dots') {
      return { fillColor: '#ffffff', fillOpacity: 0.01, weight: 1.5, color: '#aaa', opacity: 0.8 };
    }
    if (!info || info.total_ballots === info.undervotes || info.leader_votes === 0) {
      return { fillColor: '#333', fillOpacity: 0.3, weight: 1.5, color: '#aaa', opacity: 0.8 };
    }
    if (hiddenCandidates.has(info.leader)) {
      return { fillColor: 'transparent', fillOpacity: 0, weight: 1.5, color: '#aaa', opacity: 0.8 };
    }
    const color = candidateColors[info.leader] || '#888';
    const participation = (info.total_ballots - info.undervotes) / Math.max(info.total_ballots, 1);
    const opacity = 0.3 + participation * 0.5;

    if (precinct === selectedPrecinct) {
      return { fillColor: color, fillOpacity: Math.max(0.6, opacity), weight: 3, color: '#FFD700', opacity: 1 };
    }

    return { fillColor: color, fillOpacity: opacity, weight: 1.5, color: '#aaa', opacity: 0.8 };
  }, [activeRace, activeRound, hiddenCandidates, mapMode, precinctResults, candidateColors, selectedPrecinct]);

  /* --- dot helpers --- */
  const clearDots = useCallback(() => {
    if (!dotsLayerRef.current) return;
    map.removeLayer(dotsLayerRef.current);
    dotsLayerRef.current = null;
  }, [map]);

  const buildDotDensity = useCallback(() => {
    clearDots();
    if (!precinctsGeo?.features?.length) return;

    const markers = [];
    for (const feature of precinctsGeo.features) {
      const precinct = feature.properties.Precinct;
      const raceData = precinctResults?.[precinct]?.[activeRace];
      if (!raceData) continue;

      const cacheKey = `${activeRace}:${precinct}`;
      if (!dotsCacheRef.current.has(cacheKey)) {
        dotsCacheRef.current.set(cacheKey, preparePrecinctDots(feature, raceData));
      }

      const precinctDots = dotsCacheRef.current.get(cacheKey) || [];
      for (const dot of precinctDots) {
        const dotRound = resolveDotRound(dot.history, activeRound);
        const candidate = dot.history[dotRound];
        if (!candidate || !candidateColors[candidate] || hiddenCandidates.has(candidate)) continue;

        markers.push(
          L.circleMarker(dot.latLng, {
            renderer: dotsRendererRef.current,
            pane: 'dotsPane',
            radius: DOT_RADIUS,
            weight: 0,
            fillColor: candidateColors[candidate],
            fillOpacity: DOT_OPACITY,
            interactive: false,
          }),
        );
      }
    }

    dotsLayerRef.current = L.layerGroup(markers).addTo(map);
  }, [activeRace, activeRound, candidateColors, clearDots, hiddenCandidates, map, precinctResults, precinctsGeo]);

  /* --- ONE-TIME layer + click init (stable deps only) --- */
  useEffect(() => {
    if (!precinctsGeo || !districtsGeo) return;

    // Dots pane: z-index 350 = below overlayPane (400) where precinct polygons live.
    // pointer-events:none lets clicks pass through the canvas to the precincts.
    // This keeps precinct boundary lines visible on top and clickable.
    if (!map.getPane('dotsPane')) {
      const dotsPane = map.createPane('dotsPane');
      dotsPane.style.zIndex = '350';
      dotsPane.style.pointerEvents = 'none';
    }
    dotsRendererRef.current = L.canvas({ padding: 0.3, pane: 'dotsPane' });

    // Districts — visual only, non-interactive
    districtsRef.current = L.geoJSON(districtsGeo, {
      interactive: false,
      style: { color: '#ffffff', weight: 2.5, opacity: 0.6, fillOpacity: 0, dashArray: '6 4' },
      onEachFeature: (feature, layer) => {
        layer.bindTooltip(`District ${feature.properties.DISTRICT}`, {
          permanent: true, direction: 'center', className: 'district-label',
        });
      },
    }).addTo(map);

    // Precincts — each polygon gets a popup bound directly.
    // bindPopup makes Leaflet handle open-on-click automatically.
    layerRef.current = L.geoJSON(precinctsGeo, {
      style: { fillColor: '#333', fillOpacity: 0.3, weight: 1.5, color: '#aaa', opacity: 0.8 },
      onEachFeature: (feature, layer) => {
        const precinct = feature.properties.Precinct;

        // Bind a placeholder popup — content is updated on click
        layer.bindPopup('', { maxWidth: 280 });

        layer.on({
          click() {
            try {
              const s = stateRef.current;
              const html = buildPopupHTML(precinct, s.activeRace, s.precinctResults, s.activeRound);
              layer.setPopupContent(html);
              openPopupRef.current = { precinct, layer };
              setSelectedPrecinct(precinct);
              
              setTimeout(() => {
                if (layer.isPopupOpen()) layer.setPopupContent(html);
              }, 10);
            } catch (err) {
              console.error('[ElectionMap] popup click error:', err);
              layer.setPopupContent(`<div class="popup-title">Precinct ${precinct}</div><div>Error loading data</div>`);
            }
          },
          popupclose() {
            if (openPopupRef.current?.layer === layer) {
              openPopupRef.current = null;
              setSelectedPrecinct(null);
            }
          },
        });
      },
    }).addTo(map);

    return () => {
      if (dotsLayerRef.current) {
        map.removeLayer(dotsLayerRef.current);
        dotsLayerRef.current = null;
      }
      layerRef.current?.remove();
      layerRef.current = null;
      districtsRef.current?.remove();
      districtsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [precinctsGeo, districtsGeo, map]);

  /* --- Reactive style + dot updates --- */
  useEffect(() => {
    if (!layerRef.current) return;
    // Keep the stored style function current so resetStyle (mouseout) works.
    layerRef.current.options.style = getStyle;
    layerRef.current.setStyle(getStyle);

    if (mapMode === 'dots') {
      buildDotDensity();
    } else {
      clearDots();
    }
  }, [getStyle, mapMode, buildDotDensity, clearDots]);

  useEffect(() => {
    dotsCacheRef.current.clear();
  }, [precinctsGeo]);

  useEffect(() => {
    if (!openPopupRef.current) return;
    const { precinct, layer } = openPopupRef.current;
    if (!layer.isPopupOpen()) {
      openPopupRef.current = null;
      if (selectedPrecinct) setSelectedPrecinct(null);
      return;
    }
    try {
      const html = buildPopupHTML(precinct, activeRace, precinctResults, activeRound);
      layer.setPopupContent(html);
    } catch (err) {
      console.error('[ElectionMap] popup reactive update error:', err);
    }
  }, [activeRace, activeRound, hiddenCandidates, precinctResults, selectedPrecinct]);

  return null;
}

/* Legend component */
function MapLegend() {
  const { state, dispatch } = useElection();
  const race = state.rcvData?.[state.activeRace];
  const [collapsed, setCollapsed] = useState(false);
  if (!race) return null;

  const colors = state.candidateColors;

  return (
    <div className="legend map-legend-react">
      <div className="legend-title" onClick={() => setCollapsed(!collapsed)}
           style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span>{race.label} {state.mapMode === 'dots' ? 'Votes' : 'Leaders'}</span>
        <span style={{ fontSize: 10 }}>{collapsed ? '▼' : '▲'}</span>
      </div>
      {!collapsed && (
        <div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginBottom: 6 }}>
            Click to toggle visibility
          </div>
          {race.top_candidates.slice(0, 6).map(cand => {
            const hidden = state.hiddenCandidates.has(cand);
            const c = colors[cand] || '#888';
            return (
              <div key={cand}
                   onClick={() => dispatch({ type: 'TOGGLE_CANDIDATE', candidate: cand })}
                   style={{ cursor: 'pointer', opacity: hidden ? 0.35 : 1, marginBottom: 4 }}>
                <i style={{ background: hidden ? '#333' : c, width: 14, height: 14, display: 'inline-block', marginRight: 5, borderRadius: 3, verticalAlign: 'middle' }} />
                <span style={{ textDecoration: hidden ? 'line-through' : 'none' }}>{cand}</span>
              </div>
            );
          })}
          <div style={{ marginTop: 4 }}>
            {state.mapMode === 'dots' ? (
              <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>1 dot = {DOTS_PER_VOTE} votes</span>
            ) : (
              <>
                <i style={{ background: '#333', width: 14, height: 14, display: 'inline-block', marginRight: 5, borderRadius: 3, verticalAlign: 'middle' }} />
                No data / Not in district
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ElectionMap() {
  const { state, dispatch } = useElection();
  const race = state.rcvData?.[state.activeRace];
  if (!race || !state.precinctsGeo) return null;

  const modeLabel = state.mapMode === 'dots' ? 'Dot Density — Each Vote' : 'Leaders';
  const title = `Precinct Map — ${race.label} ${modeLabel} (Round ${state.activeRound})`;

  return (
    <div className="panel">
      <div className="panel-header"><h2>{title}</h2></div>
      <div className="panel-body" style={{ position: 'relative' }}>
        <MapContainer center={CENTER} zoom={ZOOM} zoomControl={false}
                      style={{ width: '100%', height: 500, background: '#0f1117' }}>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
            maxZoom={18}
          />
          <PrecinctLayer />
        </MapContainer>
        <div style={{ position: 'absolute', bottom: 10, right: 10, zIndex: 1000 }}>
          <MapLegend />
        </div>
      </div>
      <div className="map-controls">
        <div className="map-mode-toggle">
          {['choropleth', 'dots'].map(mode => (
            <button key={mode}
                    className={`map-btn${state.mapMode === mode ? ' active' : ''}`}
                    onClick={() => dispatch({ type: 'SET_MAP_MODE', mode })}>
              {mode === 'choropleth' ? 'Choropleth' : 'Dot Density'}
            </button>
          ))}
        </div>
        <span className="map-ctrl-sep" />
        {RACE_KEYS.map(r => (
          <button key={r}
                  className={`map-btn${r === state.activeRace ? ' active' : ''}`}
                  onClick={() => dispatch({ type: 'SELECT_RACE', race: r })}>
            {RACE_LABELS[r]}
          </button>
        ))}
      </div>
    </div>
  );
}
