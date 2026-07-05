// meltShader.js — the SDF "metaball" melt as ONE Skia runtime shader.
//
// The whole board is a single signed distance field: for each FILLED cell we add
// a rounded-box SDF and smooth-union (smin) them. The melt shape is the zero
// isosurface. This is correct by construction — straight runs fuse into a clean
// pill, crossings round uniformly, and enclosed EMPTY cells stay open holes (an
// empty cell contributes no field, so it can only fill if `k` is huge). One `k`
// knob controls the whole melt. Replaces the old union-of-rects + CornerPathEffect.
//
// Board state comes in as a 15x15 occupancy IMAGE sampled (nearest) in the shader
// (SkSL/ES2 can't dynamically index a uniform array, so a tiny texture is the
// robust path). We only loop a fixed 5x5 neighbourhood per pixel, so it's cheap.
// `fwidth` isn't available in ES2 runtime effects, but a true SDF has |grad|~1 so
// a fixed ~1px smoothstep AA is correct — pass aa = ~0.6 / zoomScale to stay crisp.
import { Skia, ColorType, AlphaType } from '@shopify/react-native-skia';
import { maskBytes } from '../core/board/meltmask.js';
import { SIZE } from '../core/board/geometry.js';

export const MELT_SKSL = `
uniform shader u_mask;     // ${SIZE}x${SIZE} occupancy, .r = filled?
uniform float  u_pad;      // board padding (content px)
uniform float  u_pitch;    // cell + gap (content px)
uniform float  u_half;     // tile box half-size (content px)
uniform float  u_radius;   // tile corner radius (content px)
uniform float  u_k;        // smooth-min blend radius -> "melt amount"
uniform float  u_aa;       // AA half-width (content px)
uniform float  u_borderW;  // border band half-width (content px)
uniform float4 u_fill;     // fill colour (straight rgba)
uniform float4 u_border;   // border colour (straight rgba)

float sdRoundBox(float2 p, float2 c, float b, float r) {
  float2 d = abs(p - c) - float2(b) + float2(r);
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
bool filled(int cx, int cy) {
  if (cx < 0 || cy < 0 || cx > ${SIZE - 1} || cy > ${SIZE - 1}) return false;
  return u_mask.eval(float2(float(cx) + 0.5, float(cy) + 0.5)).r > 0.5;
}

half4 main(float2 fragCoord) {
  float2 p = fragCoord;
  int gx = int(floor((p.x - u_pad) / u_pitch));
  int gy = int(floor((p.y - u_pad) / u_pitch));

  float d = 1e5;
  for (int oy = -2; oy <= 2; oy++) {
    for (int ox = -2; ox <= 2; ox++) {
      int cx = gx + ox;
      int cy = gy + oy;
      if (filled(cx, cy)) {
        float2 center = float2(u_pad + float(cx) * u_pitch + u_half,
                               u_pad + float(cy) * u_pitch + u_half);
        d = smin(d, sdRoundBox(p, center, u_half, u_radius), u_k);
      }
    }
  }

  float cov  = 1.0 - smoothstep(-u_aa, u_aa, d);                          // fill coverage
  float band = 1.0 - smoothstep(u_borderW - u_aa, u_borderW + u_aa, abs(d)); // border on the edge

  float fa = u_fill.a * cov;
  float ba = u_border.a * band;
  float outA = ba + fa * (1.0 - ba);                                     // border OVER fill
  float3 outRGB = u_border.rgb * ba + u_fill.rgb * fa * (1.0 - ba);
  return half4(outRGB, outA);                                            // premultiplied
}
`;

let _effect;
/** Compile the melt effect once (module singleton). Returns null on failure. */
export function getMeltEffect() {
  if (_effect === undefined) {
    _effect = Skia.RuntimeEffect.Make(MELT_SKSL) || null;
    if (!_effect && typeof console !== 'undefined') console.warn('[melt] shader failed to compile');
  }
  return _effect;
}

/** Build the SIZExSIZE RGBA occupancy image from a Set/array of "r,c" keys. */
export function makeMaskImage(keys) {
  const px = maskBytes(keys, SIZE);
  const data = Skia.Data.fromBytes(px);
  return Skia.Image.MakeImage(
    { width: SIZE, height: SIZE, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Opaque },
    data,
    SIZE * 4,
  );
}

/** "#RRGGBB" (or "rgba(...)") -> [r,g,b,a] in 0..1 for a float4 uniform. */
export function toRgba(color, a = 1) {
  if (typeof color !== 'string') return [0, 0, 0, a];
  if (color[0] === '#') {
    let h = color.slice(1);
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    const n = parseInt(h, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a];
  }
  const m = color.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const p = m[1].split(',').map((s) => parseFloat(s.trim()));
    return [(p[0] || 0) / 255, (p[1] || 0) / 255, (p[2] || 0) / 255, p[3] != null ? p[3] : a];
  }
  return [0, 0, 0, a];
}
