import { readFile } from 'node:fs/promises';
const html = await readFile('dist/index.html','utf8');
for (const required of ['openingVideo','storyPreview','chapterTwoTitle','chapterThreeTitle','chapterFourTitle','second-star.html','star-game-galaxy-0907.nguyenbaoduong7382.chatgpt.site','orbit-wardrobe-seven-looks.nguyenbaoduong7382.chatgpt.site']) {
  if (!html.includes(required)) throw new Error(`Missing ${required}`);
}
console.log('Validated site entrypoint.');
