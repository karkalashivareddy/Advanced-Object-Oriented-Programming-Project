const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const dist = path.resolve(__dirname, '../../frontend/dist/assets');
const files = fs.readdirSync(dist);
function inspectChunk(pattern) {
  const entry = files.find((name) => pattern.test(name));
  if (!entry) return null;
  const chunkPath = path.join(dist, entry);
  const map = JSON.parse(fs.readFileSync(`${chunkPath}.map`, 'utf8'));
  const chunk = fs.readFileSync(chunkPath);
  const byPackage = new Map();

  for (let index = 0; index < map.sources.length; index += 1) {
    const source = map.sources[index].replaceAll('\\', '/');
    const content = map.sourcesContent?.[index] ?? '';
    const nodeModules = source.indexOf('node_modules/');
    const packageParts = nodeModules < 0 ? [] : source.slice(nodeModules + 'node_modules/'.length).split('/');
    const packageName = nodeModules < 0
      ? 'application code'
      : packageParts[0].startsWith('@') ? packageParts.slice(0, 2).join('/') : packageParts[0];
    byPackage.set(packageName, (byPackage.get(packageName) ?? 0) + Buffer.byteLength(content));
  }

  return {
    file: entry,
    rawBytes: chunk.length,
    gzipBytes: zlib.gzipSync(chunk, { level: 9 }).length,
    sourceCount: map.sources.length,
    sourceBytesByPackage: Object.fromEntries([...byPackage.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)),
  };
}

const result = {
  generatedAt: new Date().toISOString(),
  build: 'Vite production build with source maps enabled; same minification and chunking configuration',
  note: 'The analytics route shell and deferred chart are separate chunks; use the chart chunk for the previous chart-bundle comparison.',
  analyticsRoute: inspectChunk(/^AnalyticsPage-.*\.js$/),
  deferredChart: inspectChunk(/^AnalyticsBarChart-.*\.js$/),
};
if (!result.analyticsRoute || !result.deferredChart) throw new Error('Expected analytics route and chart chunks; rebuild the frontend.');
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
