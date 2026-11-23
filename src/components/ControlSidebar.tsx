import React, { useRef, useState } from 'react';
import { Dices, Image as ImageIcon, RefreshCw, RotateCcw, Trash2, Upload } from 'lucide-react';
import { SampleTemplateId } from '../engine/imageProcessor';
import { computeSimulationTimeline } from '../engine/timeline';
import {
  BoundaryMode,
  COLOR_PALETTES,
  ColonyBehavior,
  GrowthModel,
  GrowthWaveEffect,
  ImageGuideMode,
  ImageLoopMode,
  PRESETS,
  PresetCategory,
  PresetDefinition,
  RESOLUTIONS,
  SimulationParams,
  SpawnMode,
} from '../types/simulation';
import { SliderControl } from './SliderControl';

export type SidebarTab = 'fungus' | 'image' | 'appearance';

interface ControlSidebarProps {
  params: SimulationParams;
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  activePresetId: string | null;
  speedMultiplier: number;
  onSpeedChange: (mult: number) => void;
  onUpdateParam: <K extends keyof SimulationParams>(key: K, value: SimulationParams[K]) => void;
  onSelectPreset: (preset: PresetDefinition) => void;
  onResetSimulation: () => void;
  onResetAllControls: () => void;
  onUploadImageFile: (file: File) => void;
  onLoadSampleTemplate: (id: SampleTemplateId) => void;
  onClearImage: () => void;
  imagePreviewUrl: string | null;
  imageName: string | null;
  onUploadImage2File: (file: File) => void;
  onLoadSampleTemplate2: (id: SampleTemplateId) => void;
  onClearImage2: () => void;
  image2PreviewUrl: string | null;
  image2Name: string | null;
  onUploadImage3File: (file: File) => void;
  onLoadSampleTemplate3: (id: SampleTemplateId) => void;
  onClearImage3: () => void;
  image3PreviewUrl: string | null;
  image3Name: string | null;
}

const SPAWN_OPTIONS: Array<{ value: SpawnMode; label: string; fullWidth?: boolean }> = [
  { value: 'random', label: 'Aleatório' },
  { value: 'center', label: 'Centro' },
  { value: 'ring', label: 'Anel' },
  { value: 'edges', label: 'Bordas' },
  { value: 'top', label: 'Cima' },
  { value: 'bottom', label: 'Baixo' },
  { value: 'colonies', label: 'Múltiplos Focos (Placa de Ágar)', fullWidth: true },
];

const FORMATION_DURATIONS = [
  { value: 2, label: '2s' },
  { value: 4, label: '4s' },
  { value: 6, label: '6s' },
  { value: 10, label: '10s' },
  { value: 15, label: '15s' },
  { value: 20, label: '20s' },
  { value: 30, label: '30s' },
  { value: 60, label: '60s' },
  { value: 120, label: '120s' },
  { value: 0, label: 'Contínuo' },
];

const SPORE_DEATH_OPTIONS = [
  { value: 0, label: 'Desl.' },
  { value: 2, label: '2s' },
  { value: 5, label: '5s' },
  { value: 8, label: '8s' },
  { value: 10, label: '10s' },
];

const IMAGE_FORMATION_MAX_OPTIONS = [1, 2, 4, 8, 12];
const IMAGE_START_OPTIONS = [0, 1, 2, 3, 5];
const IMAGE_HOLD_OPTIONS = [0, 1, 2, 3, 5];

const LOOP_MODE_OPTIONS: Array<{ value: ImageLoopMode; label: string; desc: string }> = [
  { value: 'once', label: 'Sequência Única', desc: 'Percorre as imagens 1 vez' },
  { value: 'cycle', label: 'Loop Circular', desc: '1 → 2 → 3 → 1 → 2...' },
  { value: 'pingpong', label: 'Vai-e-Volta', desc: '1 → 2 → 3 → 2 → 1...' },
];

const EVOLUTION_SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.5, 2];
const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4];

const WAVE_EFFECT_OPTIONS: Array<{ value: GrowthWaveEffect; label: string; desc: string }> = [
  { value: 'none', label: 'Contínuo', desc: 'Crescimento uniforme sem pulsos rítmicos' },
  { value: 'radial_pulse', label: 'Pulso Radial', desc: 'Ondas circulares expandindo do centro para fora' },
  { value: 'peristaltic', label: 'Peristáltico', desc: 'Fluxo citoplasmático vai-e-vem pulsando nas veias' },
  { value: 'tidal_rings', label: 'Anéis de Maré', desc: 'Ondas concêntricas que criam anéis de esporulação' },
  { value: 'spiral_wave', label: 'Onda Espiral', desc: 'Frente de onda espiralada girando sobre a placa' },
  { value: 'heartbeat_surge', label: 'Pulso Cardíaco', desc: 'Surtos rítmicos duplos de expansão rápida e pausa' },
];

const COMPLEXITY_OPTIONS = [
  { value: 1, label: '1× Leve', desc: 'Rápida ao vivo' },
  { value: 2, label: '2× Densa', desc: 'Mais subpassos' },
  { value: 3, label: '3× Ultra', desc: 'Malha fina HD' },
  { value: 4, label: '4× Extrema', desc: 'Precisão máxima' },
];

export const ControlSidebar: React.FC<ControlSidebarProps> = ({
  params,
  activeTab,
  onTabChange,
  activePresetId,
  speedMultiplier,
  onSpeedChange,
  onUpdateParam,
  onSelectPreset,
  onResetSimulation,
  onResetAllControls,
  onUploadImageFile,
  onLoadSampleTemplate,
  onClearImage,
  imagePreviewUrl,
  imageName,
  onUploadImage2File,
  onLoadSampleTemplate2,
  onClearImage2,
  image2PreviewUrl,
  image2Name,
  onUploadImage3File,
  onLoadSampleTemplate3,
  onClearImage3,
  image3PreviewUrl,
  image3Name,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInput2Ref = useRef<HTMLInputElement>(null);
  const fileInput3Ref = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDragging2, setIsDragging2] = useState(false);
  const [isDragging3, setIsDragging3] = useState(false);

  const tabs: Array<{ id: SidebarTab; label: string }> = [
    { id: 'fungus', label: 'Simulação' },
    { id: 'image', label: 'Imagem P&B' },
    { id: 'appearance', label: 'Aparência' },
  ];

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onUploadImageFile(file);
    }
  };

  const handleDrop2 = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging2(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onUploadImage2File(file);
    }
  };

  const handleDrop3 = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging3(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onUploadImage3File(file);
    }
  };

  const tl = computeSimulationTimeline(params);
  const maxDeathSec =
    params.formationDurationSec > 0 ? Math.max(1, Math.round(params.formationDurationSec * 0.8)) : 15;
  const effectiveDeathSec = tl.effectiveDeathSec;
  const deathStartSec = tl.deathStartSec;

  const isPdeModel = params.growthModel === 'lichen_mosaic';

  return (
    <aside className="w-full lg:w-[360px] shrink-0 bg-[#0B0F17] border-b lg:border-b-0 lg:border-r border-slate-800/90 flex flex-col max-h-[55vh] lg:max-h-none lg:h-full">
      {/* Segmented Navigation Tabs */}
      <div className="p-3 border-b border-slate-800/80 shrink-0">
        <div className="grid grid-cols-3 gap-1 p-1 bg-[#07090E] border border-slate-800/80 rounded-md">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={`py-1.5 px-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap truncate cursor-pointer ${
                  active
                    ? 'bg-slate-800 text-cyan-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable Parameter Body */}
      <div className="flex-1 overflow-y-auto studio-scroll p-4 space-y-5">
        {activeTab === 'fungus' && (
          <>
            <div className="space-y-3">
              <label className="block text-xs font-medium text-slate-300">
                Espécies de Fungos, Micélios, Physarum & Líquens
              </label>
              {(
                [
                  { cat: 'sculpted_3d', title: 'Formações 3D (Relevo Volumétrico)' },
                  { cat: 'physarum_colony', title: 'Physarum & Plasmódios (Redes Vasculares)' },
                  { cat: 'reticulum_mesh', title: 'Malhas & Retículos (10 Variações)' },
                  { cat: 'fungal_mycelium', title: 'Fungos Filamentosos & Bolores' },
                  { cat: 'lichen_colony', title: 'Líquens (Folioso & Fruticoso)' },
                ] as Array<{ cat: PresetCategory; title: string }>
              ).map((group) => {
                const items = PRESETS.filter((p) => p.category === group.cat);
                return (
                  <div key={group.cat} className="space-y-1.5">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">
                      {group.title}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {items.map((preset) => {
                        const selected = activePresetId === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => onSelectPreset(preset)}
                            title={preset.description}
                            className={`text-left px-2.5 py-2 rounded border text-xs transition-colors cursor-pointer ${
                              selected
                                ? 'bg-cyan-950/40 border-cyan-500/70 text-cyan-200'
                                : 'bg-[#0F141F] border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <div className="font-medium truncate">{preset.name}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {activePresetId && (
                <p className="text-[11px] text-slate-400 leading-snug pt-0.5">
                  {PRESETS.find((p) => p.id === activePresetId)?.description}
                </p>
              )}

              <div className="pt-2 border-t border-slate-800/70 space-y-2">
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-400">
                    Modelo Matemático (Motor)
                  </label>
                  <select
                    value={params.growthModel}
                    onChange={(e) =>
                      onUpdateParam('growthModel', e.target.value as GrowthModel)
                    }
                    className="w-full px-2.5 py-1.5 text-xs bg-[#0F141F] border border-slate-800 rounded text-slate-200 outline-none focus:border-cyan-500"
                  >
                    <option value="physarum">Physarum & Micélio em Rede (Quimiotaxia)</option>
                    <option value="canalization">Ramificação Hifal Dicotômica (Canalização)</option>
                    <option value="lichen_mosaic">Líquen Folioso (Crescimento Diferencial)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-400">
                    Dinâmica Biológica / Tropismo
                  </label>
                  <select
                    value={params.colonyBehavior}
                    onChange={(e) =>
                      onUpdateParam('colonyBehavior', e.target.value as ColonyBehavior)
                    }
                    className="w-full px-2.5 py-1.5 text-xs bg-[#0F141F] border border-slate-800 rounded text-slate-200 outline-none focus:border-cyan-500"
                  >
                    <option value="physarum_fan_lobe">Physarum: Leque Lobado & Contas (Frente Ondulada)</option>
                    <option value="anastomose">Anastomose Micelial (Rede de Veias e Laços)</option>
                    <option value="trabecular_lattice">Retículo Ortogonal & Alvéolos Trabeculares</option>
                    <option value="physarum_petri_plume">Physarum: Pluma de Petri (Veias Sinuosas)</option>
                    <option value="fan">Physarum: Fluxo Peristáltico (Steiner)</option>
                    <option value="sandy_spore_web">Areia de Esporos & Veias (Fundo Granulado)</option>
                    <option value="flocculent_core">Micélio Flocoso & Veias Internas</option>
                    <option value="mycorrhiza">Teia Multiescala (Micorriza)</option>
                    <option value="penicillium_zones">Bolor Penicillium (Zonas de Esporos)</option>
                    <option value="sclerotia_clumps">Escleródios & Grumos Fúngicos</option>
                    <option value="mucor_burst">Filamentos Mucor (Explosão Radial)</option>
                    <option value="trichoderma_fork">Hifas Trichoderma (Ramificação Dicotômica)</option>
                    <option value="fairy_ring_hyphae">Anel de Fadas Micelial (Hifas Centrífugas)</option>
                    <option value="lichen_foliate">Líquen Folioso Dinâmico (Lobos Vivos)</option>
                    <option value="lichen_fruticose">Líquen Fruticoso (Arbusto & Apotécios)</option>
                    <option value="hex_honeycomb_mesh">Malha: Hexagonal (Favo)</option>
                    <option value="voronoi_web_mesh">Malha: Retículo de Voronoi</option>
                    <option value="diagonal_diamond_mesh">Malha: Trama Losangular 45°</option>
                    <option value="concentric_cobweb_mesh">Malha: Teia Orbital Concêntrica</option>
                    <option value="labyrinth_gyroid_mesh">Malha: Retículo Labiríntico</option>
                    <option value="perforated_membrane_mesh">Malha: Membrana Fenestrada</option>
                    <option value="braided_chord_mesh">Malha: Cordões Trançados</option>
                    <option value="hierarchical_arterial_mesh">Malha: Retículo Hierárquico</option>
                    <option value="fractal_tessellation_mesh">Malha: Triangular 60°</option>
                    <option value="sponge_trabeculae_mesh">Malha: Esponja Trabecular 3D</option>
                    <option value="aspergillus_conidia">Fungo: Aspergillus (Conidióforos)</option>
                    <option value="rhizopus_stolons">Fungo: Rhizopus (Estolões &amp; Rizoides)</option>
                    <option value="fusarium_plume">Fungo: Fusarium (Pluma Sinuosa)</option>
                    <option value="neurospora_network">Fungo: Neurospora (Hifas Septadas)</option>
                    <option value="cordyceps_tendrils">Fungo: Cordyceps (Tentáculos Espirais)</option>
                    <option value="pleurotus_oyster_fan">Fungo: Pleurotus (Micélio em Leque)</option>
                    <option value="botrytis_clusters">Fungo: Botrytis (Cachos de Esporos)</option>
                    <option value="coprinus_ink_web">Fungo: Coprinus (Teia &amp; Gotículas)</option>
                    <option value="physarum_3d_plasmodium">3D: Physarum (Plasmódio em Relevo)</option>
                    <option value="aspergillus_3d_domes">3D: Aspergillus (Cúpulas de Conídios)</option>
                    <option value="hericium_3d_coral">3D: Hericium (Juba-de-Leão / Coral)</option>
                    <option value="ramaria_3d_coral">3D: Ramaria (Corais Ramificados)</option>
                    <option value="morel_3d_alveoli">3D: Morchella (Alvéolos Profundos)</option>
                    <option value="tremella_3d_jelly">3D: Tremella (Lóbos Gelatinosos)</option>
                    <option value="ganoderma_3d_shelf">3D: Ganoderma (Prateleiras Terradas)</option>
                    <option value="phallus_3d_veil">3D: Phallus (Véu Rendado)</option>
                    <option value="mucor_3d_sporangia">3D: Mucor (Esporângios Esféricos)</option>
                    <option value="physarum_3d_sclerotium">3D: Physarum (Veias &amp; Esclerócio)</option>
                  </select>
                </div>

                <div className="pt-2 border-t border-slate-800/70 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-medium text-slate-300">
                      Efeitos de Crescimento (Pulsos &amp; Ondas)
                    </label>
                    <span className="font-mono tabular-nums text-cyan-300 text-[11px]">
                      {WAVE_EFFECT_OPTIONS.find((w) => w.value === params.growthWaveEffect)?.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {WAVE_EFFECT_OPTIONS.map((opt) => {
                      const active = params.growthWaveEffect === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => onUpdateParam('growthWaveEffect', opt.value)}
                          title={opt.desc}
                          className={`py-1.5 px-1 text-[11px] font-medium rounded border transition-colors cursor-pointer truncate ${
                            active
                              ? 'bg-cyan-950/40 border-cyan-500/70 text-cyan-200'
                              : 'bg-[#0F141F] border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  {params.growthWaveEffect !== 'none' && (
                    <SliderControl
                      label="Intensidade dos Pulsos / Ondas"
                      value={params.growthWaveIntensity}
                      min={0.0}
                      max={1.0}
                      step={0.05}
                      decimals={2}
                      onChange={(v) => onUpdateParam('growthWaveIntensity', v)}
                    />
                  )}
                  <p className="text-[11px] text-slate-500 leading-snug">
                    {WAVE_EFFECT_OPTIONS.find((w) => w.value === params.growthWaveEffect)?.desc}
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/80 space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-medium text-slate-300">
                    Complexidade da Simulação
                  </label>
                  <span className="font-mono tabular-nums text-cyan-300">
                    {params.complexity}×
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {COMPLEXITY_OPTIONS.map((opt) => {
                    const active = params.complexity === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => onUpdateParam('complexity', opt.value)}
                        title={opt.desc}
                        className={`py-1.5 px-1 text-[11px] font-mono rounded border transition-colors cursor-pointer whitespace-nowrap ${
                          active
                            ? 'bg-cyan-950/40 border-cyan-500/70 text-cyan-200'
                            : 'bg-[#0F141F] border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Multiplica densidade, subpassos e resolução interna. Pode reduzir o FPS ao vivo, mas o vídeo renderiza quadro a quadro sem perdas.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-medium text-slate-300">
                    Velocidade da Simulação (Evolução)
                  </label>
                  <span className="font-mono tabular-nums text-cyan-300">
                    {params.evolutionSpeed.toFixed(2)}×
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-1">
                  {EVOLUTION_SPEED_OPTIONS.map((evo) => {
                    const active = Math.abs(params.evolutionSpeed - evo) < 0.02;
                    return (
                      <button
                        key={evo}
                        type="button"
                        onClick={() => onUpdateParam('evolutionSpeed', evo)}
                        className={`py-1.5 text-[11px] font-mono rounded border transition-colors cursor-pointer ${
                          active
                            ? 'bg-cyan-950/40 border-cyan-500/70 text-cyan-200'
                            : 'bg-[#0F141F] border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        {evo}×
                      </button>
                    );
                  })}
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={2.5}
                  step={0.05}
                  value={params.evolutionSpeed}
                  onChange={(e) => onUpdateParam('evolutionSpeed', Number(e.target.value))}
                  className="w-full studio-slider"
                />
                <p className="text-[11px] text-slate-500 leading-snug">
                  Controla o ritmo real de crescimento do fungo (ao vivo e no vídeo renderizado).
                </p>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-medium text-slate-300">
                    Velocidade da Reprodução (Player)
                  </label>
                  <span className="font-mono tabular-nums text-cyan-300">
                    {speedMultiplier}× ({Math.round(24 * speedMultiplier)} q/s)
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {SPEED_OPTIONS.map((mult) => {
                    const active = speedMultiplier === mult;
                    return (
                      <button
                        key={mult}
                        type="button"
                        onClick={() => onSpeedChange(mult)}
                        className={`py-1.5 text-[11px] font-mono rounded border transition-colors cursor-pointer ${
                          active
                            ? 'bg-cyan-950/40 border-cyan-500/70 text-cyan-200'
                            : 'bg-[#0F141F] border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        {mult}×
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2 pt-1 border-t border-slate-800/80">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-medium text-slate-300">
                    Limite de Tempo da Simulação
                  </label>
                  <span className="font-mono tabular-nums text-cyan-300">
                    {params.formationDurationSec === 0
                      ? 'Contínuo'
                      : `${params.formationDurationSec}s`}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {FORMATION_DURATIONS.map((opt) => {
                    const active = params.formationDurationSec === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => onUpdateParam('formationDurationSec', opt.value)}
                        className={`py-1.5 text-[11px] font-mono rounded border transition-colors cursor-pointer ${
                          active
                            ? 'bg-cyan-950/40 border-cyan-500/70 text-cyan-200'
                            : 'bg-[#0F141F] border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {params.formationDurationSec > 0 && (
                  <div className="space-y-2 pt-0.5">
                    <input
                      type="range"
                      min={0.5}
                      max={Math.max(120, Math.ceil(params.formationDurationSec))}
                      step={0.5}
                      value={params.formationDurationSec}
                      onChange={(e) =>
                        onUpdateParam('formationDurationSec', Number(e.target.value))
                      }
                      className="w-full studio-slider"
                    />
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                      <span>Tempo personalizado (qualquer duração):</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0.5}
                          step={0.5}
                          value={params.formationDurationSec}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (Number.isFinite(val) && val >= 0.5) {
                              onUpdateParam('formationDurationSec', val);
                            }
                          }}
                          className="w-20 px-2 py-1 text-xs font-mono tabular-nums text-right bg-[#0F141F] border border-slate-800 rounded text-cyan-300 outline-none focus:border-cyan-500"
                        />
                        <span className="font-mono text-slate-400">s</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-800/70 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-medium text-slate-300">
                      Formação por Imagem
                    </label>
                    <span className="font-mono tabular-nums text-cyan-300">
                      {tl.hasAnyImage
                        ? `${tl.formSec.toFixed(1)}s`
                        : `${params.imageFormationMaxSec}s`}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {IMAGE_FORMATION_MAX_OPTIONS.map((sec) => {
                      const active = params.imageFormationMaxSec === sec;
                      return (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => onUpdateParam('imageFormationMaxSec', sec)}
                          className={`py-1.5 text-[11px] font-mono rounded border transition-colors cursor-pointer ${
                            active
                              ? 'bg-cyan-950/40 border-cyan-500/70 text-cyan-200'
                              : 'bg-[#0F141F] border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          {sec}s
                        </button>
                      );
                    })}
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={Math.max(30, Math.ceil(params.imageFormationMaxSec))}
                    step={0.5}
                    value={params.imageFormationMaxSec}
                    onChange={(e) =>
                      onUpdateParam('imageFormationMaxSec', Number(e.target.value))
                    }
                    className="w-full studio-slider"
                  />
                  <div className="pt-2 border-t border-slate-800/70 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-medium text-slate-300">
                        Começar a Formar Imagem em
                      </label>
                      <span className="font-mono tabular-nums text-cyan-300">
                        {params.imageStartSec === 0
                          ? '0s (Imediato)'
                          : tl.hasAnyImage && Math.abs(tl.introSec - params.imageStartSec) > 0.1
                          ? `${tl.introSec.toFixed(1)}s`
                          : `${params.imageStartSec}s`}
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {IMAGE_START_OPTIONS.map((sec) => {
                        const active = params.imageStartSec === sec;
                        return (
                          <button
                            key={`start-sim-${sec}`}
                            type="button"
                            onClick={() => onUpdateParam('imageStartSec', sec)}
                            className={`py-1.5 text-[11px] font-mono rounded border transition-colors cursor-pointer ${
                              active
                                ? 'bg-cyan-950/40 border-cyan-500/70 text-cyan-200'
                                : 'bg-[#0F141F] border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            {sec}s
                          </button>
                        );
                      })}
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={0.5}
                      value={Math.min(10, params.imageStartSec)}
                      onChange={(e) =>
                        onUpdateParam('imageStartSec', Number(e.target.value))
                      }
                      className="w-full studio-slider"
                    />
                    <p className="text-[11px] text-slate-500 leading-snug">
                      {params.imageStartSec === 0
                        ? `Atrai para a imagem desde 0s em ~${tl.formSec.toFixed(1)}s.`
                        : `Cresce livre até ${tl.introSec.toFixed(1)}s e inicia a atração suave até ~${tl.img1EndSec.toFixed(1)}s.`}
                    </p>
                  </div>
                </div>

                {params.formationDurationSec > 0 && (
                  <div className="pt-2 border-t border-slate-800/70 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-medium text-slate-300">
                        Morte dos Esporos (antes do fim)
                      </label>
                      <span className="font-mono tabular-nums text-cyan-300">
                        {effectiveDeathSec === 0 ? 'Desl.' : `${effectiveDeathSec.toFixed(1)}s`}
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {SPORE_DEATH_OPTIONS.map((opt) => {
                        const active = params.sporeDeathSec === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => onUpdateParam('sporeDeathSec', opt.value)}
                            className={`py-1.5 text-[11px] font-mono rounded border transition-colors cursor-pointer ${
                              active
                                ? 'bg-cyan-950/40 border-cyan-500/70 text-cyan-200'
                                : 'bg-[#0F141F] border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={maxDeathSec}
                      step={1}
                      value={Math.min(params.sporeDeathSec, maxDeathSec)}
                      onChange={(e) =>
                        onUpdateParam('sporeDeathSec', Number(e.target.value))
                      }
                      className="w-full studio-slider"
                    />
                    <p className="text-[11px] text-slate-500 leading-snug">
                      {effectiveDeathSec > 0
                        ? `Os esporos morrem aos ${deathStartSec.toFixed(1)}s — sempre após completar as imagens.`
                        : 'Esporos permanecem vivos até o término da simulação.'}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-medium text-slate-300">
                  Origem do Crescimento
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {SPAWN_OPTIONS.map((opt) => {
                    const active = params.spawnMode === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => onUpdateParam('spawnMode', opt.value)}
                        className={`py-1.5 px-2 text-xs font-medium rounded border transition-colors cursor-pointer ${
                          opt.fullWidth ? 'col-span-3' : ''
                        } ${
                          active
                            ? 'bg-cyan-950/40 border-cyan-500/70 text-cyan-200'
                            : 'bg-[#0F141F] border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-300">
                    Bordas
                  </label>
                  <select
                    value={params.boundaryMode}
                    onChange={(e) =>
                      onUpdateParam('boundaryMode', e.target.value as BoundaryMode)
                    }
                    className="w-full px-2.5 py-1.5 text-xs bg-[#0F141F] border border-slate-800 rounded text-slate-200 outline-none focus:border-cyan-500"
                  >
                    <option value="bounce">Rebater</option>
                    <option value="wrap">Contínua</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-300">
                    Semente
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={params.seed}
                      onChange={(e) =>
                        onUpdateParam('seed', Math.max(1, parseInt(e.target.value, 10) || 1))
                      }
                      className="w-full px-2 py-1.5 text-xs font-mono tabular-nums bg-[#0F141F] border border-slate-800 rounded text-slate-200 outline-none focus:border-cyan-500"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateParam('seed', Math.floor(Math.random() * 999999) + 1)
                      }
                      title="Sortear nova semente"
                      className="p-1.5 text-cyan-400 bg-[#0F141F] border border-slate-800 hover:border-slate-600 rounded transition-colors cursor-pointer shrink-0"
                    >
                      <Dices className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={params.lockSeed}
                  onChange={(e) => onUpdateParam('lockSeed', e.target.checked)}
                  className="w-3.5 h-3.5 accent-cyan-400"
                />
                <span>Travar semente ao reiniciar (repetir padrão)</span>
              </label>
            </div>

            <div className="pt-3 border-t border-slate-800/80 space-y-4">
              {isPdeModel ? (
                <>
                  <SliderControl
                    label="Relevo 3D / Membrana"
                    value={params.sporeVisibility}
                    min={0.0}
                    max={1.0}
                    step={0.05}
                    decimals={2}
                    onChange={(v) => onUpdateParam('sporeVisibility', v)}
                  />
                  <SliderControl
                    label="Aleatoriedade Orgânica"
                    value={params.randomness}
                    min={0.0}
                    max={1.0}
                    step={0.02}
                    decimals={2}
                    onChange={(v) => onUpdateParam('randomness', v)}
                  />
                  <SliderControl
                    label="Areia de Esporos / Granulação"
                    value={params.grain}
                    min={0.0}
                    max={1.0}
                    step={0.02}
                    decimals={2}
                    onChange={(v) => onUpdateParam('grain', v)}
                  />
                </>
              ) : (
                <>
                  <SliderControl
                    label="Contagem de Esporos (Areia)"
                    value={params.particleCount}
                    min={10000}
                    max={300000}
                    step={5000}
                    decimals={0}
                    onChange={(v) => onUpdateParam('particleCount', v)}
                  />
                  <SliderControl
                    label="Textura Celular / Esporos"
                    value={params.sporeVisibility}
                    min={0.0}
                    max={1.0}
                    step={0.05}
                    decimals={2}
                    onChange={(v) => onUpdateParam('sporeVisibility', v)}
                  />
                  <SliderControl
                    label="Aleatoriedade Orgânica"
                    value={params.randomness}
                    min={0.0}
                    max={1.0}
                    step={0.02}
                    decimals={2}
                    onChange={(v) => onUpdateParam('randomness', v)}
                  />
                  <SliderControl
                    label="Areia de Esporos / Granulação"
                    value={params.grain}
                    min={0.0}
                    max={1.0}
                    step={0.02}
                    decimals={2}
                    onChange={(v) => onUpdateParam('grain', v)}
                  />
                  <SliderControl
                    label="Ângulo do Sensor"
                    value={params.sensorAngle}
                    min={1}
                    max={90}
                    step={0.5}
                    unit="°"
                    decimals={1}
                    onChange={(v) => onUpdateParam('sensorAngle', v)}
                  />
                  <SliderControl
                    label="Ângulo de Rotação"
                    value={params.turnAngle}
                    min={1}
                    max={90}
                    step={0.5}
                    unit="°"
                    decimals={1}
                    onChange={(v) => onUpdateParam('turnAngle', v)}
                  />
                  <SliderControl
                    label="Distância do Sensor"
                    value={params.sensorDistance}
                    min={1}
                    max={60}
                    step={0.5}
                    unit="px"
                    decimals={1}
                    onChange={(v) => onUpdateParam('sensorDistance', v)}
                  />
                  <SliderControl
                    label="Velocidade do Passo"
                    value={params.stepSpeed}
                    min={0.2}
                    max={4.0}
                    step={0.05}
                    unit="px"
                    decimals={2}
                    onChange={(v) => onUpdateParam('stepSpeed', v)}
                  />
                  <SliderControl
                    label="Decaimento da Trilha"
                    value={params.decay}
                    min={0.01}
                    max={0.4}
                    step={0.01}
                    decimals={2}
                    onChange={(v) => onUpdateParam('decay', v)}
                  />
                  <SliderControl
                    label="Intensidade da Trilha"
                    value={params.trailDeposit}
                    min={0.05}
                    max={1.0}
                    step={0.02}
                    decimals={2}
                    onChange={(v) => onUpdateParam('trailDeposit', v)}
                  />
                  <SliderControl
                    label="Difusão (Suavização)"
                    value={params.diffusion}
                    min={0.0}
                    max={1.0}
                    step={0.02}
                    decimals={2}
                    onChange={(v) => onUpdateParam('diffusion', v)}
                  />
                </>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onResetSimulation}
                className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 text-xs font-medium text-slate-200 bg-[#0F141F] border border-slate-700 hover:border-cyan-500/70 rounded transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reiniciar Simulação</span>
              </button>
            </div>
          </>
        )}

        {activeTab === 'image' && (
          <>
            <p className="text-xs text-slate-400 leading-relaxed">
              Envie até 3 imagens em contraste P&amp;B. O fungo cresce e transiciona suavemente entre elas com opções de loop contínuo.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUploadImageFile(file);
                e.target.value = '';
              }}
            />

            <input
              ref={fileInput2Ref}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUploadImage2File(file);
                e.target.value = '';
              }}
            />

            <input
              ref={fileInput3Ref}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUploadImage3File(file);
                e.target.value = '';
              }}
            />

            {/* 3 Image Slots */}
            <div className="space-y-3">
              {[
                {
                  slot: 1,
                  title: 'Imagem 1',
                  has: params.hasImage,
                  preview: imagePreviewUrl,
                  name: imageName,
                  inputRef: fileInputRef,
                  isDrag: isDragging,
                  setDrag: setIsDragging,
                  onDrop: handleDrop,
                  onClear: onClearImage,
                  onSample: onLoadSampleTemplate,
                },
                {
                  slot: 2,
                  title: 'Imagem 2 (Opcional)',
                  has: params.hasImage2,
                  preview: image2PreviewUrl,
                  name: image2Name,
                  inputRef: fileInput2Ref,
                  isDrag: isDragging2,
                  setDrag: setIsDragging2,
                  onDrop: handleDrop2,
                  onClear: onClearImage2,
                  onSample: onLoadSampleTemplate2,
                },
                {
                  slot: 3,
                  title: 'Imagem 3 (Opcional)',
                  has: params.hasImage3,
                  preview: image3PreviewUrl,
                  name: image3Name,
                  inputRef: fileInput3Ref,
                  isDrag: isDragging3,
                  setDrag: setIsDragging3,
                  onDrop: handleDrop3,
                  onClear: onClearImage3,
                  onSample: onLoadSampleTemplate3,
                },
              ].map((item) => (
                <div
                  key={`slot-${item.slot}`}
                  className="p-2.5 bg-[#0A0E17] border border-slate-800/90 rounded-md space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-slate-200 truncate">
                      {item.has && item.name
                        ? `Imagem ${item.slot} · ${item.name}`
                        : item.title}
                    </span>
                    {item.has && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => item.inputRef.current?.click()}
                          className="text-cyan-400 hover:text-cyan-300 text-xs cursor-pointer"
                        >
                          Trocar
                        </button>
                        <button
                          type="button"
                          onClick={item.onClear}
                          className="inline-flex items-center gap-1 text-rose-400 hover:text-rose-300 text-xs cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remover</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {item.has && item.preview ? (
                    <div className="bg-black border border-slate-800 rounded overflow-hidden flex items-center justify-center">
                      <img
                        src={item.preview}
                        alt={`Mapa P&B ${item.slot}`}
                        className="w-full max-h-24 object-contain"
                      />
                    </div>
                  ) : (
                    <>
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          item.setDrag(true);
                        }}
                        onDragLeave={() => item.setDrag(false)}
                        onDrop={item.onDrop}
                        onClick={() => item.inputRef.current?.click()}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            item.inputRef.current?.click();
                          }
                        }}
                        className={`p-3 border border-dashed rounded text-center transition-colors cursor-pointer ${
                          item.isDrag
                            ? 'border-cyan-400 bg-cyan-950/25'
                            : 'border-slate-700 bg-[#0F141F] hover:border-slate-500'
                        }`}
                      >
                        <Upload className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                        <div className="text-xs font-medium text-slate-200">
                          Clique ou arraste a Imagem {item.slot}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          PNG, JPG, WebP ou SVG
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-1">
                        {(
                          [
                            { id: 'typography', label: 'Tipografia' },
                            { id: 'botanical', label: 'Silhueta' },
                            { id: 'sacred_ring', label: 'Geometria' },
                            { id: 'labyrinth', label: 'Labirinto' },
                          ] as const
                        ).map((tpl) => (
                          <button
                            key={`slot-${item.slot}-${tpl.id}`}
                            type="button"
                            onClick={() => item.onSample(tpl.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-slate-300 bg-[#0F141F] border border-slate-800 hover:border-slate-600 rounded transition-colors cursor-pointer"
                          >
                            <ImageIcon className="w-3 h-3 text-cyan-400 shrink-0" />
                            <span className="truncate">{tpl.label}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {tl.hasAnyImage && (
              <div className="pt-2 border-t border-slate-800/80 space-y-4">
                {/* Multi-image Loop Mode & Hold */}
                {tl.isMultiImage && (
                  <div className="space-y-3 p-3 bg-[#090D16] border border-slate-800/90 rounded-md">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-slate-200">
                        Modo de Troca &amp; Loop ({tl.activeSlots.length} Imagens)
                      </label>
                      <div className="grid grid-cols-3 gap-1">
                        {LOOP_MODE_OPTIONS.map((opt) => {
                          const active = params.imageLoopMode === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => onUpdateParam('imageLoopMode', opt.value)}
                              title={opt.desc}
                              className={`py-1.5 px-1 text-[11px] font-medium rounded border transition-colors cursor-pointer truncate ${
                                active
                                  ? 'bg-cyan-950/40 border-cyan-500/70 text-cyan-200'
                                  : 'bg-[#0F141F] border-slate-800 text-slate-300 hover:border-slate-700'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        {LOOP_MODE_OPTIONS.find((o) => o.value === params.imageLoopMode)?.desc}
                        {params.imageLoopMode !== 'once' && params.formationDurationSec > 0
                          ? ' · Dica: use "Contínuo" abaixo para loop infinito.'
                          : ''}
                      </p>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-slate-800/70">
                      <div className="flex items-center justify-between text-xs">
                        <label className="font-medium text-slate-300">
                          Pausa com Imagem Formada
                        </label>
                        <span className="font-mono tabular-nums text-cyan-300">
                          {tl.holdSec.toFixed(1)}s
                        </span>
                      </div>
                      <div className="grid grid-cols-5 gap-1">
                        {IMAGE_HOLD_OPTIONS.map((sec) => {
                          const active = params.imageHoldSec === sec;
                          return (
                            <button
                              key={`hold-${sec}`}
                              type="button"
                              onClick={() => onUpdateParam('imageHoldSec', sec)}
                              className={`py-1 text-[11px] font-mono rounded border transition-colors cursor-pointer ${
                                active
                                  ? 'bg-cyan-950/40 border-cyan-500/70 text-cyan-200'
                                  : 'bg-[#0F141F] border-slate-800 text-slate-300 hover:border-slate-700'
                              }`}
                            >
                              {sec}s
                            </button>
                          );
                        })}
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={8}
                        step={0.5}
                        value={Math.min(8, params.imageHoldSec)}
                        onChange={(e) =>
                          onUpdateParam('imageHoldSec', Number(e.target.value))
                        }
                        className="w-full studio-slider"
                      />
                    </div>
                  </div>
                )}

                {/* Timing & Intro Ramp Controls */}
                <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-medium text-slate-300">
                      Limite de Tempo da Simulação
                    </label>
                    <span className="font-mono tabular-nums text-cyan-300">
                      {params.formationDurationSec === 0
                        ? 'Contínuo'
                        : `${params.formationDurationSec}s`}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {FORMATION_DURATIONS.map((opt) => {
                      const active = params.formationDurationSec === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => onUpdateParam('formationDurationSec', opt.value)}
                          className={`py-1.5 text-[11px] font-mono rounded border transition-colors cursor-pointer ${
                            active
                              ? 'bg-cyan-950/40 border-cyan-500/70 text-cyan-200'
                              : 'bg-[#0F141F] border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-1.5 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-medium text-slate-300">
                        Tempo de Formação por Imagem
                      </label>
                      <span className="font-mono tabular-nums text-cyan-300">
                        {tl.formSec.toFixed(1)}s
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {IMAGE_FORMATION_MAX_OPTIONS.map((sec) => {
                        const active = params.imageFormationMaxSec === sec;
                        return (
                          <button
                            key={`img-max-${sec}`}
                            type="button"
                            onClick={() => onUpdateParam('imageFormationMaxSec', sec)}
                            className={`py-1.5 text-[11px] font-mono rounded border transition-colors cursor-pointer ${
                              active
                                ? 'bg-cyan-950/40 border-cyan-500/70 text-cyan-200'
                                : 'bg-[#0F141F] border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            {sec}s
                          </button>
                        );
                      })}
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={15}
                      step={0.5}
                      value={Math.min(15, params.imageFormationMaxSec)}
                      onChange={(e) =>
                        onUpdateParam('imageFormationMaxSec', Number(e.target.value))
                      }
                      className="w-full studio-slider"
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-800/70 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-medium text-slate-300">
                        Começar a Formar Imagem em
                      </label>
                      <span className="font-mono tabular-nums text-cyan-300">
                        {params.imageStartSec === 0
                          ? '0s (Imediato)'
                          : `${tl.introSec.toFixed(1)}s`}
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {IMAGE_START_OPTIONS.map((sec) => {
                        const active = params.imageStartSec === sec;
                        return (
                          <button
                            key={`start-img-${sec}`}
                            type="button"
                            onClick={() => onUpdateParam('imageStartSec', sec)}
                            className={`py-1.5 text-[11px] font-mono rounded border transition-colors cursor-pointer ${
                              active
                                ? 'bg-cyan-950/40 border-cyan-500/70 text-cyan-200'
                                : 'bg-[#0F141F] border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            {sec}s
                          </button>
                        );
                      })}
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={0.5}
                      value={Math.min(10, params.imageStartSec)}
                      onChange={(e) =>
                        onUpdateParam('imageStartSec', Number(e.target.value))
                      }
                      className="w-full studio-slider"
                    />
                  </div>

                  {/* Live Stage Breakdown */}
                  <div className="p-2.5 bg-[#080B12] border border-slate-800/80 rounded text-[11px] font-mono text-slate-400 space-y-1">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-sans font-medium">
                      Cronograma da Transição
                    </div>
                    {tl.introSec > 0.05 && (
                      <div>
                        0.0s → {tl.introSec.toFixed(1)}s · Crescimento livre
                      </div>
                    )}
                    {tl.stages.slice(0, 6).map((st) => (
                      <div key={st.stepIndex} className="text-slate-300">
                        {st.startSec.toFixed(1)}s → {st.formEndSec.toFixed(1)}s ·{' '}
                        {st.stepIndex === 0
                          ? `Forma Img ${st.toSlot}`
                          : `Img ${st.fromSlot} → Img ${st.toSlot}`}
                        {tl.holdSec > 0.05
                          ? ` (+${tl.holdSec.toFixed(1)}s fixa)`
                          : ''}
                      </div>
                    ))}
                    {params.formationDurationSec === 0 &&
                      tl.isMultiImage &&
                      params.imageLoopMode !== 'once' && (
                        <div className="text-cyan-300">
                          ∞ Loop contínuo a cada {tl.stepSec.toFixed(1)}s
                        </div>
                      )}
                    {params.formationDurationSec > 0 && tl.effectiveDeathSec > 0 && (
                      <div className="text-amber-300">
                        {tl.deathStartSec.toFixed(1)}s → {params.formationDurationSec.toFixed(1)}s · Morte dos esporos
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    Comportamento com a Imagem
                  </label>
                  <div className="space-y-1.5">
                    {(
                      [
                        {
                          value: 'build_image',
                          title: 'Construir a Imagem',
                          desc: 'Cresce da origem escolhida até formar a imagem',
                        },
                        {
                          value: 'emerge_from_image',
                          title: 'Surgir a partir da Imagem',
                          desc: 'O fungo nasce na imagem e se espalha em rede',
                        },
                        {
                          value: 'contain_mask',
                          title: 'Conter dentro da Imagem',
                          desc: 'Cresce formando veias apenas dentro das formas',
                        },
                      ] as Array<{ value: ImageGuideMode; title: string; desc: string }>
                    ).map((mode) => {
                      const active = params.imageGuideMode === mode.value;
                      return (
                        <button
                          key={mode.value}
                          type="button"
                          onClick={() => onUpdateParam('imageGuideMode', mode.value)}
                          className={`w-full text-left px-3 py-2 rounded border transition-colors cursor-pointer ${
                            active
                              ? 'bg-cyan-950/40 border-cyan-500/70 text-cyan-200'
                              : 'bg-[#0F141F] border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="text-xs font-medium">{mode.title}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{mode.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {params.imageGuideMode === 'build_image' && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-300">
                      Origem do Crescimento
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {SPAWN_OPTIONS.map((opt) => {
                        const active = params.spawnMode === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => onUpdateParam('spawnMode', opt.value)}
                            className={`py-1.5 px-2 text-xs font-medium rounded border transition-colors cursor-pointer ${
                              opt.fullWidth ? 'col-span-3' : ''
                            } ${
                              active
                                ? 'bg-cyan-950/40 border-cyan-500/70 text-cyan-200'
                                : 'bg-[#0F141F] border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-300">
                      Polaridade
                    </label>
                    <div className="grid grid-cols-2 gap-1 p-1 bg-[#07090E] border border-slate-800 rounded-md">
                      <button
                        type="button"
                        onClick={() => onUpdateParam('imageInvert', false)}
                        className={`py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                          !params.imageInvert
                            ? 'bg-slate-800 text-cyan-300'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Branco
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateParam('imageInvert', true)}
                        className={`py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                          params.imageInvert
                            ? 'bg-slate-800 text-cyan-300'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Preto
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-300">
                      Enquadramento
                    </label>
                    <select
                      value={params.imageFit}
                      onChange={(e) =>
                        onUpdateParam('imageFit', e.target.value as 'contain' | 'cover')
                      }
                      className="w-full px-2 py-1.5 text-xs bg-[#0F141F] border border-slate-800 rounded text-slate-200 outline-none focus:border-cyan-500"
                    >
                      <option value="contain">Conter (Inteira)</option>
                      <option value="cover">Preencher</option>
                    </select>
                  </div>
                </div>

                <SliderControl
                  label="Força da Atração"
                  value={params.imageStrength}
                  min={0.0}
                  max={2.5}
                  step={0.05}
                  decimals={2}
                  onChange={(v) => onUpdateParam('imageStrength', v)}
                />
                <SliderControl
                  label="Contraste P&B"
                  value={params.imageContrast}
                  min={0.5}
                  max={4.0}
                  step={0.1}
                  decimals={1}
                  onChange={(v) => onUpdateParam('imageContrast', v)}
                />
                <SliderControl
                  label="Limiar Preto/Branco"
                  value={params.imageThreshold}
                  min={10}
                  max={245}
                  step={1}
                  decimals={0}
                  onChange={(v) => onUpdateParam('imageThreshold', v)}
                />
                <SliderControl
                  label="Sobreposição de Guia"
                  value={params.imageOverlayOpacity}
                  min={0.0}
                  max={0.6}
                  step={0.02}
                  decimals={2}
                  onChange={(v) => onUpdateParam('imageOverlayOpacity', v)}
                />

                <button
                  type="button"
                  onClick={onResetSimulation}
                  className="w-full py-2 px-4 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded transition-colors cursor-pointer"
                >
                  Reiniciar Crescimento na Imagem
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === 'appearance' && (
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-300">
                Paletas de Coloração
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {COLOR_PALETTES.map((pal) => (
                  <button
                    key={pal.id}
                    type="button"
                    onClick={() => {
                      onUpdateParam('bgColor', pal.bgColor);
                      onUpdateParam('primaryColor', pal.primaryColor);
                    }}
                    className="flex items-center gap-2 px-2.5 py-2 bg-[#0F141F] border border-slate-800 hover:border-slate-600 rounded text-xs text-slate-200 transition-colors cursor-pointer"
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-sm border border-slate-700 shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${pal.bgColor} 45%, ${pal.primaryColor} 55%)`,
                      }}
                    />
                    <span className="truncate">{pal.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800/80">
              <label className="space-y-1 text-xs text-slate-300">
                <span className="block truncate">Fundo</span>
                <input
                  type="color"
                  value={params.bgColor}
                  onChange={(e) => onUpdateParam('bgColor', e.target.value)}
                  className="w-full h-8 rounded bg-transparent border border-slate-700 cursor-pointer"
                />
              </label>
              <label className="space-y-1 text-xs text-slate-300">
                <span className="block truncate">Fungo</span>
                <input
                  type="color"
                  value={params.primaryColor}
                  onChange={(e) => onUpdateParam('primaryColor', e.target.value)}
                  className="w-full h-8 rounded bg-transparent border border-slate-700 cursor-pointer"
                />
              </label>
            </div>

            <div className="space-y-4 pt-3 border-t border-slate-800/80">
              <SliderControl
                label="Areia de Esporos / Granulação"
                value={params.grain}
                min={0.0}
                max={1.0}
                step={0.02}
                decimals={2}
                onChange={(v) => onUpdateParam('grain', v)}
              />
              <SliderControl
                label="Exposição / Brilho"
                value={params.exposure}
                min={0.4}
                max={3.5}
                step={0.05}
                decimals={2}
                onChange={(v) => onUpdateParam('exposure', v)}
              />
              <SliderControl
                label="Nitidez / Contraste (Gama)"
                value={params.gamma}
                min={0.5}
                max={2.6}
                step={0.05}
                decimals={2}
                onChange={(v) => onUpdateParam('gamma', v)}
              />
            </div>

            <div className="pt-3 border-t border-slate-800/80 space-y-2">
              <label className="block text-xs font-medium text-slate-300">
                Resolução do Quadro e Vídeo
              </label>
              <select
                value={`${params.width}x${params.height}`}
                onChange={(e) => {
                  const found = RESOLUTIONS.find(
                    (r) => `${r.width}x${r.height}` === e.target.value
                  );
                  if (found) {
                    onUpdateParam('width', found.width);
                    onUpdateParam('height', found.height);
                  }
                }}
                className="w-full px-2.5 py-2 text-xs font-mono bg-[#0F141F] border border-slate-800 rounded text-slate-200 outline-none focus:border-cyan-500"
              >
                {RESOLUTIONS.map((r) => (
                  <option key={r.label} value={`${r.width}x${r.height}`}>
                    {r.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500">
                512 × 512 (1:1) é o padrão leve ao vivo. Na janela Renderizar Vídeo você escolhe Normal, HD, Full HD ou 2K Ultra.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer Action: Reset All Controls */}
      <div className="p-3 border-t border-slate-800/80 bg-[#090C12] shrink-0">
        <button
          type="button"
          onClick={onResetAllControls}
          className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium text-slate-300 hover:text-slate-100 bg-[#0F141F] border border-slate-800 hover:border-slate-600 rounded transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reiniciar Todos os Controles</span>
        </button>
      </div>
    </aside>
  );
};
