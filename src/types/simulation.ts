export type GrowthModel =
  | 'physarum'
  | 'canalization'
  | 'lichen_mosaic';

export type ColonyBehavior =
  | 'anastomose'
  | 'physarum_fan_lobe'
  | 'trabecular_lattice'
  | 'physarum_petri_plume'
  | 'fan'
  | 'flocculent_core'
  | 'sandy_spore_web'
  | 'mycorrhiza'
  | 'penicillium_zones'
  | 'sclerotia_clumps'
  | 'mucor_burst'
  | 'trichoderma_fork'
  | 'fairy_ring_hyphae'
  | 'lichen_foliate'
  | 'lichen_fruticose'
  | 'hex_honeycomb_mesh'
  | 'voronoi_web_mesh'
  | 'diagonal_diamond_mesh'
  | 'concentric_cobweb_mesh'
  | 'labyrinth_gyroid_mesh'
  | 'perforated_membrane_mesh'
  | 'braided_chord_mesh'
  | 'hierarchical_arterial_mesh'
  | 'fractal_tessellation_mesh'
  | 'sponge_trabeculae_mesh'
  | 'aspergillus_conidia'
  | 'rhizopus_stolons'
  | 'fusarium_plume'
  | 'neurospora_network'
  | 'cordyceps_tendrils'
  | 'pleurotus_oyster_fan'
  | 'botrytis_clusters'
  | 'coprinus_ink_web'
  | 'physarum_3d_plasmodium'
  | 'aspergillus_3d_domes'
  | 'hericium_3d_coral'
  | 'ramaria_3d_coral'
  | 'morel_3d_alveoli'
  | 'tremella_3d_jelly'
  | 'ganoderma_3d_shelf'
  | 'phallus_3d_veil'
  | 'mucor_3d_sporangia'
  | 'physarum_3d_sclerotium';

export type GrowthWaveEffect =
  | 'none'
  | 'radial_pulse'
  | 'peristaltic'
  | 'tidal_rings'
  | 'spiral_wave'
  | 'heartbeat_surge';

export type SpawnMode =
  | 'random'
  | 'center'
  | 'colonies'
  | 'ring'
  | 'edges'
  | 'top'
  | 'bottom';

export type ImageGuideMode = 'build_image' | 'emerge_from_image' | 'contain_mask';

export type ImageLoopMode = 'once' | 'cycle' | 'pingpong';

export type BoundaryMode = 'bounce' | 'wrap';

export interface SimulationResolution {
  label: string;
  width: number;
  height: number;
}

export const RESOLUTIONS: SimulationResolution[] = [
  { label: '512 × 512 (1:1 Normal)', width: 512, height: 512 },
  { label: '720 × 720 (1:1 HD)', width: 720, height: 720 },
  { label: '1080 × 1080 (1:1 Full HD)', width: 1080, height: 1080 },
  { label: '1440 × 1440 (1:1 2K)', width: 1440, height: 1440 },
];

export interface SimulationParams {
  growthModel: GrowthModel;
  colonyBehavior: ColonyBehavior;
  complexity: number; // 1 = Leve, 2 = Densa, 3 = Ultra, 4 = Extrema

  // Legacy Reaction-Diffusion tuning kept on state for compatibility
  gsFeed: number;
  gsKill: number;

  // Core Fungal Simulation Parameters
  seed: number;
  lockSeed: boolean;
  spawnMode: SpawnMode;
  boundaryMode: BoundaryMode;
  formationDurationSec: number; // 0 = Contínuo, > 0 = tempo total limite
  imageStartSec: number; // segundos após o início para começar a formar a imagem (0 = imediato)
  imageFormationMaxSec: number; // tempo máximo em segundos para formar cada imagem
  sporeDeathSec: number; // 0 = desligado, > 0 = segundos antes do fim para morte dos esporos
  particleCount: number;
  sensorAngle: number; // degrees
  turnAngle: number; // degrees
  sensorDistance: number; // px
  stepSpeed: number; // px per step
  evolutionSpeed: number; // 0.1 - 3.0 biological evolution rate (live & export)
  randomness: number; // 0.0 - 1.0 organic chaos
  decay: number; // 0.01 - 0.40
  trailDeposit: number; // 0.05 - 1.0
  diffusion: number; // 0.0 - 1.0
  grain: number; // 0.0 - 1.0 fine sandy grain + patchy variation
  sporeVisibility: number; // 0.0 - 1.0 cellular texture / 3D relief
  growthWaveEffect: GrowthWaveEffect;
  growthWaveIntensity: number; // 0.0 - 1.0 pulse / wave amplitude

  // Image B&W Reconstruction (Up to 3 Images + Loop Modes)
  hasImage: boolean;
  hasImage2: boolean;
  hasImage3: boolean;
  imageHoldSec: number; // segundos mantendo cada imagem formada antes de trocar
  imageLoopMode: ImageLoopMode;
  transitionStart: number; // mantido para compatibilidade
  imageGuideMode: ImageGuideMode;
  imageInvert: boolean;
  imageStrength: number;
  imageContrast: number;
  imageThreshold: number;
  imageFit: 'contain' | 'cover';
  imageOverlayOpacity: number;

  // Appearance & Resolution
  width: number;
  height: number;
  exposure: number;
  gamma: number;
  bgColor: string;
  primaryColor: string;
}

export const DEFAULT_PARAMS: SimulationParams = {
  growthModel: 'physarum',
  colonyBehavior: 'physarum_fan_lobe',
  complexity: 1,

  gsFeed: 0.0545,
  gsKill: 0.0620,

  seed: 32767,
  lockSeed: false,
  spawnMode: 'colonies',
  boundaryMode: 'bounce',
  formationDurationSec: 20,
  imageStartSec: 0,
  imageFormationMaxSec: 8,
  imageHoldSec: 1.5,
  imageLoopMode: 'once',
  sporeDeathSec: 5,
  particleCount: 90000,
  sensorAngle: 28.0,
  turnAngle: 22.0,
  sensorDistance: 12.0,
  stepSpeed: 1.32,
  evolutionSpeed: 1.0,
  randomness: 0.16,
  decay: 0.09,
  trailDeposit: 0.34,
  diffusion: 0.32,
  grain: 0.56,
  sporeVisibility: 0.72,
  growthWaveEffect: 'peristaltic',
  growthWaveIntensity: 0.60,

  hasImage: false,
  hasImage2: false,
  hasImage3: false,
  transitionStart: 0.50,
  imageGuideMode: 'build_image',
  imageInvert: false,
  imageStrength: 1.35,
  imageContrast: 1.8,
  imageThreshold: 120,
  imageFit: 'contain',
  imageOverlayOpacity: 0.0,

  width: 512,
  height: 512,
  exposure: 1.24,
  gamma: 1.22,
  bgColor: '#000000',
  primaryColor: '#ffffff',
};

export type PresetCategory =
  | 'sculpted_3d'
  | 'physarum_colony'
  | 'reticulum_mesh'
  | 'fungal_mycelium'
  | 'lichen_colony';

export interface PresetDefinition {
  id: string;
  name: string;
  category: PresetCategory;
  description: string;
  patch: Partial<SimulationParams>;
}

export const PRESETS: PresetDefinition[] = [
  // --- 0. FORMAÇÕES 3D (RELEVO VOLUMÉTRICO & MICROSCÓPICO) ---
  {
    id: 'physarum_3d_plasmodium',
    name: 'Physarum 3D (Plasmódio)',
    category: 'sculpted_3d',
    description: 'Veias tubulares em relevo 3D, leques aveludados na frente e nódulos de esporulação brilhantes no verso',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'physarum_3d_plasmodium',
      growthWaveEffect: 'peristaltic',
      growthWaveIntensity: 0.68,
      spawnMode: 'colonies',
      particleCount: 100000,
      sensorAngle: 28.0,
      turnAngle: 22.0,
      sensorDistance: 13.5,
      stepSpeed: 1.32,
      randomness: 0.16,
      decay: 0.085,
      trailDeposit: 0.38,
      diffusion: 0.34,
      grain: 0.58,
      sporeVisibility: 0.88,
      exposure: 1.24,
      gamma: 1.18,
    },
  },
  {
    id: 'aspergillus_3d_domes',
    name: 'Aspergillus 3D (Cúpulas)',
    category: 'sculpted_3d',
    description: 'Hastes radiais em relevo coroadas por cúpulas esféricas 3D de conídios com sombras de profundidade',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'aspergillus_3d_domes',
      growthWaveEffect: 'radial_pulse',
      growthWaveIntensity: 0.55,
      spawnMode: 'colonies',
      particleCount: 95000,
      sensorAngle: 20.0,
      turnAngle: 14.0,
      sensorDistance: 15.0,
      stepSpeed: 1.40,
      randomness: 0.14,
      decay: 0.09,
      trailDeposit: 0.36,
      diffusion: 0.24,
      grain: 0.66,
      sporeVisibility: 0.90,
      exposure: 1.24,
      gamma: 1.18,
    },
  },
  {
    id: 'hericium_3d_coral',
    name: 'Hericium 3D (Juba-de-Leão)',
    category: 'sculpted_3d',
    description: 'Espinhos pendentes e lóbulos brancos em cascata 3D com iluminação volumétrica suave',
    patch: {
      growthModel: 'canalization',
      colonyBehavior: 'hericium_3d_coral',
      growthWaveEffect: 'heartbeat_surge',
      growthWaveIntensity: 0.50,
      spawnMode: 'colonies',
      particleCount: 95000,
      sensorAngle: 26.0,
      turnAngle: 20.0,
      sensorDistance: 14.0,
      stepSpeed: 1.32,
      randomness: 0.16,
      decay: 0.09,
      trailDeposit: 0.38,
      diffusion: 0.22,
      grain: 0.50,
      sporeVisibility: 0.92,
      exposure: 1.26,
      gamma: 1.16,
    },
  },
  {
    id: 'ramaria_3d_coral',
    name: 'Ramaria 3D (Coral Fúngico)',
    category: 'sculpted_3d',
    description: 'Galhos cilíndricos bifurcados como corais esculpidos com brilho especular nas cristas',
    patch: {
      growthModel: 'canalization',
      colonyBehavior: 'ramaria_3d_coral',
      growthWaveEffect: 'radial_pulse',
      growthWaveIntensity: 0.48,
      spawnMode: 'center',
      particleCount: 90000,
      sensorAngle: 32.0,
      turnAngle: 24.0,
      sensorDistance: 15.0,
      stepSpeed: 1.38,
      randomness: 0.15,
      decay: 0.095,
      trailDeposit: 0.36,
      diffusion: 0.20,
      grain: 0.42,
      sporeVisibility: 0.90,
      exposure: 1.26,
      gamma: 1.16,
    },
  },
  {
    id: 'morel_3d_alveoli',
    name: 'Morchella 3D (Alvéolos)',
    category: 'sculpted_3d',
    description: 'Cristas sinuosas em colmeia profunda escavando alvéolos escuros e crateras em alto-relevo',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'morel_3d_alveoli',
      growthWaveEffect: 'none',
      growthWaveIntensity: 0.35,
      spawnMode: 'colonies',
      particleCount: 95000,
      sensorAngle: 40.0,
      turnAngle: 24.0,
      sensorDistance: 13.0,
      stepSpeed: 1.26,
      randomness: 0.16,
      decay: 0.095,
      trailDeposit: 0.38,
      diffusion: 0.28,
      grain: 0.48,
      sporeVisibility: 0.92,
      exposure: 1.24,
      gamma: 1.18,
    },
  },
  {
    id: 'tremella_3d_jelly',
    name: 'Tremella 3D (Gelatina)',
    category: 'sculpted_3d',
    description: 'Dobras translúcidas úmidas com brilho especular molhado e bordas gelatinosas luminosas',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'tremella_3d_jelly',
      growthWaveEffect: 'spiral_wave',
      growthWaveIntensity: 0.58,
      spawnMode: 'colonies',
      particleCount: 95000,
      sensorAngle: 36.0,
      turnAngle: 22.0,
      sensorDistance: 15.0,
      stepSpeed: 1.24,
      randomness: 0.20,
      decay: 0.075,
      trailDeposit: 0.40,
      diffusion: 0.46,
      grain: 0.36,
      sporeVisibility: 0.95,
      exposure: 1.22,
      gamma: 1.15,
    },
  },
  {
    id: 'ganoderma_3d_shelf',
    name: 'Ganoderma 3D (Prateleiras)',
    category: 'sculpted_3d',
    description: 'Terraços concêntricos em degraus 3D como fungos orelha-de-pau crescendo em anéis escalonados',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'ganoderma_3d_shelf',
      growthWaveEffect: 'tidal_rings',
      growthWaveIntensity: 0.72,
      spawnMode: 'center',
      particleCount: 95000,
      sensorAngle: 28.0,
      turnAngle: 18.0,
      sensorDistance: 14.0,
      stepSpeed: 1.30,
      randomness: 0.14,
      decay: 0.085,
      trailDeposit: 0.38,
      diffusion: 0.34,
      grain: 0.44,
      sporeVisibility: 0.90,
      exposure: 1.22,
      gamma: 1.18,
    },
  },
  {
    id: 'phallus_3d_veil',
    name: 'Phallus 3D (Véu Rendado)',
    category: 'sculpted_3d',
    description: 'Renda poligonal suspensa em arcos 3D elevados projetando cavidades profundas abaixo da malha',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'phallus_3d_veil',
      growthWaveEffect: 'radial_pulse',
      growthWaveIntensity: 0.45,
      spawnMode: 'ring',
      particleCount: 95000,
      sensorAngle: 38.0,
      turnAngle: 22.0,
      sensorDistance: 14.5,
      stepSpeed: 1.36,
      randomness: 0.12,
      decay: 0.095,
      trailDeposit: 0.38,
      diffusion: 0.22,
      grain: 0.38,
      sporeVisibility: 0.92,
      exposure: 1.26,
      gamma: 1.18,
    },
  },
  {
    id: 'mucor_3d_sporangia',
    name: 'Mucor 3D (Esporângios)',
    category: 'sculpted_3d',
    description: 'Fios aéreos radiantes pontilhados por pérolas esféricas 3D de esporângios brilhantes',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'mucor_3d_sporangia',
      growthWaveEffect: 'radial_pulse',
      growthWaveIntensity: 0.62,
      spawnMode: 'center',
      particleCount: 90000,
      sensorAngle: 14.0,
      turnAngle: 8.0,
      sensorDistance: 22.0,
      stepSpeed: 1.72,
      randomness: 0.06,
      decay: 0.09,
      trailDeposit: 0.34,
      diffusion: 0.14,
      grain: 0.56,
      sporeVisibility: 0.92,
      exposure: 1.24,
      gamma: 1.18,
    },
  },
  {
    id: 'physarum_3d_sclerotium',
    name: 'Physarum 3D (Esclerócio)',
    category: 'sculpted_3d',
    description: 'Cordões vasculares espessos incrustados de grânulos 3D densos e sulcos escuros profundos',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'physarum_3d_sclerotium',
      growthWaveEffect: 'peristaltic',
      growthWaveIntensity: 0.60,
      spawnMode: 'colonies',
      particleCount: 100000,
      sensorAngle: 34.0,
      turnAngle: 26.0,
      sensorDistance: 14.5,
      stepSpeed: 1.28,
      randomness: 0.20,
      decay: 0.085,
      trailDeposit: 0.42,
      diffusion: 0.32,
      grain: 0.72,
      sporeVisibility: 0.94,
      exposure: 1.24,
      gamma: 1.18,
    },
  },

  // --- 1. PHYSARUM & PLASMÓDIOS ---
  {
    id: 'physarum_fan_lobe',
    name: 'Leque & Contas (Physarum)',
    category: 'physarum_colony',
    description: 'Malha anastomosada espessa com bordas em leque estriado e contas peristálticas na cauda',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'physarum_fan_lobe',
      growthWaveEffect: 'peristaltic',
      growthWaveIntensity: 0.65,
      spawnMode: 'colonies',
      particleCount: 95000,
      sensorAngle: 28.0,
      turnAngle: 22.0,
      sensorDistance: 12.0,
      stepSpeed: 1.32,
      randomness: 0.16,
      decay: 0.09,
      trailDeposit: 0.34,
      diffusion: 0.32,
      grain: 0.56,
      sporeVisibility: 0.76,
      exposure: 1.24,
      gamma: 1.22,
    },
  },
  {
    id: 'physarum_trabecular',
    name: 'Retículo & Alvéolos',
    category: 'physarum_colony',
    description: 'Fios ortogonais ultrafinos que se fundem no centro em alvéolos orgânicos vazados',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'trabecular_lattice',
      spawnMode: 'random',
      particleCount: 95000,
      sensorAngle: 42.0,
      turnAngle: 16.0,
      sensorDistance: 10.0,
      stepSpeed: 1.28,
      randomness: 0.05,
      decay: 0.10,
      trailDeposit: 0.32,
      diffusion: 0.16,
      grain: 0.30,
      sporeVisibility: 0.42,
      exposure: 1.26,
      gamma: 1.24,
    },
  },
  {
    id: 'fine_mesh',
    name: 'Malha Capilar Fina',
    category: 'physarum_colony',
    description: 'Micro-rede delicada de hifas (1–2px) com anastomose fechada sem névoa',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'anastomose',
      spawnMode: 'random',
      particleCount: 85000,
      sensorAngle: 22.0,
      turnAngle: 14.0,
      sensorDistance: 6.0,
      stepSpeed: 1.05,
      randomness: 0.12,
      decay: 0.12,
      trailDeposit: 0.28,
      diffusion: 0.18,
      grain: 0.38,
      sporeVisibility: 0.46,
      exposure: 1.20,
      gamma: 1.26,
    },
  },
  {
    id: 'physarum_petri_plume',
    name: 'Pluma de Petri (Physarum)',
    category: 'physarum_colony',
    description: 'Veia central sinuosa explodindo em leques plumosos e bordas densas em placa',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'physarum_petri_plume',
      spawnMode: 'colonies',
      particleCount: 95000,
      sensorAngle: 26.0,
      turnAngle: 28.0,
      sensorDistance: 14.5,
      stepSpeed: 1.48,
      randomness: 0.14,
      decay: 0.095,
      trailDeposit: 0.38,
      diffusion: 0.26,
      grain: 0.52,
      sporeVisibility: 0.68,
      exposure: 1.26,
      gamma: 1.20,
    },
  },
  {
    id: 'physarum_steiner_web',
    name: 'Rede de Steiner Pulsante',
    category: 'physarum_colony',
    description: 'Pontes vasculares retesadas com fluxo citoplasmático pulsando entre focos',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'fan',
      growthWaveEffect: 'peristaltic',
      growthWaveIntensity: 0.78,
      spawnMode: 'ring',
      particleCount: 90000,
      sensorAngle: 24.0,
      turnAngle: 20.0,
      sensorDistance: 18.0,
      stepSpeed: 1.50,
      randomness: 0.10,
      decay: 0.075,
      trailDeposit: 0.38,
      diffusion: 0.42,
      grain: 0.38,
      sporeVisibility: 0.50,
      exposure: 1.20,
      gamma: 1.26,
    },
  },
  {
    id: 'rhizomorph_cords',
    name: 'Cordões Rizomorfos',
    category: 'physarum_colony',
    description: 'Troncos fúngicos espessos (Armillaria) separados por grandes vazios escuros',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'anastomose',
      spawnMode: 'edges',
      particleCount: 90000,
      sensorAngle: 16.0,
      turnAngle: 52.0,
      sensorDistance: 38.0,
      stepSpeed: 1.75,
      randomness: 0.08,
      decay: 0.045,
      trailDeposit: 0.48,
      diffusion: 0.58,
      grain: 0.35,
      sporeVisibility: 0.22,
      exposure: 1.08,
      gamma: 1.38,
    },
  },

  // --- 2. MALHAS & RETÍCULOS (10 VARIAÇÕES GEOMÉTRICAS E ORGÂNICAS) ---
  {
    id: 'hex_honeycomb_mesh',
    name: 'Malha Hexagonal (Favo)',
    category: 'reticulum_mesh',
    description: 'Células miceliais em favos hexagonais de 120° com paredes nítidas e miolos vazados',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'hex_honeycomb_mesh',
      spawnMode: 'random',
      particleCount: 95000,
      sensorAngle: 38.0,
      turnAngle: 18.0,
      sensorDistance: 11.0,
      stepSpeed: 1.24,
      randomness: 0.08,
      decay: 0.10,
      trailDeposit: 0.34,
      diffusion: 0.18,
      grain: 0.32,
      sporeVisibility: 0.45,
      exposure: 1.24,
      gamma: 1.24,
    },
  },
  {
    id: 'voronoi_web_mesh',
    name: 'Retículo de Voronoi',
    category: 'reticulum_mesh',
    description: 'Câmaras poligonais irregulares divididas por septos finos e junções nodais luminosas',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'voronoi_web_mesh',
      spawnMode: 'random',
      particleCount: 95000,
      sensorAngle: 44.0,
      turnAngle: 22.0,
      sensorDistance: 13.0,
      stepSpeed: 1.30,
      randomness: 0.12,
      decay: 0.11,
      trailDeposit: 0.34,
      diffusion: 0.22,
      grain: 0.35,
      sporeVisibility: 0.50,
      exposure: 1.26,
      gamma: 1.22,
    },
  },
  {
    id: 'diagonal_diamond_mesh',
    name: 'Trama Losangular 45°',
    category: 'reticulum_mesh',
    description: 'Filamentos cruzados em treliça diagonal (45°/135°) formando tecido losangular tenso',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'diagonal_diamond_mesh',
      spawnMode: 'random',
      particleCount: 90000,
      sensorAngle: 40.0,
      turnAngle: 16.0,
      sensorDistance: 10.5,
      stepSpeed: 1.32,
      randomness: 0.06,
      decay: 0.10,
      trailDeposit: 0.32,
      diffusion: 0.16,
      grain: 0.30,
      sporeVisibility: 0.42,
      exposure: 1.24,
      gamma: 1.24,
    },
  },
  {
    id: 'concentric_cobweb_mesh',
    name: 'Teia Orbital Concêntrica',
    category: 'reticulum_mesh',
    description: 'Raios miceliais ligados por anéis orbitais concêntricos em padrão de teia radial',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'concentric_cobweb_mesh',
      spawnMode: 'center',
      particleCount: 95000,
      sensorAngle: 28.0,
      turnAngle: 15.0,
      sensorDistance: 11.5,
      stepSpeed: 1.34,
      randomness: 0.10,
      decay: 0.095,
      trailDeposit: 0.34,
      diffusion: 0.20,
      grain: 0.36,
      sporeVisibility: 0.52,
      exposure: 1.24,
      gamma: 1.22,
    },
  },
  {
    id: 'labyrinth_gyroid_mesh',
    name: 'Retículo Labiríntico',
    category: 'reticulum_mesh',
    description: 'Dobra sinuosa contínua em meandros fúngicos intercalados por canais escuros',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'labyrinth_gyroid_mesh',
      spawnMode: 'colonies',
      particleCount: 95000,
      sensorAngle: 46.0,
      turnAngle: 26.0,
      sensorDistance: 12.5,
      stepSpeed: 1.26,
      randomness: 0.14,
      decay: 0.105,
      trailDeposit: 0.35,
      diffusion: 0.28,
      grain: 0.34,
      sporeVisibility: 0.48,
      exposure: 1.26,
      gamma: 1.22,
    },
  },
  {
    id: 'perforated_membrane_mesh',
    name: 'Membrana Fenestrada',
    category: 'reticulum_mesh',
    description: 'Lâmina micelial contínua perfurada por poros ovais nítidos com bordas luminosas',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'perforated_membrane_mesh',
      spawnMode: 'colonies',
      particleCount: 95000,
      sensorAngle: 34.0,
      turnAngle: 20.0,
      sensorDistance: 13.5,
      stepSpeed: 1.28,
      randomness: 0.16,
      decay: 0.085,
      trailDeposit: 0.36,
      diffusion: 0.34,
      grain: 0.44,
      sporeVisibility: 0.62,
      exposure: 1.22,
      gamma: 1.24,
    },
  },
  {
    id: 'braided_chord_mesh',
    name: 'Cordões Trançados',
    category: 'reticulum_mesh',
    description: 'Feixes duplos helicoidais trançados por pontes transversais finas entre cabos fúngicos',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'braided_chord_mesh',
      spawnMode: 'ring',
      particleCount: 95000,
      sensorAngle: 22.0,
      turnAngle: 24.0,
      sensorDistance: 16.0,
      stepSpeed: 1.44,
      randomness: 0.12,
      decay: 0.08,
      trailDeposit: 0.38,
      diffusion: 0.24,
      grain: 0.36,
      sporeVisibility: 0.48,
      exposure: 1.22,
      gamma: 1.26,
    },
  },
  {
    id: 'hierarchical_arterial_mesh',
    name: 'Retículo Hierárquico',
    category: 'reticulum_mesh',
    description: 'Artérias principais espessas alimentando uma micro-malha capilar secundária finíssima',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'hierarchical_arterial_mesh',
      spawnMode: 'edges',
      particleCount: 95000,
      sensorAngle: 24.0,
      turnAngle: 20.0,
      sensorDistance: 15.0,
      stepSpeed: 1.42,
      randomness: 0.14,
      decay: 0.085,
      trailDeposit: 0.36,
      diffusion: 0.22,
      grain: 0.40,
      sporeVisibility: 0.56,
      exposure: 1.24,
      gamma: 1.22,
    },
  },
  {
    id: 'fractal_tessellation_mesh',
    name: 'Malha Triangular 60°',
    category: 'reticulum_mesh',
    description: 'Tessela geodésica em três eixos de 60°/120° com vértices fúngicos entrecruzados',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'fractal_tessellation_mesh',
      spawnMode: 'random',
      particleCount: 90000,
      sensorAngle: 32.0,
      turnAngle: 16.0,
      sensorDistance: 10.0,
      stepSpeed: 1.28,
      randomness: 0.06,
      decay: 0.105,
      trailDeposit: 0.32,
      diffusion: 0.16,
      grain: 0.28,
      sporeVisibility: 0.42,
      exposure: 1.26,
      gamma: 1.24,
    },
  },
  {
    id: 'sponge_trabeculae_mesh',
    name: 'Esponja Trabecular 3D',
    category: 'reticulum_mesh',
    description: 'Malha trabecular densa com relevo direcional esculpido em cavernas e vigas fúngicas',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'sponge_trabeculae_mesh',
      spawnMode: 'colonies',
      particleCount: 95000,
      sensorAngle: 38.0,
      turnAngle: 24.0,
      sensorDistance: 14.0,
      stepSpeed: 1.30,
      randomness: 0.18,
      decay: 0.09,
      trailDeposit: 0.38,
      diffusion: 0.30,
      grain: 0.45,
      sporeVisibility: 0.85,
      exposure: 1.22,
      gamma: 1.20,
    },
  },

  // --- 2. FUNGOS FILAMENTOSOS & BOLORES ---
  {
    id: 'sandy_spore_web',
    name: 'Areia de Esporos & Veias',
    category: 'fungal_mycelium',
    description: 'Veias miceliais curvas e brilhantes emergindo sobre um leito granuloso persistente de areia e esporos',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'sandy_spore_web',
      spawnMode: 'colonies',
      particleCount: 95000,
      sensorAngle: 30.0,
      turnAngle: 23.0,
      sensorDistance: 13.0,
      stepSpeed: 1.28,
      randomness: 0.24,
      decay: 0.085,
      trailDeposit: 0.35,
      diffusion: 0.36,
      grain: 0.88,
      sporeVisibility: 0.86,
      exposure: 1.24,
      gamma: 1.20,
    },
  },
  {
    id: 'flocculent_core',
    name: 'Micélio Flocoso & Veias',
    category: 'fungal_mycelium',
    description: 'Nuvens algodonosas granuladas de esporos atravessadas por veias brancas internas',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'flocculent_core',
      spawnMode: 'colonies',
      particleCount: 95000,
      sensorAngle: 34.0,
      turnAngle: 24.0,
      sensorDistance: 15.0,
      stepSpeed: 1.25,
      randomness: 0.36,
      decay: 0.075,
      trailDeposit: 0.36,
      diffusion: 0.54,
      grain: 0.85,
      sporeVisibility: 0.88,
      exposure: 1.26,
      gamma: 1.18,
    },
  },
  {
    id: 'mycorrhiza_web',
    name: 'Micorriza Multiescala',
    category: 'fungal_mycelium',
    description: 'Hifas primárias espessas conectando nuvens de micro-hifas exploratórias de longo alcance',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'mycorrhiza',
      spawnMode: 'colonies',
      particleCount: 90000,
      sensorAngle: 25.0,
      turnAngle: 18.0,
      sensorDistance: 16.0,
      stepSpeed: 1.34,
      randomness: 0.18,
      decay: 0.09,
      trailDeposit: 0.34,
      diffusion: 0.28,
      grain: 0.48,
      sporeVisibility: 0.62,
      exposure: 1.22,
      gamma: 1.22,
    },
  },
  {
    id: 'penicillium_mold',
    name: 'Bolor Penicillium (Zonas)',
    category: 'fungal_mycelium',
    description: 'Colônia radial em ágar com anéis concêntricos de esporulação e halo de conídios',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'penicillium_zones',
      growthWaveEffect: 'tidal_rings',
      growthWaveIntensity: 0.70,
      spawnMode: 'colonies',
      particleCount: 85000,
      sensorAngle: 36.0,
      turnAngle: 20.0,
      sensorDistance: 12.0,
      stepSpeed: 1.25,
      randomness: 0.24,
      decay: 0.08,
      trailDeposit: 0.34,
      diffusion: 0.66,
      grain: 0.65,
      sporeVisibility: 0.72,
      exposure: 1.22,
      gamma: 1.20,
    },
  },
  {
    id: 'sclerotia_knots',
    name: 'Escleródios & Grumos',
    category: 'fungal_mycelium',
    description: 'Nódulos fúngicos perolados condensados por agregação com pontes ultrafinas',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'sclerotia_clumps',
      spawnMode: 'random',
      particleCount: 85000,
      sensorAngle: 56.0,
      turnAngle: 48.0,
      sensorDistance: 20.0,
      stepSpeed: 1.35,
      randomness: 0.16,
      decay: 0.18,
      trailDeposit: 0.42,
      diffusion: 0.32,
      grain: 0.55,
      sporeVisibility: 0.60,
      exposure: 1.26,
      gamma: 1.30,
    },
  },
  {
    id: 'mucor_whiskers',
    name: 'Filamentos Mucor',
    category: 'fungal_mycelium',
    description: 'Hifas retilíneas velozes disparando em explosão radial sem laços curvos',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'mucor_burst',
      spawnMode: 'center',
      particleCount: 80000,
      sensorAngle: 10.0,
      turnAngle: 3.5,
      sensorDistance: 26.0,
      stepSpeed: 1.95,
      randomness: 0.02,
      decay: 0.09,
      trailDeposit: 0.30,
      diffusion: 0.08,
      grain: 0.36,
      sporeVisibility: 0.44,
      exposure: 1.22,
      gamma: 1.24,
    },
  },
  {
    id: 'trichoderma_tufts',
    name: 'Tufos Trichoderma (Ramos)',
    category: 'fungal_mycelium',
    description: 'Ramificação hifal dicotômica nítida com pontas luminosas de conidióforos',
    patch: {
      growthModel: 'canalization',
      colonyBehavior: 'trichoderma_fork',
      spawnMode: 'colonies',
      particleCount: 90000,
      sensorAngle: 30.0,
      turnAngle: 22.0,
      sensorDistance: 14.0,
      stepSpeed: 1.36,
      randomness: 0.18,
      decay: 0.095,
      trailDeposit: 0.36,
      diffusion: 0.18,
      grain: 0.40,
      sporeVisibility: 0.68,
      exposure: 1.26,
      gamma: 1.18,
    },
  },
  {
    id: 'fairy_ring_fungus',
    name: 'Anel de Fadas (Hifas)',
    category: 'fungal_mycelium',
    description: 'Frente micelial circular em expansão contínua deixando o miolo esgotado para trás',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'fairy_ring_hyphae',
      growthWaveEffect: 'radial_pulse',
      growthWaveIntensity: 0.72,
      spawnMode: 'center',
      particleCount: 90000,
      sensorAngle: 32.0,
      turnAngle: 20.0,
      sensorDistance: 13.0,
      stepSpeed: 1.35,
      randomness: 0.20,
      decay: 0.11,
      trailDeposit: 0.34,
      diffusion: 0.28,
      grain: 0.48,
      sporeVisibility: 0.62,
      exposure: 1.24,
      gamma: 1.20,
    },
  },
  {
    id: 'aspergillus_conidia',
    name: 'Aspergillus (Conidióforos)',
    category: 'fungal_mycelium',
    description: 'Tapete central denso irradiando hastes rígidas com cabeças esféricas de conídios pontilhados',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'aspergillus_conidia',
      spawnMode: 'colonies',
      particleCount: 90000,
      sensorAngle: 18.0,
      turnAngle: 12.0,
      sensorDistance: 16.0,
      stepSpeed: 1.44,
      randomness: 0.14,
      decay: 0.095,
      trailDeposit: 0.34,
      diffusion: 0.20,
      grain: 0.68,
      sporeVisibility: 0.72,
      exposure: 1.20,
      gamma: 1.24,
    },
  },
  {
    id: 'rhizopus_stolons',
    name: 'Rhizopus (Estolões & Rizoides)',
    category: 'fungal_mycelium',
    description: 'Arcos aéreos longos conectando tufos ancorados em rosetas de rizoides escuros',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'rhizopus_stolons',
      spawnMode: 'colonies',
      particleCount: 85000,
      sensorAngle: 22.0,
      turnAngle: 30.0,
      sensorDistance: 24.0,
      stepSpeed: 1.68,
      randomness: 0.15,
      decay: 0.08,
      trailDeposit: 0.36,
      diffusion: 0.26,
      grain: 0.42,
      sporeVisibility: 0.56,
      exposure: 1.18,
      gamma: 1.26,
    },
  },
  {
    id: 'fusarium_plume',
    name: 'Fusarium (Pluma Sinuosa)',
    category: 'fungal_mycelium',
    description: 'Fitas sedosas espiraladas varrendo o ágar em leques ondulantes com bordas plumosas',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'fusarium_plume',
      growthWaveEffect: 'spiral_wave',
      growthWaveIntensity: 0.65,
      spawnMode: 'colonies',
      particleCount: 90000,
      sensorAngle: 30.0,
      turnAngle: 18.0,
      sensorDistance: 13.5,
      stepSpeed: 1.38,
      randomness: 0.22,
      decay: 0.09,
      trailDeposit: 0.34,
      diffusion: 0.34,
      grain: 0.54,
      sporeVisibility: 0.64,
      exposure: 1.18,
      gamma: 1.22,
    },
  },
  {
    id: 'neurospora_network',
    name: 'Neurospora (Hifas Septadas)',
    category: 'fungal_mycelium',
    description: 'Malha veloz de hifas septadas com nós transversais luminosos ao longo dos filamentos',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'neurospora_network',
      spawnMode: 'edges',
      particleCount: 90000,
      sensorAngle: 24.0,
      turnAngle: 18.0,
      sensorDistance: 15.0,
      stepSpeed: 1.56,
      randomness: 0.12,
      decay: 0.085,
      trailDeposit: 0.35,
      diffusion: 0.20,
      grain: 0.38,
      sporeVisibility: 0.60,
      exposure: 1.20,
      gamma: 1.24,
    },
  },
  {
    id: 'cordyceps_tendrils',
    name: 'Cordyceps (Tentáculos Espirais)',
    category: 'fungal_mycelium',
    description: 'Gavinhas fúngicas retorcidas que espiralam ao redor dos focos dividindo-se em pontas finas',
    patch: {
      growthModel: 'canalization',
      colonyBehavior: 'cordyceps_tendrils',
      spawnMode: 'colonies',
      particleCount: 85000,
      sensorAngle: 28.0,
      turnAngle: 24.0,
      sensorDistance: 14.5,
      stepSpeed: 1.40,
      randomness: 0.18,
      decay: 0.09,
      trailDeposit: 0.36,
      diffusion: 0.18,
      grain: 0.44,
      sporeVisibility: 0.68,
      exposure: 1.22,
      gamma: 1.22,
    },
  },
  {
    id: 'pleurotus_oyster_fan',
    name: 'Pleurotus (Micélio em Leque)',
    category: 'fungal_mycelium',
    description: 'Leques aveludados de hifas paralelas em expansão concêntrica como micélio em placa de ágar',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'pleurotus_oyster_fan',
      spawnMode: 'center',
      particleCount: 95000,
      sensorAngle: 16.0,
      turnAngle: 10.0,
      sensorDistance: 16.0,
      stepSpeed: 1.46,
      randomness: 0.10,
      decay: 0.08,
      trailDeposit: 0.33,
      diffusion: 0.24,
      grain: 0.50,
      sporeVisibility: 0.58,
      exposure: 1.16,
      gamma: 1.26,
    },
  },
  {
    id: 'botrytis_clusters',
    name: 'Botrytis (Cachos de Esporos)',
    category: 'fungal_mycelium',
    description: 'Rede acinzentada delicada coberta por cachos densos de esporos microscópicos ao longo dos ramos',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'botrytis_clusters',
      spawnMode: 'random',
      particleCount: 90000,
      sensorAngle: 40.0,
      turnAngle: 28.0,
      sensorDistance: 13.0,
      stepSpeed: 1.22,
      randomness: 0.28,
      decay: 0.10,
      trailDeposit: 0.32,
      diffusion: 0.30,
      grain: 0.74,
      sporeVisibility: 0.76,
      exposure: 1.18,
      gamma: 1.24,
    },
  },
  {
    id: 'coprinus_ink_web',
    name: 'Coprinus (Teia & Gotículas)',
    category: 'fungal_mycelium',
    description: 'Teia micelial efêmera que se autolisa do centro em gotículas brilhantes na borda',
    patch: {
      growthModel: 'physarum',
      colonyBehavior: 'coprinus_ink_web',
      spawnMode: 'center',
      particleCount: 85000,
      sensorAngle: 34.0,
      turnAngle: 22.0,
      sensorDistance: 14.0,
      stepSpeed: 1.38,
      randomness: 0.16,
      decay: 0.115,
      trailDeposit: 0.34,
      diffusion: 0.22,
      grain: 0.52,
      sporeVisibility: 0.66,
      exposure: 1.20,
      gamma: 1.24,
    },
  },

  // --- 3. LÍQUENS ---
  {
    id: 'lichen_foliate_dynamic',
    name: 'Líquen Folioso (Lobos)',
    category: 'lichen_colony',
    description: 'Crescimento diferencial com flambagem de bordas e lobos foliáceos ondulados',
    patch: {
      growthModel: 'lichen_mosaic',
      colonyBehavior: 'lichen_foliate',
      spawnMode: 'colonies',
      randomness: 0.34,
      grain: 0.55,
      sporeVisibility: 0.78,
      exposure: 1.26,
      gamma: 1.12,
    },
  },
  {
    id: 'lichen_fruticose_shrub',
    name: 'Líquen Fruticoso (Cladonia)',
    category: 'lichen_colony',
    description: 'Talo arbustivo ramificado com pontas luminosas de apotécios fúngicos',
    patch: {
      growthModel: 'canalization',
      colonyBehavior: 'lichen_fruticose',
      spawnMode: 'colonies',
      particleCount: 90000,
      sensorAngle: 36.0,
      turnAngle: 26.0,
      sensorDistance: 14.0,
      stepSpeed: 1.34,
      randomness: 0.22,
      decay: 0.10,
      trailDeposit: 0.36,
      diffusion: 0.20,
      grain: 0.55,
      sporeVisibility: 0.76,
      exposure: 1.26,
      gamma: 1.16,
    },
  },
];

export interface ColorPalettePreset {
  id: string;
  name: string;
  bgColor: string;
  primaryColor: string;
}

export const COLOR_PALETTES: ColorPalettePreset[] = [
  {
    id: 'classic_bw',
    name: 'Clássico P&B',
    bgColor: '#000000',
    primaryColor: '#ffffff',
  },
  {
    id: 'agar_amber',
    name: 'Placa Physarum',
    bgColor: '#12140f',
    primaryColor: '#facc15',
  },
  {
    id: 'bioluminescent',
    name: 'Bioluminescente',
    bgColor: '#04080d',
    primaryColor: '#67e8f9',
  },
  {
    id: 'microscopy_light',
    name: 'Microscopia Clara',
    bgColor: '#f1f5f9',
    primaryColor: '#0f172a',
  },
];
