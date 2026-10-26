// Compressed frames stay cached; only a small moving window is decoded.
function createStorySequence(canvas, container, count) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const blobs = new Map(), bitmaps = new Map(), decoding = new Set();
  const status = document.querySelector('#storyLoading');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let target = 0, progress = 0, raf = 0, lastTime = 0, drawn = -1;
  let next = 0, started = false, active = false, failures = [];
  const pending = new Map();
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
  function load(index) {
    if (blobs.has(index)) return Promise.resolve();
    if (pending.has(index)) return pending.get(index);
    const task = fetchFrame(index).finally(() => pending.delete(index));
    pending.set(index, task);
    return task;
  }
  async function fetchFrame(index) {
    try {
      const response = await fetch(`./assets/story-frames/${String(index).padStart(4, '0')}.webp`);
      if (!response.ok) throw new Error('Frame unavailable');
      blobs.set(index, await response.blob());
      status.textContent = `准备星空 ${Math.round(blobs.size / count * 100)}%`;
      status.hidden = blobs.size === count;
      if (index === 0) decode(0);
      wake();
    } catch { failures.push(index); }
  }
  async function preload() {
    if (started) return;
    started = true;
    await Promise.all(Array.from({ length: 2 }, async () => {
      while (next < count) await load(next++);
    }));
    const retry = failures; failures = [];
    for (const index of retry) await load(index);
    if (failures.length) {
      status.hidden = false;
      status.replaceChildren(document.createTextNode('部分画面未加载 '));
      const button = document.createElement('button');
      button.textContent = '重试';
      button.onclick = async () => {
        button.disabled = true;
        const pending = failures; failures = [];
        for (const index of pending) await load(index);
        if (failures.length) { button.disabled = false; status.replaceChildren(button); }
      };
      status.append(button);
    }
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
    preload, resize, warmup: () => load(0),
    setTarget(value) { target = Math.max(0, Math.min(1, value)); wake(); }
  };
}
