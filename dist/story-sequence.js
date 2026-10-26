// Compressed frames stay cached; only a small moving window is decoded.
function createStorySequence(canvas, container, count) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const blobs = new Map(), bitmaps = new Map(), decoding = new Set();
  const status = document.querySelector('#storyLoading');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let target = 0, progress = 0, raf = 0, lastTime = 0, drawn = -1;
  let started = false, active = false;
  let width = 1, height = 1;
  function wake() {
    if (active && !document.hidden && !raf) raf = requestAnimationFrame(tick);
  }
  function paint(index) {
    const frame = bitmaps.get(index);
    if (!frame || drawn === index) return;
    const scale = Math.max(width / frame.width, height / frame.height);
    ctx.drawImage(frame, (width - frame.width * scale) / 2,
      (height - frame.height * scale) / 2, frame.width * scale, frame.height * scale);
    drawn = index;
    canvas.dataset.frame = String(index);
    canvas.style.opacity = '1';
  }
  async function decode(index) {
    if (index < 0 || index >= count || !blobs.has(index) ||
        bitmaps.has(index) || decoding.has(index) || decoding.size >= 3) return;
    decoding.add(index);
    try {
      const bitmap = await createImageBitmap(blobs.get(index));
      bitmaps.set(index, bitmap);
      const current = Math.round(progress * (count - 1));
      while (bitmaps.size > 18) {
        const farthest = [...bitmaps.keys()].sort((a, b) =>
          Math.abs(b - current) - Math.abs(a - current))[0];
        bitmaps.get(farthest).close();
        bitmaps.delete(farthest);
      }
    } catch {
      status.hidden = false;
      status.textContent = '画面暂时无法解码，请刷新重试';
    } finally {
      decoding.delete(index);
      wake();
    }
  }
  function tick(time) {
    raf = 0;
    const dt = Math.min((time - (lastTime || time - 16.7)) / 1000, .05);
    lastTime = time;
    progress += (target - progress) * (reduced ? 1 : 1 - Math.exp(-10 * dt));
    if (Math.abs(target - progress) < .0001) progress = target;
    const index = Math.round(progress * (count - 1));
    paint(index);
    decode(index);
    const direction = target >= progress ? 1 : -1;
    decode(index + direction); decode(index + 2 * direction);
    document.documentElement.style.setProperty('--stage-progress', `${progress * 100}%`);
    if (progress !== target) wake();
  }
  let ready = false;
  async function preload() {
    if (started || ready) return;
    started = true;
    status.hidden = false;
    status.textContent = '正在准备星空，请等待加载完成后再滑动…';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    try {
      const response = await fetch('./assets/story-frames.pack', {signal: controller.signal});
      if (!response.ok) throw new Error('Sequence unavailable');
      const total = Number(response.headers.get('content-length'));
      const reader = response.body.getReader(), chunks = [];
      let received = 0;
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        chunks.push(value); received += value.byteLength;
        status.textContent = '准备星空 ' + (total ? Math.min(99, Math.round(received / total * 100)) + '%' : '') + ' · 请等待加载完成后再滑动';
      }
      const bundle = new Blob(chunks);
      const headerSize = new DataView(await bundle.slice(0, 4).arrayBuffer()).getUint32(0, true);
      if (headerSize > 10000) throw new Error('Invalid header');
      const sizes = JSON.parse(await bundle.slice(4, 4 + headerSize).text());
      if (sizes.length !== count || sizes.some(n => !Number.isInteger(n) || n <= 0) || sizes.reduce((a,b)=>a+b,4+headerSize) !== bundle.size) throw new Error('Incomplete sequence');
      let offset = 4 + headerSize;
      sizes.forEach((size, index) => { blobs.set(index, bundle.slice(offset, offset + size, 'image/webp')); offset += size; });
      await decode(0);
      if (!bitmaps.has(0)) throw new Error('First frame unavailable');
      ready = true;
      status.textContent = '星空已就绪，可以向下滑动欣赏了';
      canvas.dispatchEvent(new Event('storyready'));
      wake();
    } catch {
      started = false;
      status.replaceChildren(document.createTextNode('加载未完成，请稍候重试，暂时不要滑动 '));
      const button = document.createElement('button');
      button.textContent = '重试加载'; button.onclick = preload; status.append(button);
    } finally { clearTimeout(timer); }
  }
  function resize() {
    const r = container.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const density = Math.min(devicePixelRatio || 1, 1.25);
    width = Math.round(r.width * density); height = Math.round(r.height * density);
    canvas.width = width; canvas.height = height;
    drawn = -1;
    paint(Math.round(progress * (count - 1))); wake();
  }
  new ResizeObserver(resize).observe(container);
  new IntersectionObserver(entries => {
    active = entries[0].isIntersecting;
    if (active) { lastTime = 0; wake(); }
    else { cancelAnimationFrame(raf); raf = 0; }
  }).observe(container);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { lastTime = 0; wake(); }
  });
  return {
    preload, resize, isReady: () => ready,
    setTarget(value) { if (ready && value > 0) status.hidden = true; target = Math.max(0, Math.min(1, value)); wake(); }
  };
}
