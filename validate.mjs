import { readFile, access } from 'node:fs/promises';
const html = await readFile('dist/index.html','utf8');
for (const required of ['openingVideo','storyPreview','chapterTwoTitle','chapterThreeTitle','chapterFourTitle','second-star.html','./chapters/third-star/index.html','./chapters/fourth-star/index.html','./chapters/sixth-star/index.html']) {
  if (!html.includes(required)) throw new Error(`Missing ${required}`);
}
if (html.includes('.chatgpt.site')) throw new Error('Homepage still depends on ChatGPT Sites');
for (const chapter of ['third', 'fourth', 'sixth']) {
  const root = `dist/chapters/${chapter}-star/`;
  const page = await readFile(root + 'index.html', 'utf8');
  if (/\.chatgpt\.site|\/cdn-cgi\/|["']\/assets\//.test(page)) throw new Error(`Unmigrated dependency: ${chapter}`);
  const assets = chapter === 'third' ? ['星空背景.png'] : chapter === 'fourth'
    ? [...new Set([...page.matchAll(/\.\/assets\/[a-zA-Z0-9_-]+\.webp/g)].map(m => m[0]))]
    : Array.from({length: 10}, (_, i) => `assets/gallery/scene-${String(i + 1).padStart(2, '0')}.png`);
  if (!assets.length) throw new Error(`No assets found: ${chapter}`);
  for (const asset of assets) await access(root + asset);
}
console.log('Validated entrypoint and all three recovered chapters.');
