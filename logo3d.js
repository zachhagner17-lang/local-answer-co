// The moving 3D logo (the bagua medallion) in the navy band at the top of every page, and on the home
// page also beside the "Your goals come first" cards. It is decoration only: every word stays in the
// HTML and never moves for it. If anything fails (no WebGL, the CDN is down, or the visitor asked for
// reduced motion), the page looks as it did before (the home page shows its flat logo).
const CDN = 'https://cdn.jsdelivr.net/npm/three@0.186.1';
const GOLD = '#C4A35A', NAVY = '#0B1F3A', BONE = '#F4EFE6';
// Later Heaven trigrams clockwise from the top, lines listed inner to outer (1 = solid line), as in
// the logo. Dui (Zach, right) and Xun (Jake, top left) are bone; the other six are antique gold.
const TRIGRAMS = [[1, 0, 1], [0, 0, 0], [1, 1, 0], [1, 1, 1], [0, 1, 0], [0, 0, 1], [1, 0, 0], [0, 1, 1]];
const BRIGHT = new Set([2, 7]);
const TAU = Math.PI * 2;

const root = document.documentElement;
const hero = document.querySelector('.hero');
const heroBox = document.getElementById('hero3d') || document.querySelector('.page-3d');
const clamp01 = v => Math.min(1, Math.max(0, v));
const pointer = { x: 0, y: 0 };
const fallBack = () => root.classList.remove('has-3d', 'wait-3d');

if (heroBox && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  if (document.getElementById('hero3d')) reveal();  // home page only
  // Load the 3D once the page itself has finished, so the words and buttons come first.
  const later = () => (window.requestIdleCallback || setTimeout)(() => start().catch(fallBack));
  document.readyState === 'complete' ? later() : addEventListener('load', later, { once: true });
}
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) depth();

// Sections fade up as they scroll into view.
function reveal() {
  const els = document.querySelectorAll('main section h2, .intro, .why-now p, .stat, .steps-flow .step, .fixlist li, .promise, .trades li, main section > .wrap > p, .person');
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target;
    el.classList.add('in');
    io.unobserve(el);
    setTimeout(() => { el.classList.remove('reveal'); el.style.transitionDelay = ''; }, 1500);  // so the tilt below answers at once
  }), { rootMargin: '0px 0px -6% 0px' });
  els.forEach(el => {
    if (el.matches('li, .steps-flow .step, .person')) el.style.transitionDelay = Math.min(6, [...el.parentNode.children].indexOf(el)) * 60 + 'ms';
    el.classList.add('reveal');
    io.observe(el);
  });
  root.classList.add('has-motion');
}

// More 3D on every page: the floating objects (example phones, AI-tools stack, profile card, map, report
// sheets, code card) turn toward the pointer and play once they scroll into view, and cards and photos tilt.
// On the home page the hero's grid floor and AI-tool ring lean toward the pointer too.
// Only transforms change, so no word ever moves.
function depth() {
  const figs = [...document.querySelectorAll('.ai-phone, .obj3d')];
  const movers = [...document.querySelectorAll('.phone-3d, .body3d, .orbit, .hero-floor')];
  if (figs.length) {
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('play'); io.unobserve(e.target); }
    }), { threshold: 0.35 });
    figs.forEach(f => { f.classList.add(f.matches('.ai-phone') ? 'phone-anim' : 'anim'); io.observe(f); });
    let raf = 0, px = 0, py = 0;
    addEventListener('pointermove', e => {
      px = e.clientX / innerWidth * 2 - 1;
      py = e.clientY / innerHeight * 2 - 1;
      if (!raf) raf = requestAnimationFrame(() => {
        raf = 0;
        movers.forEach(m => { m.style.setProperty('--px', px.toFixed(3)); m.style.setProperty('--py', py.toFixed(3)); });
      });
    }, { passive: true });
  }
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  document.querySelectorAll('.step, .tier, .person, .stat').forEach(el => {
    el.classList.add('tilt');
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(900px) rotateX(${(-y * 7).toFixed(2)}deg) rotateY(${(x * 9).toFixed(2)}deg) translateZ(6px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
}

async function start() {
  const [THREE, { RoomEnvironment }] = await Promise.all([
    import(`${CDN}/+esm`),
    import(`${CDN}/examples/jsm/environments/RoomEnvironment.js/+esm`),
  ]);
  addEventListener('pointermove', e => {
    pointer.x = e.clientX / innerWidth * 2 - 1;
    pointer.y = e.clientY / innerHeight * 2 - 1;
  }, { passive: true });
  await homeScene(THREE, RoomEnvironment);
}

// One WebGL view: renderer, studio lighting, camera and a medallion.
function makeStage(THREE, RoomEnvironment, withDust) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });  // throws without WebGL
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.8;
  pmrem.dispose();
  const key = new THREE.DirectionalLight(0xfff1d6, 1.4);
  key.position.set(-3, 4, 5);
  const rim = new THREE.DirectionalLight(GOLD, 2);
  rim.position.set(3, -2, -4);
  scene.add(key, rim);

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  const m = buildMedallion(THREE);
  scene.add(m.group);
  if (withDust) scene.add(m.dust = buildDust(THREE));

  // Size the drawing to its box and back the camera off until a circle of radius `half` fits.
  function fit(box, half) {
    if (!box || !box.clientWidth || !box.clientHeight) return;
    renderer.setSize(box.clientWidth, box.clientHeight, false);
    camera.aspect = box.clientWidth / box.clientHeight;
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.z = Math.max(half / tan, half / (tan * camera.aspect));
    camera.updateProjectionMatrix();
  }
  return { renderer, canvas, scene, camera, m, fit };
}

// Spread the parts out (e), light the trigrams one by one (scan), and make the check glow (glow).
function pose(m, cur, t) {
  m.trigrams.forEach((g, i) => {
    const ei = clamp01(cur.e * 1.2 - i * 0.025);
    g.position.copy(g.userData.base).addScaledVector(g.userData.dir, 0.22 * ei);
    g.position.z = 0.42 * ei + 0.05 * Math.sin(t * 1.3 + i) * ei;
    g.userData.plate.rotation.x = -0.7 * ei;
    const lit = cur.scan > i + 1 ? 0.3 : cur.scan > i ? 0.9 : 0;
    g.userData.mat.emissiveIntensity = lit * (1 - cur.glow);
  });
  m.ring.position.z = 0.2 * cur.e;
  m.center.position.z = 0.36 * cur.e;
  m.center.scale.setScalar(1 + 0.06 * cur.e);
  m.check.emissiveIntensity = 0.7 * cur.glow;
}

// Animation loop that runs only while `isOn()` and the tab is showing.
function loop(step, isOn) {
  let raf = 0, last = 0;
  function frame(now) {
    raf = 0;
    if (!isOn() || document.hidden) return;
    step(now / 1000, Math.min(0.05, (now - last) / 1000));
    last = now;
    raf = requestAnimationFrame(frame);
  }
  const kick = () => {
    if (!raf && isOn() && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); }
  };
  document.addEventListener('visibilitychange', kick);
  return kick;
}

// The medallion in the navy band at the top of the page. It floats and turns on its own; the page scroll
// only carries it along with everything else.
async function homeScene(THREE, RoomEnvironment) {
  const s = makeStage(THREE, RoomEnvironment, true), m = s.m, canvas = s.canvas;
  canvas.className = 'medallion-canvas';

  // Draw only while the band is on screen.
  let active = null;
  const vis = { hero: false }, pt = { x: 0, y: 0 };
  const cur = { e: 1.4, yaw: -1.2, pitch: 0.3, lift: 0, glow: 0, scan: -1 };  // starts apart, then assembles

  const resize = () => s.fit(canvas.parentElement, 1.12);

  function pick() {
    const next = vis.hero && !heroBox.classList.contains('off') ? 'hero' : null;
    if (next === active) return;
    active = next;
    if (!next) return;
    heroBox.appendChild(canvas);
    resize();
    kick();
  }

  function targets() {
    const r = hero.getBoundingClientRect(), hp = clamp01(-r.top / r.height);
    return { e: 0, yaw: 0, pitch: -0.06 + hp * 0.5, lift: hp * 0.6, glow: 0, scan: -1 };
  }

  const kick = loop((t, dt) => {
    const tg = targets(), a = 1 - Math.exp(-dt * 4.5);
    for (const k in cur) cur[k] += (tg[k] - cur[k]) * a;
    pt.x += (pointer.x - pt.x) * a;
    pt.y += (pointer.y - pt.y) * a;
    m.group.rotation.y = cur.yaw + 0.24 * Math.sin(t * 0.45) + pt.x * 0.3;
    m.group.rotation.x = cur.pitch + 0.06 * Math.sin(t * 0.6) + pt.y * 0.2;
    m.group.position.y = 0.035 * Math.sin(t * 0.9) + cur.lift;
    pose(m, cur, t);
    m.dust.rotation.z = t * 0.03;
    m.dust.rotation.y = 0.15 * Math.sin(t * 0.2);
    s.renderer.render(s.scene, s.camera);
  }, () => !!active);

  canvas.addEventListener('webglcontextlost', () => {
    active = null;
    canvas.remove();
    fallBack();
  });
  // Other pages: on wide screens the logo floats in the empty space beside the words. If it would touch
  // any of them (a narrow window, or the fallback font), it steps aside rather than move a word.
  function clearOfWords() {
    if (heroBox.classList.contains('page-3d')) {
      heroBox.classList.remove('off');
      const words = [...heroBox.parentElement.children].filter(el => el !== heroBox).flatMap(el => {
        const r = document.createRange();
        r.selectNodeContents(el);
        return [...r.getClientRects()].filter(w => w.width);
      });
      if (getComputedStyle(heroBox).position === 'absolute') {
        const b = heroBox.getBoundingClientRect();
        heroBox.classList.toggle('off', words.some(w => w.right > b.left - 16 && w.left < b.right && w.bottom > b.top && w.top < b.bottom));
      }
      fitRing(words.concat([...heroBox.parentElement.querySelectorAll('.btn')].map(el => el.getBoundingClientRect())));  // buttons: their whole box
    }
    resize();
    pick();
  }
  addEventListener('resize', clearOfWords);

  heroBox.appendChild(canvas);
  active = 'hero';
  resize();
  await s.renderer.compileAsync(s.scene, s.camera);  // shaders compile off the main thread where the browser can
  s.renderer.render(s.scene, s.camera);  // first frame before switching the page over
  root.classList.add('has-3d');
  root.classList.remove('wait-3d');
  clearOfWords();
  document.fonts.ready.then(clearOfWords);
  requestAnimationFrame(() => canvas.classList.add('on'));
  active = null;

  const io = new IntersectionObserver(entries => {
    entries.forEach(en => { vis.hero = en.isIntersecting; });
    pick();
  }, { rootMargin: '80px 0px' });
  io.observe(hero);
}

// Other pages: the four AI-tool tiles circle the logo only where they have room. A flat ring first, then
// steeper ones; the first that stays inside the navy band, on screen and well clear of every word wins.
// If none does, the logo shows without them.
const TILE = { w: 92, h: 28 };  // .page-3d .chip in style.css
// [ring angle on screen, tilt, room between a tile beside the logo and the logo], degrees and px. The last
// two are for tight spots: an upright ring for logos at the screen edge, and on the smallest phones a flat
// ring whose tiles tuck just behind the logo's rim (as on the home page).
const RINGS = [[0, 12, 8], [35, 10, 8], [60, 10, 8], [80, 10, 8], [90, 6, 8], [0, 12, -12]];
function fitRing(words) {
  const orbit = heroBox.querySelector('.orbit');
  if (!orbit) return;
  heroBox.classList.remove('ring');
  if (heroBox.classList.contains('off')) return;
  const b = heroBox.getBoundingClientRect(), band = hero.getBoundingClientRect(), W = root.clientWidth;
  const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
  const medR = 0.9 * Math.min(b.width, b.height) / 2;  // the medallion's radius in its box, with a little room
  for (const [deg, tiltDeg, room] of RINGS) {
    const tz = deg * Math.PI / 180, tx = tiltDeg * Math.PI / 180;
    // far enough out that a tile beside the logo clears it by `room`
    const r = medR + TILE.w / 2 * Math.cos(tz) + TILE.h / 2 * Math.sin(tz) + room;
    const f = ringBounds(r, tz, tx);
    const z = { left: cx + f.x0 - 6, right: cx + f.x1 + 6, top: cy + f.y0 - 8, bottom: cy + f.y1 + 8 };  // + the pointer lean
    const fits = z.top >= band.top + 4 && z.bottom <= band.bottom - 4 && z.left >= 8 && z.right <= W - 8 &&
      !words.some(w => w.right > z.left - 20 && w.left < z.right + 20 && w.bottom > z.top - 20 && w.top < z.bottom + 20);
    if (fits) {
      orbit.style.setProperty('--r', r.toFixed(1) + 'px');
      orbit.style.setProperty('--tz', deg + 'deg');
      orbit.style.setProperty('--tx', tiltDeg + 'deg');
      heroBox.classList.add('ring');
      return;
    }
  }
}

// The screen area a ring of radius r sweeps (tilted tx, turned tz), tiles and depth included, from its centre.
function ringBounds(r, tz, tx) {
  let x0 = 0, x1 = 0, y0 = 0, y1 = 0;
  for (let i = 0; i < 72; i++) {
    const a = i / 72 * TAU, x = r * Math.sin(a), z = r * Math.cos(a);
    const y = -z * Math.sin(tx), depth = z * Math.cos(tx), s = 1000 / (1000 - depth);  // perspective: 1000px in style.css
    const X = x * Math.cos(tz) - y * Math.sin(tz), Y = x * Math.sin(tz) + y * Math.cos(tz);
    x0 = Math.min(x0, (X - TILE.w / 2) * s); x1 = Math.max(x1, (X + TILE.w / 2) * s);
    y0 = Math.min(y0, (Y - TILE.h / 2) * s); y1 = Math.max(y1, (Y + TILE.h / 2) * s);
  }
  return { x0, x1, y0, y1 };
}

function buildMedallion(THREE) {
  const std = o => new THREE.MeshStandardMaterial(o);
  const gold = std({ color: GOLD, metalness: 1, roughness: 0.24 });
  const enamel = new THREE.MeshPhysicalMaterial({ color: NAVY, roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.12 });
  const bone = std({ color: BONE, roughness: 0.3 });
  const check = std({ color: GOLD, metalness: 1, roughness: 0.2, emissive: GOLD, emissiveIntensity: 0 });

  const octPts = r => Array.from({ length: 8 }, (_, i) => {
    const a = THREE.MathUtils.degToRad(22.5 + 45 * i);  // flat top edge, like the logo
    return new THREE.Vector2(r * Math.cos(a), r * Math.sin(a));
  });
  const oct = (r, hole) => {
    const s = new THREE.Shape(octPts(r));
    if (hole) s.holes.push(new THREE.Path(octPts(hole).reverse()));
    return s;
  };
  const slab = (shape, depth, bevel, z) => {
    const g = new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 6,
    });
    g.translate(0, 0, z - depth / 2);
    return g;
  };
  const rrect = (w, h, r) => {
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  };

  const group = new THREE.Group();
  group.add(new THREE.Mesh(slab(oct(0.97), 0.12, 0.03, 0), gold));             // gold case, front at z 0.09
  group.add(new THREE.Mesh(slab(oct(0.9), 0.02, 0, 0.1), enamel));             // navy enamel face
  group.add(new THREE.Mesh(slab(oct(0.985, 0.9), 0.04, 0.012, 0.122), gold));  // raised bezel
  const ring = new THREE.Mesh(slab(oct(0.665, 0.64), 0.012, 0.006, 0.122), gold);  // inner octagon line
  group.add(ring);

  // Trigram bars: logo units / 96 = 3D units (outer radius 1).
  const solid = slab(rrect(0.338, 0.041, 0.012), 0.016, 0.008, 0);
  const half = slab(rrect(0.125, 0.041, 0.012), 0.016, 0.008, 0);
  const trigrams = TRIGRAMS.map((lines, i) => {
    const ang = -i * Math.PI / 4;  // clockwise from the top
    const mat = BRIGHT.has(i)
      ? std({ color: BONE, roughness: 0.3, emissive: '#FFF6E0', emissiveIntensity: 0 })
      : std({ color: '#8C7A4A', metalness: 1, roughness: 0.42, emissive: GOLD, emissiveIntensity: 0 });
    const g = new THREE.Group(), plate = new THREE.Group();
    g.rotation.z = ang;
    const bar = (geo, x, y) => { const b = new THREE.Mesh(geo, mat); b.position.set(x, y, 0); plate.add(b); };
    lines.forEach((on, row) => {
      const y = (row - 1) * 0.0885;  // inner, middle, outer
      if (on) bar(solid, 0, y);
      else { bar(half, -0.107, y); bar(half, 0.107, y); }
    });
    plate.position.z = 0.126;
    g.add(plate);
    const dir = new THREE.Vector3(-Math.sin(ang), Math.cos(ang), 0);
    g.userData = { base: dir.clone().multiplyScalar(0.775), dir, plate, mat };
    group.add(g);
    return g;
  });

  // The A (bone) and the check (gold), as rounded strokes like the logo's.
  const center = new THREE.Group();
  const xy = ([x, y]) => new THREE.Vector2(1.2 * (x - 50) / 96, -1.2 * (y - 51) / 96);
  const stroke = (p, q, r, mat, z) => {
    const a = xy(p), b = xy(q);
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, a.distanceTo(b), 8, 20), mat);
    mesh.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, z);
    mesh.rotation.z = Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2;
    mesh.scale.z = 0.5;
    center.add(mesh);
  };
  stroke([26, 82], [50, 20], 0.0625, bone, 0.141);
  stroke([50, 20], [74, 82], 0.0625, bone, 0.141);
  stroke([31, 55], [44, 66], 0.069, check, 0.156);
  stroke([44, 66], [70, 39], 0.069, check, 0.156);
  group.add(center);

  return { group, trigrams, ring, center, check };
}

function buildDust(THREE) {
  const n = 150, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = 1.25 + Math.random() * 1.4, t = Math.random() * TAU;
    pos.set([r * Math.cos(t), r * Math.sin(t) * 0.85, (Math.random() - 0.5) * 1.8], i * 3);
  }
  const dot = document.createElement('canvas');
  dot.width = dot.height = 32;
  const c = dot.getContext('2d'), grad = c.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = grad;
  c.fillRect(0, 0, 32, 32);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({
    color: GOLD, size: 0.045, map: new THREE.CanvasTexture(dot), transparent: true, opacity: 0.8, depthWrite: false,
  }));
}
