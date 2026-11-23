export const UPDATE_VS = `#version 300 es
precision highp float;
precision highp int;

layout(location = 0) in vec4 a_agent; // x, y, angle, tag (0..1 lifetime, < 0 = dead)

uniform sampler2D u_trail;
uniform sampler2D u_guide;
uniform sampler2D u_guide2;
uniform vec2 u_simResolution;
uniform float u_simScale;
uniform uint u_stepSeed;
uniform uint u_baseSeed;
uniform float u_growthProgress; // 0..1 across total duration
uniform float u_colonyRamp;     // 0..1 progressive convergence
uniform float u_imageEngage;    // 0..1 activates image pull at imageStartSec
uniform float u_morphBlend;     // 0..1 ImgA -> ImgB transition
uniform float u_deathProgress;  // 0..1 progressive spore death near end of simulation
uniform float u_randomness;
uniform int u_boundaryMode;     // 0 = bounce, 1 = wrap
// 0 = physarum, 3 = canalization
uniform int u_growthModel;
uniform int u_spawnMode;        // 0=random,1=center,2=colonies,3=ring,4=edges,5=top,6=bottom

uniform float u_sensorAngle;
uniform float u_turnAngle;
uniform float u_sensorDist;
uniform float u_speed;
uniform float u_trailDeposit;

uniform int u_hasImage;
uniform int u_hasImage2;
uniform int u_guideMode; // 0=build_image, 1=emerge_from_image, 2=contain_mask
uniform int u_colonyBehavior;
uniform int u_growthWaveEffect; // 0=none,1=radial_pulse,2=peristaltic,3=tidal_rings,4=spiral_wave,5=heartbeat_surge
uniform float u_growthWaveIntensity;
uniform float u_simTime;
uniform uint u_stepIndex;
uniform float u_imageStrength;

out vec4 v_outAgent;

uint hash(uint x) {
  x += (x << 10u);
  x ^= (x >> 6u);
  x += (x << 3u);
  x ^= (x >> 11u);
  x += (x << 15u);
  return x;
}

float rand01(uint seed) {
  return float(hash(seed)) / 4294967295.0;
}

float hash2(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash2(i), hash2(i + vec2(1.0, 0.0)), u.x),
    mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

vec2 wrapOrClamp(vec2 p) {
  if (u_boundaryMode == 1) {
    return mod(p + u_simResolution, u_simResolution);
  }
  return clamp(p, vec2(1.0), u_simResolution - vec2(1.0));
}

vec2 posToUv(vec2 p) {
  return vec2(p.x / u_simResolution.x, 1.0 - p.y / u_simResolution.y);
}

vec4 sampleGuide(vec2 uv) {
  vec4 g1 = texture(u_guide, uv);
  if (u_hasImage2 == 1 && u_morphBlend > 0.001) {
    vec4 g2 = texture(u_guide2, uv);
    float m = clamp(u_morphBlend, 0.0, 1.0);
    if (u_guideMode == 2 && m < 0.92) {
      float bridge = max(
        g1.r * (1.0 - smoothstep(0.25, 0.92, m)),
        g2.r * smoothstep(0.0, 0.35, m)
      );
      return vec4(bridge, max(g1.g * (1.0 - m), g2.g), mix(g1.b, g2.b, m), 1.0);
    }
    return mix(g1, g2, m);
  }
  return g1;
}

float sense(
  vec2 pos,
  float angle,
  float dist,
  float curLum,
  float curHalo,
  float curLum2,
  float curTrail,
  vec2 seedShift,
  out float guideSig
) {
  vec2 dir = vec2(cos(angle), sin(angle));
  float migrating = (u_hasImage == 1 && u_hasImage2 == 1)
    ? smoothstep(0.01, 0.45, u_morphBlend) * (1.0 - smoothstep(0.08, 0.48, curLum2))
    : 0.0;

  float baseProbe = (u_hasImage == 1 && u_guideMode == 2)
    ? min(dist, 4.5 * u_simScale)
    : (u_hasImage == 1 && u_guideMode == 0 && u_hasImage2 == 0 && (curLum > 0.08 || curHalo > 0.20))
      ? min(dist, 4.0 * u_simScale)
      : dist;
  float probeDist = mix(baseProbe, max(dist * 1.35, 14.0 * u_simScale), migrating);

  vec2 samplePos = wrapOrClamp(pos + dir * probeDist);
  vec2 uv = posToUv(samplePos);

  vec4 trail = texture(u_trail, uv);
  vec4 guide = sampleGuide(uv);
  guideSig = guide.r;

  if (u_hasImage == 1 && u_guideMode == 2 && guide.r < 0.22) {
    return -40.0 + guide.r * 35.0 + guide.g * 12.0;
  }

  float substrate = valueNoise((samplePos / u_simScale) * 0.015 + seedShift);
  float rawTrail = trail.r;
  float trailSig = 0.0;

  float effectiveRamp = (u_hasImage2 == 1 && u_morphBlend > 0.01) ? max(u_colonyRamp, u_morphBlend) : u_colonyRamp;
  float shapeSettle = (u_hasImage == 1 && u_guideMode == 0)
    ? effectiveRamp * mix(0.25, 1.0, smoothstep(0.08, 0.60, guide.r))
    : 0.0;
  float repelKeep = mix(1.0, 0.22, shapeSettle);

  if (u_growthModel == 3) {
    // Non-anastomosing Hyphal Canalization (Cladonia Fruticose Lichen / Trichoderma Forks)
    vec2 perp = vec2(-dir.y, dir.x);
    float latL = texture(u_trail, posToUv(wrapOrClamp(pos + perp * (probeDist * 0.85)))).r;
    float latR = texture(u_trail, posToUv(wrapOrClamp(pos - perp * (probeDist * 0.85)))).r;
    float farAhead = texture(u_trail, posToUv(wrapOrClamp(pos + dir * (probeDist * 2.15)))).r;
    float primaryTrunk = pow(clamp(rawTrail, 0.0, 2.4), 1.30) * 0.56;
    float openTip = exp(-rawTrail * 2.6) * 0.26 * (1.0 - shapeSettle * 0.45);
    float latAvoid = (latL + latR) * 0.30 * repelKeep;
    float tipClear = max(0.0, farAhead - 0.65) * 0.42 * repelKeep;
    float overCrowd = max(0.0, rawTrail - 0.85) * 1.35 * (u_hasImage == 1 && u_guideMode == 0 ? 0.85 : repelKeep);
    trailSig = primaryTrunk + openTip - latAvoid - tipClear - overCrowd;
  } else if (u_colonyBehavior == 2) {
    // Physarum Steiner Minimal Web: prune weak loops, preserve taut geometric highways
    float overDense = max(0.0, rawTrail - 1.35) * 0.62 * repelKeep;
    trailSig = pow(clamp(rawTrail, 0.0, 2.5), 1.36) * 0.62 - overDense;
  } else if (u_colonyBehavior == 7) {
    // Mycorrhiza Multi-Scale Web: short capillary loops + long exploratory highways
    vec2 farPos = wrapOrClamp(pos + dir * (probeDist * 2.6));
    float farTrail = texture(u_trail, posToUv(farPos)).r;
    trailSig = (rawTrail / (1.0 + rawTrail * 0.60)) * 0.72 + (farTrail / (1.0 + farTrail * 0.45)) * 0.55;
  } else if (u_colonyBehavior == 14) {
    // Sclerotia knots: extreme self-condensation + mid-range ring repulsion into pearl-white knots
    vec2 ringPos = wrapOrClamp(pos + dir * (probeDist * 1.75));
    float ringTrail = texture(u_trail, posToUv(ringPos)).r;
    trailSig = pow(clamp(rawTrail, 0.0, 2.6), 1.72) * 0.92 - ringTrail * 1.15 * repelKeep;
  } else if (u_colonyBehavior == 15) {
    // Penicillium concentric sporulation zones
    float crowd = max(0.0, rawTrail - 1.10) * 0.80 * repelKeep;
    trailSig = (rawTrail / (1.0 + rawTrail * 0.42)) - crowd;
  } else if (u_colonyBehavior == 16) {
    // Mucor straight radial whiskers: minimal lateral web curvature
    trailSig = (rawTrail / (1.0 + rawTrail * 0.90)) * 0.42;
  } else if (u_colonyBehavior == 17) {
    // Image 1 Reference: Thick anastomosed veins + ruffled advancing fan + hollow cell loops
    float trunk = pow(clamp(rawTrail, 0.0, 2.5), 1.28) * 0.58;
    float cellLoop = exp(-pow((rawTrail - 0.36) / 0.20, 2.0)) * 0.38;
    float hollowCore = max(0.0, rawTrail - 1.18) * 0.82 * repelKeep;
    trailSig = trunk + cellLoop - hollowCore;
  } else if (u_colonyBehavior == 18) {
    // Sinuous petri plume with feathering tips
    float mainVein = pow(clamp(rawTrail, 0.0, 2.4), 1.26) * 0.56;
    float tipFlare = exp(-rawTrail * 3.2) * 0.38;
    float midRepel = max(0.0, rawTrail - 1.15) * 0.75 * repelKeep;
    trailSig = mainVein + tipFlare - midRepel;
  } else if (u_colonyBehavior == 22) {
    // Image 2 Reference: Flocculent cottony spore clusters + bright internal core anastomosed veins
    vec2 midPos = wrapOrClamp(pos + dir * (probeDist * 2.1));
    float clusterTrail = texture(u_trail, posToUv(midPos)).g;
    float cottonBed = (trail.g / (1.0 + trail.g * 0.65)) * 0.50 + clusterTrail * 0.38;
    float innerCord = pow(clamp(rawTrail, 0.0, 2.5), 1.38) * 0.56;
    float coreRelief = max(0.0, rawTrail - 1.45) * 0.65 * repelKeep;
    trailSig = innerCord + cottonBed - coreRelief;
  } else if (u_colonyBehavior == 23) {
    // Image 3 Reference: Crisp 0/90 orthogonal lattice in outer zones -> curved hollow trabecular alveoli in dense center
    float vacuoleZone = smoothstep(0.24, 0.74, max(curTrail, rawTrail));
    float orthoBias = pow(max(abs(cos(angle)), abs(sin(angle))), 4.0) * 0.38 * (1.0 - vacuoleZone) * (1.0 - shapeSettle * 0.75);
    float fineThread = (rawTrail / (1.0 + rawTrail * 0.85)) * 0.46;
    float alveolarWall = exp(-pow((rawTrail - 0.58) / 0.24, 2.0)) * 0.72 * vacuoleZone;
    float vacuoleHollow = smoothstep(0.88, 1.55, rawTrail) * 1.18 * vacuoleZone * repelKeep;
    trailSig = mix(fineThread, alveolarWall - vacuoleHollow, vacuoleZone) + orthoBias;
  } else if (u_colonyBehavior == 24) {
    // Fairy Ring Hyphae: centrifugal ring band leaving depleted interior
    float staleCenter = max(0.0, rawTrail - 0.92) * 1.20 * repelKeep;
    trailSig = (rawTrail / (1.0 + rawTrail * 0.45)) - staleCenter;
  } else if (u_colonyBehavior == 26) {
    // Sandy Spore Web (Reference examples): crisp curved anastomosing veins over persistent spore mist
    float crispVein = pow(clamp(rawTrail, 0.0, 2.5), 1.30) * 0.60;
    float mistBed = (trail.g / (1.0 + trail.g * 0.60)) * 0.34;
    float coreLoop = max(0.0, rawTrail - 1.22) * 0.76 * repelKeep;
    trailSig = crispVein + mistBed - coreLoop;
  } else if (u_colonyBehavior == 27) {
    // 27: Hexagonal Honeycomb Mesh (120-degree 6-way walls + hollow cell interiors)
    float hexBias = pow(max(0.0, cos(angle * 6.0)), 2.0) * 0.24 * (1.0 - shapeSettle * 0.65);
    float wallBand = exp(-pow((rawTrail - 0.52) / 0.22, 2.0)) * 0.68;
    float cellHollow = smoothstep(0.84, 1.48, rawTrail) * 1.10 * repelKeep;
    trailSig = wallBand + hexBias - cellHollow;
  } else if (u_colonyBehavior == 28) {
    // 28: Voronoi Cellular Web (thin polygonal septa + bright triple-junction nodes)
    float septum = exp(-pow((rawTrail - 0.44) / 0.18, 2.0)) * 0.72;
    float nodeAnchor = pow(clamp(rawTrail, 0.0, 2.0), 1.42) * 0.28;
    float chamberClear = max(0.0, rawTrail - 0.92) * 1.12 * repelKeep;
    trailSig = septum + nodeAnchor - chamberClear;
  } else if (u_colonyBehavior == 29) {
    // 29: Diagonal Diamond 45/135 Lattice
    float diag = angle - 0.785398;
    float diagBias = pow(max(abs(cos(diag)), abs(sin(diag))), 5.0) * 0.34 * (1.0 - shapeSettle * 0.70);
    float crossThread = (rawTrail / (1.0 + rawTrail * 0.75)) * 0.52;
    trailSig = crossThread + diagBias - max(0.0, rawTrail - 1.15) * 0.65 * repelKeep;
  } else if (u_colonyBehavior == 30) {
    // 30: Concentric Orbital Cobweb (radial spokes + orbital rings)
    vec2 cRel = samplePos - u_simResolution * 0.5;
    float rDist = length(cRel) / max(1.0, min(u_simResolution.x, u_simResolution.y));
    float ringRail = 0.5 + 0.5 * cos(rDist * 42.0);
    float spokeBias = pow(abs(cos(atan(cRel.y, cRel.x) * 8.0)), 4.0) * 0.22;
    trailSig = (rawTrail / (1.0 + rawTrail * 0.62)) * 0.65 + (ringRail * 0.26 + spokeBias) * (1.0 - shapeSettle * 0.60);
  } else if (u_colonyBehavior == 31) {
    // 31: Labyrinth Gyroid Meander (mid-range lateral avoidance keeping parallel meanders separated)
    vec2 perp = vec2(-dir.y, dir.x);
    float sideA = texture(u_trail, posToUv(wrapOrClamp(pos + perp * (probeDist * 1.15)))).r;
    float sideB = texture(u_trail, posToUv(wrapOrClamp(pos - perp * (probeDist * 1.15)))).r;
    float selfRidge = (rawTrail / (1.0 + rawTrail * 0.50)) * 0.72;
    float channelGap = (sideA + sideB) * 0.36 * repelKeep;
    trailSig = selfRidge - channelGap - max(0.0, rawTrail - 1.12) * 0.70 * repelKeep;
  } else if (u_colonyBehavior == 32) {
    // 32: Perforated Fenestrated Membrane (continuous sheet punched with dark oval pores)
    float poreWave = sin((samplePos.x / u_simScale) * 0.14 + substrate * 3.5) * cos((samplePos.y / u_simScale) * 0.14 - substrate * 3.0);
    float sheetPull = (rawTrail / (1.0 + rawTrail * 0.48)) * 0.70;
    float poreCut = smoothstep(0.35, 0.85, poreWave) * 0.42 * (1.0 - shapeSettle * 0.55);
    trailSig = sheetPull - poreCut;
  } else if (u_colonyBehavior == 33) {
    // 33: Braided Double Chords (intertwined dual mycelial cables + fine cross-bridges)
    vec2 cRel33 = samplePos - u_simResolution * 0.5;
    float rNorm33 = length(cRel33) / max(1.0, min(u_simResolution.x, u_simResolution.y));
    float braidWave = sin(angle * 2.0 + rNorm33 * 18.0 + substrate * 4.0) * 0.18;
    float cable = pow(clamp(rawTrail, 0.0, 2.5), 1.38) * 0.62;
    trailSig = cable + braidWave * (1.0 - shapeSettle * 0.60) - max(0.0, rawTrail - 1.38) * 0.55 * repelKeep;
  } else if (u_colonyBehavior == 34) {
    // 34: Hierarchical Arterial & Capillary Mesh (thick trunks + fine secondary mesh)
    float nearT = texture(u_trail, posToUv(wrapOrClamp(pos + dir * (probeDist * 0.55)))).r;
    float farT = texture(u_trail, posToUv(wrapOrClamp(pos + dir * (probeDist * 2.4)))).r;
    float trunk = pow(clamp(farT, 0.0, 2.4), 1.32) * 0.52;
    float capWeb = (nearT / (1.0 + nearT * 0.80)) * 0.48;
    trailSig = trunk + capWeb;
  } else if (u_colonyBehavior == 35) {
    // 35: Triangular 60/120 Tessellation Lattice
    float triBias = pow(max(0.0, cos(angle * 3.0)), 4.0) * 0.36 * (1.0 - shapeSettle * 0.72);
    float strut = (rawTrail / (1.0 + rawTrail * 0.75)) * 0.54;
    trailSig = strut + triBias - max(0.0, rawTrail - 1.15) * 0.60 * repelKeep;
  } else if (u_colonyBehavior == 36) {
    // 36: Sponge Trabeculae 3D (thick sculpted struts around deep cavernous voids)
    float strutWall = exp(-pow((rawTrail - 0.65) / 0.28, 2.0)) * 0.75;
    float cavernCut = smoothstep(0.95, 1.60, rawTrail) * 0.95 * repelKeep;
    trailSig = strutWall + (rawTrail / (1.0 + rawTrail * 0.65)) * 0.38 - cavernCut;
  } else if (u_colonyBehavior == 37) {
    // 37: Aspergillus Radial Conidiophores (stiff stalks + bright spherical conidial heads)
    float farConidia = texture(u_trail, posToUv(wrapOrClamp(pos + dir * (probeDist * 1.9)))).r;
    float stalk = (rawTrail / (1.0 + rawTrail * 0.62)) * 0.62;
    float headTip = exp(-rawTrail * 3.6) * 0.34;
    trailSig = stalk + headTip + farConidia * 0.18 - max(0.0, rawTrail - 1.25) * 0.65 * repelKeep;
  } else if (u_colonyBehavior == 38) {
    // 38: Rhizopus Stolons & Rhizoids (long aerial arches leaping between focal root rosettes)
    float farArch = texture(u_trail, posToUv(wrapOrClamp(pos + dir * (probeDist * 2.8)))).r;
    float knot = pow(clamp(rawTrail, 0.0, 2.6), 1.44) * 0.56;
    trailSig = knot + (farArch / (1.0 + farArch * 0.55)) * 0.46 - max(0.0, rawTrail - 1.32) * 0.78 * repelKeep;
  } else if (u_colonyBehavior == 39) {
    // 39: Fusarium Silky Helical Plume (curling crescent waves with feathery margins)
    float waveSilk = sin((samplePos.x + samplePos.y) / u_simScale * 0.028 + substrate * 4.2) * 0.16;
    trailSig = (rawTrail / (1.0 + rawTrail * 0.54)) * 0.76 + waveSilk * (1.0 - shapeSettle * 0.60);
  } else if (u_colonyBehavior == 40) {
    // 40: Neurospora Septate Superhighways (fast anastomosed long-range filaments)
    float highway = pow(clamp(rawTrail, 0.0, 2.5), 1.32) * 0.64;
    float crowd = max(0.0, rawTrail - 1.26) * 0.58 * repelKeep;
    trailSig = highway - crowd;
  } else if (u_colonyBehavior == 42) {
    // 42: Pleurotus Oyster Fan (tightly packed parallel-radiating velvety mycelium)
    vec2 outRef = normalize(samplePos - u_simResolution * 0.5 + vec2(1e-4));
    float radialAlign = max(0.0, dot(dir, outRef)) * 0.24 * (1.0 - shapeSettle * 0.65);
    float sheet = pow(clamp(rawTrail, 0.0, 2.4), 1.22) * 0.56;
    trailSig = sheet + radialAlign - max(0.0, rawTrail - 1.35) * 0.45 * repelKeep;
  } else if (u_colonyBehavior == 43) {
    // 43: Botrytis Grape-like Spore Clusters (fine branching web bearing tight side-clusters)
    float branch = (rawTrail / (1.0 + rawTrail * 0.72)) * 0.54;
    float clusterPeak = exp(-pow((rawTrail - 0.52) / 0.20, 2.0)) * 0.52;
    trailSig = branch + clusterPeak - max(0.0, rawTrail - 1.08) * 0.80 * repelKeep;
  } else if (u_colonyBehavior == 44) {
    // 44: Coprinus Autolytic Ink Web (delicate spiderweb dissolving inward into outer rim droplets)
    float webThread = (rawTrail / (1.0 + rawTrail * 0.68)) * 0.66;
    float autoLyse = max(0.0, rawTrail - 0.84) * 1.12 * repelKeep;
    trailSig = webThread - autoLyse;
  } else if (u_colonyBehavior == 45) {
    // 45: Physarum 3D Plasmodium (thick sculpted arterial cords + ruffled fan + rear fruiting nodules)
    float veinCord = pow(clamp(rawTrail, 0.0, 2.6), 1.32) * 0.62;
    float lobeFan = exp(-pow((rawTrail - 0.34) / 0.18, 2.0)) * 0.42;
    float relief = max(0.0, rawTrail - 1.24) * 0.78 * repelKeep;
    trailSig = veinCord + lobeFan - relief;
  } else if (u_colonyBehavior == 46) {
    // 46: Aspergillus 3D Domes (radiating stalk bundles flaring into crowded circular conidial domes)
    float farDome = texture(u_trail, posToUv(wrapOrClamp(pos + dir * (probeDist * 1.8)))).r;
    float stalk3d = (rawTrail / (1.0 + rawTrail * 0.56)) * 0.64;
    float domeFlare = exp(-rawTrail * 3.1) * 0.36;
    trailSig = stalk3d + domeFlare + farDome * 0.16 - max(0.0, rawTrail - 1.20) * 0.65 * repelKeep;
  } else if (u_colonyBehavior == 47) {
    // 47: Hericium 3D Lion's Mane Coral (cascading snowy lobes & forked icicle spines)
    vec2 perp47 = vec2(-dir.y, dir.x);
    float sideL47 = texture(u_trail, posToUv(wrapOrClamp(pos + perp47 * (probeDist * 0.90)))).r;
    float sideR47 = texture(u_trail, posToUv(wrapOrClamp(pos - perp47 * (probeDist * 0.90)))).r;
    float spineBody = pow(clamp(rawTrail, 0.0, 2.4), 1.26) * 0.58;
    float tipDrop = exp(-rawTrail * 2.5) * 0.30;
    trailSig = spineBody + tipDrop - (sideL47 + sideR47) * 0.24 * repelKeep - max(0.0, rawTrail - 1.15) * 0.85 * repelKeep;
  } else if (u_colonyBehavior == 48) {
    // 48: Ramaria 3D Forked Coral (sculpted cylindrical antler branches)
    vec2 perp48 = vec2(-dir.y, dir.x);
    float side48 = texture(u_trail, posToUv(wrapOrClamp(pos + perp48 * (probeDist * 1.05)))).r
                 + texture(u_trail, posToUv(wrapOrClamp(pos - perp48 * (probeDist * 1.05)))).r;
    float branch48 = pow(clamp(rawTrail, 0.0, 2.4), 1.30) * 0.62;
    trailSig = branch48 + exp(-rawTrail * 2.8) * 0.28 - side48 * 0.28 * repelKeep - max(0.0, rawTrail - 1.05) * 0.95 * repelKeep;
  } else if (u_colonyBehavior == 49) {
    // 49: Morchella 3D Honeycomb Alveoli (deeply pitted honeycomb ridges)
    float ridgeWall = exp(-pow((rawTrail - 0.62) / 0.26, 2.0)) * 0.78;
    float pitHollow = smoothstep(0.92, 1.56, rawTrail) * 1.10 * repelKeep;
    trailSig = ridgeWall + (rawTrail / (1.0 + rawTrail * 0.60)) * 0.32 - pitHollow;
  } else if (u_colonyBehavior == 50) {
    // 50: Tremella 3D Jelly Folded Lobes (broad translucent brain-like folds)
    float lobeSheet = (rawTrail / (1.0 + rawTrail * 0.42)) * 0.74;
    float foldCrease = max(0.0, rawTrail - 1.38) * 0.62 * repelKeep;
    trailSig = lobeSheet - foldCrease;
  } else if (u_colonyBehavior == 51) {
    // 51: Ganoderma 3D Terraced Shelves (stepped concentric bracket arcs)
    float shelfArc = pow(clamp(rawTrail, 0.0, 2.4), 1.20) * 0.60;
    float grooveCut = max(0.0, rawTrail - 1.25) * 0.58 * repelKeep;
    trailSig = shelfArc - grooveCut;
  } else if (u_colonyBehavior == 52) {
    // 52: Phallus 3D Bridal Veil (open lacy polygons with thick clean 3D struts)
    float strut52 = exp(-pow((rawTrail - 0.50) / 0.20, 2.0)) * 0.74;
    float hole52 = smoothstep(0.86, 1.44, rawTrail) * 1.08 * repelKeep;
    trailSig = strut52 + pow(clamp(rawTrail, 0.0, 2.2), 1.28) * 0.24 - hole52;
  } else if (u_colonyBehavior == 53) {
    // 53: Mucor 3D Sporangia (radiating aerial stalks + terminal spherical spore pearls)
    float rayStalk = (rawTrail / (1.0 + rawTrail * 0.78)) * 0.48;
    float headKnot = exp(-pow((rawTrail - 0.38) / 0.16, 2.0)) * 0.44;
    trailSig = rayStalk + headKnot - max(0.0, rawTrail - 1.10) * 0.65 * repelKeep;
  } else if (u_colonyBehavior == 54) {
    // 54: Physarum 3D Sclerotium (heavy vascular cords crusted with dense 3D pebble mounds)
    vec2 midPos54 = wrapOrClamp(pos + dir * (probeDist * 1.9));
    float cluster54 = texture(u_trail, posToUv(midPos54)).g;
    float cord54 = pow(clamp(rawTrail, 0.0, 2.6), 1.40) * 0.64;
    trailSig = cord54 + cluster54 * 0.32 - max(0.0, rawTrail - 1.32) * 0.72 * repelKeep;
  } else {
    trailSig = rawTrail / (1.0 + rawTrail * 0.65);
  }

  float localTrail = trailSig * mix(1.0, 0.80, migrating);
  float val = localTrail + (substrate - 0.5) * u_randomness * 0.26;

  float minDim = max(1.0, min(u_simResolution.x, u_simResolution.y));
  vec2 centerVec = samplePos - u_simResolution * 0.5;
  float radialNorm = length(centerVec) / minDim;

  if (u_hasImage == 0) {
    if (u_growthModel == 3) {
      if (u_colonyBehavior == 21) {
        // Fruticose Lichen Cladonia antlers
        vec2 outDir = normalize(centerVec + vec2(1e-4));
        float antlerWave = 0.5 + 0.5 * sin(atan(centerVec.y, centerVec.x) * 14.0 + radialNorm * 18.0);
        val += max(0.0, dot(dir, outDir)) * 0.20 + antlerWave * 0.18 + radialNorm * 0.14;
      } else if (u_colonyBehavior == 41) {
        // Cordyceps Coiled Tendrils
        vec2 outDir = normalize(centerVec + vec2(1e-4));
        vec2 tangDir = vec2(-outDir.y, outDir.x);
        val += dot(dir, normalize(outDir * 0.62 + tangDir * 0.78)) * 0.26 + radialNorm * 0.14;
      } else {
        // Trichoderma Dichotomous Hyphal Forks
        vec2 outDir = normalize(centerVec + vec2(1e-4));
        float forkWave = 0.5 + 0.5 * cos(radialNorm * 26.0 + substrate * 5.5);
        val += max(0.0, dot(dir, outDir)) * 0.18 + forkWave * 0.16;
      }
    } else if (u_colonyBehavior == 2) {
      // Physarum Steiner Minimal Web: 7 discrete nutrient hubs forcing taut bridges
      float hubRot = rand01(u_baseSeed ^ 0x517cc1b7u) * 6.283185;
      float hubGlow = 0.0;
      for (int h = 0; h < 7; h++) {
        float fh = float(h);
        float a = hubRot + fh * (6.283185 / 7.0) + sin(fh * 2.3) * 0.18;
        float radH = (h == 6) ? 0.02 : (0.28 + 0.12 * cos(fh * 1.9));
        vec2 hubPos = u_simResolution * 0.5 + vec2(cos(a), sin(a)) * (minDim * radH);
        float dH = length(samplePos - hubPos) / max(1.0, 26.0 * u_simScale);
        hubGlow = max(hubGlow, exp(-dH * dH));
      }
      val += hubGlow * 0.58;
    } else if (u_colonyBehavior == 15) {
      float sporeZone = 0.5 + 0.5 * cos(radialNorm * 40.0);
      val += sporeZone * 0.22 + radialNorm * 0.10;
    } else if (u_colonyBehavior == 16) {
      vec2 outDir = normalize(centerVec + vec2(1e-4));
      val += max(0.0, dot(dir, outDir)) * 0.38 + radialNorm * 0.26;
    } else if (u_colonyBehavior == 17) {
      // Advancing ruffled fan lobes + gentle outward exploration
      float theta17 = atan(centerVec.y, centerVec.x);
      float lobe = 0.5 + 0.5 * sin(theta17 * 8.0 + valueNoise((samplePos / u_simScale) * 0.025 + seedShift) * 4.2);
      val += lobe * 0.20 + radialNorm * 0.14;
    } else if (u_colonyBehavior == 18) {
      float curl = sin((samplePos.x / u_simScale) * 0.032 + (samplePos.y / u_simScale) * 0.024 + seedShift.x) * 0.12;
      val += curl + radialNorm * 0.12;
    } else if (u_colonyBehavior == 22) {
      // Swirling mottled flocculent patches
      float clumpNoise = valueNoise((samplePos / u_simScale) * 0.035 + seedShift * 1.4);
      val += (clumpNoise - 0.5) * 0.34;
    } else if (u_colonyBehavior == 23) {
      // Central dense colonization hub surrounded by fine rectilinear outer lattice
      float centerCore = exp(-pow(radialNorm / 0.24, 2.0));
      val += centerCore * 0.18;
    } else if (u_colonyBehavior == 24) {
      // Expanding Fairy Ring fungal band
      float targetRing = mix(0.06, 0.46, u_colonyRamp);
      float ringBand = exp(-pow((radialNorm - targetRing) / 0.085, 2.0));
      val += ringBand * 0.48 + radialNorm * 0.10;
    } else if (u_colonyBehavior == 26) {
      // Organic crescent/discoid mycelial cloud with sandy halo
      float arc = 0.5 + 0.5 * sin(atan(centerVec.y, centerVec.x) * 2.0 + seedShift.x * 0.3);
      float haloRing = exp(-pow((radialNorm - 0.24) / 0.16, 2.0));
      val += haloRing * (0.20 + 0.16 * arc);
    } else if (u_colonyBehavior == 37) {
      // Aspergillus radial broom stalks
      vec2 outDir = normalize(centerVec + vec2(1e-4));
      float ray = 0.5 + 0.5 * cos(atan(centerVec.y, centerVec.x) * 22.0);
      val += max(0.0, dot(dir, outDir)) * 0.26 + ray * 0.14 + radialNorm * 0.12;
    } else if (u_colonyBehavior == 39) {
      // Fusarium helical crescent waves
      vec2 outDir = normalize(centerVec + vec2(1e-4));
      vec2 swirlDir = vec2(-outDir.y, outDir.x);
      val += dot(dir, swirlDir) * 0.18 + radialNorm * 0.10;
    } else if (u_colonyBehavior == 42) {
      // Pleurotus concentric oyster mycelium tide waves
      float tide = 0.5 + 0.5 * cos(radialNorm * 34.0);
      val += tide * 0.18 + radialNorm * 0.22;
    } else if (u_colonyBehavior == 44) {
      // Coprinus outer expanding autolytic ring
      val += radialNorm * 0.28;
    } else if (u_colonyBehavior == 45) {
      // Physarum 3D Plasmodium: ruffled multi-lobe wave + gentle outward foraging
      float theta45 = atan(centerVec.y, centerVec.x);
      float fanWave45 = 0.5 + 0.5 * sin(theta45 * 7.0 + valueNoise((samplePos / u_simScale) * 0.024 + seedShift) * 4.5);
      val += fanWave45 * 0.22 + radialNorm * 0.14;
    } else if (u_colonyBehavior == 46) {
      // Aspergillus 3D Domes: radial broom stalks into circular spore domes
      vec2 outDir46 = normalize(centerVec + vec2(1e-4));
      float ray46 = 0.5 + 0.5 * cos(atan(centerVec.y, centerVec.x) * 20.0);
      val += max(0.0, dot(dir, outDir46)) * 0.24 + ray46 * 0.16 + radialNorm * 0.12;
    } else if (u_colonyBehavior == 47) {
      // Hericium 3D Lion's Mane: cascading vertical icicle pull + tufted clusters
      vec2 cascadeDir = normalize(vec2((substrate - 0.5) * 0.6, 1.0));
      val += max(0.0, dot(dir, cascadeDir)) * 0.26 + radialNorm * 0.10;
    } else if (u_colonyBehavior == 48) {
      // Ramaria 3D Coral: forked outward branching wave
      vec2 outDir48 = normalize(centerVec + vec2(1e-4));
      float antler48 = 0.5 + 0.5 * sin(atan(centerVec.y, centerVec.x) * 12.0 + radialNorm * 16.0);
      val += max(0.0, dot(dir, outDir48)) * 0.22 + antler48 * 0.18 + radialNorm * 0.12;
    } else if (u_colonyBehavior == 50) {
      // Tremella 3D Jelly: undulating brain-fold contour waves
      float fold50 = sin((samplePos.x / u_simScale) * 0.045 + substrate * 4.0) * cos((samplePos.y / u_simScale) * 0.045 - substrate * 3.5);
      val += fold50 * 0.16;
    } else if (u_colonyBehavior == 51) {
      // Ganoderma 3D Terraced Shelves: concentric stepped shelf waves
      float shelf51 = 0.5 + 0.5 * cos(radialNorm * 36.0 + substrate * 2.4);
      val += shelf51 * 0.26 + radialNorm * 0.16;
    } else if (u_colonyBehavior == 53) {
      // Mucor 3D Sporangia: fast radial filaments
      vec2 outDir53 = normalize(centerVec + vec2(1e-4));
      val += max(0.0, dot(dir, outDir53)) * 0.34 + radialNorm * 0.22;
    }

    // Dynamic Growth Wave & Pulse Effects (re-introduced rhythmic chemotactic waves)
    if (u_growthWaveEffect > 0 && u_growthWaveIntensity > 0.01) {
      float wInt = clamp(u_growthWaveIntensity, 0.0, 1.0);
      float thetaW = atan(centerVec.y, centerVec.x);
      if (u_growthWaveEffect == 1) {
        // Radial Pulse Wave: expanding outward nutrient ring crests
        float crest = 0.5 + 0.5 * sin(radialNorm * 22.0 - u_simTime * 2.6);
        val += crest * 0.28 * wInt;
      } else if (u_growthWaveEffect == 2) {
        // Peristaltic Shuttle Wave: rhythmic back-and-forth cytoplasmic density pulsing
        float perist = 0.5 + 0.5 * sin(radialNorm * 16.0 - u_simTime * 3.2 + substrate * 2.0);
        val += (perist - 0.5) * 0.26 * wInt;
      } else if (u_growthWaveEffect == 3) {
        // Tidal Sporulation Rings: crisp concentric wave bands laying down zoned rings
        float rings = 0.5 + 0.5 * cos(radialNorm * 32.0 - u_simTime * 2.0);
        val += rings * 0.36 * wInt;
      } else if (u_growthWaveEffect == 4) {
        // Spiral Vortex Wave: rotating helical growth wavefront
        float spiral = 0.5 + 0.5 * sin(thetaW * 3.0 + radialNorm * 18.0 - u_simTime * 2.4);
        val += spiral * 0.32 * wInt;
      } else if (u_growthWaveEffect == 5) {
        // Heartbeat Surge: synchronized colony expansion pulses
        float beat = pow(max(0.0, sin(u_simTime * 3.0)), 4.0);
        val += beat * radialNorm * 0.30 * wInt;
      }
    }

    // Overcrowded colony relief + fresh agar nutrient exploration for non-random spawns
    float freshAgar = 1.0 - smoothstep(0.0, 0.16, rawTrail);
    float crowdPressure = smoothstep(0.32, 1.25, curTrail);
    float overCore = max(0.0, rawTrail - 1.10) * 0.42;
    val += freshAgar * crowdPressure * 0.46 - overCore * (u_spawnMode != 0 ? 1.0 : 0.22);

    vec2 outDirSpawn = normalize(centerVec + vec2(1e-4));
    if (u_spawnMode == 1) {
      val += freshAgar * (radialNorm * 0.34 + max(0.0, dot(dir, outDirSpawn)) * 0.16);
    } else if (u_spawnMode == 3) {
      val += freshAgar * (abs(radialNorm - 0.30) * 0.36);
    } else if (u_spawnMode == 4) {
      val += freshAgar * ((1.0 - radialNorm) * 0.46 + max(0.0, dot(dir, -outDirSpawn)) * 0.24);
    } else if (u_spawnMode == 5) {
      val += freshAgar * ((samplePos.y / u_simResolution.y) * 0.48 + max(0.0, dir.y) * 0.24);
    } else if (u_spawnMode == 6) {
      val += freshAgar * ((1.0 - samplePos.y / u_simResolution.y) * 0.48 + max(0.0, -dir.y) * 0.24);
    }

    if (u_boundaryMode == 0) {
      float edgeDist = min(
        min(samplePos.x, u_simResolution.x - samplePos.x),
        min(samplePos.y, u_simResolution.y - samplePos.y)
      );
      val -= smoothstep(7.0 * u_simScale, 0.5, edgeDist) * 0.90;
    }
  }

  if (u_hasImage == 1) {
    vec2 scentPos = wrapOrClamp(pos + dir * max(dist, 16.0 * u_simScale));
    vec2 scentUv = posToUv(scentPos);
    vec2 farScentPos = wrapOrClamp(pos + dir * max(dist * 3.6, 72.0 * u_simScale));
    vec2 farScentUv = posToUv(farScentPos);

    if (u_guideMode == 0) {
      float outsideWeight = max(1.0 - smoothstep(0.05, 0.28, curLum), migrating);
      float scentHalo = max(sampleGuide(scentUv).g, sampleGuide(farScentUv).g * 0.90);

      float pullRamp = u_imageEngage * mix(0.32, 1.0, effectiveRamp);
      float convergeBoost = 1.0 + 0.95 * smoothstep(0.20, 1.0, effectiveRamp);
      float activeStr = u_imageStrength * pullRamp * convergeBoost;
      float sharpFood = smoothstep(0.06, 0.72, guide.r);
      float gapPenalty = (1.0 - smoothstep(0.0, 0.22, guide.r)) * smoothstep(0.10, 0.42, curHalo) * 0.65 * smoothstep(0.25, 0.95, effectiveRamp) * (1.0 - migrating * 0.85);

      val += (
        scentHalo * outsideWeight * 1.18 +
        guide.g * 0.44 +
        sharpFood * 1.98 +
        guide.b * 0.60 -
        gapPenalty
      ) * activeStr;
    } else if (u_guideMode == 1) {
      val += (guide.r * 0.12) * u_imageStrength * u_imageEngage;
    } else if (u_guideMode == 2) {
      val += (smoothstep(0.18, 0.55, guide.r) * 0.9 + guide.b * 0.35) * u_imageStrength;
    }

    if (u_hasImage2 == 1 && u_morphBlend > 0.005) {
      vec2 midPos = wrapOrClamp(pos + dir * max(dist * 2.0, 24.0 * u_simScale));
      vec2 midUv = posToUv(midPos);
      vec4 g2Scent = texture(u_guide2, scentUv);
      vec4 g2Mid = texture(u_guide2, midUv);
      vec4 g2Probe = texture(u_guide2, uv);
      float morphRamp = smoothstep(0.0, 0.55, u_morphBlend);
      float morphPull = morphRamp * (0.85 + u_imageStrength * 0.72);
      float branchCorridor = 0.70 + 0.60 * valueNoise((samplePos / u_simScale) * 0.052 + seedShift * 1.7);
      float tipExtension = smoothstep(0.04, 0.35, curTrail) * (1.0 - smoothstep(0.55, 1.30, rawTrail));
      float openTarget = smoothstep(0.06, 0.60, g2Probe.r) * (1.0 - smoothstep(0.45, 1.25, rawTrail));
      val += (
        max(g2Scent.g, g2Mid.g * 0.92) * 1.15 * branchCorridor +
        g2Probe.g * 0.65 +
        smoothstep(0.05, 0.58, g2Probe.r) * (1.35 + 0.45 * morphRamp) +
        (openTarget + tipExtension * 0.45) * 0.90 +
        g2Probe.b * 0.52
      ) * morphPull;
    }
  }

  return val;
}

void main() {
  vec2 pos = a_agent.xy;
  float angle = a_agent.z;
  float agentTag = a_agent.w;

  if (agentTag < 0.0) {
    v_outAgent = vec4(pos, angle, -1.0);
    return;
  }

  uint id = uint(gl_VertexID);
  vec2 seedShift = vec2(
    rand01(u_baseSeed) * 100.0,
    rand01(u_baseSeed ^ 0x9e3779b9u) * 100.0
  );

  if (u_deathProgress > 0.001) {
    float patchNoise = valueNoise((pos / u_simScale) * 0.022 + seedShift);
    float rawTag = (agentTag >= 2.0) ? (agentTag - 2.0) : agentTag;
    float lifeLimit = clamp(mix(rawTag, patchNoise, 0.28), 0.0, 0.996);
    if (u_deathProgress >= 0.992 || u_deathProgress > lifeLimit) {
      v_outAgent = vec4(pos, angle, -1.0);
      return;
    }
  }

  float agentJitter = rand01(id * 374761393u + u_baseSeed);
  float speed = u_speed * mix(1.0, 0.58 + 0.78 * agentJitter, clamp(0.45 + u_randomness * 0.85, 0.0, 1.0));

  if (u_colonyBehavior == 2 || u_colonyBehavior == 17 || u_colonyBehavior == 45) {
    float radialD = length(pos - u_simResolution * 0.5) / max(1.0, u_simScale);
    float shuttleWave = 0.78 + 0.42 * sin(u_simTime * 2.8 - radialD * 0.065);
    speed *= shuttleWave;
  } else if (u_colonyBehavior == 16 || u_colonyBehavior == 53) {
    speed *= 1.32;
  } else if (u_colonyBehavior == 18) {
    float pulse = 0.85 + 0.42 * sin(u_simTime * 2.4 + pos.x * 0.04);
    speed *= pulse;
  } else if (u_colonyBehavior == 22 || u_colonyBehavior == 50) {
    speed *= 0.90;
  } else if (u_colonyBehavior == 38 || u_colonyBehavior == 40) {
    speed *= 1.18;
  }

  // Apply user-selected Growth Pulse / Wave Effect to hyphal velocity & spiral swirl
  vec2 waveRel = pos - u_simResolution * 0.5;
  float waveMinDim = max(1.0, min(u_simResolution.x, u_simResolution.y));
  float waveRNorm = length(waveRel) / waveMinDim;
  if (u_growthWaveEffect > 0 && u_growthWaveIntensity > 0.01) {
    float wInt = clamp(u_growthWaveIntensity, 0.0, 1.0);
    if (u_growthWaveEffect == 1) {
      // Radial Pulse: expanding outward speed wave crests
      float pulse1 = 0.5 + 0.5 * sin(u_simTime * 2.8 - waveRNorm * 20.0);
      speed *= mix(1.0, 0.48 + 1.05 * pulse1, wInt);
    } else if (u_growthWaveEffect == 2) {
      // Peristaltic: rhythmic shuttle surge + subtle phase oscillation
      float shuttle2 = 0.5 + 0.5 * sin(u_simTime * 3.4 - waveRNorm * 16.0);
      speed *= mix(1.0, 0.35 + 1.25 * shuttle2, wInt);
    } else if (u_growthWaveEffect == 3) {
      // Tidal Rings: rhythmic slowing at wave crests to deposit concentric rings
      float ring3 = 0.5 + 0.5 * cos(waveRNorm * 32.0 - u_simTime * 2.0);
      speed *= mix(1.0, 1.25 - 0.65 * ring3, wInt);
    } else if (u_growthWaveEffect == 4) {
      // Spiral Wave: helical wave accelerating & curving tips
      float theta4 = atan(waveRel.y, waveRel.x);
      float sp4 = sin(theta4 * 3.0 + waveRNorm * 18.0 - u_simTime * 2.4);
      speed *= mix(1.0, 0.72 + 0.68 * (0.5 + 0.5 * sp4), wInt);
      float curlLock = (u_hasImage == 0) ? 1.0 : 0.35;
      angle += sp4 * 0.038 * wInt * curlLock;
    } else if (u_growthWaveEffect == 5) {
      // Heartbeat Surge: sharp double-beat extension bursts followed by consolidation pauses
      float b1 = pow(max(0.0, sin(u_simTime * 3.0)), 4.0);
      float b2 = 0.45 * pow(max(0.0, sin(u_simTime * 3.0 - 0.85)), 6.0);
      float beat = clamp(b1 + b2, 0.0, 1.2);
      speed *= mix(1.0, 0.28 + 1.65 * beat, wInt);
    }
  }

  float r1 = rand01(id ^ u_stepSeed);
  float r2 = rand01((id * 747796405u) ^ (u_stepSeed * 2891336453u));
  float r3 = rand01((id * 2246822519u) ^ (u_stepSeed * 3266489917u));

  vec2 curUv = posToUv(pos);
  float curTrail = texture(u_trail, curUv).r;
  vec4 curGuide = (u_hasImage == 1) ? sampleGuide(curUv) : vec4(1.0);
  float curLum = curGuide.r;
  float curHalo = curGuide.g;
  float curLum2 = (u_hasImage == 1 && u_hasImage2 == 1) ? texture(u_guide2, curUv).r : curLum;

  if (u_colonyBehavior == 41) {
    float curlWeight = (u_hasImage == 0) ? 1.0 : (1.0 - smoothstep(0.08, 0.55, curLum));
    angle += 0.045 * curlWeight;
  }

  float gF, gL, gR;
  float wF = sense(pos, angle, u_sensorDist, curLum, curHalo, curLum2, curTrail, seedShift, gF);
  float wL = sense(pos, angle + u_sensorAngle, u_sensorDist, curLum, curHalo, curLum2, curTrail, seedShift, gL);
  float wR = sense(pos, angle - u_sensorAngle, u_sensorDist, curLum, curHalo, curLum2, curTrail, seedShift, gR);

  float edgeSteer = 0.0;
  float scentSteer = 0.0;
  float effRampMain = (u_hasImage2 == 1 && u_morphBlend > 0.01) ? max(u_colonyRamp, u_morphBlend) : u_colonyRamp;
  if (u_hasImage == 1 && u_guideMode != 1) {
    float gMax = max(gF, max(gL, gR));
    float gMin = min(gF, min(gL, gR));
    edgeSteer = smoothstep(0.05, 0.35, gMax - gMin) * mix(0.50 * u_imageEngage, 1.0, effRampMain);
    if (u_guideMode == 0) {
      scentSteer = (1.0 - smoothstep(0.02, 0.25, curLum)) * mix(0.50 * u_imageEngage, 1.0, effRampMain);
    }
  }
  float effTurnAngle = mix(u_turnAngle, max(u_turnAngle, 0.62), edgeSteer);
  effTurnAngle = max(effTurnAngle, mix(u_turnAngle, 0.48, scentSteer));

  bool isSporeScout = (u_colonyBehavior == 26 && (id & 3u) == 0u);
  float wanderScale = (u_colonyBehavior == 16)
    ? 0.04
    : (u_colonyBehavior == 23)
      ? mix(0.015, 0.26, smoothstep(0.28, 0.80, curTrail))
      : (u_colonyBehavior == 22 || isSporeScout)
        ? 0.42
        : (u_growthModel == 3 ? 0.07 : 0.2);
  float wander = (r3 - 0.5) * u_randomness * wanderScale;
  if (isSporeScout) {
    effTurnAngle *= 0.65;
  }

  if (wF > wL && wF > wR) {
    angle += wander * 0.25;
  } else if (wF < wL && wF < wR) {
    angle += (r1 < 0.5 ? 1.0 : -1.0) * effTurnAngle + wander;
  } else if (wL > wR) {
    angle += effTurnAngle + wander * 0.35;
  } else if (wR > wL) {
    angle -= effTurnAngle + wander * 0.35;
  }

  // Geometric mesh axis alignment (when not tightly locked inside image)
  if (u_hasImage == 0) {
    if (u_colonyBehavior == 23 && curTrail < 0.26) {
      float snap90 = floor(angle / 1.5707963 + 0.5) * 1.5707963;
      angle = mix(angle, snap90, 0.06);
    } else if (u_colonyBehavior == 27) {
      float snap60 = floor(angle / 1.0471975 + 0.5) * 1.0471975;
      angle = mix(angle, snap60, 0.045);
    } else if (u_colonyBehavior == 29) {
      float snap45 = floor((angle - 0.785398) / 1.5707963 + 0.5) * 1.5707963 + 0.785398;
      angle = mix(angle, snap45, 0.055);
    } else if (u_colonyBehavior == 35) {
      float snap120 = floor(angle / 2.0943951 + 0.5) * 2.0943951;
      angle = mix(angle, snap120, 0.05);
    }
  }

  if (u_hasImage == 1 && u_guideMode == 0) {
    float targetOutside = (u_hasImage2 == 1) ? 1.38 : 1.75;
    float outsideSpeed = mix(mix(1.0, 1.40, u_imageEngage), targetOutside, effRampMain);
    float overflowBoost = (curTrail > 1.05) ? 1.45 : 1.0;
    speed *= mix(outsideSpeed, mix(1.0, 0.68 * overflowBoost, u_imageEngage), curLum);
  }
  if (u_hasImage == 1 && u_hasImage2 == 1 && u_morphBlend > 0.01) {
    float leaveImg1 = smoothstep(0.05, 0.60, u_morphBlend) * (1.0 - smoothstep(0.05, 0.45, curLum2));
    speed *= mix(1.0, 1.18, leaveImg1);
  }

  vec2 dir = vec2(cos(angle), sin(angle));
  vec2 nextPos = pos + dir * speed;

  if (u_boundaryMode == 1) {
    nextPos = mod(nextPos + u_simResolution, u_simResolution);
  } else {
    bool hit = false;
    if (nextPos.x < 1.5 || nextPos.x >= u_simResolution.x - 1.5) {
      dir.x = -dir.x;
      nextPos.x = clamp(nextPos.x, 2.0, u_simResolution.x - 2.0);
      hit = true;
    }
    if (nextPos.y < 1.5 || nextPos.y >= u_simResolution.y - 1.5) {
      dir.y = -dir.y;
      nextPos.y = clamp(nextPos.y, 2.0, u_simResolution.y - 2.0);
      hit = true;
    }
    if (hit) {
      vec2 toCenter = u_simResolution * 0.5 - nextPos;
      float bounceA = atan(dir.y, dir.x);
      vec2 blended = mix(vec2(cos(bounceA), sin(bounceA)), normalize(toCenter + vec2(1e-4)), 0.32);
      angle = atan(blended.y, blended.x) + (r2 - 0.5) * 0.65;
    }
  }

  if (u_hasImage == 1 && u_guideMode == 2) {
    vec2 nextUv = posToUv(nextPos);
    vec4 nextGuide = sampleGuide(nextUv);
    if (nextGuide.r < 0.22) {
      vec2 texStep = vec2(2.0) / u_simResolution;
      float gL2 = sampleGuide(nextUv - vec2(texStep.x, 0.0)).g + sampleGuide(nextUv - vec2(texStep.x, 0.0)).r;
      float gR2 = sampleGuide(nextUv + vec2(texStep.x, 0.0)).g + sampleGuide(nextUv + vec2(texStep.x, 0.0)).r;
      float gD2 = sampleGuide(nextUv - vec2(0.0, texStep.y)).g + sampleGuide(nextUv - vec2(0.0, texStep.y)).r;
      float gU2 = sampleGuide(nextUv + vec2(0.0, texStep.y)).g + sampleGuide(nextUv + vec2(0.0, texStep.y)).r;
      vec2 inGrad = vec2(gR2 - gL2, gD2 - gU2);
      if (length(inGrad) > 1e-4) {
        angle = atan(inGrad.y, inGrad.x) + (r2 - 0.5) * 0.6;
      } else {
        angle += 3.14159 + (r2 - 0.5) * 0.8;
      }
      nextPos = pos;
    }
  }

  v_outAgent = vec4(nextPos, angle, agentTag);
}
`;

export const UPDATE_FS = `#version 300 es
precision highp float;
precision highp int;
void main() {
  discard;
}
`;

export const DEPOSIT_VS = `#version 300 es
precision highp float;
precision highp int;

layout(location = 0) in vec4 a_agent;
uniform sampler2D u_guide;
uniform sampler2D u_guide2;
uniform vec2 u_simResolution;
uniform int u_hasImage;
uniform int u_hasImage2;
uniform int u_guideMode;
uniform int u_growthModel;
uniform int u_colonyBehavior;
uniform int u_isSeedPass;
uniform float u_morphBlend;
uniform float u_pointSize;

out float v_keep;
out float v_seedVal;
out vec2 v_depositRG;

void main() {
  if (a_agent.w < 0.0) {
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
    gl_PointSize = 1.0;
    v_keep = 0.0;
    v_seedVal = 0.0;
    v_depositRG = vec2(0.0);
    return;
  }

  float ndcX = (a_agent.x / u_simResolution.x) * 2.0 - 1.0;
  float ndcY = 1.0 - (a_agent.y / u_simResolution.y) * 2.0;
  gl_Position = vec4(ndcX, ndcY, 0.0, 1.0);
  gl_PointSize = u_pointSize;
  v_seedVal = clamp(a_agent.w, 0.05, 1.0);
  v_depositRG = (u_colonyBehavior == 26 && (uint(gl_VertexID) & 3u) == 0u)
    ? vec2(0.18, 0.92)
    : vec2(1.0, 0.52);

  v_keep = 1.0;
  if (u_hasImage == 1 && u_guideMode == 2) {
    vec2 uv = vec2(a_agent.x / u_simResolution.x, 1.0 - a_agent.y / u_simResolution.y);
    vec4 g = texture(u_guide, uv);
    if (u_hasImage2 == 1 && u_morphBlend > 0.001) {
      vec4 g2 = texture(u_guide2, uv);
      if (u_morphBlend < 0.94) {
        g.r = max(
          g.r * (1.0 - smoothstep(0.25, 0.94, u_morphBlend)),
          g2.r * smoothstep(0.0, 0.40, u_morphBlend)
        );
      } else {
        g = g2;
      }
    }
    if (g.r < 0.22) {
      v_keep = 0.0;
    }
  }
}
`;

export const DEPOSIT_FS = `#version 300 es
precision highp float;
precision highp int;

in float v_keep;
in float v_seedVal;
in vec2 v_depositRG;
uniform float u_trailDeposit;
uniform int u_growthModel;

out vec4 outColor;

void main() {
  if (v_keep < 0.5) {
    discard;
  }
  if (u_growthModel == 5) {
    // Lichen Foliate: initial biomass field
    outColor = vec4(v_seedVal, 0.45, 0.0, 0.0);
  } else {
    outColor = vec4(u_trailDeposit * v_depositRG.x, u_trailDeposit * v_depositRG.y, 0.0, 0.0);
  }
}
`;

export const QUAD_VS = `#version 300 es
precision highp float;
precision highp int;

layout(location = 0) in vec2 a_pos;
out vec2 v_uv;

void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

export const DIFFUSE_FS = `#version 300 es
precision highp float;
precision highp int;

in vec2 v_uv;
uniform sampler2D u_trail;
uniform sampler2D u_guide;
uniform sampler2D u_guide2;
uniform vec2 u_texelSize;
uniform float u_decay;
uniform float u_diffusion;
uniform float u_colonyRamp;
uniform float u_imageEngage;
uniform float u_pruneRamp;
uniform float u_morphBlend;
uniform float u_deathProgress;
uniform int u_growthModel;
uniform int u_colonyBehavior;
uniform int u_growthWaveEffect;
uniform float u_growthWaveIntensity;
uniform float u_simTime;
uniform int u_hasImage;
uniform int u_hasImage2;
uniform int u_guideMode;
uniform vec2 u_seedOffset;

out vec4 outColor;

void main() {
  vec4 center = texture(u_trail, v_uv);

  vec4 guide = vec4(1.0);
  vec4 g2 = vec4(1.0);
  if (u_hasImage == 1) {
    guide = texture(u_guide, v_uv);
    if (u_hasImage2 == 1) {
      g2 = texture(u_guide2, v_uv);
      if (u_guideMode == 2 && u_morphBlend > 0.001 && u_morphBlend < 0.94) {
        guide.r = max(
          guide.r * (1.0 - smoothstep(0.25, 0.94, u_morphBlend)),
          g2.r * smoothstep(0.0, 0.35, u_morphBlend)
        );
      } else {
        guide = mix(guide, g2, clamp(u_morphBlend, 0.0, 1.0));
      }
    }
  }

  vec2 dx = vec2(u_texelSize.x, 0.0);
  vec2 dy = vec2(0.0, u_texelSize.y);

  float blurred = (
    center.r * 4.0 +
    texture(u_trail, v_uv - dx).r +
    texture(u_trail, v_uv + dx).r +
    texture(u_trail, v_uv - dy).r +
    texture(u_trail, v_uv + dy).r +
    texture(u_trail, v_uv - dx - dy).r * 0.5 +
    texture(u_trail, v_uv + dx - dy).r * 0.5 +
    texture(u_trail, v_uv - dx + dy).r * 0.5 +
    texture(u_trail, v_uv + dx + dy).r * 0.5
  ) / 10.0;

  float blurredG = (
    center.g * 4.0 +
    texture(u_trail, v_uv - dx).g +
    texture(u_trail, v_uv + dx).g +
    texture(u_trail, v_uv - dy).g +
    texture(u_trail, v_uv + dy).g
  ) / 8.0;

  float effDiffusion = (u_growthModel == 3)
    ? u_diffusion * 0.30
    : (u_colonyBehavior == 23 || u_colonyBehavior == 27 || u_colonyBehavior == 29 || u_colonyBehavior == 35 || u_colonyBehavior == 49 || u_colonyBehavior == 52)
      ? u_diffusion * 0.40
      : u_diffusion;
  float diffused = mix(center.r, blurred, effDiffusion);
  float localDecay = u_decay;
  if (u_growthWaveEffect == 3 && u_growthWaveIntensity > 0.01) {
    float rDist = length(v_uv - vec2(0.5));
    float ringPreserve = 0.5 + 0.5 * cos(rDist * 32.0 - u_simTime * 2.0);
    localDecay *= mix(1.0, 1.25 - 0.52 * ringPreserve, u_growthWaveIntensity);
  } else if (u_growthWaveEffect == 5 && u_growthWaveIntensity > 0.01) {
    float beatPause = 1.0 - clamp(pow(max(0.0, sin(u_simTime * 3.0)), 4.0), 0.0, 1.0);
    localDecay *= mix(1.0, 0.78 + 0.35 * (1.0 - beatPause), u_growthWaveIntensity);
  }
  float decayed = diffused * max(0.0, 1.0 - localDecay);

  if (u_growthModel == 3) {
    float sharpPow = (u_hasImage == 1 && u_guideMode == 0) ? 1.012 : 1.04;
    decayed = pow(max(0.0, decayed), sharpPow);
  }

  if (u_hasImage == 1) {
    if (u_guideMode == 0 || (u_hasImage2 == 1 && u_guideMode == 1 && u_morphBlend > 0.01)) {
      float g1Mask = smoothstep(0.05, 0.78, texture(u_guide, v_uv).r);
      float g2Mask = (u_hasImage2 == 1) ? smoothstep(0.05, 0.72, g2.r) : g1Mask;
      float bridgeMask = (u_hasImage2 == 1 && u_morphBlend > 0.01)
        ? max(g1Mask * (1.0 - smoothstep(0.32, 0.92, u_morphBlend)), g2Mask * smoothstep(0.0, 0.45, u_morphBlend))
        : smoothstep(0.05, 0.78, guide.r);
      float targetDecay = u_decay * mix(3.2, 0.68, bridgeMask);
      float ramp = (u_guideMode == 1)
        ? u_morphBlend
        : (u_hasImage2 == 1 ? 1.0 : clamp(u_pruneRamp, 0.0, 1.0));
      localDecay = mix(u_decay, targetDecay, ramp);
      decayed = diffused * max(0.0, 1.0 - localDecay);

      if (u_hasImage2 == 1 && u_morphBlend > 0.01) {
        decayed *= mix(1.0, 1.0 - 0.038 * smoothstep(0.35, 0.94, u_morphBlend), 1.0 - g2Mask);
      }

      float cap = mix(0.65, 1.85, bridgeMask);
      float capped = decayed / (1.0 + max(0.0, decayed - cap) * 0.38);
      decayed = mix(decayed, capped, ramp);
    } else if (u_guideMode == 2 && guide.r < 0.22) {
      decayed = 0.0;
    }
  }

  if (u_deathProgress > 0.001) {
    float minDeathDecay = u_deathProgress * 0.095;
    float deathFade = 1.0 - smoothstep(0.82, 1.0, u_deathProgress) * 0.18;
    decayed = decayed * max(0.0, 1.0 - max(0.0, minDeathDecay - localDecay)) * deathFade;
  }

  // Diffuse G wider than R so a persistent sandy spore mist stays softly under & around formed hyphae
  float sporeMix = clamp(effDiffusion * 1.35 + 0.22, 0.0, 0.90);
  float grainBase = mix(center.g, blurredG, sporeMix);
  float grainRate = (u_colonyBehavior == 22 || u_colonyBehavior == 26 || u_colonyBehavior == 43) ? 0.56 : 0.78;
  float haloMask = (u_hasImage == 1 && (u_guideMode == 0 || (u_hasImage2 == 1 && u_guideMode == 1 && u_morphBlend > 0.01)))
    ? max(smoothstep(0.05, 0.78, guide.r), guide.g * 0.75)
    : 1.0;
  float grainBaseDecay = (u_hasImage == 1 && u_guideMode == 0)
    ? mix(u_decay, u_decay * mix(1.85, 0.58, haloMask), clamp(u_pruneRamp, 0.0, 1.0))
    : u_decay;
  float grainDecay = min(0.65, grainBaseDecay * (grainRate + u_deathProgress * 1.25));
  float decayedGrain = (u_hasImage == 1 && u_guideMode == 2 && decayed == 0.0)
    ? 0.0
    : grainBase * max(0.0, 1.0 - grainDecay) * (1.0 - smoothstep(0.82, 1.0, u_deathProgress) * 0.25);
  decayedGrain = min(decayedGrain, 1.35);

  outColor = clamp(vec4(decayed, decayedGrain, 0.0, 0.0), 0.0, 6.0);
}
`;
