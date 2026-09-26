/*
 * LRMaster photo — the pictures inside the medium.
 *
 * A screenshot of a blog post without a photograph is not a screenshot, it is
 * a wireframe. This module draws the pictures: a portrait of the person a text
 * is about, the place it happens in, the thumbnail beside another article.
 * Every picture is composed from shapes on the canvas, seeded by a number, so
 * the same material always yields the same picture, nothing is fetched from
 * the internet and no image file has to travel with the app.
 *
 * A scene is drawn in fractional coordinates (0…1 of the box), so the same
 * subject works as a 64 px thumbnail and as a 900 px lead picture. Every
 * scene ends in the same finish — haze towards the horizon, grain, vignette,
 * a colour grade — which is what makes a set of drawings read as photographs
 * from one camera instead of clip art.
 *
 * No text of the material is ever drawn here; a picture carries no words.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./photolib.js'));
  else { root.LR = root.LR || {}; root.LR.photo = factory(root.LR.photolib); }
})(typeof self !== 'undefined' ? self : this, function (photolib) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Colour and randomness                                               */
  /* ------------------------------------------------------------------ */

  function rng(seed) {
    let x = Math.abs(Math.round(seed || 1)) % 2147483647 || 7;
    return () => { x = (x * 48271) % 2147483647; return x / 2147483647; };
  }

  function rgb(c) {
    const s = String(c).replace('#', '');
    const n = s.length === 3 ? s.split('').map(ch => ch + ch).join('') : s;
    return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
  }
  function hexOf(a) {
    return '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  }
  /** Two colours blended: mix('#000','#fff',.5) is grey. */
  function mix(a, b, t) {
    const x = rgb(a), y = rgb(b);
    return hexOf([0, 1, 2].map(i => x[i] + (y[i] - x[i]) * t));
  }
  /** Lighter (positive) or darker (negative) by a share of the way to white/black. */
  function shade(c, amount) { return amount >= 0 ? mix(c, '#FFFFFF', amount) : mix(c, '#000000', -amount); }

  /* The light a picture was taken in. Every scene picks one, so two pictures
     of the same subject are not the same picture. */
  const LIGHTS = {
    day: { top: '#7FA9CF', low: '#CBDCE8', sun: '#FFF6DC', warm: 0.08, dark: '#2B3440' },
    golden: { top: '#D79A5E', low: '#F7DCB0', sun: '#FFE9BC', warm: 0.3, dark: '#3A2A22' },
    dusk: { top: '#4C5285', low: '#C08EA0', sun: '#F4CBA8', warm: 0.18, dark: '#241F33' },
    grey: { top: '#9BA7B2', low: '#D2D8DC', sun: '#E9EEF1', warm: 0.02, dark: '#2F343A' },
    indoor: { top: '#C9BCA8', low: '#E8DECC', sun: '#FFF0D2', warm: 0.22, dark: '#3B332A' },
    night: { top: '#1B2337', low: '#3A4358', sun: '#FFD79A', warm: 0.12, dark: '#0E1320' },
  };
  const LIGHT_KEYS = Object.keys(LIGHTS);

  /* Skin, hair and clothes: the ranges a class of people really covers. */
  const SKIN = ['#F2D2B8', '#E7BE9C', '#D8A277', '#C08552', '#9C6640', '#6F452C', '#4E3122'];
  const HAIR = ['#1C1A19', '#2E2622', '#4A3327', '#6B4A2F', '#8B5A2B', '#B07B47', '#D6B27E', '#8C8C8C', '#E2E2E2', '#7A2E2E'];
  const CLOTHES = ['#3B5876', '#6B7F5A', '#8C4A3F', '#4A4E69', '#2F6F6B', '#A2634A', '#5C5C5C', '#7A5C86', '#B08A3E'];

  /* ------------------------------------------------------------------ */
  /* The drawing kit a scene works with                                   */
  /* ------------------------------------------------------------------ */

  /**
   * Fractional drawing over one box. `fx`/`fy` are 0…1 of the width/height,
   * so a scene is written once and works at every size. Radii are given as a
   * share of the height so circles stay round in a wide box.
   */
  function kit(ctx, box, r, light) {
    const { x, y, w, h } = box;
    const K = {
      ctx, r, x, y, w, h, light,
      X: (fx) => x + fx * w,
      Y: (fy) => y + fy * h,
      /** A rectangle in fractional coordinates. */
      rect(fx, fy, fw, fh, fill) { ctx.fillStyle = fill; ctx.fillRect(x + fx * w, y + fy * h, fw * w, fh * h); return K; },
      /** A rectangle whose width is given in units of the height (for upright things). */
      up(fx, fy, wh, fh, fill) { ctx.fillStyle = fill; ctx.fillRect(x + fx * w, y + fy * h, wh * h, fh * h); return K; },
      /** A disc; the radius is a share of the height. */
      disc(fx, fy, fr, fill) {
        ctx.fillStyle = fill; ctx.beginPath();
        ctx.ellipse(x + fx * w, y + fy * h, fr * h, fr * h, 0, 0, Math.PI * 2); ctx.fill(); return K;
      },
      /** An ellipse with its own width and height, both shares of the height. */
      oval(fx, fy, rw, rh, fill, rot) {
        ctx.fillStyle = fill; ctx.beginPath();
        ctx.ellipse(x + fx * w, y + fy * h, rw * h, rh * h, rot || 0, 0, Math.PI * 2); ctx.fill(); return K;
      },
      /** A filled polygon from fractional points. */
      poly(points, fill) {
        ctx.fillStyle = fill; ctx.beginPath();
        points.forEach((p, i) => (i ? ctx.lineTo(x + p[0] * w, y + p[1] * h) : ctx.moveTo(x + p[0] * w, y + p[1] * h)));
        ctx.closePath(); ctx.fill(); return K;
      },
      /** A stroked line. */
      line(x1, y1, x2, y2, colour, width) {
        ctx.strokeStyle = colour; ctx.lineWidth = Math.max(0.6, (width || 0.004) * h);
        ctx.beginPath(); ctx.moveTo(x + x1 * w, y + y1 * h); ctx.lineTo(x + x2 * w, y + y2 * h); ctx.stroke(); return K;
      },
      /** A vertical gradient over a band of the box. */
      band(fy0, fy1, from, to) {
        const g = ctx.createLinearGradient(0, y + fy0 * h, 0, y + fy1 * h);
        g.addColorStop(0, from); g.addColorStop(1, to);
        ctx.fillStyle = g; ctx.fillRect(x, y + fy0 * h, w, (fy1 - fy0) * h); return K;
      },
      /** A soft round glow, e.g. the sun or a lamp. */
      glow(fx, fy, fr, colour, strength) {
        const cx = x + fx * w, cy = y + fy * h, rr = fr * h;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
        g.addColorStop(0, withAlpha(colour, strength === undefined ? 0.85 : strength));
        g.addColorStop(1, withAlpha(colour, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, rr, rr, 0, 0, Math.PI * 2); ctx.fill(); return K;
      },
      /** Clip everything that follows to the box. */
      clip() { ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); return K; },
      done() { ctx.restore(); return K; },
      pick(list) { return list[Math.floor(r() * list.length) % list.length]; },
      between(a, b) { return a + r() * (b - a); },
    };
    return K;
  }

  function withAlpha(colour, alpha) {
    const c = rgb(colour);
    return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
  }

  /* ------------------------------------------------------------------ */
  /* Things that appear in several scenes                                 */
  /* ------------------------------------------------------------------ */

  /** Sky with a sun and a few clouds; returns the horizon as a fraction. */
  function sky(K, horizon) {
    const L = K.light;
    K.band(0, horizon + 0.02, L.top, L.low);
    const sx = K.between(0.15, 0.85), sy = horizon * K.between(0.25, 0.6);
    K.glow(sx, sy, 0.45, L.sun, 0.55);
    K.disc(sx, sy, 0.055, L.sun);
    for (let i = 0; i < 3; i++) {
      const cx = K.between(0, 1), cy = horizon * K.between(0.1, 0.7), s = K.between(0.05, 0.13);
      const c = withAlpha('#FFFFFF', 0.16 + K.r() * 0.16);
      K.oval(cx, cy, s * 2.1, s * 0.55, c);
      K.oval(cx + s * 0.6 * K.h / K.w, cy - s * 0.2, s * 1.2, s * 0.5, c);
    }
    return horizon;
  }

  /** Ground from the horizon down, darker towards the viewer. */
  function ground(K, horizon, colour) {
    K.band(horizon, 1, shade(colour, 0.12), shade(colour, -0.18));
  }

  /** Air between the viewer and the horizon — what makes a picture have depth. */
  function haze(K, horizon) {
    const g = K.ctx.createLinearGradient(0, K.Y(Math.max(0, horizon - 0.25)), 0, K.Y(horizon + 0.05));
    g.addColorStop(0, withAlpha(K.light.low, 0));
    g.addColorStop(1, withAlpha(K.light.low, 0.5));
    K.ctx.fillStyle = g;
    K.ctx.fillRect(K.x, K.Y(Math.max(0, horizon - 0.25)), K.w, 0.3 * K.h);
  }

  /**
   * A person seen at a distance: head, shoulders, body, legs. `scale` is the
   * height of the whole figure as a share of the box height.
   */
  function figure(K, fx, footY, scale, opts) {
    const o = opts || {};
    const skin = o.skin || K.pick(SKIN);
    const shirt = o.shirt || K.pick(CLOTHES);
    const trouser = o.trouser || shade(K.pick(CLOTHES), -0.35);
    const hair = o.hair || K.pick(HAIR);
    const dark = o.silhouette;
    const headR = scale * 0.13;
    const headY = footY - scale + headR;
    const bodyTop = headY + headR * 1.35;
    const bodyH = scale * 0.42;
    const wide = headR * 1.55;
    const px = (u) => fx + u * K.h / K.w; // move sideways in units of the height
    if (dark) {
      K.disc(fx, headY, headR, dark);
      K.poly([[px(-wide), footY - scale + scale * 0.28], [px(wide), footY - scale + scale * 0.28],
        [px(wide * 0.8), footY], [px(-wide * 0.8), footY]], dark);
      return;
    }
    // legs
    K.up(px(-wide * 0.62), bodyTop + bodyH, wide * 0.5, scale - (bodyTop + bodyH - (footY - scale)) - scale * 0.02, trouser);
    K.up(px(wide * 0.12), bodyTop + bodyH, wide * 0.5, scale - (bodyTop + bodyH - (footY - scale)) - scale * 0.02, trouser);
    K.rect(px(-wide * 0.66), footY - scale * 0.03, (wide * 0.56) * K.h / K.w, scale * 0.03, '#2C2A28');
    K.rect(px(wide * 0.1), footY - scale * 0.03, (wide * 0.56) * K.h / K.w, scale * 0.03, '#2C2A28');
    // torso with shoulders
    K.poly([[px(-wide), bodyTop + scale * 0.03], [px(wide), bodyTop + scale * 0.03],
      [px(wide * 0.86), bodyTop + bodyH], [px(-wide * 0.86), bodyTop + bodyH]], shirt);
    K.oval(fx, bodyTop + scale * 0.035, wide * 1.02, scale * 0.045, shirt);
    // arms
    K.up(px(-wide * 1.02), bodyTop + scale * 0.05, wide * 0.38, bodyH * 0.92, shade(shirt, -0.1));
    K.up(px(wide * 0.64), bodyTop + scale * 0.05, wide * 0.38, bodyH * 0.92, shade(shirt, -0.1));
    // neck and head
    K.up(px(-headR * 0.34), headY + headR * 0.55, headR * 0.68, headR * 0.9, shade(skin, -0.12));
    K.oval(fx, headY, headR * 0.86, headR, skin);
    // hair: a cap over the skull, sometimes longer at the sides
    K.oval(fx, headY - headR * 0.18, headR * 0.92, headR * 0.78, hair);
    if (o.longHair || K.r() > 0.55) {
      K.oval(px(-headR * 0.8), headY + headR * 0.25, headR * 0.3, headR * 0.75, hair);
      K.oval(px(headR * 0.8), headY + headR * 0.25, headR * 0.3, headR * 0.75, hair);
    }
  }

  /**
   * A face close up — the picture a byline or a profile really shows.
   * `fy` is the centre of the head, `size` its radius as a share of height.
   */
  function face(K, fx, fy, size, opts) {
    const o = opts || {};
    const skin = o.skin || K.pick(SKIN);
    const hair = o.hair || K.pick(HAIR);
    const shirt = o.shirt || K.pick(CLOTHES);
    const px = (u) => fx + u * K.h / K.w;
    const long = o.longHair === undefined ? K.r() > 0.5 : o.longHair;
    // shoulders first, so the head sits in front of them
    K.oval(fx, fy + size * 2.35, size * 2.1, size * 1.25, shirt);
    K.oval(fx, fy + size * 2.1, size * 1.35, size * 0.8, shade(skin, -0.06)); // neck/collar area
    K.up(px(-size * 0.34), fy + size * 0.7, size * 0.68, size * 0.85, shade(skin, -0.14)); // neck
    if (long) K.oval(fx, fy + size * 0.55, size * 1.5, size * 1.45, hair);
    K.oval(fx, fy, size * 0.82, size, skin);                                  // head
    K.oval(px(-size * 0.82), fy + size * 0.1, size * 0.16, size * 0.24, skin); // ears
    K.oval(px(size * 0.82), fy + size * 0.1, size * 0.16, size * 0.24, skin);
    // hairline: a cap, with a parting on one side
    K.oval(fx, fy - size * 0.3, size * 0.86, size * 0.62, hair);
    K.poly([[px(-size * 0.88), fy - size * 0.1], [px(-size * 0.5), fy - size * 0.72],
      [px(size * 0.2), fy - size * 0.78], [px(size * 0.88), fy - size * 0.2],
      [px(size * 0.86), fy - size * 0.45], [px(-size * 0.86), fy - size * 0.45]], hair);
    if (o.beard || (!long && K.r() > 0.72)) {
      K.oval(fx, fy + size * 0.45, size * 0.62, size * 0.42, mix(hair, skin, 0.25));
      K.oval(fx, fy + size * 0.3, size * 0.3, size * 0.16, skin);
    }
    // eyes, brows, nose, mouth — small, but they make it a face
    const eyeY = fy - size * 0.02, eyeX = size * 0.34;
    K.oval(px(-eyeX), eyeY, size * 0.15, size * 0.09, '#FFFFFF');
    K.oval(px(eyeX), eyeY, size * 0.15, size * 0.09, '#FFFFFF');
    const iris = K.pick(['#3B2A1E', '#4A6A55', '#3E5A78', '#5B4632']);
    K.disc(px(-eyeX), eyeY, size * 0.062, iris);
    K.disc(px(eyeX), eyeY, size * 0.062, iris);
    K.disc(px(-eyeX), eyeY, size * 0.028, '#15100C');
    K.disc(px(eyeX), eyeY, size * 0.028, '#15100C');
    K.line(px(-eyeX - 0.18 * size), eyeY - size * 0.22, px(-eyeX + 0.16 * size), eyeY - size * 0.26, hair, 0.012 * size / 0.1 * 0.1);
    K.line(px(eyeX - 0.16 * size), eyeY - size * 0.26, px(eyeX + 0.18 * size), eyeY - size * 0.22, hair, 0.012 * size / 0.1 * 0.1);
    K.oval(fx, fy + size * 0.22, size * 0.1, size * 0.14, shade(skin, -0.12));
    K.oval(fx, fy + size * 0.54, size * 0.24, size * 0.09, mix(skin, '#9C4B44', 0.55));
    K.oval(fx, fy + size * 0.5, size * 0.2, size * 0.035, shade(mix(skin, '#9C4B44', 0.55), -0.25));
  }

  /** A row of houses or blocks along a horizon. */
  function skyline(K, horizon, opts) {
    const o = opts || {};
    const dark = o.colour || K.light.dark;
    let bx = -0.03;
    while (bx < 1.02) {
      const bw = K.between(0.05, 0.13);
      const bh = K.between(o.low || 0.12, o.high || 0.45);
      const face_ = mix(dark, K.light.low, K.between(0.1, 0.45));
      K.rect(bx, horizon - bh, bw, bh, face_);
      if (o.roofs && K.r() > 0.5) K.poly([[bx - 0.01, horizon - bh], [bx + bw / 2, horizon - bh - 0.06], [bx + bw + 0.01, horizon - bh]], shade(face_, -0.2));
      // windows
      const lit = K.light === LIGHTS.night || K.light === LIGHTS.dusk;
      for (let wy = horizon - bh + 0.03; wy < horizon - 0.02; wy += 0.055) {
        for (let wx = bx + 0.012; wx < bx + bw - 0.015; wx += 0.022) {
          if (K.r() > 0.45) K.rect(wx, wy, 0.012, 0.028, withAlpha(lit && K.r() > 0.4 ? '#FFE3A8' : '#FFFFFF', 0.28));
        }
      }
      bx += bw + K.between(0.004, 0.02);
    }
  }

  /** A tree: trunk and a crown of overlapping blobs. */
  function tree(K, fx, footY, scale, colour) {
    const trunk = mix('#5B4632', K.light.dark, 0.25);
    const px = (u) => fx + u * K.h / K.w;
    K.up(px(-scale * 0.045), footY - scale * 0.42, scale * 0.09, scale * 0.42, trunk);
    for (let i = 0; i < 4; i++) {
      K.oval(px(K.between(-0.18, 0.18) * scale), footY - scale * K.between(0.55, 0.82),
        scale * K.between(0.16, 0.26), scale * K.between(0.14, 0.22), mix(colour, K.light.low, K.between(0, 0.3)));
    }
  }

  /* ------------------------------------------------------------------ */
  /* The subjects a picture can show                                      */
  /* ------------------------------------------------------------------ */

  const SCENES = {
    portrait: {
      hint: 'one person, head and shoulders — for a byline, a profile or a person the text is about',
      light: ['indoor', 'day', 'golden', 'grey'],
      draw(K) {
        const back = mix(K.light.low, K.pick(['#8FA5B5', '#B8A896', '#9FB09A', '#AE9AA8']), 0.5);
        K.band(0, 1, shade(back, 0.12), shade(back, -0.18));
        K.glow(K.between(0.2, 0.8), 0.15, 0.7, K.light.sun, 0.35);
        face(K, K.between(0.44, 0.56), 0.44, 0.27);
        // a soft shadow on the wall behind the shoulder
        K.oval(0.72, 0.8, 0.35, 0.3, withAlpha('#000000', 0.06));
      },
    },
    people: {
      hint: 'two or three people together — a conversation, an interview, friends',
      light: ['day', 'indoor', 'golden'],
      draw(K) {
        const back = mix(K.light.low, '#A9B4BC', 0.4);
        K.band(0, 0.72, shade(back, 0.1), back);
        K.band(0.72, 1, shade(back, -0.22), shade(back, -0.34));
        const n = 2 + Math.floor(K.r() * 2);
        for (let i = 0; i < n; i++) figure(K, 0.3 + i * (0.4 / n) + K.between(-0.03, 0.03), 0.97, K.between(0.62, 0.78));
      },
    },
    crowd: {
      hint: 'many people — a full hall, a demonstration, a busy square',
      light: ['day', 'dusk', 'grey'],
      draw(K) {
        sky(K, 0.42); ground(K, 0.42, mix('#8C8578', K.light.low, 0.3));
        skyline(K, 0.42, { low: 0.08, high: 0.3 });
        for (let row = 0; row < 4; row++) {
          const scale = 0.22 + row * 0.16;
          const shadeC = withAlpha(K.light.dark, 0.35 + row * 0.16);
          for (let i = 0; i < 12 - row; i++) {
            figure(K, K.between(-0.05, 1.05), 0.52 + row * 0.14, scale, { silhouette: shadeC });
          }
        }
      },
    },
    classroom: {
      hint: 'a classroom — desks, a board, students',
      light: ['indoor', 'day'],
      draw(K) {
        K.band(0, 1, '#E7E0D2', '#C9C0B0');
        K.rect(0.08, 0.1, 0.5, 0.34, '#3E5B4A');                 // board
        K.rect(0.085, 0.105, 0.49, 0.33, mix('#3E5B4A', '#FFFFFF', 0.06));
        for (let i = 0; i < 5; i++) K.rect(0.12 + K.r() * 0.05, 0.16 + i * 0.05, K.between(0.12, 0.38), 0.008, withAlpha('#FFFFFF', 0.5));
        K.rect(0.66, 0.08, 0.3, 0.42, withAlpha('#FFFFFF', 0.55)); // window
        K.rect(0.66, 0.08, 0.3, 0.42, withAlpha(K.light.top, 0.35));
        K.line(0.81, 0.08, 0.81, 0.5, '#FFFFFF', 0.008);
        K.rect(0, 0.62, 1, 0.38, '#B9A889');                       // floor
        for (let i = 0; i < 3; i++) {
          const dx = 0.1 + i * 0.32;
          figure(K, dx + 0.1, 0.78, 0.34, {});
          K.rect(dx, 0.76, 0.24, 0.05, '#C9A06A');                 // desk top
          K.rect(dx + 0.02, 0.81, 0.02, 0.14, '#8A6A45');
          K.rect(dx + 0.2, 0.81, 0.02, 0.14, '#8A6A45');
        }
      },
    },
    school: {
      hint: 'a school from outside — the building, the yard',
      light: ['day', 'grey', 'golden'],
      draw(K) {
        sky(K, 0.5); ground(K, 0.5, '#8FA07A');
        K.rect(0.12, 0.2, 0.76, 0.42, mix('#C8B49A', K.light.low, 0.25));
        K.poly([[0.08, 0.2], [0.5, 0.1], [0.92, 0.2]], mix('#8C5A4A', K.light.dark, 0.2));
        for (let r_ = 0; r_ < 2; r_++) for (let i = 0; i < 6; i++) {
          K.rect(0.18 + i * 0.115, 0.27 + r_ * 0.16, 0.07, 0.1, withAlpha('#FFFFFF', 0.6));
          K.rect(0.18 + i * 0.115, 0.27 + r_ * 0.16, 0.07, 0.1, withAlpha(K.light.top, 0.25));
        }
        K.rect(0.46, 0.46, 0.08, 0.16, mix('#6B4A2F', K.light.dark, 0.2));
        for (let i = 0; i < 4; i++) figure(K, K.between(0.1, 0.9), K.between(0.72, 0.95), K.between(0.16, 0.26), {});
        tree(K, 0.06, 0.78, 0.55, '#6F8B58');
      },
    },
    city: {
      hint: 'a city — skyline, blocks, streets from above',
      light: ['day', 'dusk', 'golden', 'night'],
      draw(K) {
        const hz = sky(K, 0.62);
        skyline(K, hz, { low: 0.12, high: 0.5 });
        ground(K, hz, mix('#7C7A74', K.light.low, 0.2));
        K.poly([[0.3, 1], [0.46, hz], [0.56, hz], [0.78, 1]], withAlpha('#FFFFFF', 0.12));
        for (let i = 0; i < 5; i++) figure(K, K.between(0.05, 0.95), K.between(hz + 0.12, 0.99), K.between(0.1, 0.22), { silhouette: withAlpha(K.light.dark, 0.6) });
      },
    },
    street: {
      hint: 'a street at eye level — shop fronts, pavement, passers-by',
      light: ['day', 'golden', 'grey', 'night'],
      draw(K) {
        K.band(0, 0.3, K.light.top, K.light.low);
        const wall = mix('#C7B39C', K.light.low, 0.2);
        K.rect(0, 0.06, 1, 0.66, wall);
        for (let i = 0; i < 4; i++) {
          const sx = i * 0.27;
          K.rect(sx + 0.02, 0.3, 0.22, 0.3, mix('#5E6B72', K.light.low, 0.3));   // shop window
          K.rect(sx + 0.02, 0.3, 0.22, 0.3, withAlpha(K.light.sun, 0.18));
          K.rect(sx + 0.01, 0.24, 0.24, 0.06, K.pick(['#8C4A3F', '#2F6F6B', '#3B5876', '#B08A3E'])); // awning
          for (let wy = 0.1; wy < 0.22; wy += 0.07) K.rect(sx + 0.05, wy, 0.07, 0.05, withAlpha('#FFFFFF', 0.45));
        }
        K.rect(0, 0.72, 1, 0.28, mix('#8A8880', K.light.dark, 0.25));            // road
        K.rect(0, 0.68, 1, 0.05, mix('#B4B0A6', K.light.low, 0.2));              // kerb
        for (let i = 0; i < 4; i++) K.rect(0.06 + i * 0.26, 0.86, 0.1, 0.012, withAlpha('#FFFFFF', 0.5));
        for (let i = 0; i < 4; i++) figure(K, K.between(0.08, 0.92), K.between(0.7, 0.78), K.between(0.3, 0.44), {});
        K.up(0.9, 0.2, 0.012, 0.52, mix('#3A3A38', K.light.dark, 0.3));          // lamp post
        K.oval(0.9, 0.2, 0.04, 0.018, '#E8E4D8');
      },
    },
    home: {
      hint: 'a room at home — sofa, lamp, window',
      light: ['indoor', 'golden'],
      draw(K) {
        K.band(0, 1, '#E3D7C6', '#CBBBA6');
        K.rect(0.58, 0.08, 0.34, 0.44, withAlpha('#FFFFFF', 0.6));
        K.rect(0.58, 0.08, 0.34, 0.44, withAlpha(K.light.top, 0.3));
        K.line(0.75, 0.08, 0.75, 0.52, '#FFFFFF', 0.01);
        K.rect(0.53, 0.06, 0.05, 0.5, '#B7A48C');
        K.rect(0, 0.72, 1, 0.28, mix('#9A7A54', K.light.dark, 0.2));            // floor
        K.rect(0.06, 0.48, 0.44, 0.26, K.pick(['#6B7F5A', '#8C4A3F', '#4A4E69']));  // sofa back
        K.rect(0.04, 0.62, 0.48, 0.16, shade(K.pick(['#6B7F5A', '#8C4A3F', '#4A4E69']), -0.12));
        K.oval(0.16, 0.56, 0.08, 0.06, withAlpha('#FFFFFF', 0.35));             // cushions
        K.oval(0.36, 0.56, 0.08, 0.06, withAlpha('#FFFFFF', 0.25));
        K.up(0.86, 0.5, 0.012, 0.24, '#6B5B45');                                // lamp
        K.poly([[0.82, 0.5], [0.94, 0.5], [0.91, 0.36], [0.85, 0.36]], '#E8D8B0');
        K.glow(0.88, 0.45, 0.3, '#FFE7B0', 0.3);
        tree(K, 0.68, 0.78, 0.3, '#6F8B58');                                    // house plant
      },
    },
    office: {
      hint: 'an office or a newsroom — desks, screens, people working',
      light: ['indoor', 'grey', 'day'],
      draw(K) {
        K.band(0, 1, '#DCDFE2', '#B9BFC5');
        K.rect(0.02, 0.1, 0.96, 0.03, '#9AA2A8');
        K.rect(0, 0.66, 1, 0.34, mix('#8F8B84', K.light.dark, 0.15));
        for (let i = 0; i < 3; i++) {
          const dx = 0.05 + i * 0.32;
          K.rect(dx, 0.6, 0.26, 0.05, '#C9C3B6');                              // desk
          K.rect(dx + 0.03, 0.65, 0.02, 0.18, '#8A857A');
          K.rect(dx + 0.21, 0.65, 0.02, 0.18, '#8A857A');
          K.rect(dx + 0.05, 0.42, 0.16, 0.16, '#2E3338');                      // monitor
          K.rect(dx + 0.06, 0.43, 0.14, 0.14, mix('#4C6E86', K.light.sun, 0.25));
          K.rect(dx + 0.11, 0.58, 0.04, 0.02, '#5A5F64');
          figure(K, dx + 0.13, 0.62, 0.36, {});
        }
      },
    },
    desk: {
      hint: 'a desk close up — laptop, notebook, cup',
      light: ['indoor', 'day', 'golden'],
      draw(K) {
        K.band(0, 1, mix('#B98E5E', '#FFFFFF', 0.25), '#9A7043');
        K.glow(0.75, 0.1, 0.6, K.light.sun, 0.3);
        K.poly([[0.2, 0.86], [0.72, 0.86], [0.66, 0.42], [0.26, 0.42]], '#B8BCC0');  // laptop base
        K.poly([[0.26, 0.42], [0.66, 0.42], [0.72, 0.1], [0.2, 0.1]], '#2E3338');    // screen
        K.poly([[0.28, 0.4], [0.64, 0.4], [0.69, 0.13], [0.23, 0.13]], mix('#4C6E86', K.light.sun, 0.3));
        for (let i = 0; i < 5; i++) K.rect(0.3, 0.17 + i * 0.045, K.between(0.12, 0.32), 0.012, withAlpha('#FFFFFF', 0.45));
        K.rect(0.3, 0.88, 0.36, 0.03, '#A3A8AC');                                    // keyboard edge
        K.oval(0.85, 0.7, 0.09, 0.09, '#E8E2D6');                                    // cup
        K.oval(0.85, 0.66, 0.075, 0.045, '#6B4A2F');
        K.rect(0.02, 0.62, 0.16, 0.3, '#E5DCC8');                                    // notebook
        for (let i = 0; i < 5; i++) K.rect(0.04, 0.68 + i * 0.05, 0.12, 0.008, '#B9B0A0');
      },
    },
    phone: {
      hint: 'a phone in a hand — a chat, an app, a screen someone is reading',
      light: ['indoor', 'day', 'dusk'],
      draw(K) {
        K.band(0, 1, mix(K.light.low, '#8FA5B5', 0.4), shade(mix(K.light.low, '#8FA5B5', 0.4), -0.3));
        K.glow(0.5, 0.35, 0.55, K.light.sun, 0.25);
        const skin = K.pick(SKIN);
        K.poly([[0.28, 1], [0.24, 0.62], [0.36, 0.5], [0.66, 0.5], [0.78, 0.66], [0.74, 1]], skin); // hand
        K.rect(0.33, 0.12, 0.34, 0.66, '#23272B');                                  // phone
        K.rect(0.345, 0.15, 0.31, 0.6, mix('#5C7E96', K.light.sun, 0.2));
        for (let i = 0; i < 6; i++) {
          const right = i % 2 === 1;
          const bw = K.between(0.1, 0.2);
          K.rect(right ? 0.64 - bw : 0.36, 0.2 + i * 0.085, bw, 0.055, withAlpha(right ? '#BFE7C4' : '#FFFFFF', 0.8));
        }
        K.oval(0.5, 0.79, 0.02, 0.02, '#3A3F44');
        K.poly([[0.66, 0.5], [0.8, 0.44], [0.84, 0.54], [0.72, 0.62]], shade(skin, -0.08)); // thumb
      },
    },
    sport: {
      hint: 'sport — a pitch, a court, players, a goal',
      light: ['day', 'golden', 'night'],
      draw(K) {
        const hz = sky(K, 0.36);
        K.band(hz, 1, mix('#6F9557', '#FFFFFF', 0.12), '#4C6B3C');
        for (let i = 0; i < 6; i++) K.rect(0, hz + i * 0.11, 1, 0.055, withAlpha('#FFFFFF', 0.05));
        K.rect(0.06, hz + 0.06, 0.88, 0.006, withAlpha('#FFFFFF', 0.7));
        K.oval(0.5, 0.72, 0.16, 0.09, withAlpha('#FFFFFF', 0));
        K.ctx.strokeStyle = withAlpha('#FFFFFF', 0.7); K.ctx.lineWidth = Math.max(1, 0.006 * K.h);
        K.ctx.beginPath(); K.ctx.ellipse(K.X(0.5), K.Y(0.75), 0.14 * K.h, 0.14 * K.h, 0, 0, Math.PI * 2); K.ctx.stroke();
        // goal
        K.rect(0.08, hz - 0.14, 0.006, 0.2, '#FFFFFF');
        K.rect(0.3, hz - 0.14, 0.006, 0.2, '#FFFFFF');
        K.rect(0.08, hz - 0.14, 0.228, 0.006, '#FFFFFF');
        for (let i = 0; i < 4; i++) figure(K, K.between(0.2, 0.9), K.between(hz + 0.1, 0.95), K.between(0.2, 0.34), {});
        K.disc(0.62, 0.9, 0.035, '#FFFFFF');
        K.disc(0.62, 0.9, 0.018, '#2C2A28');
      },
    },
    park: {
      hint: 'a park, a meadow, a path with trees',
      light: ['day', 'golden', 'grey'],
      draw(K) {
        const hz = sky(K, 0.46);
        ground(K, hz, '#7D9A5E');
        K.poly([[0.36, 1], [0.47, hz], [0.55, hz], [0.78, 1]], mix('#B9A57C', K.light.low, 0.2));
        tree(K, 0.16, 0.92, 0.7, '#5F8049');
        tree(K, 0.84, 0.86, 0.55, '#6F8B58');
        tree(K, 0.62, 0.64, 0.3, '#78955E');
        K.rect(0.06, 0.78, 0.16, 0.02, '#7A5C3E');                                  // bench
        K.rect(0.06, 0.8, 0.02, 0.08, '#5E4630');
        K.rect(0.2, 0.8, 0.02, 0.08, '#5E4630');
        figure(K, 0.5, 0.94, 0.3, {});
      },
    },
    mountain: {
      hint: 'mountains, a lake, a wide landscape',
      light: ['day', 'golden', 'dusk'],
      draw(K) {
        const hz = sky(K, 0.6);
        for (let layer = 0; layer < 3; layer++) {
          const base = hz - layer * 0.04;
          const c = mix(K.light.dark, K.light.low, 0.62 - layer * 0.2);
          const pts = [[0, base]];
          for (let i = 0; i <= 6; i++) pts.push([i / 6, base - K.between(0.12, 0.34) - layer * 0.05]);
          pts.push([1, base]);
          K.poly(pts, c);
        }
        K.band(hz, 1, mix('#6E8FA6', K.light.low, 0.3), '#3E5A6B');                  // lake
        for (let i = 0; i < 7; i++) K.rect(K.between(0, 0.9), hz + K.between(0.05, 0.36), K.between(0.05, 0.16), 0.008, withAlpha('#FFFFFF', 0.25));
      },
    },
    sea: {
      hint: 'the sea, a beach, a harbour',
      light: ['day', 'golden', 'dusk'],
      draw(K) {
        const hz = sky(K, 0.52);
        K.band(hz, 0.82, mix('#3E7B96', K.light.low, 0.25), '#2E5E78');
        K.band(0.82, 1, mix('#D9C9A6', '#FFFFFF', 0.2), '#BFA97E');
        for (let i = 0; i < 9; i++) K.rect(K.between(0, 0.92), hz + K.between(0.03, 0.28), K.between(0.04, 0.14), 0.007, withAlpha('#FFFFFF', 0.4));
        K.glow(K.between(0.2, 0.8), hz - 0.06, 0.4, K.light.sun, 0.3);
        figure(K, K.between(0.2, 0.8), 0.96, 0.22, { silhouette: withAlpha(K.light.dark, 0.5) });
      },
    },
    food: {
      hint: 'food — a plate, a table, a kitchen',
      light: ['indoor', 'day'],
      draw(K) {
        K.band(0, 1, mix('#C9A277', '#FFFFFF', 0.3), '#A57C4F');
        K.glow(0.3, 0.1, 0.6, K.light.sun, 0.28);
        K.oval(0.5, 0.56, 0.42, 0.34, '#FFFFFF');
        K.oval(0.5, 0.56, 0.35, 0.28, '#F4F0E8');
        const food = K.pick(['#C0563B', '#7C9A4E', '#D7A13B', '#8B5E3C']);
        K.oval(0.47, 0.55, 0.2, 0.15, food);
        K.oval(0.56, 0.6, 0.12, 0.09, mix(food, '#FFFFFF', 0.25));
        for (let i = 0; i < 5; i++) K.oval(K.between(0.4, 0.62), K.between(0.48, 0.64), 0.035, 0.025, K.pick(['#7C9A4E', '#D7A13B', '#B8493A']));
        K.rect(0.08, 0.44, 0.02, 0.26, '#B9BDC1');                                   // fork
        K.rect(0.88, 0.44, 0.02, 0.26, '#B9BDC1');                                   // knife
        K.oval(0.85, 0.2, 0.09, 0.07, '#DCE6EC');                                    // glass
      },
    },
    market: {
      hint: 'a market, a shop, stalls with people',
      light: ['day', 'golden'],
      draw(K) {
        const hz = sky(K, 0.3);
        K.band(hz, 1, mix('#A79C8C', K.light.low, 0.2), '#7E7568');
        for (let i = 0; i < 3; i++) {
          const sx = 0.04 + i * 0.33;
          K.poly([[sx, 0.34], [sx + 0.28, 0.34], [sx + 0.3, 0.44], [sx - 0.02, 0.44]], K.pick(['#B8493A', '#2F6F6B', '#B08A3E']));
          K.rect(sx + 0.01, 0.44, 0.26, 0.04, '#6B4A2F');
          for (let j = 0; j < 6; j++) K.oval(sx + 0.03 + j * 0.043, 0.42, 0.022, 0.018, K.pick(['#C0563B', '#7C9A4E', '#D7A13B', '#8B5E3C', '#A34F7A']));
          K.rect(sx + 0.02, 0.48, 0.015, 0.16, '#5E5A52');
          K.rect(sx + 0.25, 0.48, 0.015, 0.16, '#5E5A52');
        }
        for (let i = 0; i < 5; i++) figure(K, K.between(0.05, 0.95), K.between(0.76, 0.99), K.between(0.28, 0.42), {});
      },
    },
    animal: {
      hint: 'an animal — a pet, a dog in a field, a bird',
      light: ['day', 'golden', 'grey'],
      draw(K) {
        const hz = sky(K, 0.44);
        ground(K, hz, '#86A063');
        tree(K, 0.12, hz + 0.06, 0.4, '#5F8049');
        const fur = K.pick(['#8B6A45', '#D6C1A0', '#3A3532', '#B08A5E', '#E8E2D6']);
        const cx = 0.55, base = 0.86;
        K.oval(cx, base - 0.1, 0.18, 0.1, fur);                                      // body
        K.oval(cx - 0.17, base - 0.17, 0.08, 0.075, fur);                            // head
        K.oval(cx - 0.23, base - 0.15, 0.045, 0.03, shade(fur, -0.15));              // snout
        K.poly([[cx - 0.2, base - 0.24], [cx - 0.16, base - 0.33], [cx - 0.13, base - 0.23]], shade(fur, -0.2)); // ear
        K.disc(cx - 0.19, base - 0.19, 0.012, '#2A2320');                            // eye
        for (let i = 0; i < 4; i++) K.up(cx - 0.12 + i * 0.07, base - 0.05, 0.028, 0.06, shade(fur, -0.12));
        K.poly([[cx + 0.16, base - 0.14], [cx + 0.3, base - 0.24], [cx + 0.28, base - 0.16]], fur); // tail
      },
    },
    transport: {
      hint: 'a bus, a train, a station, a bike',
      light: ['day', 'grey', 'dusk'],
      draw(K) {
        const hz = sky(K, 0.4);
        K.band(hz, 1, mix('#8C8880', K.light.low, 0.2), '#5E5B55');
        skyline(K, hz, { low: 0.08, high: 0.26 });
        const body = K.pick(['#B8493A', '#2F6F6B', '#3B5876', '#C9A227']);
        K.rect(0.1, 0.42, 0.72, 0.34, body);
        K.rect(0.1, 0.42, 0.72, 0.06, shade(body, 0.18));
        for (let i = 0; i < 5; i++) K.rect(0.14 + i * 0.14, 0.5, 0.1, 0.14, mix('#5C7E96', K.light.sun, 0.3));
        K.rect(0.62, 0.5, 0.16, 0.26, mix('#5C7E96', K.light.sun, 0.2));             // door
        K.disc(0.24, 0.79, 0.065, '#2A2A2A'); K.disc(0.24, 0.79, 0.03, '#9A9A9A');
        K.disc(0.68, 0.79, 0.065, '#2A2A2A'); K.disc(0.68, 0.79, 0.03, '#9A9A9A');
        figure(K, 0.9, 0.96, 0.4, {});
      },
    },
    concert: {
      hint: 'a stage, a concert, a performance',
      light: ['night', 'dusk'],
      draw(K) {
        K.band(0, 1, '#171B2A', '#0D0F18');
        for (let i = 0; i < 4; i++) {
          const bx = K.between(0.15, 0.85);
          K.poly([[bx, 0.08], [bx - 0.18, 0.72], [bx + 0.18, 0.72]], withAlpha(K.pick(['#FFD79A', '#7ED0E0', '#E08AC0', '#A0E08A']), 0.16));
          K.glow(bx, 0.1, 0.12, '#FFFFFF', 0.4);
        }
        K.rect(0, 0.66, 1, 0.1, '#2A2F3E');
        for (let i = 0; i < 3; i++) figure(K, 0.34 + i * 0.16, 0.66, 0.3, { silhouette: withAlpha('#0A0C14', 0.95) });
        for (let i = 0; i < 16; i++) figure(K, K.between(-0.05, 1.05), K.between(0.9, 1.08), K.between(0.28, 0.42), { silhouette: withAlpha('#05070C', 0.92) });
      },
    },
    lab: {
      hint: 'a laboratory, research, science',
      light: ['indoor', 'grey'],
      draw(K) {
        K.band(0, 1, '#E4E9EC', '#C2CACF');
        K.rect(0, 0.62, 1, 0.38, '#AFB8BE');
        K.rect(0.02, 0.58, 0.96, 0.05, '#DDE3E6');
        for (let i = 0; i < 4; i++) {
          const gx = 0.12 + i * 0.2;
          const liquid = K.pick(['#7CC4A8', '#D2A03C', '#B8493A', '#6E8FC9']);
          K.poly([[gx, 0.58], [gx + 0.08, 0.58], [gx + 0.06, 0.4], [gx + 0.02, 0.4]], withAlpha('#FFFFFF', 0.75));
          K.poly([[gx + 0.004, 0.58], [gx + 0.076, 0.58], [gx + 0.056, 0.48], [gx + 0.024, 0.48]], liquid);
          K.rect(gx + 0.026, 0.33, 0.028, 0.08, withAlpha('#FFFFFF', 0.6));
        }
        K.rect(0.72, 0.28, 0.24, 0.24, '#2E3338');
        K.rect(0.73, 0.29, 0.22, 0.22, mix('#4C6E86', '#FFFFFF', 0.25));
        figure(K, 0.86, 0.96, 0.5, { shirt: '#FFFFFF' });
      },
    },
    building: {
      hint: 'one building — a library, a museum, a town hall, a house',
      light: ['day', 'golden', 'grey'],
      draw(K) {
        const hz = sky(K, 0.72);
        ground(K, hz, mix('#8C8880', K.light.low, 0.25));
        const wall = mix('#C9B99E', K.light.low, 0.2);
        K.rect(0.12, 0.2, 0.76, 0.52, wall);
        K.poly([[0.06, 0.2], [0.5, 0.06], [0.94, 0.2]], shade(wall, -0.2));
        for (let i = 0; i < 6; i++) {
          K.rect(0.17 + i * 0.12, 0.3, 0.02, 0.42, shade(wall, 0.2));               // columns
          K.rect(0.16 + i * 0.12, 0.28, 0.04, 0.02, shade(wall, -0.1));
        }
        K.rect(0.44, 0.46, 0.12, 0.26, mix('#5B4632', K.light.dark, 0.25));
        for (let i = 0; i < 4; i++) K.rect(0.1, 0.72 + i * 0.02, 0.8, 0.014, shade(wall, -0.12 - i * 0.03));
        figure(K, K.between(0.2, 0.8), 0.97, 0.18, { silhouette: withAlpha(K.light.dark, 0.55) });
      },
    },
    still: {
      hint: 'an object close up — a book, a letter, a ball, a thing the text is about',
      light: ['indoor', 'day', 'golden'],
      draw(K) {
        K.band(0, 1, mix('#BBAF9C', '#FFFFFF', 0.3), '#8E8271');
        K.glow(0.28, 0.14, 0.55, K.light.sun, 0.3);
        const cover = K.pick(['#8C4A3F', '#2F6F6B', '#3B5876', '#6B7F5A', '#7A5C86']);
        K.poly([[0.22, 0.74], [0.78, 0.74], [0.72, 0.28], [0.28, 0.28]], shade(cover, -0.25));
        K.poly([[0.2, 0.7], [0.76, 0.7], [0.7, 0.24], [0.26, 0.24]], cover);
        K.poly([[0.23, 0.68], [0.5, 0.68], [0.47, 0.27], [0.28, 0.27]], withAlpha('#FFFFFF', 0.12));
        K.rect(0.3, 0.36, 0.3, 0.012, withAlpha('#FFFFFF', 0.45));
        K.rect(0.3, 0.4, 0.2, 0.012, withAlpha('#FFFFFF', 0.3));
        K.oval(0.5, 0.82, 0.3, 0.05, withAlpha('#000000', 0.12));
      },
    },
    sky: {
      hint: 'sky and weather — clouds, rain, sun, nothing else',
      light: ['day', 'golden', 'dusk', 'grey'],
      draw(K) {
        K.band(0, 1, K.light.top, K.light.low);
        K.glow(K.between(0.15, 0.85), K.between(0.15, 0.4), 0.55, K.light.sun, 0.55);
        for (let i = 0; i < 7; i++) {
          const cx = K.between(-0.05, 1.05), cy = K.between(0.1, 0.8), s = K.between(0.08, 0.2);
          const c = withAlpha('#FFFFFF', 0.14 + K.r() * 0.22);
          for (let j = 0; j < 4; j++) K.oval(cx + (j - 1.5) * s * 0.5 * K.h / K.w, cy + K.between(-0.02, 0.02) * K.h / K.h, s * K.between(0.7, 1.2), s * K.between(0.3, 0.5), c);
        }
      },
    },
  };

  const SUBJECTS = Object.keys(SCENES);

  /* Which subject a text is probably about, when nothing else says so. The
     keywords are only a fallback: the interface data from Claude decides. */
  const KEYWORDS = [
    ['portrait', ['interview', 'profile', 'career', 'she said', 'he said', 'author', 'singer', 'player', 'teacher', 'artist']],
    ['classroom', ['school', 'class', 'lesson', 'teacher', 'pupil', 'student', 'homework', 'exam', 'timetable']],
    ['sport', ['football', 'match', 'team', 'training', 'sport', 'goal', 'race', 'swim', 'basketball', 'coach']],
    ['food', ['food', 'cook', 'recipe', 'restaurant', 'kitchen', 'meal', 'breakfast', 'dinner', 'canteen']],
    ['phone', ['chat', 'message', 'app', 'phone', 'screen', 'online', 'social media', 'post', 'text message']],
    ['city', ['city', 'town', 'downtown', 'traffic', 'flat', 'neighbourhood', 'street']],
    ['park', ['park', 'garden', 'forest', 'walk', 'nature', 'tree', 'meadow', 'picnic']],
    ['mountain', ['mountain', 'hike', 'alps', 'valley', 'snow', 'climb', 'lake']],
    ['sea', ['sea', 'beach', 'ocean', 'island', 'holiday', 'swimming', 'coast', 'harbour']],
    ['transport', ['bus', 'train', 'station', 'bike', 'tram', 'travel', 'commute', 'journey']],
    ['market', ['market', 'shop', 'shopping', 'buy', 'price', 'money', 'store', 'sell']],
    ['animal', ['dog', 'cat', 'animal', 'pet', 'bird', 'horse', 'zoo', 'wildlife']],
    ['concert', ['concert', 'band', 'music', 'festival', 'stage', 'song', 'theatre', 'dance']],
    ['lab', ['research', 'science', 'study found', 'experiment', 'laboratory', 'scientist', 'data']],
    ['office', ['office', 'work', 'job', 'company', 'meeting', 'boss', 'colleague', 'newsroom']],
    ['home', ['home', 'family', 'room', 'house', 'parents', 'living room', 'flat share']],
    ['crowd', ['protest', 'demonstration', 'crowd', 'everyone', 'people gathered', 'campaign', 'vote']],
    ['school', ['playground', 'schoolyard', 'head teacher', 'school building', 'assembly']],
    ['building', ['library', 'museum', 'church', 'town hall', 'gallery', 'hospital']],
    ['desk', ['write', 'letter', 'laptop', 'computer', 'homework', 'project', 'notes']],
    ['still', ['book', 'novel', 'diary', 'letter', 'photo album', 'object', 'gift']],
    ['sky', ['weather', 'rain', 'storm', 'climate', 'sun', 'snowfall', 'wind']],
  ];

  /** The subject that fits a piece of text best — used when Claude names none. */
  function subjectFor(text, fallback) {
    const hay = ' ' + String(text || '').toLowerCase().replace(/\s+/g, ' ') + ' ';
    let best = null, bestScore = 0;
    for (const [subject, words] of KEYWORDS) {
      let score = 0;
      for (const w of words) if (hay.includes(' ' + w) || hay.includes(w + ' ')) score += w.includes(' ') ? 2 : 1;
      if (score > bestScore) { bestScore = score; best = subject; }
    }
    return best || (SUBJECTS.includes(fallback) ? fallback : 'city');
  }

  /** Is this a subject the engine can draw? */
  function isSubject(key) { return Object.prototype.hasOwnProperty.call(SCENES, key); }

  /** The list for the prompt: every subject with what it shows. */
  function subjectHints() { return SUBJECTS.map(k => `${k} — ${SCENES[k].hint}`); }

  /* ------------------------------------------------------------------ */
  /* Drawing one picture                                                  */
  /* ------------------------------------------------------------------ */

  /** Grain, vignette and a colour cast — the finish that makes it a photo. */
  function finish(ctx, box, r, light, opts) {
    const { x, y, w, h } = box;
    const o = opts || {};
    if (o.real) {
      ctx.fillStyle = 'rgba(25,25,25,.06)';
      for (let yy = y; yy < y + h; yy += 3) {
        for (let xx = x + (Math.round(yy) % 6 === 0 ? 0 : 1.5); xx < x + w; xx += 3) {
          ctx.beginPath(); ctx.arc(xx, yy, 0.6, 0, Math.PI * 2); ctx.fill();
        }
      }
      return;
    }
    // colour grade: a warm or cool cast over everything
    ctx.fillStyle = withAlpha(light.sun, Math.min(0.16, light.warm * 0.5));
    ctx.fillRect(x, y, w, h);
    // vignette
    const g = ctx.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.2, x + w / 2, y + h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,.26)');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    // grain — fine, and only as dense as the picture is big
    const step = Math.max(2, Math.round(Math.min(w, h) / 90));
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    for (let yy = y; yy < y + h; yy += step) {
      for (let xx = x; xx < x + w; xx += step) if (r() > 0.55) ctx.fillRect(xx, yy, 1, 1);
    }
    ctx.fillStyle = 'rgba(0,0,0,.05)';
    for (let yy = y; yy < y + h; yy += step) {
      for (let xx = x + step / 2; xx < x + w; xx += step) if (r() > 0.6) ctx.fillRect(xx, yy, 1, 1);
    }
    // printed pictures are screened, not continuous
    if (o.halftone) {
      ctx.fillStyle = 'rgba(25,25,25,.07)';
      for (let yy = y; yy < y + h; yy += 3) {
        for (let xx = x + (Math.round(yy) % 6 === 0 ? 0 : 1.5); xx < x + w; xx += 3) {
          ctx.beginPath(); ctx.arc(xx, yy, 0.7, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  }

  /** Everything drained of colour, the way a paper prints a photo. */
  function desaturate(ctx, box, amount) {
    const g = ctx.createLinearGradient(box.x, box.y, box.x, box.y + box.h);
    g.addColorStop(0, `rgba(150,150,150,${amount})`);
    g.addColorStop(1, `rgba(120,120,120,${amount})`);
    ctx.save();
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = '#808080';
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.restore();
    ctx.fillStyle = g;
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ------------------------------------------------------------------ */
  /* Real photographs                                                     */
  /* ------------------------------------------------------------------ */

  /*
   * Where a real photograph of a subject ships with the app (app/photos/,
   * listed in photolib.js with author, source and licence), it is used
   * instead of the drawn scene. The drawn scene stays the fallback: when the
   * library has nothing for a subject, when a file fails to load, and in the
   * tests. Photographs travel WITH the app — a picture from a foreign server
   * is blocked by the page and would make the PNG export fail.
   */
  let LIBRARY = [];
  const IMAGES = new Map();   // file -> loaded image
  const FAILED = new Set();   // files that did not load
  const PENDING_TONE = '#E7E5E4';

  /** Take a library manifest; everything that is not usable is left out. */
  function useLibrary(lib) {
    const list = (lib && Array.isArray(lib.photos)) ? lib.photos : [];
    const seen = new Set();
    LIBRARY = list.filter(e => e && typeof e === 'object' && isSubject(e.subject) && typeof e.file === 'string' && e.file
      && /^[a-z0-9_\-./]+\.(jpe?g|png|webp)$/i.test(e.file) && !/\.\./.test(e.file)
      && typeof e.credit === 'string' && e.credit.trim() && typeof e.license === 'string' && e.license.trim()
      && !seen.has(e.id) && seen.add(e.id))
      .map(e => ({
        id: String(e.id), subject: e.subject, file: e.file, credit: e.credit.trim(), license: e.license.trim(),
        author: String(e.author || ''), source: String(e.source || ''), url: String(e.url || ''),
        // a photograph of a real person only stands in for an invented one when
        // it is a stock picture meant for that (a model, a released portrait)
        persona: e.persona === true,
        focus: Array.isArray(e.focus) && e.focus.length === 2 ? e.focus.map(v => Math.max(0, Math.min(1, Number(v) || 0.5))) : [0.5, 0.4],
        w: Number(e.w) || 0, h: Number(e.h) || 0,
      }));
    IMAGES.clear(); FAILED.clear();
    return LIBRARY.length;
  }

  /** All photographs of one subject that may be used here. */
  function photosFor(subject, opts) {
    const o = opts || {};
    return LIBRARY.filter(e => e.subject === subject && (!o.persona || e.persona));
  }

  /**
   * The photograph a picture uses, chosen from the seed so the same material
   * always shows the same photo and two materials rarely show the same one.
   */
  function pick(subject, seed, opts) {
    const list = photosFor(subject, opts);
    if (!list.length) return null;
    const n = typeof seed === 'number' ? Math.abs(Math.round(seed)) : hashOf(String(seed || ''));
    return list[n % list.length];
  }

  function byId(id) { return LIBRARY.find(e => e.id === id) || null; }

  /** Load every photograph once (browser only); resolves when all have answered. */
  function preload(base) {
    if (typeof Image === 'undefined') return Promise.resolve(0);
    const prefix = base || '';
    return Promise.all(LIBRARY.map(e => new Promise((resolve) => {
      if (IMAGES.has(e.file) || FAILED.has(e.file)) return resolve();
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { IMAGES.set(e.file, img); resolve(); };
      img.onerror = () => { FAILED.add(e.file); resolve(); };
      img.src = prefix + e.file;
    }))).then(() => IMAGES.size);
  }

  /** The loaded image of an entry, or null if it is not (yet) there. */
  function imageFor(entry) {
    const img = entry && IMAGES.get(entry.file);
    return img && img.naturalWidth > 0 ? img : null;
  }

  /*
   * A picture the teacher put in herself: addressed by its source — the
   * stored upload ("/_blob/<id>") or, where the page cannot store uploads,
   * the downscaled image itself. Only these two kinds of source are drawn.
   */
  const OWN_SOURCE = /^(\/_blob\/[A-Za-z0-9_-]{8,64}|data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+)$/;
  function isOwnSource(src) { return typeof src === 'string' && src.length < 3000000 && OWN_SOURCE.test(src); }

  /** Load one of the teacher's pictures (browser only); resolves true when it is there. */
  function loadSrc(src) {
    if (typeof Image === 'undefined' || !isOwnSource(src)) return Promise.resolve(false);
    if (IMAGES.has(src)) return Promise.resolve(true);
    if (FAILED.has(src)) return Promise.resolve(false);
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { IMAGES.set(src, img); resolve(true); };
      img.onerror = () => { FAILED.add(src); resolve(false); };
      img.src = src;
    });
  }

  function imageForSrc(src) {
    const img = src && IMAGES.get(src);
    return img && img.naturalWidth > 0 ? img : null;
  }
  /** A stored photo that is still loading (neither there nor failed). */
  function isPending(src) {
    return !!src && typeof Image !== 'undefined' && isOwnSource(src) && !IMAGES.has(src) && !FAILED.has(src);
  }

  /** Put an image into a box the way a layout does: fill it, crop the rest. */
  function drawCover(ctx, img, box, focus) {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const scale = Math.max(box.w / iw, box.h / ih);
    const sw = box.w / scale, sh = box.h / scale;
    const fx = focus ? focus[0] : 0.5, fy = focus ? focus[1] : 0.4;
    const sx = Math.max(0, Math.min(iw - sw, iw * fx - sw / 2));
    const sy = Math.max(0, Math.min(ih - sh, ih * fy - sh / 2));
    ctx.drawImage(img, sx, sy, sw, sh, box.x, box.y, box.w, box.h);
  }

  /**
   * Draw one picture. `b` is the block from the drawing model:
   * {x, y, w, h, subject, seed, colour, tint, round, photoId}.
   */
  function draw(ctx, b) {
    const box = { x: b.x, y: b.y, w: b.w, h: b.h };
    if (!(box.w > 0) || !(box.h > 0)) return;
    const own = b.own ? imageForSrc(b.own) : null;
    // A stored photo that has not arrived yet: a quiet tone in its place, not
    // the drawn scene — the page is drawn again the moment the photo is there
    // (and shows the drawn scene only if it never comes).
    if (b.own && !own && isPending(b.own)) {
      ctx.save();
      ctx.fillStyle = PENDING_TONE;
      if (b.round) { ctx.beginPath(); ctx.ellipse(box.x + box.w / 2, box.y + box.h / 2, box.w / 2, box.h / 2, 0, 0, Math.PI * 2); ctx.fill(); }
      else ctx.fillRect(box.x, box.y, box.w, box.h);
      ctx.restore();
      return;
    }
    const real = own || (b.photoId ? imageFor(byId(b.photoId)) : null);
    if (real) {
      const entry = own ? { focus: Array.isArray(b.focus) ? b.focus : [0.5, b.subject === 'portrait' ? 0.35 : 0.45] } : byId(b.photoId);
      ctx.save();
      ctx.beginPath();
      if (b.round) ctx.ellipse(box.x + box.w / 2, box.y + box.h / 2, box.w / 2, box.h / 2, 0, 0, Math.PI * 2);
      else ctx.rect(box.x, box.y, box.w, box.h);
      ctx.clip();
      drawCover(ctx, real, box, entry.focus);
      if (b.colour === false) desaturate(ctx, box, 1);
      // a real photograph needs no invented light — only the screen of the
      // print where the page is paper
      if (b.halftone) finish(ctx, box, rng(7), LIGHTS.grey, { halftone: true, real: true });
      ctx.restore();
      if (!b.round && b.frame !== false) {
        ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1;
        ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1);
      }
      return;
    }
    const seedNum = typeof b.seed === 'number' ? b.seed : hashOf(String(b.seed || ''));
    const r = rng(seedNum + 1);
    const scene = SCENES[b.subject] || SCENES[subjectFor('', 'city')];
    const lightKey = scene.light ? scene.light[Math.floor(r() * scene.light.length) % scene.light.length] : LIGHT_KEYS[Math.floor(r() * LIGHT_KEYS.length)];
    const light = LIGHTS[lightKey] || LIGHTS.day;
    ctx.save();
    ctx.beginPath();
    if (b.round) ctx.ellipse(box.x + box.w / 2, box.y + box.h / 2, box.w / 2, box.h / 2, 0, 0, Math.PI * 2);
    else ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    const K = kit(ctx, box, r, light);
    scene.draw(K);
    if (b.colour === false) desaturate(ctx, box, 1);
    finish(ctx, box, r, light, { halftone: b.halftone });
    ctx.restore();
    if (!b.round && b.frame !== false) {
      ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = 1;
      ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1);
    }
  }

  /** A number from a string, so a name or a headline can seed a picture. */
  function hashOf(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return Math.abs(h % 100000);
  }

  /* ------------------------------------------------------------------ */
  /* A real photo from the web for the lead picture                       */
  /* ------------------------------------------------------------------ */

  /*
   * After the text is written, the page looks for a real photograph that
   * would accompany it — in open image collections that a page may call from
   * the browser (Wikimedia Commons, then Openverse): free licences, no key,
   * CORS allowed. Nothing is invented: a picture is used only when it was
   * really found, really downloaded and really decodes. Everything else —
   * no network, a blocked host (a page's security policy), no match, a
   * timeout — ends quietly in the picture the page draws itself.
   *
   * Every step leaves a reason code in `opts.log`, so a failure can be told
   * apart in tests and in the stored material (never shown as a stack trace):
   * commons-search-failed, commons-search-empty, openverse-search-failed,
   * openverse-rate-limited, openverse-search-empty, image-cors-failed,
   * image-load-failed, image-not-image, image-decode-failed, image-too-small,
   * licence-rejected, metadata-incomplete, event-photo-rejected, csp-blocked,
   * timeout, cancelled, found, fallback-used.
   */
  const WEB_TIMEOUT = 12000;          // the whole search
  const WEB_REQUEST_TIMEOUT = 6000;   // one request, so a hanging host leaves time for the next
  const WEB_HOSTS = /^https:\/\/([a-z0-9-]+\.)*(wikimedia\.org|openverse\.org|openverse\.engineering)\//;
  const WEB_SKIP = /\b(logo|logos|map|maps|diagram|flag|coat of arms|chart|graph|icon|signature|seal|screenshot|poster|cover|plan|drawing|illustration|painting|svg|scan|document|text|table|emblem|banner|sticker|meme|collage|montage|clipart|cartoon|render|rendering|infographic|sketch)\b/i;
  // a photo of a real event must never stand for an invented one
  const WEB_EVENT = /\b(fire|fires|blaze|burning|flood|flooding|crash|accident|collision|wreck|explosion|attack|shooting|protest|protests|demonstration|riot|strike|arrest|police|funeral|memorial|election|campaign|disaster|earthquake|storm damage|rescue|evacuation|trial|court|victim|victims|war|battle|killed|injured|ceremony|award|visit of|opening of|inauguration)\b/i;
  const STOP = new Set('a an the of in on at to for and or with by from as is are was were be this that these those its it their his her our your into over under about after before during near new old one two three'.split(' '));
  // once a page's security policy has blocked the collections, it will again
  let webBlocked = false;

  /** The search for the photo, from what Claude chose for this text — or from the text itself. */
  function webQueryFor(chrome, content) {
    const c = chrome || {};
    const own = String(c.photoQuery || '').replace(/[^\p{L}\p{N}\s'-]/gu, ' ').replace(/\s+/g, ' ').trim();
    if (own.split(' ').length >= 2) return own.split(' ').slice(0, 8).join(' ');
    // no query from Claude: the headline, then the caption of the generated text
    const src = [content && content.title, c.photoCaption].filter(Boolean).join(' ');
    const words = String(src).replace(/[^\p{L}\p{N}\s'-]/gu, ' ').split(/\s+/)
      .filter(w => w.length > 2 && !STOP.has(w.toLowerCase()) && !/^fixture/i.test(w));
    const seen = new Set();
    return words.filter(w => !seen.has(w.toLowerCase()) && seen.add(w.toLowerCase())).slice(0, 7).join(' ');
  }

  /**
   * Whether a real photo may stand at all, and how. Claude says what the text
   * is about (`photoReality`): a real, general subject (a city, an animal, a
   * technology) may have a real photo; an invented event or person only a
   * general scene that cannot be taken for evidence of it, captioned as an
   * illustration; "none", or no answer at all, keeps the drawn picture.
   */
  function webPlan(chrome, content) {
    const c = chrome || {};
    const reality = String(c.photoReality || '').trim().toLowerCase();
    if (reality === 'none') return { skip: 'no-real-photo-fits' };
    if (reality !== 'real-subject' && reality !== 'fictional-event') return { skip: 'uncertain-subject' };
    const query = webQueryFor(c, content);
    if (query.split(/\s+/).filter(Boolean).length < 2) return { skip: 'no-query' };
    return { query, fictional: reality === 'fictional-event' };
  }

  /** A licence a worksheet may print and hand out: free licences and CC NC for own teaching, never ND. */
  function webLicenseOk(label) {
    const l = String(label || '').toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!l) return false;
    if (/\bnd\b|no derivatives|noderivs/.test(l)) return false;
    if (/public domain|^pd\b|pdm|cc0|cc zero|no restrictions/.test(l)) return true;
    return /^(cc )?by( sa| nc| nc sa)?( \d(\.\d)?)?/.test(l.replace(/^cc\s*/, 'cc '));
  }
  const publicDomain = (label) => /public domain|^pd\b|pdm|cc0|cc zero|no restrictions/i.test(String(label || ''));
  const plainText = (html) => String(html || '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
  const overlap = (query, text) => {
    const q = String(query).toLowerCase().split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
    const t = ' ' + String(text).toLowerCase().replace(/[^a-z0-9\u00C0-\u024F]+/g, ' ') + ' ';
    return q.filter(w => t.includes(' ' + w) || t.includes(w + ' ')).length;
  };
  /** Wide enough for the place it goes to, and a photograph. */
  function shapeOk(w, h, aspect) {
    if (!(w >= 640) || !(h >= 360)) return false;
    const r = w / h;
    const want = aspect > 0 ? aspect : 1.6;
    return want >= 1 ? (r >= 1.15 && r <= 2.4) : (r >= 0.55 && r <= 1.05);
  }
  /** What the source itself says the photo shows — the only thing a caption may claim. */
  function sourceCaption(title) {
    const t = String(title || '').replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[_]+/g, ' ')
      .replace(/\b(IMG|DSC|DSCF|P)\s?\d{3,}\b/gi, '').replace(/\(\d+\)|\b\d{6,}\b/g, '').replace(/\s+/g, ' ').trim();
    return t.length >= 6 && /[a-z]{3}/i.test(t) ? t.slice(0, 90) : '';
  }
  const note = (log, code) => { if (log) log.push(code); };

  /** The candidates Wikimedia Commons returns, filtered and ranked. */
  function commonsCandidates(json, query, aspect, opts) {
    const o = opts || {};
    const pages = json && json.query && json.query.pages ? Object.values(json.query.pages) : [];
    const out = [];
    for (const p of pages) {
      const ii = p && p.imageinfo && p.imageinfo[0];
      if (!ii) continue;
      // a photograph: JPEG (PNG and WebP on Commons are mostly graphics)
      if (ii.mime !== 'image/jpeg') continue;
      const title = String(p.title || '').replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' ');
      if (WEB_SKIP.test(title)) continue;
      if (!shapeOk(ii.width, ii.height, aspect)) continue;
      const meta = ii.extmetadata || {};
      const license = plainText(meta.LicenseShortName && meta.LicenseShortName.value);
      if (!webLicenseOk(license)) { note(o.log, 'licence-rejected'); continue; }
      const author = plainText(meta.Artist && meta.Artist.value).slice(0, 60);
      const desc = plainText(meta.ImageDescription && meta.ImageDescription.value);
      // who made it, where it is: missing metadata is never filled in
      if ((!author && !publicDomain(license)) || !/^https:\/\//.test(ii.descriptionurl || '')) { note(o.log, 'metadata-incomplete'); continue; }
      if (o.fictional && WEB_EVENT.test(title + ' ' + desc)) { note(o.log, 'event-photo-rejected'); continue; }
      const src = ii.thumburl || ii.url;
      if (!/^https:\/\//.test(src || '')) continue;
      out.push({ src, page: ii.descriptionurl, title, caption: sourceCaption(title), author: author || 'unknown author', license, source: 'Wikimedia Commons',
        score: overlap(query, title + ' ' + desc) * 3 - (p.index || 0) * 0.15 });
    }
    return out.sort((a, b) => b.score - a.score);
  }

  /** The candidates Openverse returns, filtered and ranked. */
  function openverseCandidates(json, query, aspect, opts) {
    const o = opts || {};
    const out = [];
    ((json && json.results) || []).forEach((r, i) => {
      if (!r || !r.url) return;
      const title = String(r.title || '');
      if (WEB_SKIP.test(title)) return;
      if (!(r.width && r.height) || !shapeOk(r.width, r.height, aspect)) return;
      const lic = String(r.license || '').toLowerCase();
      if (!lic) { note(o.log, 'licence-rejected'); return; }
      const license = (lic === 'cc0' ? 'CC0' : lic === 'pdm' ? 'Public Domain' : 'CC ' + lic.toUpperCase()) + (r.license_version ? ' ' + r.license_version : '');
      if (!webLicenseOk(license)) { note(o.log, 'licence-rejected'); return; }
      const author = String(r.creator || '').trim().slice(0, 60);
      if ((!author && !publicDomain(license)) || !/^https:\/\//.test(r.foreign_landing_url || '')) { note(o.log, 'metadata-incomplete'); return; }
      const tags = (r.tags || []).map(t => t && t.name).join(' ');
      if (o.fictional && WEB_EVENT.test(title + ' ' + tags)) { note(o.log, 'event-photo-rejected'); return; }
      const srcs = [r.url, r.thumbnail].filter(u => /^https:\/\//.test(u || ''));
      if (!srcs.length) return;
      out.push({ src: srcs[0], alt: srcs[1] || '', page: r.foreign_landing_url, title, caption: sourceCaption(title), author: author || 'unknown author', license,
        source: r.source ? String(r.source).replace(/^./, c => c.toUpperCase()) + ' via Openverse' : 'Openverse', score: overlap(query, title + ' ' + tags) * 3 - i * 0.15 });
    });
    return out.sort((a, b) => b.score - a.score);
  }

  /** Does the downloaded file really open as an image — and how large is it? */
  async function decodeImage(blob) {
    try {
      if (typeof createImageBitmap === 'function') {
        const bmp = await createImageBitmap(blob);
        const size = { width: bmp.width, height: bmp.height };
        if (bmp.close) bmp.close();
        return size;
      }
      if (typeof Image === 'function' && typeof URL !== 'undefined' && URL.createObjectURL) {
        const url = URL.createObjectURL(blob);
        try {
          const img = new Image();
          img.src = url;
          await img.decode();
          return { width: img.naturalWidth, height: img.naturalHeight };
        } finally { URL.revokeObjectURL(url); }
      }
    } catch (e) { /* not an image */ }
    return null;
  }

  /**
   * Look for a real photo and download it. Resolves `null` whenever anything
   * is missing or fails — never throws, never invents. `opts.fetch` and
   * `opts.decode` let a test stand in for the network and the decoder;
   * `opts.log` collects the reason codes; `opts.fictional` keeps photos of
   * real events away from an invented story.
   */
  async function findWebPicture(query, opts) {
    const o = opts || {};
    const log = o.log || [];
    const doFetch = o.fetch || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    const decode = o.decode || decodeImage;
    const q = String(query || '').trim();
    if (!doFetch || q.split(/\s+/).length < 2) { note(log, 'no-query'); note(log, 'fallback-used'); return null; }
    if (webBlocked && !o.fetch) { note(log, 'csp-blocked'); note(log, 'fallback-used'); return null; }
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    let why = '';
    const stop = (reason) => { if (!why) why = reason; if (ctl) ctl.abort(); };
    const timer = setTimeout(() => stop('timeout'), o.timeout || WEB_TIMEOUT);
    const onCancel = () => stop('cancelled');
    if (o.signal) { if (o.signal.aborted) onCancel(); else o.signal.addEventListener('abort', onCancel, { once: true }); }
    // A page whose security policy forbids these hosts tells us so: then
    // nothing else is tried, now or later in this page.
    const onCsp = (e) => { if (WEB_HOSTS.test(String(e.blockedURI || ''))) { webBlocked = true; stop('csp-blocked'); } };
    const doc = typeof document !== 'undefined' && document.addEventListener ? document : null;
    if (doc && !o.fetch) doc.addEventListener('securitypolicyviolation', onCsp);
    const done = () => ctl && ctl.signal.aborted;

    /** One request with its own time limit, inside the time of the whole search. */
    const get = async (url, as, headers) => {
      const one = typeof AbortController === 'function' ? new AbortController() : null;
      const t = setTimeout(() => one && one.abort(), o.requestTimeout || WEB_REQUEST_TIMEOUT);
      const pass = () => one && one.abort();
      if (ctl) ctl.signal.addEventListener('abort', pass, { once: true });
      try {
        const init = { mode: 'cors', credentials: 'omit', signal: one ? one.signal : undefined };
        if (headers) init.headers = headers;
        const res = await doFetch(url, init);
        if (!res) throw Object.assign(new Error('no response'), { kind: 'load' });
        if (res.status === 429) throw Object.assign(new Error('rate limited'), { kind: 'rate' });
        if (!res.ok) throw Object.assign(new Error('HTTP ' + res.status), { kind: 'load' });
        return as === 'blob' ? await res.blob() : await res.json();
      } catch (e) {
        // a TypeError is what a browser gives for CORS, CSP, DNS and offline alike
        if (e && !e.kind) e.kind = (e.name === 'TypeError') ? 'network' : (e.name === 'AbortError' ? 'abort' : 'load');
        throw e;
      } finally {
        clearTimeout(t);
        if (ctl) ctl.signal.removeEventListener('abort', pass);
      }
    };
    /** The Commons API asks browser clients to name themselves in Api-User-Agent (a browser may not set User-Agent). */
    const commons = async (text) => {
      const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*'
        + '&generator=search&gsrnamespace=6&gsrlimit=24&gsrsearch=' + encodeURIComponent(text + ' filetype:bitmap')
        + '&prop=imageinfo&iiprop=' + encodeURIComponent('url|size|mime|extmetadata')
        // a standard thumbnail width: the CDN refuses others
        + '&iiurlwidth=1280&iiextmetadatafilter=' + encodeURIComponent('LicenseShortName|Artist|ImageDescription');
      try { return await get(url, 'json', { 'Api-User-Agent': 'LRMaster/1.0 (classroom reading worksheets; browser)' }); }
      catch (e) {
        // the header needs a preflight; a host or policy that refuses it gets the plain request
        if (e.kind === 'network' && !done()) return get(url, 'json');
        throw e;
      }
    };
    const pagesOf = (j) => {
      // formatversion=2 gives an array of pages, 1 an object keyed by id
      if (j && j.query && Array.isArray(j.query.pages)) return { query: { pages: Object.assign({}, j.query.pages) } };
      return j;
    };
    const download = async (c) => {
      for (const src of [c.src, c.alt].filter(Boolean)) {
        if (done()) return null;
        try {
          const blob = await get(src, 'blob');
          if (!blob || !/^image\/(jpeg|png|webp)$/.test(blob.type) || blob.size > 15e6) { note(log, 'image-not-image'); continue; }
          if (blob.size < 8000) { note(log, 'image-too-small'); continue; }
          const size = await decode(blob);
          if (!size || !(size.width > 0)) { note(log, 'image-decode-failed'); continue; }
          if (size.width < 480 || size.height < 270) { note(log, 'image-too-small'); continue; }
          return blob;
        } catch (e) {
          if (done()) return null;
          note(log, e.kind === 'network' ? 'image-cors-failed' : 'image-load-failed');
        }
      }
      return null;
    };
    const shorter = q.split(/\s+/).slice(0, 4).join(' ');
    const searches = [
      { name: 'commons', run: () => commons(q).then(j => commonsCandidates(pagesOf(j), q, o.aspect, { log, fictional: o.fictional })) },
      { name: 'commons', run: () => (shorter !== q ? commons(shorter).then(j => commonsCandidates(pagesOf(j), shorter, o.aspect, { log, fictional: o.fictional })) : null) },
      { name: 'openverse', run: () => get('https://api.openverse.org/v1/images/?page_size=20&mature=false&category=photograph&q=' + encodeURIComponent(q), 'json')
        .then(j => openverseCandidates(j, q, o.aspect, { log, fictional: o.fictional })) },
    ];
    try {
      for (const s of searches) {
        if (done()) break;
        let list;
        try { list = await s.run(); } catch (e) {
          if (done()) break;
          note(log, e.kind === 'rate' ? s.name + '-rate-limited' : s.name + '-search-failed');
          continue;
        }
        if (list === null) continue;
        if (!list.length) { note(log, s.name + '-search-empty'); continue; }
        for (const c of list.slice(0, 3)) {
          const blob = await download(c);
          if (done()) break;
          if (!blob) continue;
          const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
          note(log, 'found');
          return { blob, name: (c.title || 'photo').slice(0, 60) + '.' + ext, page: c.page, source: c.source, license: c.license, author: c.author, query: q,
            caption: c.caption, title: c.title, fictional: !!o.fictional,
            credit: ('Foto: ' + c.author + ' / ' + c.source + ', ' + c.license).slice(0, 120) };
        }
      }
      // a blocked request fails at once; the browser may report the policy
      // behind it a moment later — wait for that moment before telling why
      if (!why && doc && !o.fetch && log.some(c => /search-failed$/.test(c))) await new Promise(r => setTimeout(r, 80));
      if (why) note(log, why);
      note(log, 'fallback-used');
      return null;
    } catch (e) {
      if (why) note(log, why);
      note(log, 'fallback-used');
      return null;
    } finally {
      clearTimeout(timer);
      if (o.signal) o.signal.removeEventListener('abort', onCancel);
      if (doc && !o.fetch) doc.removeEventListener('securitypolicyviolation', onCsp);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Prompts to find or make a photo                                      */
  /* ------------------------------------------------------------------ */

  /*
   * A published page cannot fetch pictures from the web, so each photo place
   * tells the teacher how to get one: three short Google image searches that
   * are generic enough to have many real results, and one prompt for an image
   * generator (ChatGPT) for a photorealistic photo as if taken with a camera.
   * Claude writes them with the page (chrome.photoPrompts); for a material
   * without them they are built here from what the page says about the picture.
   */
  const ROLE_INDEX = { lead: 0, second: 1, extra: 2 };
  const clean = (t, n) => String(t || '').replace(/[\u201C\u201D"]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
  function keywords(text, n) {
    const seen = new Set();
    return String(text || '').replace(/[^\p{L}\p{N}\s'-]/gu, ' ').split(/\s+/)
      .filter(w => w.length > 2 && !STOP.has(w.toLowerCase()) && !/^fixture/i.test(w))
      .filter(w => !seen.has(w.toLowerCase()) && seen.add(w.toLowerCase())).slice(0, n);
  }
  /** Is a prompt set usable: three searches of a few words and a real image prompt. */
  function promptSetOk(p) {
    return !!p && Array.isArray(p.google) && p.google.filter(q => clean(q, 80).split(' ').length >= 2).length >= 2 && clean(p.chatgpt, 1200).length >= 40;
  }
  /**
   * The prompts for one photo place. `ctx`: role (lead, second, extra), the
   * page's chrome, the material's content, the picture subject, the medium.
   */
  function promptsFor(ctx) {
    const c = (ctx && ctx.chrome) || {};
    const role = ctx.role || 'extra';
    const given = Array.isArray(c.photoPrompts) ? c.photoPrompts[ROLE_INDEX[role]] : null;
    if (promptSetOk(given)) {
      return { google: given.google.map(q => clean(q, 80)).filter(q => q.split(' ').length >= 2).slice(0, 3), chatgpt: clean(given.chatgpt, 1200), from: 'claude' };
    }
    const subject = isSubject(ctx.subject) ? ctx.subject : 'city';
    const scene = (SCENES[subject] && SCENES[subject].hint) || subject;
    const sceneWords = keywords(scene, 4);
    const fromText = role === 'lead'
      ? keywords(c.photoQuery || '', 5).length >= 2 ? keywords(c.photoQuery, 5) : keywords([ctx.content && ctx.content.title, c.photoCaption].filter(Boolean).join(' '), 5)
      : role === 'second' ? keywords(ctx.caption || '', 5) : [];
    const print = ctx.medium === 'print';
    const style = print ? 'documentary news' : 'editorial';
    const google = [];
    const add = (words) => { const q = words.filter(Boolean).join(' ').trim(); if (q.split(' ').length >= 2 && !google.some(x => x.toLowerCase() === q.toLowerCase())) google.push(q); };
    add(fromText.slice(0, 5));
    add(sceneWords.slice(0, 3).concat(['photo']));
    add([sceneWords[0] || subject, print ? 'documentary photo' : 'everyday life', 'people']);
    add([subject, 'photography']);
    const what = clean(role === 'lead' ? (c.photoCaption || scene) : role === 'second' ? (ctx.caption || scene) : scene, 220).replace(/\.$/, '');
    const chatgpt = `Photorealistic ${style} photograph, as if taken with a real 35 mm camera at eye level: ${what}. `
      + 'Natural available light, realistic colours and textures, shallow depth of field, slight film grain, candid and unposed. '
      + `Composition for a ${print ? 'newspaper' : 'magazine or news website'} ${role === 'lead' ? 'lead picture' : 'picture'}, landscape format 3:2. `
      + 'No text, no captions, no logos, no watermarks, no recognisable real people or brands.';
    return { google: google.slice(0, 3), chatgpt, from: 'app' };
  }

  /*
   * One message for all photos of a page: the teacher pastes it into ChatGPT
   * once and gets the pictures one after another, numbered like the photo
   * places on the page. The picture descriptions are the model's (Claude's
   * photoPrompts); the frame around them keeps the style the same.
   */
  const ROLE_NAME = { lead: 'the lead picture at the top', second: 'the second picture inside the text', extra: 'a smaller picture elsewhere on the page' };
  function batchPrompt(places, medium) {
    const list = (places || []).filter(p => p && p.set && p.set.chatgpt);
    if (!list.length) return '';
    const print = medium === 'print';
    const n = list.length;
    return [
      `Please create ${n === 1 ? 'one photorealistic photo' : n + ' separate photorealistic photos'} for a ${print ? 'newspaper page' : 'magazine or news website'}${n > 1 ? ', one image after another, in exactly this order' : ''}.`,
      `Same style for ${n > 1 ? 'all of them' : 'it'}: ${print ? 'documentary news photography' : 'editorial photography'}, as if taken with a real 35 mm camera at eye level; natural light, realistic colours and textures, slight film grain, candid; landscape format 3:2. No text, no captions, no logos, no watermarks, no recognisable real people or brands.`,
      '',
      list.map((p, i) => `Photo ${i + 1} (${ROLE_NAME[p.role] || 'a picture on the page'}): ${p.set.chatgpt}`).join('\n\n'),
      '',
      n > 1 ? `Generate Photo 1 first, then Photo 2${n > 2 ? ', then Photo 3' : ''} — each as its own image, not as a collage.` : 'Generate it as a single image, not as a collage.',
    ].join('\n');
  }

  /** What a teacher puts once into a ChatGPT project, so every picture comes out alike. */
  const PROJECT_INSTRUCTIONS = [
    'You create photos for English reading worksheets (newspaper, magazine and blog pages).',
    'Every image: photorealistic, as if taken with a real 35 mm camera at eye level; natural light, realistic colours and textures, slight film grain, candid and unposed; landscape format 3:2.',
    'Newspaper pages: documentary news photography. Magazines and blogs: editorial photography.',
    'Never: text, captions, signs with readable words, logos, watermarks, brands, recognisable real or famous people, collages, frames.',
    'When a message asks for several photos, create them one after another as separate images, in the order given (Photo 1, Photo 2, Photo 3).',
    'Answer with the images only, without explanations.',
  ].join('\n');

  useLibrary(photolib);

  return {
    SUBJECTS, SCENES, subjectFor, subjectHints, isSubject, draw, hashOf, LIGHTS, SKIN, HAIR, CLOTHES,
    useLibrary, photosFor, pick, byId, preload, imageFor, library: () => LIBRARY.slice(),
    isOwnSource, loadSrc, imageForSrc,
    promptsFor, promptSetOk, batchPrompt, PROJECT_INSTRUCTIONS, ROLE_INDEX,
    webQueryFor, webPlan, webLicenseOk, commonsCandidates, openverseCandidates, findWebPicture, decodeImage, isPending, sourceCaption,
    PENDING_TONE, webBlockedNow: () => webBlocked, resetWebBlocked: () => { webBlocked = false; },
  };
});
