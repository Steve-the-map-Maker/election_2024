export const PALETTE = [
  '#6c72cb','#4cc9f0','#f72585','#fca311','#2ecc71',
  '#e74c3c','#9b59b6','#1abc9c','#e67e22','#3498db',
  '#ff6b6b','#48dbfb','#feca57','#ff9ff3','#54a0ff',
  '#5f27cd','#01a3a4','#c44569','#f8b500','#6ab04c',
];

export const RACE_KEYS = ['Mayor', 'D1', 'D2', 'D3', 'D4'];

export function assignColors(candidates, existingMap = {}) {
  const colors = { ...existingMap };
  candidates.forEach((c, i) => {
    if (!colors[c]) colors[c] = PALETTE[i % PALETTE.length];
  });
  return colors;
}

export function calcThreshold(totalVotes, seats) {
  return Math.floor(totalVotes / (seats + 1)) + 1;
}
