// Differential-Buckling Foliate Lobes (Líquen Folioso)
export const LICHEN_MOSAIC_FS = `#version 300 es
precision highp float;
precision highp int;

in vec2 v_uv;
uniform sampler2D u_trail; // R=U, G=V, B=ridge, A=phase
uniform sampler2D u_guide;
uniform sampler2D u_guide2;
uniform vec2 u_texelSize;
uniform float u_randomness;
uniform float u_colonyRamp;
uniform float u_imageEngage;
uniform float u_morphBlend;
uniform float u_deathProgress;
uniform float u_imageStrength;
uniform int u_boundaryMode;
uniform int u_hasImage;
uniform int u_hasImage2;
uniform int u_guideMode;
uniform int u_colonyBehavior; // 19 = lichen_foliate
uniform int u_growthWaveEffect;
uniform float u_growthWaveIntensity;
uniform float u_simTime;
uniform vec2 u_seedOffset;
uniform uint u_stepIndex;

out vec4 outColor;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise21(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

vec2 sampleCoord(vec2 uv) {
  if (u_boundaryMode == 1) {
    return fract(uv);
  }
  return clamp(uv, u_texelSize * 0.5, 1.0 - u_texelSize * 0.5);
}

void main() {
  float dx = u_texelSize.x;
  float dy = u_texelSize.y;
  vec2 uvC = sampleCoord(v_uv);
  vec4 c = texture(u_trail, uvC);

  vec4 guide = vec4(1.0);
  vec4 g2 = vec4(1.0);
  float mask = 1.0;
  float ramp = 1.0;
  bool morphActive = false;

  if (u_hasImage == 1) {
    guide = texture(u_guide, v_uv);
    g2 = guide;
    if (u_hasImage2 == 1) {
      g2 = texture(u_guide2, v_uv);
      morphActive = (u_morphBlend > 0.005);
      if (u_guideMode == 2 && u_morphBlend > 0.001 && u_morphBlend < 0.94) {
        guide.r = max(
          guide.r * (1.0 - smoothstep(0.25, 0.94, u_morphBlend)),
          g2.r * smoothstep(0.0, 0.35, u_morphBlend)
        );
      } else {
        guide = mix(guide, g2, clamp(u_morphBlend, 0.0, 1.0));
      }
    }

    if (u_guideMode == 2 && guide.r < 0.22) {
      outColor = vec4(1.0, 0.0, 0.0, 0.0);
      return;
    }

    if (u_guideMode == 0 || (u_hasImage2 == 1 && u_guideMode == 1 && u_morphBlend > 0.01)) {
      mask = smoothstep(0.10, 0.65, guide.r);
      ramp = (u_guideMode == 1)
        ? u_morphBlend
        : (morphActive ? 1.0 : smoothstep(0.05, 0.92, u_colonyRamp) * u_imageEngage);
    }
  }

  // Foliate Ruffled Lichen (Anisotropic Edge-Buckling Differential Growth)
  float u = c.r;
  float v = c.g;
  float ridge = c.b;

  vec2 cN = texture(u_trail, sampleCoord(uvC + vec2(0.0, dy))).rg;
  vec2 cS = texture(u_trail, sampleCoord(uvC - vec2(0.0, dy))).rg;
  vec2 cE = texture(u_trail, sampleCoord(uvC + vec2(dx, 0.0))).rg;
  vec2 cW = texture(u_trail, sampleCoord(uvC - vec2(dx, 0.0))).rg;
  vec2 cNE = texture(u_trail, sampleCoord(uvC + vec2(dx, dy))).rg;
  vec2 cNW = texture(u_trail, sampleCoord(uvC + vec2(-dx, dy))).rg;
  vec2 cSE = texture(u_trail, sampleCoord(uvC + vec2(dx, -dy))).rg;
  vec2 cSW = texture(u_trail, sampleCoord(uvC + vec2(-dx, -dy))).rg;

  vec2 lap = -c.rg + 0.20 * (cN + cS + cE + cW) + 0.05 * (cNE + cNW + cSE + cSW);

  vec2 gradV = vec2(cE.g - cW.g, cN.g - cS.g);
  float gAngle = atan(gradV.y, gradV.x);
  float n = noise21(v_uv * 22.0 + u_seedOffset);
  float lobeWave = sin(gAngle * 6.0 + n * 5.0 + u_simTime * 0.8);

  float waveFMod = 0.0;
  float waveKMod = 0.0;
  if (u_growthWaveEffect > 0 && u_growthWaveIntensity > 0.01) {
    float rPde = length(v_uv - vec2(0.5));
    float wI = clamp(u_growthWaveIntensity, 0.0, 1.0);
    float wSig = (u_growthWaveEffect == 4)
      ? sin(atan(v_uv.y - 0.5, v_uv.x - 0.5) * 3.0 + rPde * 18.0 - u_simTime * 2.2)
      : (u_growthWaveEffect == 3)
        ? cos(rPde * 30.0 - u_simTime * 2.0)
        : (u_growthWaveEffect == 5)
          ? (pow(max(0.0, sin(u_simTime * 3.0)), 4.0) * 2.0 - 0.6)
          : sin(rPde * 20.0 - u_simTime * 2.6);
    waveFMod = wSig * 0.0045 * wI;
    waveKMod = -wSig * 0.0016 * wI;
  }

  float F = 0.042 + lobeWave * 0.0045 + waveFMod + (n - 0.5) * 0.004 * u_randomness;
  float k = 0.0595 - lobeWave * 0.0018 + waveKMod;
  float outsideDamp = 1.0;

  if (u_hasImage == 1 && (u_guideMode == 0 || morphActive)) {
    k += (1.0 - mask) * ramp * (0.015 + 0.008 * u_imageStrength);
    F *= mix(1.0, 0.48, (1.0 - mask) * ramp);
    outsideDamp = mix(1.0, 0.88, (1.0 - mask) * smoothstep(0.05, 0.65, ramp));

    float targetLum = morphActive ? g2.r : guide.r;
    if ((u_imageEngage > 0.05 || morphActive) && u_colonyRamp < 0.97 && targetLum > 0.36 && v < 0.08) {
      vec2 blockCoord = floor(v_uv / (u_texelSize * 4.0));
      float h = hash21(blockCoord + vec2(float(u_stepIndex) * 0.173, u_seedOffset.x));
      if (h > (morphActive ? 0.974 : 0.982)) {
        v = 0.52;
        u = 0.35;
      }
    }
  }

  if (u_deathProgress > 0.001) {
    k += u_deathProgress * 0.024 * (0.55 + 0.9 * n);
  }

  float uvv = u * v * v;
  float nextU = clamp(u + (0.96 * lap.r - uvv + F * (1.0 - u)) * 0.95, 0.0, 1.0);
  float nextV = clamp((v + (0.48 * lap.g + uvv - (F + k) * v) * 0.95) * outsideDamp, 0.0, 1.0);

  float rim = smoothstep(0.03, 0.18, length(gradV));
  float nextRidge = clamp(mix(ridge * 0.97, rim, 0.12), 0.0, 1.0);

  outColor = vec4(nextU, nextV, nextRidge, 1.0);
}
`;

export const RENDER_FS = `#version 300 es
precision highp float;
precision highp int;

in vec2 v_uv;
uniform sampler2D u_trail;
uniform sampler2D u_guide;
uniform sampler2D u_guide2;

uniform vec2 u_resolution;
uniform vec2 u_seedOffset;
uniform float u_grain;
uniform float u_sporeVisibility;
uniform float u_morphBlend;
uniform vec3 u_bgColor;
uniform vec3 u_primaryColor;
uniform float u_exposure;
uniform float u_gamma;
uniform float u_imageOverlayOpacity;
uniform int u_growthModel;
uniform int u_colonyBehavior;
uniform int u_growthWaveEffect;
uniform float u_growthWaveIntensity;
uniform float u_simTime;
uniform int u_hasImage;
uniform int u_hasImage2;

out vec4 outColor;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float noise21(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * noise21(p);
    p *= 2.15;
    a *= 0.5;
  }
  return v;
}

// Cellular bead/droplet distance for Physarum receding tails
float beadField(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float minD = 1.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = 0.22 + 0.56 * hash22(i + g + u_seedOffset);
      float d = length(g + o - f);
      minD = min(minD, d);
    }
  }
  return minD;
}

void main() {
  vec4 trail = texture(u_trail, v_uv);
  vec4 guide = texture(u_guide, v_uv);
  if (u_hasImage2 == 1) {
    guide = mix(guide, texture(u_guide2, v_uv), u_morphBlend);
  }
  vec2 px = v_uv * u_resolution;

  float macroPatch = fbm(px * 0.016 + u_seedOffset);
  float fineGrain = hash21(px + u_seedOffset * 17.3);
  float patchMod = mix(1.0, 0.58 + macroPatch * 0.84, u_grain);
  float grainStipple = mix(1.0, 0.78 + fineGrain * 0.44, u_grain * 0.5);

  // Multi-scale organic contrast & translucent opacity variation (prevents solid flat white slabs)
  float microWeb = fbm(px * 0.14 + u_seedOffset * 2.3);
  float sporeCluster = fbm(px * 0.048 - u_seedOffset * 1.3);
  float sporeContrast = smoothstep(0.18, 0.86, sporeCluster);
  float patchContrast = mix(1.0, 0.42 + 0.88 * macroPatch * (0.65 + 0.70 * microWeb), 0.32 + u_grain * 0.68);

  // Persistent stippled sand / spore dust bed behind and around formed fungi (bright white grains, variable opacity)
  float sporeNorm = trail.g / (1.0 + trail.g * 1.10);
  float sandHashA = hash21(floor(px) + u_seedOffset * 19.7);
  float sandHashB = hash21(floor(px * 0.5) + u_seedOffset * 7.3);
  float sandDot = smoothstep(0.34, 0.94, mix(sandHashA, sandHashA * sandHashB * 1.55, 0.35));
  float sporeHalo = smoothstep(0.012, 0.34, sporeNorm) * (0.35 + 0.75 * sporeContrast);
  float sandLayer = sandDot * sporeHalo * (0.14 + u_grain * 0.62) * (0.28 + u_sporeVisibility * 0.72);

  float pVal = 0.0;

  if (u_growthModel == 5) {
    // Foliate Ruffled Lichen (Líquen Folioso): curled bright folded borders over shaded thallus lobes
    vec2 ts = 1.5 / u_resolution;
    float vC = trail.g;
    float vR = texture(u_trail, v_uv + vec2(ts.x, 0.0)).g;
    float vL = texture(u_trail, v_uv - vec2(ts.x, 0.0)).g;
    float vU = texture(u_trail, v_uv + vec2(0.0, ts.y)).g;
    float vD = texture(u_trail, v_uv - vec2(0.0, ts.y)).g;
    float mask = smoothstep(0.12, 0.32, vC);
    float slope = (vR - vL) * 1.5 - (vU - vD) * 1.5;
    float rimGlow = trail.b * (0.45 + u_sporeVisibility * 0.75);
    float foliateSand = sandDot * smoothstep(0.04, 0.25, vC) * u_grain * 0.20;
    float val = (mask * clamp(0.70 + slope * 1.6 + rimGlow, 0.25, 1.45) + foliateSand)
      * mix(1.0, 0.75 + macroPatch * 0.5, u_grain);
    pVal = pow(clamp(val * u_exposure * 0.92, 0.0, 1.0), u_gamma);
  } else if (u_growthModel == 3) {
    // Hyphal Canalization: Trichoderma forks, Cordyceps tendrils & Cladonia fruticose lichen apothecia tips
    float vein = trail.r * 0.96;
    float fineCap = sporeNorm * (0.04 + u_sporeVisibility * 0.24) * (0.35 + 0.75 * sporeContrast) + sandLayer;
    if (u_colonyBehavior == 21 || u_colonyBehavior == 25 || u_colonyBehavior == 41) {
      float tipClusters = smoothstep(0.14, 0.48, sporeNorm) * (1.0 - smoothstep(0.38, 1.18, trail.r)) * 0.75;
      vein += tipClusters;
    }
    float thickCarve = smoothstep(0.60, 2.10, trail.r);
    float innerVar = mix(1.0, 0.50 + 0.80 * microWeb, thickCarve * (0.40 + 0.60 * u_sporeVisibility));
    float veinSig = max(0.0, vein) * patchContrast * innerVar * u_exposure * 1.05;
    float veinTone = veinSig / (1.0 + veinSig * 0.48);
    float sporeSig = max(0.0, fineCap) * u_exposure * 0.95;
    float sporeTone = sporeSig / (1.0 + sporeSig * 0.55);
    float combined = clamp(max(veinTone, sporeTone) + min(veinTone, sporeTone) * 0.14, 0.0, 1.0);
    pVal = pow(combined, u_gamma) * mix(1.0, 0.85 + fineGrain * 0.30, u_grain * 0.3);
  } else {
    // Physarum & Filamentous Fungal Networks
    float veinDensity = trail.r * 0.88;
    float sporeLayer = sporeNorm * (0.04 + u_sporeVisibility * 0.22) * (0.30 + 0.82 * sporeContrast) + sandLayer;

    if (u_colonyBehavior == 17) {
      // Thick white anastomosing cell loops + ruffled striated fan front + beaded tails
      vec2 ts = 3.5 / u_resolution;
      float tBlur = (
        texture(u_trail, v_uv + vec2(ts.x, 0.0)).r +
        texture(u_trail, v_uv - vec2(ts.x, 0.0)).r +
        texture(u_trail, v_uv + vec2(0.0, ts.y)).r +
        texture(u_trail, v_uv - vec2(0.0, ts.y)).r
      ) * 0.25;
      float coreLoops = smoothstep(0.28, 1.15, trail.r) * 1.16;
      float frontFan = smoothstep(0.03, 0.26, trail.r - tBlur * 0.58) * (0.52 + 0.48 * macroPatch) * 0.62;
      float dBead = beadField(px * 0.13);
      float dropletMask = 1.0 - smoothstep(0.16, 0.36, dBead);
      float recedingTail = smoothstep(0.04, 0.24, trail.r) * (1.0 - smoothstep(0.32, 0.68, trail.r));
      float tailBeads = recedingTail * mix(0.24, 1.15, dropletMask);
      veinDensity = coreLoops + frontFan + tailBeads * 0.52;
      sporeLayer = sporeNorm * 0.07 + sandLayer * 0.70;
    } else if (u_colonyBehavior == 22) {
      // Granular cottony flocculent spore tufts + razor-bright inner core veins
      float flocCoarse = fbm(px * 0.055 + u_seedOffset);
      float flocFine = fbm(px * 0.18 - u_seedOffset * 1.7);
      float flocGranule = flocCoarse * (0.55 + 0.90 * flocFine);
      float cottonBed = smoothstep(0.05, 0.52, sporeNorm * (0.45 + 1.35 * flocGranule)) * 0.62;
      float coreVeins = smoothstep(0.45, 1.38, trail.r) * 1.48;
      float creviceCut = mix(0.48, 1.18, smoothstep(0.22, 0.78, flocFine));
      veinDensity = coreVeins;
      sporeLayer = cottonBed * creviceCut + sandLayer;
      patchMod = 1.0;
    } else if (u_colonyBehavior == 23) {
      // Crisp orthogonal filament grid transitioning to bright hollow trabecular walls
      float filament = pow(clamp(trail.r, 0.0, 2.5), 0.86) * 0.95;
      float wallGlow = smoothstep(0.34, 1.20, trail.r) * 0.75;
      veinDensity = filament + wallGlow;
      sporeLayer = sandLayer * 0.60;
    } else if (u_colonyBehavior == 26) {
      // Reference Examples: Crisp bright mycelial veins over persistent fine stippled sand/spore dust
      float brightVeins = smoothstep(0.22, 1.08, trail.r) * 1.28 + pow(clamp(trail.r, 0.0, 2.2), 1.12) * 0.28;
      float stippleCluster = mix(0.40, 1.25, fbm(px * 0.045 + u_seedOffset));
      float richSand = sandDot * smoothstep(0.010, 0.26, sporeNorm) * stippleCluster * (0.45 + u_grain * 0.85);
      float softDustHalo = smoothstep(0.03, 0.45, sporeNorm) * (0.08 + 0.22 * sporeContrast) * u_sporeVisibility;
      veinDensity = brightVeins;
      sporeLayer = richSand + softDustHalo;
      patchMod = 1.0;
    } else if (u_colonyBehavior == 15) {
      float conidia = (fineGrain > 0.44 && sporeNorm > 0.06) ? 1.45 : 0.45;
      sporeLayer *= conidia;
    } else if (u_colonyBehavior == 14) {
      veinDensity = smoothstep(0.18, 1.4, trail.r) * 1.45;
      sporeLayer = sandLayer * 0.65;
    } else if (u_colonyBehavior == 27 || u_colonyBehavior == 28) {
      // Hexagonal Honeycomb & Voronoi Web: crisp bright polygonal cell walls + clean dark chambers
      float wallSharp = smoothstep(0.16, 0.78, trail.r) * 1.15 + pow(clamp(trail.r, 0.0, 2.4), 0.90) * 0.38;
      veinDensity = wallSharp;
      sporeLayer = sandLayer * 0.48;
    } else if (u_colonyBehavior == 29 || u_colonyBehavior == 35) {
      // Diagonal Diamond 45° & Triangular 60°: razor-crisp taut geometric filaments
      veinDensity = pow(clamp(trail.r, 0.0, 2.4), 0.85) * 1.05 + smoothstep(0.32, 1.05, trail.r) * 0.62;
      sporeLayer = sandLayer * 0.42;
    } else if (u_colonyBehavior == 30) {
      // Concentric Orbital Cobweb: crisp orbital rings & radial spokes
      veinDensity = smoothstep(0.14, 0.88, trail.r) * 1.24 + trail.r * 0.35;
      sporeLayer = sandLayer * 0.55;
    } else if (u_colonyBehavior == 31) {
      // Labyrinth Gyroid Meander: smooth high-contrast sinuous ridges
      veinDensity = smoothstep(0.22, 0.92, trail.r) * 1.38;
      sporeLayer = sandLayer * 0.42;
    } else if (u_colonyBehavior == 32) {
      // Perforated Fenestrated Membrane: bright sheet around dark oval pores
      float sheet = smoothstep(0.15, 0.65, trail.r) * 0.95;
      float poreRim = exp(-pow((trail.r - 0.42) / 0.16, 2.0)) * 0.55;
      veinDensity = sheet + poreRim;
      sporeLayer = sandLayer * 0.58;
    } else if (u_colonyBehavior == 33) {
      // Braided Double Chords: luminous twisted cables + crisp cross-bridges
      veinDensity = smoothstep(0.26, 1.15, trail.r) * 1.35 + pow(clamp(trail.r, 0.0, 2.2), 0.92) * 0.32;
      sporeLayer = sandLayer * 0.48;
    } else if (u_colonyBehavior == 34) {
      // Hierarchical Arterial & Capillary Mesh: dual-band bright trunks + fine spider capillaries
      float capFine = pow(clamp(trail.r, 0.0, 0.65), 0.72) * 0.65;
      float mainArtery = smoothstep(0.45, 1.35, trail.r) * 1.25;
      veinDensity = capFine + mainArtery;
      sporeLayer = sandLayer * 0.50;
    } else if (u_colonyBehavior == 36) {
      // Sponge Trabeculae 3D: embossed directional relief shading on thick struts
      vec2 ts = 1.6 / u_resolution;
      float tR = texture(u_trail, v_uv + vec2(ts.x, 0.0)).r;
      float tL = texture(u_trail, v_uv - vec2(ts.x, 0.0)).r;
      float tU = texture(u_trail, v_uv + vec2(0.0, ts.y)).r;
      float tD = texture(u_trail, v_uv - vec2(0.0, ts.y)).r;
      float emboss = clamp(0.88 + ((tR - tL) - (tU - tD)) * (1.2 + u_sporeVisibility * 1.6), 0.35, 1.65);
      veinDensity = smoothstep(0.18, 1.05, trail.r) * 1.18 * emboss;
      sporeLayer = sandLayer * 0.52;
    } else if (u_colonyBehavior == 37) {
      // Aspergillus Conidiophores: bright stalks + stippled spherical spore heads at medium density
      float conidiaHead = exp(-pow((trail.r - 0.28) / 0.15, 2.0)) * (0.45 + 0.95 * sandDot);
      veinDensity = smoothstep(0.20, 1.05, trail.r) * 1.18 + conidiaHead * 0.75;
      sporeLayer = sandLayer;
    } else if (u_colonyBehavior == 38) {
      // Rhizopus Stolons & Rhizoids: sharp arching bridges + bright root knots
      veinDensity = smoothstep(0.22, 1.18, trail.r) * 1.30 + pow(clamp(trail.r, 0.0, 2.2), 1.10) * 0.26;
      sporeLayer = sandLayer * 0.52;
    } else if (u_colonyBehavior == 39) {
      // Fusarium Silky Helical Plume: luminous soft-edged sweeping ribbons
      veinDensity = pow(clamp(trail.r, 0.0, 2.2), 0.90) * 0.88 + smoothstep(0.30, 1.05, trail.r) * 0.45;
      sporeLayer = sporeNorm * (0.12 + 0.18 * sporeContrast) + sandLayer * 0.75;
    } else if (u_colonyBehavior == 40) {
      // Neurospora Septate Hyphae: periodic luminous septal rings along hyphae
      float septa = 0.78 + 0.58 * pow(0.5 + 0.5 * sin(px.x * 0.34 + px.y * 0.34 + trail.r * 5.0), 4.0);
      veinDensity = smoothstep(0.16, 1.05, trail.r) * 1.18 * septa;
      sporeLayer = sandLayer * 0.52;
    } else if (u_colonyBehavior == 42) {
      // Pleurotus Oyster Fan: velvety concentric mycelium tides
      float ripple = 0.76 + 0.42 * cos(length(px - u_resolution * 0.5) * 0.18);
      veinDensity = smoothstep(0.18, 1.02, trail.r) * 1.14 * ripple;
      sporeLayer = sandLayer * 0.65;
    } else if (u_colonyBehavior == 43) {
      // Botrytis Grape Spore Clusters: delicate web + crisp bright clustered spore beads
      float dBot = beadField(px * 0.20);
      float grape = (1.0 - smoothstep(0.15, 0.34, dBot)) * smoothstep(0.10, 0.55, trail.r);
      veinDensity = pow(clamp(trail.r, 0.0, 2.0), 0.85) * 0.72 + grape * 0.92;
      sporeLayer = sporeNorm * (0.10 + 0.20 * sporeContrast) + sandLayer;
    } else if (u_colonyBehavior == 44) {
      // Coprinus Ink Web: delicate spiderweb + sparkling autolytic rim droplets
      float dInk = beadField(px * 0.16);
      float dropGlow = (1.0 - smoothstep(0.12, 0.28, dInk)) * exp(-pow((trail.r - 0.34) / 0.18, 2.0));
      veinDensity = smoothstep(0.16, 0.95, trail.r) * 1.10 + dropGlow * 1.05;
      sporeLayer = sandLayer * 0.65;
    }

    // Traveling cytoplasmic pulse / wave luminescence across existing veins
    float waveLum = 1.0;
    if (u_growthWaveEffect > 0 && u_growthWaveIntensity > 0.01) {
      vec2 relUv = v_uv - vec2(0.5);
      float rUv = length(relUv);
      float wInt = clamp(u_growthWaveIntensity, 0.0, 1.0);
      float wVal = 0.5;
      if (u_growthWaveEffect == 1) {
        wVal = 0.5 + 0.5 * sin(u_simTime * 2.8 - rUv * 20.0);
      } else if (u_growthWaveEffect == 2) {
        wVal = 0.5 + 0.5 * sin(u_simTime * 3.4 - rUv * 16.0 + fbm(px * 0.025) * 2.5);
      } else if (u_growthWaveEffect == 3) {
        wVal = 0.5 + 0.5 * cos(rUv * 32.0 - u_simTime * 2.0);
      } else if (u_growthWaveEffect == 4) {
        wVal = 0.5 + 0.5 * sin(atan(relUv.y, relUv.x) * 3.0 + rUv * 18.0 - u_simTime * 2.4);
      } else if (u_growthWaveEffect == 5) {
        wVal = clamp(pow(max(0.0, sin(u_simTime * 3.0)), 4.0) + 0.45 * pow(max(0.0, sin(u_simTime * 3.0 - 0.85)), 6.0), 0.0, 1.0);
      }
      waveLum = mix(1.0, 0.72 + 0.56 * wVal, wInt * 0.75);
    }

    if (u_colonyBehavior >= 45 && u_colonyBehavior <= 54) {
      // --- 3D VOLUMETRIC SCULPTED FORMATIONS (Behaviors 45..54) ---
      vec2 ts1 = 1.6 / u_resolution;
      vec2 ts2 = 4.8 / u_resolution;

      float cR = texture(u_trail, v_uv + vec2(ts1.x, 0.0)).r;
      float cL = texture(u_trail, v_uv - vec2(ts1.x, 0.0)).r;
      float cU = texture(u_trail, v_uv + vec2(0.0, ts1.y)).r;
      float cD = texture(u_trail, v_uv - vec2(0.0, ts1.y)).r;
      float hC = (trail.r * 2.0 + cR + cL + cU + cD) / 6.0;

      // Neighbor height shaping for smooth cylindrical/domed 3D profiles
      float hR = pow(clamp(cR, 0.0, 2.8), 0.72);
      float hL = pow(clamp(cL, 0.0, 2.8), 0.72);
      float hU = pow(clamp(cU, 0.0, 2.8), 0.72);
      float hD = pow(clamp(cD, 0.0, 2.8), 0.72);
      float hCenter = pow(clamp(hC, 0.0, 2.8), 0.72);

      // Wide ambient occlusion radius (crevice & valley depth shadows)
      float aoSum = (
        texture(u_trail, v_uv + vec2(ts2.x, 0.0)).r +
        texture(u_trail, v_uv - vec2(ts2.x, 0.0)).r +
        texture(u_trail, v_uv + vec2(0.0, ts2.y)).r +
        texture(u_trail, v_uv - vec2(0.0, ts2.y)).r
      ) * 0.25;
      float ao = clamp(1.0 - max(0.0, aoSum - hC) * (0.85 + u_sporeVisibility * 0.90), 0.22, 1.0);

      // Species-specific 3D surface sculpting (micro-nodules, domes, spines, pits, terraces)
      float bump = 0.0;
      float reliefAmp = 3.2 + u_sporeVisibility * 4.0;
      float shininess = 24.0;
      float specStrength = 0.45;
      float rimAmp = 0.35;
      float baseMask = smoothstep(0.05, 0.42, trail.r) * (0.55 + 0.45 * smoothstep(0.10, 0.95, trail.r));

      if (u_colonyBehavior == 45) {
        // 45: Physarum 3D Plasmodium (thick sculpted veins + bulbous rear sporangia nodules + ruffled fan)
        float dNod = beadField(px * 0.14);
        float nodDome = sqrt(max(0.0, 1.0 - pow(clamp(dNod / 0.38, 0.0, 1.0), 2.0)));
        float nodBand = smoothstep(0.22, 0.92, trail.r);
        bump = nodDome * nodBand * 0.32 + microWeb * 0.10;
        baseMask = smoothstep(0.04, 0.36, trail.r) * (0.65 + 0.35 * nodBand);
        reliefAmp = 3.8 + u_sporeVisibility * 4.4;
        shininess = 28.0;
        specStrength = 0.56;
      } else if (u_colonyBehavior == 46) {
        // 46: Aspergillus 3D Domes (radial stalks + raised spherical conidial heads)
        float dDome = beadField(px * 0.11);
        float domeSph = sqrt(max(0.0, 1.0 - pow(clamp(dDome / 0.42, 0.0, 1.0), 2.0)));
        float domeZone = exp(-pow((trail.r - 0.34) / 0.24, 2.0));
        bump = domeSph * domeZone * 0.48 + sandDot * 0.12;
        baseMask = max(smoothstep(0.06, 0.44, trail.r), domeSph * domeZone * 0.95);
        shininess = 18.0;
        specStrength = 0.38;
      } else if (u_colonyBehavior == 47) {
        // 47: Hericium 3D Lion's Mane (cascading icicle spines & snowy lobes)
        float tooth = 0.5 + 0.5 * sin(px.x * 0.34 + microWeb * 4.5);
        bump = tooth * smoothstep(0.08, 0.65, trail.r) * 0.36;
        reliefAmp = 3.6 + u_sporeVisibility * 4.2;
        shininess = 14.0;
        specStrength = 0.28;
        rimAmp = 0.52;
      } else if (u_colonyBehavior == 48) {
        // 48: Ramaria 3D Coral (round cylindrical antler branches)
        bump = microWeb * 0.08;
        reliefAmp = 4.2 + u_sporeVisibility * 4.6;
        shininess = 32.0;
        specStrength = 0.52;
        rimAmp = 0.46;
      } else if (u_colonyBehavior == 49) {
        // 49: Morchella 3D Honeycomb Alveoli (sharp ridges around deep sunken craters)
        float ridgePeak = exp(-pow((hC - 0.56) / 0.26, 2.0));
        hCenter = hCenter * 0.65 + ridgePeak * 0.55;
        bump = microWeb * 0.14;
        reliefAmp = 4.5 + u_sporeVisibility * 4.5;
        ao = clamp(ao * (0.45 + 0.55 * ridgePeak), 0.16, 1.0);
        shininess = 20.0;
        specStrength = 0.42;
      } else if (u_colonyBehavior == 50) {
        // 50: Tremella 3D Jelly Lobes (glossy wet translucent folds)
        bump = smoothstep(0.25, 0.85, macroPatch) * 0.14;
        reliefAmp = 3.4 + u_sporeVisibility * 4.2;
        shininess = 52.0;
        specStrength = 0.78;
        rimAmp = 0.68;
      } else if (u_colonyBehavior == 51) {
        // 51: Ganoderma 3D Terraced Shelves (stepped concentric growth rings)
        float stepped = floor(hCenter * 6.5) / 6.5;
        hCenter = mix(hCenter, stepped, 0.48);
        bump = (0.5 + 0.5 * cos(length(px - u_resolution * 0.5) * 0.22)) * 0.16;
        reliefAmp = 4.0 + u_sporeVisibility * 4.0;
        shininess = 24.0;
        specStrength = 0.44;
      } else if (u_colonyBehavior == 52) {
        // 52: Phallus 3D Bridal Veil (elevated lacy struts hovering over dark cavities)
        float laceLift = smoothstep(0.18, 0.76, hC);
        baseMask = laceLift * 1.08;
        reliefAmp = 4.4 + u_sporeVisibility * 4.4;
        shininess = 30.0;
        specStrength = 0.50;
        rimAmp = 0.55;
      } else if (u_colonyBehavior == 53) {
        // 53: Mucor 3D Sporangia (aerial stalks crowned with glossy 3D sporangia pearls)
        float dPearl = beadField(px * 0.16);
        float pearlSph = sqrt(max(0.0, 1.0 - pow(clamp(dPearl / 0.34, 0.0, 1.0), 2.0)));
        float tipZone = smoothstep(0.05, 0.28, trail.r) * (1.0 - smoothstep(0.45, 0.95, trail.r));
        bump = pearlSph * tipZone * 0.52;
        baseMask = max(smoothstep(0.06, 0.50, trail.r), pearlSph * tipZone * 1.10);
        shininess = 44.0;
        specStrength = 0.72;
      } else {
        // 54: Physarum 3D Sclerotium (thick cords crusted with pebbled 3D sclerotial clusters)
        float dPeb = beadField(px * 0.19);
        float pebSph = sqrt(max(0.0, 1.0 - pow(clamp(dPeb / 0.38, 0.0, 1.0), 2.0)));
        bump = pebSph * smoothstep(0.16, 0.90, trail.r) * 0.42 + macroPatch * 0.14;
        reliefAmp = 4.2 + u_sporeVisibility * 4.6;
        shininess = 22.0;
        specStrength = 0.46;
      }

      // Compute perturbed surface normal using heightfield & micro-bump gradient
      float dBx = dFdx(bump);
      float dBy = dFdy(bump);
      vec3 N = normalize(vec3((hL - hR) * reliefAmp - dBx * 6.0, (hD - hU) * reliefAmp - dBy * 6.0, 1.0));
      vec3 L = normalize(vec3(-0.52, 0.68, 0.52));
      vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));

      float diff = max(dot(N, L), 0.0);
      float fresnel = pow(1.0 - clamp(N.z, 0.0, 1.0), 2.2);
      float spec = pow(max(dot(N, H), 0.0), shininess) * specStrength;

      float heightShade = clamp(0.38 + hCenter * 0.42, 0.32, 1.15);
      float litBody = baseMask * ao * heightShade * (0.28 + diff * 0.92 + fresnel * rimAmp) + bump * baseMask * 0.25;
      float sandDust = sandLayer * 0.58 * (0.5 + 0.5 * sporeContrast);

      float sig3D = max(0.0, litBody + sandDust) * patchContrast * waveLum * u_exposure;
      float tone3D = sig3D / (1.0 + sig3D * 0.42);
      pVal = pow(clamp(tone3D, 0.0, 1.0), u_gamma) * grainStipple;

      vec3 col3D = mix(u_bgColor, u_primaryColor, clamp(pVal, 0.0, 1.0));
      float bgLum = dot(u_bgColor, vec3(0.299, 0.587, 0.114));
      float primLum = dot(u_primaryColor, vec3(0.299, 0.587, 0.114));
      if (primLum >= bgLum) {
        col3D += spec * baseMask * ao * mix(u_primaryColor, vec3(1.0), 0.55) * 0.44;
      } else {
        col3D = mix(col3D, u_bgColor, clamp(spec * baseMask * 0.35, 0.0, 0.45));
      }

      if (u_hasImage == 1 && u_imageOverlayOpacity > 0.001) {
        col3D = mix(col3D, vec3(guide.r), u_imageOverlayOpacity * 0.65);
      }
      outColor = vec4(clamp(col3D, 0.0, 1.0), 1.0);
      return;
    }

    // Carve internal opacity & contrast variation inside dense mats while keeping bright white peaks
    float thickCarve = smoothstep(0.58, 2.10, trail.r);
    float innerVar = mix(1.0, 0.46 + 0.82 * microWeb, thickCarve * (0.45 + 0.55 * u_sporeVisibility));
    float veinSignal = max(0.0, veinDensity) * patchMod * patchContrast * innerVar * waveLum * u_exposure * 1.05;
    float veinTone = veinSignal / (1.0 + veinSignal * 0.48);

    float sporeSignal = max(0.0, sporeLayer) * (0.55 + 0.70 * sporeContrast) * mix(1.0, waveLum, 0.55) * u_exposure;
    float sporeTone = sporeSignal / (1.0 + sporeSignal * 0.46);

    float combined = clamp(max(veinTone, sporeTone) + min(veinTone, sporeTone) * 0.16, 0.0, 1.0);
    pVal = pow(combined, u_gamma) * grainStipple;
  }

  vec3 col = mix(u_bgColor, u_primaryColor, clamp(pVal, 0.0, 1.0));

  if (u_hasImage == 1 && u_imageOverlayOpacity > 0.001) {
    vec3 guideCol = vec3(guide.r);
    col = mix(col, guideCol, u_imageOverlayOpacity * 0.65);
  }

  outColor = vec4(col, 1.0);
}
`;
