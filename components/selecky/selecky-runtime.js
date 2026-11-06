/* 셀렉이 런타임. 편집 도구(rig.html)·미리보기(preview.html)·시안(index.html)이 이 코드 하나로 그리고 움직인다.
   char_gen.py 가 이 파일 내용을 세 곳에 그대로 넣는다(따로 고치지 말 것). */
function SelRT(D) {
  const KEY0 = { t: 0, face: "default", aL: 0, aR: 0, ty: 0, rot: 0, sx: 1, sy: 1, eye: 1 };
  const CH = ["aL", "aR", "ty", "rot", "sx", "sy", "eye"];
  const G = D.geom;
  const rt = { D, KEY0, repeat: false, reduce: false };
  const clone = o => JSON.parse(JSON.stringify(o));
  const isObj = v => v && typeof v === "object" && !Array.isArray(v);
  const merge = (base, over) => { const out = clone(base); for (const [k, v] of Object.entries(over || {})) out[k] = isObj(v) && isObj(out[k]) ? merge(out[k], v) : clone(v); return out; };
  rt.normalize = r => { const x = merge(D.defaults, r); for (const m of Object.values(x.motions)) m.keys = m.keys.map(k => ({ ...KEY0, ...k })).sort((a, b) => a.t - b.t); return x; };
  rt.rig = rt.normalize(D.rig);

  /* 이음(cubic-bezier) */
  const bezCache = new Map();
  function bez(x1, y1, x2, y2) {
    const key = [x1, y1, x2, y2].join(); if (bezCache.has(key)) return bezCache.get(key);
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const X = u => ((ax * u + bx) * u + cx) * u, Y = u => ((ay * u + by) * u + cy) * u, dX = u => (3 * ax * u + 2 * bx) * u + cx;
    const f = x => { if (x <= 0) return 0; if (x >= 1) return 1; let u = x;
      for (let i = 0; i < 8; i++) { const e = X(u) - x, d = dX(u); if (Math.abs(e) < 1e-7 || Math.abs(d) < 1e-7) break; u -= e / d; }
      if (u < 0 || u > 1 || Math.abs(X(u) - x) > 1e-5) { let lo = 0, hi = 1; u = x; for (let i = 0; i < 50; i++) { if (X(u) < x) lo = u; else hi = u; u = (lo + hi) / 2; } }
      return Y(u); };
    bezCache.set(key, f); return f;
  }
  rt.bez = bez;
  const easeStd = bez(0.25, 0.1, 0.25, 1);
  const piece = (stops, vals, ph, e) => { for (let i = 0; i < stops.length - 1; i++) if (ph <= stops[i + 1]) { const w = stops[i + 1] - stops[i]; return vals[i] + (vals[i + 1] - vals[i]) * e(w ? (ph - stops[i]) / w : 1); } return vals[vals.length - 1]; };

  /* 시각 → 값 */
  rt.stateAt = (m, tt) => {
    const ks = m.keys; if (tt <= ks[0].t) return { ...ks[0] }; const last = ks[ks.length - 1]; if (tt >= last.t) return { ...last };
    let i = 0; while (ks[i + 1].t < tt) i++; const a = ks[i], b = ks[i + 1], e = bez(...m.ease)((tt - a.t) / (b.t - a.t));
    const s = { t: tt, face: a.face }; for (const k of CH) s[k] = a[k] + (b[k] - a[k]) * e; return s;
  };
  rt.stillKey = m => m.loop ? m.keys[0] : m.keys[m.keys.length - 1];
  rt.blinkAt = bt => bt < 0 ? 1 : piece([0, .44, .45, .46, .96, .97, .98, 1], [1, 1, .1, 1, 1, .1, 1, 1], (bt % 10) / 10, easeStd);
  const flickEnd = m => m.flame ? (m.loop ? Infinity : Math.ceil(m.dur / .4) * .4) : 0;
  rt.flickAt = (m, T) => { if (!m.flame || T >= flickEnd(m) || T < 0) return 0; return piece([0, .5, 1], [0, 1, 0], (T % .4) / .4, easeStd); };
  rt.frameState = (code, T) => {
    const m = rt.rig.motions[code], tt = m.loop ? (T <= m.dur ? T : T % m.dur) : Math.min(T, m.dur);
    const s = rt.stateAt(m, tt); s.blink = m.blink ? rt.blinkAt(T - m.dur) : 1; s.flick = rt.flickAt(m, T); return s;
  };
  rt.stillState = code => ({ ...rt.stillKey(rt.rig.motions[code]), blink: 1, flick: 0 });
  rt.restState = (face = "default") => ({ ...KEY0, face, blink: 1, flick: 0 });
  rt.endTime = code => { const m = rt.rig.motions[code]; return Math.max(m.dur, m.loop ? m.dur : flickEnd(m)); };

  /* 변환 행렬 */
  const M = () => new DOMMatrix();
  rt.figM = s => M().translate(G.fig[0], G.fig[1]).translate(0, s.ty).rotate(s.rot).translate(-G.fig[0], -G.fig[1]);
  rt.torsoM = s => M().translate(G.torso[0], G.torso[1]).scale(s.sx, s.sy).translate(-G.torso[0], -G.torso[1]);
  rt.armRot = (side, s) => { const a = rt.rig.arm[side]; return M().translate(a.x, a.y).rotate(side === "l" ? s.aL : -s.aR).translate(-a.x, -a.y); };
  rt.armSpace = side => { const a = rt.rig.arm[side]; return M().translate(a.x, a.y).rotate(side === "l" ? a.a : -a.a); };
  rt.eyeM = s => M().translate(G.cx, G.eyeY).scale(1, s.eye).translate(-G.cx, -G.eyeY);
  rt.blinkM = s => M().translate(G.cx, G.eyeY).scale(1, s.blink ?? 1).translate(-G.cx, -G.eyeY);
  rt.lift = s => Math.min(1, Math.max(0, -s.ty) / 22);
  rt.shadowM = s => { const l = rt.lift(s); return M().translate(G.shadow[0], G.shadow[1]).scale((1 - .28 * l) * s.sx, 1 - .28 * l).translate(-G.shadow[0], -G.shadow[1]); };
  rt.flickM = s => { const k = s.flick || 0; return M().scale(1 - .1 * k, 1 + .1 * k); };
  rt.mstr = m => `matrix(${[m.a, m.b, m.c, m.d, m.e, m.f].map(v => +v.toFixed(5)).join(" ")})`;
  rt.armPath = side => { const r = rt.rig.arm.t / 2, h = rt.rig.arm.hand, L = rt.rig.arm[side].len; return `M${-r} 0A${r} ${r} 0 0 1 ${r} 0L${h} ${L}A${h} ${h} 0 0 1 ${-h} ${L}Z`; };
  rt.motionFaces = m => [...new Set(m.keys.map(k => k.face))];

  /* 그림 만들기: 주어진 장면을 담은 svg 글. o = {state, pose, flame, flameAR, faces, vb, code, cls} */
  rt.markup = o => {
    const L = rt.rig.arm, s = o.state || rt.restState(), pose = o.pose || "stand", faces = o.faces || [s.face], ms = rt.mstr;
    const legs = ["l", "r"].map(side => {
      if (pose === "sit") { const g = rt.rig.leg.sit, [x, y] = g[side]; return `<ellipse class="sl-limb" data-k="leg" cx="${x}" cy="${y}" rx="${g.rx}" ry="${g.ry}"/>`; }
      const g = rt.rig.leg.stand, [x, y] = g[side]; return `<rect class="sl-limb" data-k="leg" x="${x - g.w / 2}" y="${y - 12}" width="${g.w}" height="${g.h}" rx="11"/>`;
    }).join("");
    const arm = side => `<g data-r="arm-${side}" transform="${ms(rt.armRot(side, s))}">${L.bump ? `<circle class="sl-arm" data-k="bump" cx="${L[side].x}" cy="${L[side].y}" r="${L.bump}"/>` : ""}`
      + `<path class="sl-arm" data-k="arm" transform="${ms(rt.armSpace(side))}" d="${rt.armPath(side)}"/></g>`;
    const arms = arm("l") + arm("r"), front = L.layer === "front";
    const v = part => faces.map(f => `<g data-face="${f}"${f === s.face ? "" : ' display="none"'}>${D.faces[f][part]}</g>`).join("");
    const flame = o.flame ? `<g data-r="flamewrap" transform="${ms(rt.armRot("r", s))}"><g transform="${ms(rt.armSpace("r"))}">`
      + `<g transform="translate(0 ${L.r.len}) rotate(${L.r.a + (o.flameAR || 0)}) translate(0 -7) scale(1.4)"><g data-r="flame" transform="${ms(rt.flickM(s))}">${D.flame}</g></g>`
      + `<circle class="sl-arm" cx="0" cy="${L.r.len}" r="${L.hand}"/></g></g>` : "";
    return `<svg class="${o.cls || "slk"}" viewBox="${o.vb || D.slotVB}"${o.code ? ` data-code="${o.code}"` : ""} style="--sl-arm:${L.color}" aria-hidden="true">`
      + `<ellipse data-r="shadow" class="sl-shadow" cx="${G.shadow[0]}" cy="${G.shadow[1]}" rx="70" ry="6.5" transform="${ms(rt.shadowM(s))}" opacity="${+(1 - .45 * rt.lift(s)).toFixed(4)}"/>`
      + `<g data-r="fig" transform="${ms(rt.figM(s))}">${pose === "sit" ? "" : legs}<g data-r="torso" transform="${ms(rt.torsoM(s))}">${front ? "" : arms}`
      + `${D.stat.body}${D.stat.faceRow}<g class="sl-grid">${D.stat.grid}</g>${front ? arms : ""}`
      + `<g data-r="eye" transform="${ms(rt.eyeM(s))}"><g data-r="blink" transform="${ms(rt.blinkM(s))}">${v("eyes")}</g></g><g data-r="brows">${v("brows")}</g>`
      + `<g class="sl-cheek">${D.stat.cheeks}</g><g data-r="mouth">${v("mouth")}</g>${flame}</g>${pose === "sit" ? legs : ""}</g></svg>`;
  };
  rt.markupFor = (code, extra = {}) => { const m = rt.rig.motions[code];
    return rt.markup({ state: rt.stillState(code), pose: m.pose, flame: m.flame, flameAR: rt.stillKey(m).aR, faces: rt.motionFaces(m), code, ...extra }); };

  /* 장면 바꾸기 */
  rt.apply = (svg, s) => {
    const q = svg._sel || (svg._sel = Object.fromEntries([...svg.querySelectorAll("[data-r]")].map(e => [e.dataset.r, e])));
    const set = (k, m) => { if (q[k]) q[k].setAttribute("transform", rt.mstr(m)); };
    set("fig", rt.figM(s)); set("torso", rt.torsoM(s)); set("arm-l", rt.armRot("l", s)); set("arm-r", rt.armRot("r", s)); set("flamewrap", rt.armRot("r", s));
    set("eye", rt.eyeM(s)); set("blink", rt.blinkM(s)); set("flame", rt.flickM(s)); set("shadow", rt.shadowM(s));
    if (q.shadow) q.shadow.setAttribute("opacity", +(1 - .45 * rt.lift(s)).toFixed(4));
    if (svg._face !== s.face) { svg.querySelectorAll("[data-face]").forEach(g => { if (g.dataset.face === s.face) g.removeAttribute("display"); else g.setAttribute("display", "none"); }); svg._face = s.face; }
  };

  /* 재생 */
  const players = new Map();
  rt.noMotion = () => rt.reduce || (typeof document !== "undefined" && document.body && document.body.classList.contains("shot"))
    || (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  rt.stop = svg => { const p = players.get(svg); if (p) { cancelAnimationFrame(p.raf); players.delete(svg); } };
  rt.play = (svg, code) => {
    rt.stop(svg); const m = rt.rig.motions[code];
    if (rt.noMotion()) { rt.apply(svg, rt.stillState(code)); return; }
    const end = rt.endTime(code), p = { start: performance.now(), raf: 0 };
    const tick = now => {
      let T = (now - p.start) / 1000;
      if (rt.repeat && !m.loop && T > end + .6) { p.start = now; T = 0; }
      rt.apply(svg, rt.frameState(code, T));
      if (!m.loop && !m.blink && !rt.repeat && T >= end) { rt.apply(svg, rt.stillState(code)); players.delete(svg); return; }
      p.raf = requestAnimationFrame(tick);
    };
    players.set(svg, p); p.raf = requestAnimationFrame(tick);
  };
  rt.activate = root => { if (rt.noMotion()) return; root.querySelectorAll("svg[data-code]").forEach(svg => rt.play(svg, svg.dataset.code)); };
  rt.replay = root => root.querySelectorAll("svg[data-code]").forEach(svg => rt.play(svg, svg.dataset.code));
  rt.stopAll = () => { for (const [svg] of players) { rt.stop(svg); rt.apply(svg, rt.stillState(svg.dataset.code)); } };

  /* 시안에서 쓰는 목록 */
  rt.catalog = () => {
    const codes = Object.keys(rt.rig.motions), slot = {}, still = {}, dur = {};
    for (const c of codes) { slot[c] = rt.markupFor(c); still[c] = rt.markupFor(c, { code: "" }); dur[c] = rt.rig.motions[c].dur; }
    return Object.assign(rt, { slot, still, dur, front: rt.markup({ vb: "0 0 240 240" }),
      faces: D.faceList.map(([k, label]) => [label, rt.markup({ state: rt.restState(k), faces: [k] })]),
      faceKeys: D.faceList.map(([k]) => k), motions: D.motionList, icon: D.icon, tokens: D.tokens });
  };
  return rt;
}
