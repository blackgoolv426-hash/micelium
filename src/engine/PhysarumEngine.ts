import { SimulationParams } from '../types/simulation';
import { ISimulationEngine } from './SimulationEngine';
import { computeImageTimelineState, computeSimulationTimeline, ImageSlotId } from './timeline';
import {
  UPDATE_VS,
  UPDATE_FS,
  DEPOSIT_VS,
  DEPOSIT_FS,
  QUAD_VS,
  DIFFUSE_FS,
} from './shaders/physarumShaders';
import {
  LICHEN_MOSAIC_FS,
  RENDER_FS,
} from './shaders/pdeShaders';

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgbNorm(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [1, 1, 1];
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return [1, 1, 1];
  return [
    ((num >> 16) & 255) / 255,
    ((num >> 8) & 255) / 255,
    (num & 255) / 255,
  ];
}

export function getPhysarumComplexityConfig(complexity: number): {
  substeps: number;
  simScale: number;
  particleMult: number;
} {
  const c = Math.max(1, Math.min(4, Math.round(complexity || 1)));
  if (c === 1) return { substeps: 1, simScale: 1.0, particleMult: 1.0 };
  if (c === 2) return { substeps: 2, simScale: 1.25, particleMult: 1.75 };
  if (c === 3) return { substeps: 3, simScale: 1.5, particleMult: 2.5 };
  return { substeps: 4, simScale: 2.0, particleMult: 3.5 };
}

const MAX_PARTICLES = 300000;

export class PhysarumEngine implements ISimulationEngine {
  private gl: WebGL2RenderingContext;
  private width: number;
  private height: number;
  private simScale = 1.0;
  private simWidth: number;
  private simHeight: number;
  private useFloatFBO = false;

  private updateProg!: WebGLProgram;
  private depositProg!: WebGLProgram;
  private diffuseProg!: WebGLProgram;
  private lichenMosaicProg!: WebGLProgram;
  private renderProg!: WebGLProgram;

  private agentBuffers!: [WebGLBuffer, WebGLBuffer];
  private agentVaos!: [WebGLVertexArrayObject, WebGLVertexArrayObject];
  private transformFeedbacks!: [WebGLTransformFeedback, WebGLTransformFeedback];
  private quadVao!: WebGLVertexArrayObject;
  private quadBuffer!: WebGLBuffer;

  private dlaSeedBuffer!: WebGLBuffer;
  private dlaSeedVao!: WebGLVertexArrayObject;

  private trailTextures!: [WebGLTexture, WebGLTexture];
  private trailFbos!: [WebGLFramebuffer, WebGLFramebuffer];
  private guideTexture!: WebGLTexture;
  private guideTexture2!: WebGLTexture;
  private guideTexture3!: WebGLTexture;
  private guideData!: Uint8Array;
  private guideData2!: Uint8Array;
  private guideData3!: Uint8Array;

  private agentReadIdx = 0;
  private trailReadIdx = 0;
  private stepCount = 0;
  private simTime = 0;
  private activeParticles = 75000;
  private livingParticles = 75000;

  constructor(canvas: HTMLCanvasElement, params: SimulationParams) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });

    if (!gl) {
      throw new Error('WebGL2 não está disponível neste navegador.');
    }

    this.gl = gl;
    const cfg = getPhysarumComplexityConfig(params.complexity);
    this.width = params.width;
    this.height = params.height;
    this.simScale = cfg.simScale;
    this.simWidth = Math.round(this.width * this.simScale);
    this.simHeight = Math.round(this.height * this.simScale);
    canvas.width = this.width;
    canvas.height = this.height;

    const extHalf = gl.getExtension('EXT_color_buffer_half_float');
    const extFloat = gl.getExtension('EXT_color_buffer_float');
    this.useFloatFBO = Boolean(extHalf || extFloat);

    this.initPrograms();
    this.initGeometry();
    this.initTexturesAndFbos();
    this.resetSimulation(params);
  }

  private compileShader(type: number, src: string): WebGLShader {
    const { gl } = this;
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Falha ao criar shader WebGL2.');
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader) || 'Erro desconhecido no shader';
      gl.deleteShader(shader);
      throw new Error(`Erro de compilação GLSL: ${log}`);
    }
    return shader;
  }

  private createProgram(vsSrc: string, fsSrc: string, varyings?: string[]): WebGLProgram {
    const { gl } = this;
    const vs = this.compileShader(gl.VERTEX_SHADER, vsSrc);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSrc);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    if (varyings && varyings.length > 0) {
      gl.transformFeedbackVaryings(prog, varyings, gl.INTERLEAVED_ATTRIBS);
    }
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(prog) || 'Erro ao linkar programa WebGL2';
      gl.deleteProgram(prog);
      throw new Error(log);
    }
    return prog;
  }

  private initPrograms() {
    this.updateProg = this.createProgram(UPDATE_VS, UPDATE_FS, ['v_outAgent']);
    this.depositProg = this.createProgram(DEPOSIT_VS, DEPOSIT_FS);
    this.diffuseProg = this.createProgram(QUAD_VS, DIFFUSE_FS);
    this.lichenMosaicProg = this.createProgram(QUAD_VS, LICHEN_MOSAIC_FS);
    this.renderProg = this.createProgram(QUAD_VS, RENDER_FS);
  }

  private initGeometry() {
    const { gl } = this;

    const bufA = gl.createBuffer()!;
    const bufB = gl.createBuffer()!;
    const byteLength = MAX_PARTICLES * 4 * 4;

    gl.bindBuffer(gl.ARRAY_BUFFER, bufA);
    gl.bufferData(gl.ARRAY_BUFFER, byteLength, gl.DYNAMIC_COPY);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufB);
    gl.bufferData(gl.ARRAY_BUFFER, byteLength, gl.DYNAMIC_COPY);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    const vaoA = gl.createVertexArray()!;
    gl.bindVertexArray(vaoA);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufA);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);

    const vaoB = gl.createVertexArray()!;
    gl.bindVertexArray(vaoB);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufB);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    const tfA = gl.createTransformFeedback()!;
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tfA);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, bufA);

    const tfB = gl.createTransformFeedback()!;
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tfB);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, bufB);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);

    this.agentBuffers = [bufA, bufB];
    this.agentVaos = [vaoA, vaoB];
    this.transformFeedbacks = [tfA, tfB];

    this.dlaSeedBuffer = gl.createBuffer()!;
    this.dlaSeedVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.dlaSeedVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.dlaSeedBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, 4096 * 4 * 4, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    this.quadBuffer = gl.createBuffer()!;
    this.quadVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.quadVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  private createTrailPair(useFloat: boolean): {
    textures: [WebGLTexture, WebGLTexture];
    fbos: [WebGLFramebuffer, WebGLFramebuffer];
  } {
    const { gl, simWidth, simHeight } = this;
    const texA = gl.createTexture()!;
    const texB = gl.createTexture()!;
    const fboA = gl.createFramebuffer()!;
    const fboB = gl.createFramebuffer()!;

    const internalFormat = useFloat ? gl.RGBA16F : gl.RGBA8;
    const type = useFloat ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;

    const pairs: Array<[WebGLTexture, WebGLFramebuffer]> = [
      [texA, fboA],
      [texB, fboB],
    ];

    for (const [tex, fbo] of pairs) {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, simWidth, simHeight, 0, gl.RGBA, type, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, fboA);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    if (status !== gl.FRAMEBUFFER_COMPLETE && useFloat) {
      gl.deleteTexture(texA);
      gl.deleteTexture(texB);
      gl.deleteFramebuffer(fboA);
      gl.deleteFramebuffer(fboB);
      this.useFloatFBO = false;
      return this.createTrailPair(false);
    }

    return { textures: [texA, texB], fbos: [fboA, fboB] };
  }

  private initTexturesAndFbos() {
    const { gl, width, height } = this;

    const pair = this.createTrailPair(this.useFloatFBO);
    this.trailTextures = pair.textures;
    this.trailFbos = pair.fbos;

    this.guideData = new Uint8Array(width * height * 4);
    this.guideData2 = new Uint8Array(width * height * 4);
    this.guideData3 = new Uint8Array(width * height * 4);
    for (let i = 0; i < this.guideData.length; i += 4) {
      this.guideData[i + 3] = 255;
      this.guideData2[i + 3] = 255;
      this.guideData3[i + 3] = 255;
    }

    this.guideTexture = gl.createTexture()!;
    this.guideTexture2 = gl.createTexture()!;
    this.guideTexture3 = gl.createTexture()!;
    this.uploadGuideTexture(this.guideTexture, this.guideData);
    this.uploadGuideTexture(this.guideTexture2, this.guideData2);
    this.uploadGuideTexture(this.guideTexture3, this.guideData3);
  }

  private uploadGuideTexture(tex: WebGLTexture, data: Uint8Array) {
    const { gl, width, height } = this;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  private getGrowthModelInt(params: SimulationParams): number {
    if (params.growthModel === 'canalization') return 3;
    if (params.growthModel === 'lichen_mosaic') return 5;
    return 0;
  }

  private isPdeModel(model: SimulationParams['growthModel']): boolean {
    return model === 'lichen_mosaic';
  }

  private getSpawnModeInt(params: SimulationParams): number {
    const map: Record<SimulationParams['spawnMode'], number> = {
      random: 0,
      center: 1,
      colonies: 2,
      ring: 3,
      edges: 4,
      top: 5,
      bottom: 6,
    };
    return map[params.spawnMode] ?? 0;
  }

  private getGuideModeInt(params: SimulationParams): number {
    if (params.imageGuideMode === 'build_image') return 0;
    if (params.imageGuideMode === 'emerge_from_image') return 1;
    return 2;
  }

  public resize(width: number, height: number, params: SimulationParams) {
    const cfg = getPhysarumComplexityConfig(params.complexity);
    const nextSimWidth = Math.round(width * cfg.simScale);
    const nextSimHeight = Math.round(height * cfg.simScale);
    if (
      this.width === width &&
      this.height === height &&
      this.simWidth === nextSimWidth &&
      this.simHeight === nextSimHeight
    ) {
      return;
    }

    const { gl } = this;
    this.width = width;
    this.height = height;
    this.simScale = cfg.simScale;
    this.simWidth = nextSimWidth;
    this.simHeight = nextSimHeight;
    (gl.canvas as HTMLCanvasElement).width = width;
    (gl.canvas as HTMLCanvasElement).height = height;

    gl.deleteTexture(this.trailTextures[0]);
    gl.deleteTexture(this.trailTextures[1]);
    gl.deleteFramebuffer(this.trailFbos[0]);
    gl.deleteFramebuffer(this.trailFbos[1]);
    gl.deleteTexture(this.guideTexture);
    gl.deleteTexture(this.guideTexture2);
    gl.deleteTexture(this.guideTexture3);

    this.initTexturesAndFbos();
    this.resetSimulation(params);
  }

  private fillGuideArray(target: Uint8Array, guideRGB: Uint8Array | null) {
    const total = this.width * this.height;
    if (!guideRGB || guideRGB.length !== total * 3) {
      for (let i = 0; i < total; i++) {
        target[i * 4] = 0;
        target[i * 4 + 1] = 0;
        target[i * 4 + 2] = 0;
      }
    } else {
      for (let i = 0; i < total; i++) {
        target[i * 4] = guideRGB[i * 3];
        target[i * 4 + 1] = guideRGB[i * 3 + 1];
        target[i * 4 + 2] = guideRGB[i * 3 + 2];
      }
    }
  }

  public setImageGuide(guideRGB: Uint8Array | null) {
    this.fillGuideArray(this.guideData, guideRGB);
    this.uploadGuideTexture(this.guideTexture, this.guideData);
  }

  public setSecondImageGuide(guideRGB: Uint8Array | null) {
    this.fillGuideArray(this.guideData2, guideRGB);
    this.uploadGuideTexture(this.guideTexture2, this.guideData2);
  }

  public setThirdImageGuide(guideRGB: Uint8Array | null) {
    this.fillGuideArray(this.guideData3, guideRGB);
    this.uploadGuideTexture(this.guideTexture3, this.guideData3);
  }

  private getGuideTexture(slot: ImageSlotId): WebGLTexture {
    if (slot === 2) return this.guideTexture2;
    if (slot === 3) return this.guideTexture3;
    return this.guideTexture;
  }

  private getGuideDataForSlot(slot: ImageSlotId): Uint8Array {
    if (slot === 2) return this.guideData2;
    if (slot === 3) return this.guideData3;
    return this.guideData;
  }

  public getTargetSteps(params: SimulationParams): number {
    if (params.formationDurationSec <= 0) return 0;
    return Math.max(12, Math.round(params.formationDurationSec * 24));
  }

  public getGrowthProgress(params: SimulationParams): number {
    const target = this.getTargetSteps(params);
    if (target <= 0) {
      return Math.min(1.0, this.stepCount / 480);
    }
    return Math.min(1.0, this.stepCount / target);
  }

  private getBehaviorInt(params: SimulationParams): number {
    const behaviorMap: Record<SimulationParams['colonyBehavior'], number> = {
      anastomose: 0,
      fan: 2,
      mycorrhiza: 7,
      sclerotia_clumps: 14,
      penicillium_zones: 15,
      mucor_burst: 16,
      physarum_fan_lobe: 17,
      physarum_petri_plume: 18,
      lichen_foliate: 19,
      lichen_fruticose: 21,
      flocculent_core: 22,
      trabecular_lattice: 23,
      fairy_ring_hyphae: 24,
      trichoderma_fork: 25,
      sandy_spore_web: 26,
      hex_honeycomb_mesh: 27,
      voronoi_web_mesh: 28,
      diagonal_diamond_mesh: 29,
      concentric_cobweb_mesh: 30,
      labyrinth_gyroid_mesh: 31,
      perforated_membrane_mesh: 32,
      braided_chord_mesh: 33,
      hierarchical_arterial_mesh: 34,
      fractal_tessellation_mesh: 35,
      sponge_trabeculae_mesh: 36,
      aspergillus_conidia: 37,
      rhizopus_stolons: 38,
      fusarium_plume: 39,
      neurospora_network: 40,
      cordyceps_tendrils: 41,
      pleurotus_oyster_fan: 42,
      botrytis_clusters: 43,
      coprinus_ink_web: 44,
      physarum_3d_plasmodium: 45,
      aspergillus_3d_domes: 46,
      hericium_3d_coral: 47,
      ramaria_3d_coral: 48,
      morel_3d_alveoli: 49,
      tremella_3d_jelly: 50,
      ganoderma_3d_shelf: 51,
      phallus_3d_veil: 52,
      mucor_3d_sporangia: 53,
      physarum_3d_sclerotium: 54,
    };
    return behaviorMap[params.colonyBehavior] ?? 0;
  }

  private getWaveEffectInt(params: SimulationParams): number {
    const map: Record<SimulationParams['growthWaveEffect'], number> = {
      none: 0,
      radial_pulse: 1,
      peristaltic: 2,
      tidal_rings: 3,
      spiral_wave: 4,
      heartbeat_surge: 5,
    };
    return map[params.growthWaveEffect] ?? 0;
  }

  private getElapsedSec(params: SimulationParams): number {
    if (params.formationDurationSec <= 0) {
      return this.stepCount / 24;
    }
    return this.getGrowthProgress(params) * params.formationDurationSec;
  }

  public getActiveCount(): number {
    return this.livingParticles;
  }

  private depositSeeds(
    params: SimulationParams,
    vao: WebGLVertexArrayObject,
    count: number,
    pointSize: number,
    useMaxBlend: boolean
  ) {
    const { gl, simWidth, simHeight } = this;
    const modelInt = this.getGrowthModelInt(params);
    const depositScale = this.useFloatFBO ? 0.38 : 0.20;
    const guideModeInt = this.getGuideModeInt(params);
    const seq = computeImageTimelineState(params, this.getElapsedSec(params));

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.trailFbos[this.trailReadIdx]);
    gl.viewport(0, 0, simWidth, simHeight);
    gl.enable(gl.BLEND);
    gl.blendEquation(useMaxBlend ? gl.MAX : gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE);

    gl.useProgram(this.depositProg);
    gl.bindVertexArray(vao);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.getGuideTexture(seq.fromSlot));
    gl.uniform1i(gl.getUniformLocation(this.depositProg, 'u_guide'), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.getGuideTexture(seq.toSlot));
    gl.uniform1i(gl.getUniformLocation(this.depositProg, 'u_guide2'), 1);

    gl.uniform2f(gl.getUniformLocation(this.depositProg, 'u_simResolution'), simWidth, simHeight);
    gl.uniform1i(gl.getUniformLocation(this.depositProg, 'u_hasImage'), seq.hasAnyImage ? 1 : 0);
    gl.uniform1i(
      gl.getUniformLocation(this.depositProg, 'u_hasImage2'),
      seq.hasAnyImage && seq.isTransitioning ? 1 : 0
    );
    gl.uniform1i(gl.getUniformLocation(this.depositProg, 'u_guideMode'), guideModeInt);
    gl.uniform1i(gl.getUniformLocation(this.depositProg, 'u_growthModel'), modelInt);
    gl.uniform1i(
      gl.getUniformLocation(this.depositProg, 'u_colonyBehavior'),
      this.getBehaviorInt(params)
    );
    gl.uniform1i(gl.getUniformLocation(this.depositProg, 'u_isSeedPass'), 1);
    gl.uniform1f(gl.getUniformLocation(this.depositProg, 'u_morphBlend'), 0);
    gl.uniform1f(gl.getUniformLocation(this.depositProg, 'u_pointSize'), pointSize);
    gl.uniform1f(
      gl.getUniformLocation(this.depositProg, 'u_trailDeposit'),
      params.trailDeposit * depositScale
    );

    gl.drawArrays(gl.POINTS, 0, count);
    gl.bindVertexArray(null);
    gl.blendEquation(gl.FUNC_ADD);
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private getBrightImageIndices(params?: SimulationParams): number[] | null {
    const { width, height } = this;
    const total = width * height;
    const tl = params ? computeSimulationTimeline(params) : null;
    const firstSlot: ImageSlotId = tl && tl.activeSlots.length > 0 ? tl.activeSlots[0] : 1;
    const src = this.getGuideDataForSlot(firstSlot);
    const list: number[] = [];
    for (let i = 0; i < total; i++) {
      if (src[i * 4] > 65) {
        list.push(i);
      }
    }
    return list.length > 0 ? list : null;
  }

  private seedFoliateField(params: SimulationParams, rng: () => number) {
    const { gl, width, simWidth, simHeight, simScale } = this;

    for (let i = 0; i < 2; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.trailFbos[i]);
      gl.viewport(0, 0, simWidth, simHeight);
      gl.clearColor(1, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const seedPoints: number[] = [];
    const pushPoint = (x: number, y: number) => {
      if (seedPoints.length / 4 >= 4000) return;
      seedPoints.push(
        Math.min(simWidth - 2, Math.max(2, x)),
        Math.min(simHeight - 2, Math.max(2, y)),
        0,
        0.5
      );
    };

    const cx = simWidth * 0.5;
    const cy = simHeight * 0.5;
    const minDim = Math.min(simWidth, simHeight);

    const hasAnyImg = params.hasImage || params.hasImage2 || params.hasImage3;
    const spawnFromImagePixels =
      hasAnyImg &&
      (params.imageGuideMode === 'emerge_from_image' || params.imageGuideMode === 'contain_mask');
    const brightIndices = spawnFromImagePixels ? this.getBrightImageIndices(params) : null;

    if (brightIndices) {
      const numSeeds = params.imageGuideMode === 'contain_mask' ? 35 : 220;
      for (let i = 0; i < numSeeds; i++) {
        const pick = brightIndices[Math.floor(rng() * brightIndices.length)];
        pushPoint((pick % width) * simScale, Math.floor(pick / width) * simScale);
      }
    } else if (params.spawnMode === 'center') {
      for (let i = 0; i < 12; i++) {
        const a = rng() * Math.PI * 2;
        const r = rng() * minDim * 0.04;
        pushPoint(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
    } else if (params.spawnMode === 'colonies') {
      for (let c = 0; c < 10; c++) {
        const fx = simWidth * (0.14 + rng() * 0.72);
        const fy = simHeight * (0.14 + rng() * 0.72);
        for (let j = 0; j < 4; j++) {
          pushPoint(fx + (rng() - 0.5) * 14 * simScale, fy + (rng() - 0.5) * 14 * simScale);
        }
      }
    } else if (params.spawnMode === 'ring') {
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2 + (rng() - 0.5) * 0.15;
        const r = minDim * 0.28 + (rng() - 0.5) * 8 * simScale;
        pushPoint(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
    } else if (params.spawnMode === 'top') {
      for (let i = 0; i < 18; i++) {
        pushPoint(simWidth * (0.08 + 0.84 * (i / 17)), 10 * simScale);
      }
    } else if (params.spawnMode === 'bottom') {
      for (let i = 0; i < 18; i++) {
        pushPoint(simWidth * (0.08 + 0.84 * (i / 17)), simHeight - 10 * simScale);
      }
    } else if (params.spawnMode === 'edges') {
      for (let i = 0; i < 28; i++) {
        const edge = i % 4;
        if (edge === 0) pushPoint(rng() * simWidth, 8 * simScale);
        else if (edge === 1) pushPoint(rng() * simWidth, simHeight - 8 * simScale);
        else if (edge === 2) pushPoint(8 * simScale, rng() * simHeight);
        else pushPoint(simWidth - 8 * simScale, rng() * simHeight);
      }
    } else {
      for (let i = 0; i < 36; i++) {
        pushPoint(simWidth * (0.08 + rng() * 0.84), simHeight * (0.08 + rng() * 0.84));
      }
    }

    const seedArray = new Float32Array(seedPoints);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.dlaSeedBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, seedArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    this.depositSeeds(params, this.dlaSeedVao, seedPoints.length / 4, Math.max(4, 5 * simScale), false);
  }

  public resetSimulation(params: SimulationParams) {
    const { gl, width, simWidth, simHeight, simScale } = this;
    const cfg = getPhysarumComplexityConfig(params.complexity);
    this.activeParticles = Math.min(
      MAX_PARTICLES,
      Math.max(1000, Math.round(params.particleCount * cfg.particleMult))
    );
    this.livingParticles = this.isPdeModel(params.growthModel)
      ? Math.round(this.activeParticles * 0.15)
      : this.activeParticles;
    this.stepCount = 0;
    this.simTime = 0;
    this.agentReadIdx = 0;
    this.trailReadIdx = 0;

    const rng = mulberry32(params.seed);

    if (params.growthModel === 'lichen_mosaic') {
      this.seedFoliateField(params, rng);
      return;
    }

    for (let i = 0; i < 2; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.trailFbos[i]);
      gl.viewport(0, 0, simWidth, simHeight);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const data = new Float32Array(this.activeParticles * 4);

    const hasAnyImg = params.hasImage || params.hasImage2 || params.hasImage3;
    const spawnFromImagePixels =
      hasAnyImg &&
      (params.imageGuideMode === 'emerge_from_image' || params.imageGuideMode === 'contain_mask');
    const brightIndices = spawnFromImagePixels ? this.getBrightImageIndices(params) : null;

    const cx = simWidth * 0.5;
    const cy = simHeight * 0.5;
    const minDim = Math.min(simWidth, simHeight);

    const foci: Array<{ x: number; y: number; r: number }> = [];
    if (params.spawnMode === 'colonies') {
      for (let f = 0; f < 6; f++) {
        foci.push({
          x: simWidth * (0.16 + rng() * 0.68),
          y: simHeight * (0.16 + rng() * 0.68),
          r: minDim * (0.025 + rng() * 0.03),
        });
      }
    }

    for (let i = 0; i < this.activeParticles; i++) {
      let x = cx;
      let y = cy;
      let angle = rng() * Math.PI * 2;

      if (spawnFromImagePixels && brightIndices) {
        const pick = brightIndices[Math.floor(rng() * brightIndices.length)];
        const px = (pick % width) * simScale;
        const py = Math.floor(pick / width) * simScale;
        x = px + (rng() - 0.5) * simScale;
        y = py + (rng() - 0.5) * simScale;
      } else if (params.spawnMode === 'center') {
        const r = Math.pow(rng(), 0.7) * minDim * 0.08;
        const a = rng() * Math.PI * 2;
        x = cx + Math.cos(a) * r;
        y = cy + Math.sin(a) * r;
      } else if (params.spawnMode === 'colonies') {
        const focus = foci[Math.floor(rng() * foci.length)];
        const r = Math.pow(rng(), 0.65) * focus.r;
        const a = rng() * Math.PI * 2;
        x = focus.x + Math.cos(a) * r;
        y = focus.y + Math.sin(a) * r;
      } else if (params.spawnMode === 'top') {
        x = 10 * simScale + rng() * Math.max(4, simWidth - 20 * simScale);
        y = 10 * simScale + rng() * (28 * simScale);
        angle = Math.PI * 0.5 + (rng() - 0.5) * 1.4;
      } else if (params.spawnMode === 'bottom') {
        x = 10 * simScale + rng() * Math.max(4, simWidth - 20 * simScale);
        y = simHeight - 10 * simScale - rng() * (28 * simScale);
        angle = -Math.PI * 0.5 + (rng() - 0.5) * 1.4;
      } else if (params.spawnMode === 'edges') {
        const edge = Math.floor(rng() * 4);
        const margin = 10 * simScale;
        const band = 26 * simScale;
        if (edge === 0) {
          x = margin + rng() * Math.max(4, simWidth - margin * 2);
          y = margin + rng() * band;
          angle = Math.PI * 0.5 + (rng() - 0.5) * 1.4;
        } else if (edge === 1) {
          x = margin + rng() * Math.max(4, simWidth - margin * 2);
          y = simHeight - margin - rng() * band;
          angle = -Math.PI * 0.5 + (rng() - 0.5) * 1.4;
        } else if (edge === 2) {
          x = margin + rng() * band;
          y = margin + rng() * Math.max(4, simHeight - margin * 2);
          angle = (rng() - 0.5) * 1.4;
        } else {
          x = simWidth - margin - rng() * band;
          y = margin + rng() * Math.max(4, simHeight - margin * 2);
          angle = Math.PI + (rng() - 0.5) * 1.4;
        }
      } else if (params.spawnMode === 'ring') {
        const a = rng() * Math.PI * 2;
        const r = minDim * 0.3 + (rng() - 0.5) * (12 * simScale);
        x = cx + Math.cos(a) * r;
        y = cy + Math.sin(a) * r;
      } else {
        x = 2 + rng() * (simWidth - 4);
        y = 2 + rng() * (simHeight - 4);
      }

      data[i * 4] = Math.min(simWidth - 2, Math.max(2, x));
      data[i * 4 + 1] = Math.min(simHeight - 2, Math.max(2, y));
      data[i * 4 + 2] = angle;
      data[i * 4 + 3] = rng();
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.agentBuffers[0]);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    this.depositSeeds(params, this.agentVaos[0], this.activeParticles, 1.0, false);
  }

  public updateParticleCount(params: SimulationParams) {
    const cfg = getPhysarumComplexityConfig(params.complexity);
    const clamped = Math.min(
      MAX_PARTICLES,
      Math.max(1000, Math.round(params.particleCount * cfg.particleMult))
    );
    if (clamped === this.activeParticles) return;
    this.resetSimulation(params);
  }

  public getStepCount(): number {
    return this.stepCount;
  }

  private stepPdeProgram(
    prog: WebGLProgram,
    params: SimulationParams,
    substeps: number,
    hasAnyImg: boolean,
    isTransitioning: boolean,
    fromSlot: ImageSlotId,
    toSlot: ImageSlotId,
    colonyRamp: number,
    imageEngage: number,
    morphBlend: number,
    deathProgress: number
  ) {
    const { gl, simWidth, simHeight } = this;
    const guideModeInt = this.getGuideModeInt(params);
    const behaviorInt = this.getBehaviorInt(params);
    const sx = (params.seed * 0.137) % 97.3;
    const sy = (params.seed * 0.293) % 83.7;

    gl.useProgram(prog);
    gl.bindVertexArray(this.quadVao);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.getGuideTexture(fromSlot));
    gl.uniform1i(gl.getUniformLocation(prog, 'u_guide'), 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.getGuideTexture(toSlot));
    gl.uniform1i(gl.getUniformLocation(prog, 'u_guide2'), 2);

    gl.uniform2f(gl.getUniformLocation(prog, 'u_texelSize'), 1 / simWidth, 1 / simHeight);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_randomness'), params.randomness);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_colonyRamp'), colonyRamp);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_imageEngage'), imageEngage);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_morphBlend'), morphBlend);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_deathProgress'), deathProgress);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_imageStrength'), params.imageStrength);
    gl.uniform1i(
      gl.getUniformLocation(prog, 'u_boundaryMode'),
      params.boundaryMode === 'wrap' ? 1 : 0
    );
    gl.uniform1i(gl.getUniformLocation(prog, 'u_hasImage'), hasAnyImg ? 1 : 0);
    gl.uniform1i(gl.getUniformLocation(prog, 'u_hasImage2'), hasAnyImg && isTransitioning ? 1 : 0);
    gl.uniform1i(gl.getUniformLocation(prog, 'u_guideMode'), guideModeInt);
    const behLoc = gl.getUniformLocation(prog, 'u_colonyBehavior');
    if (behLoc) gl.uniform1i(behLoc, behaviorInt);
    const waveLoc = gl.getUniformLocation(prog, 'u_growthWaveEffect');
    if (waveLoc) gl.uniform1i(waveLoc, this.getWaveEffectInt(params));
    const waveIntLoc = gl.getUniformLocation(prog, 'u_growthWaveIntensity');
    if (waveIntLoc) gl.uniform1f(waveIntLoc, params.growthWaveIntensity ?? 0.6);
    const simTimeLoc = gl.getUniformLocation(prog, 'u_simTime');
    if (simTimeLoc) gl.uniform1f(simTimeLoc, this.simTime);
    gl.uniform2f(gl.getUniformLocation(prog, 'u_seedOffset'), sx, sy);
    gl.uniform1ui(gl.getUniformLocation(prog, 'u_stepIndex'), this.stepCount >>> 0);

    const trailLoc = gl.getUniformLocation(prog, 'u_trail');

    for (let s = 0; s < substeps; s++) {
      const readTrail = this.trailReadIdx;
      const writeTrail = 1 - readTrail;

      gl.bindFramebuffer(gl.FRAMEBUFFER, this.trailFbos[writeTrail]);
      gl.viewport(0, 0, simWidth, simHeight);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.trailTextures[readTrail]);
      gl.uniform1i(trailLoc, 0);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      this.trailReadIdx = writeTrail;
    }

    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  public step(params: SimulationParams, steps = 1) {
    const { gl, simWidth, simHeight, simScale } = this;
    const cfg = getPhysarumComplexityConfig(params.complexity);
    const modelInt = this.getGrowthModelInt(params);
    const guideModeInt = this.getGuideModeInt(params);
    const spawnModeInt = this.getSpawnModeInt(params);

    const evoRaw = Math.max(0.1, Math.min(3.0, params.evolutionSpeed ?? 1.0)) * 0.65;

    if (this.isPdeModel(params.growthModel)) {
      const prog = this.lichenMosaicProg;
      const pdeSubsteps = Math.max(2, Math.round((14 + cfg.substeps * 4) * evoRaw));

      for (let f = 0; f < steps; f++) {
        this.stepCount++;
        this.simTime += evoRaw * 0.085;
        const growthProgress = this.getGrowthProgress(params);
        const seq = computeImageTimelineState(params, this.getElapsedSec(params));
        const biomassRatio = Math.min(1.0, 0.15 + growthProgress * 1.35) * (1 - seq.deathProgress);
        this.livingParticles = Math.max(0, Math.round(this.activeParticles * biomassRatio));

        this.stepPdeProgram(
          prog,
          params,
          pdeSubsteps,
          seq.hasAnyImage,
          seq.isTransitioning,
          seq.fromSlot,
          seq.toSlot,
          seq.colonyRamp,
          seq.imageEngage,
          seq.morphBlend,
          seq.deathProgress
        );
      }
      return;
    }

    const microSubsteps = Math.max(cfg.substeps, Math.ceil(cfg.substeps * evoRaw));
    const dtStep = evoRaw / microSubsteps;
    const deg2rad = Math.PI / 180;
    const baseDepositScale = this.useFloatFBO ? 1.0 : 0.35;

    const subSpeed = (params.stepSpeed * simScale) * dtStep;
    const subDecay = 1.0 - Math.pow(Math.max(0.01, 1.0 - params.decay), dtStep);
    const subDeposit = (params.trailDeposit * baseDepositScale) * dtStep;
    const subDiffusion = Math.min(
      0.95,
      1.0 - Math.pow(Math.max(0.02, 1.0 - params.diffusion), dtStep)
    );

    const behaviorInt = this.getBehaviorInt(params);
    const sx = (params.seed * 0.137) % 97.3;
    const sy = (params.seed * 0.293) % 83.7;

    for (let f = 0; f < steps; f++) {
      this.stepCount++;
      const growthProgress = this.getGrowthProgress(params);
      const seq = computeImageTimelineState(params, this.getElapsedSec(params));
      const hasAnyImg = seq.hasAnyImage ? 1 : 0;
      const hasImg2 = seq.hasAnyImage && seq.isTransitioning ? 1 : 0;
      const fromTex = this.getGuideTexture(seq.fromSlot);
      const toTex = this.getGuideTexture(seq.toSlot);
      this.livingParticles = Math.max(0, Math.round(this.activeParticles * (1 - seq.deathProgress)));

      for (let m = 0; m < microSubsteps; m++) {
        this.simTime += dtStep * 0.085;
        const readAgent = this.agentReadIdx;
        const writeAgent = 1 - readAgent;
        const readTrail = this.trailReadIdx;
        const writeTrail = 1 - readTrail;
        const stepSeed = (params.seed + (this.stepCount * microSubsteps + m) * 2654435761) >>> 0;

        // 1. Update agents / hyphal walkers via Transform Feedback
        gl.useProgram(this.updateProg);
        gl.bindVertexArray(this.agentVaos[readAgent]);
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.transformFeedbacks[writeAgent]);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.trailTextures[readTrail]);
        gl.uniform1i(gl.getUniformLocation(this.updateProg, 'u_trail'), 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, fromTex);
        gl.uniform1i(gl.getUniformLocation(this.updateProg, 'u_guide'), 1);

        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, toTex);
        gl.uniform1i(gl.getUniformLocation(this.updateProg, 'u_guide2'), 2);

        gl.uniform2f(gl.getUniformLocation(this.updateProg, 'u_simResolution'), simWidth, simHeight);
        gl.uniform1f(gl.getUniformLocation(this.updateProg, 'u_simScale'), simScale);
        gl.uniform1ui(gl.getUniformLocation(this.updateProg, 'u_stepSeed'), stepSeed);
        gl.uniform1ui(gl.getUniformLocation(this.updateProg, 'u_baseSeed'), params.seed >>> 0);
        gl.uniform1f(gl.getUniformLocation(this.updateProg, 'u_growthProgress'), growthProgress);
        gl.uniform1f(gl.getUniformLocation(this.updateProg, 'u_colonyRamp'), seq.colonyRamp);
        gl.uniform1f(gl.getUniformLocation(this.updateProg, 'u_imageEngage'), seq.imageEngage);
        gl.uniform1f(gl.getUniformLocation(this.updateProg, 'u_morphBlend'), seq.morphBlend);
        gl.uniform1f(gl.getUniformLocation(this.updateProg, 'u_deathProgress'), seq.deathProgress);
        gl.uniform1f(gl.getUniformLocation(this.updateProg, 'u_randomness'), params.randomness);
        gl.uniform1i(
          gl.getUniformLocation(this.updateProg, 'u_boundaryMode'),
          params.boundaryMode === 'wrap' ? 1 : 0
        );
        gl.uniform1i(gl.getUniformLocation(this.updateProg, 'u_growthModel'), modelInt);
        gl.uniform1i(gl.getUniformLocation(this.updateProg, 'u_spawnMode'), spawnModeInt);

        gl.uniform1f(gl.getUniformLocation(this.updateProg, 'u_sensorAngle'), params.sensorAngle * deg2rad);
        gl.uniform1f(gl.getUniformLocation(this.updateProg, 'u_turnAngle'), params.turnAngle * deg2rad);
        gl.uniform1f(gl.getUniformLocation(this.updateProg, 'u_sensorDist'), params.sensorDistance * simScale);
        gl.uniform1f(gl.getUniformLocation(this.updateProg, 'u_speed'), subSpeed);
        gl.uniform1f(gl.getUniformLocation(this.updateProg, 'u_trailDeposit'), params.trailDeposit);

        gl.uniform1i(gl.getUniformLocation(this.updateProg, 'u_hasImage'), hasAnyImg);
        gl.uniform1i(gl.getUniformLocation(this.updateProg, 'u_hasImage2'), hasImg2);
        gl.uniform1i(gl.getUniformLocation(this.updateProg, 'u_guideMode'), guideModeInt);
        gl.uniform1i(gl.getUniformLocation(this.updateProg, 'u_colonyBehavior'), behaviorInt);
        gl.uniform1i(gl.getUniformLocation(this.updateProg, 'u_growthWaveEffect'), this.getWaveEffectInt(params));
        gl.uniform1f(gl.getUniformLocation(this.updateProg, 'u_growthWaveIntensity'), params.growthWaveIntensity ?? 0.6);
        gl.uniform1f(gl.getUniformLocation(this.updateProg, 'u_simTime'), this.simTime);
        gl.uniform1ui(gl.getUniformLocation(this.updateProg, 'u_stepIndex'), this.stepCount >>> 0);
        gl.uniform1f(gl.getUniformLocation(this.updateProg, 'u_imageStrength'), params.imageStrength);

        gl.enable(gl.RASTERIZER_DISCARD);
        gl.beginTransformFeedback(gl.POINTS);
        gl.drawArrays(gl.POINTS, 0, this.activeParticles);
        gl.endTransformFeedback();
        gl.disable(gl.RASTERIZER_DISCARD);

        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
        gl.bindVertexArray(null);

        this.agentReadIdx = writeAgent;

        // 2. Deposit trails
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.trailFbos[readTrail]);
        gl.viewport(0, 0, simWidth, simHeight);
        gl.enable(gl.BLEND);
        gl.blendEquation(gl.FUNC_ADD);
        gl.blendFunc(gl.ONE, gl.ONE);

        gl.useProgram(this.depositProg);
        gl.bindVertexArray(this.agentVaos[this.agentReadIdx]);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, fromTex);
        gl.uniform1i(gl.getUniformLocation(this.depositProg, 'u_guide'), 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, toTex);
        gl.uniform1i(gl.getUniformLocation(this.depositProg, 'u_guide2'), 1);

        gl.uniform2f(gl.getUniformLocation(this.depositProg, 'u_simResolution'), simWidth, simHeight);
        gl.uniform1i(gl.getUniformLocation(this.depositProg, 'u_hasImage'), hasAnyImg);
        gl.uniform1i(gl.getUniformLocation(this.depositProg, 'u_hasImage2'), hasImg2);
        gl.uniform1i(gl.getUniformLocation(this.depositProg, 'u_guideMode'), guideModeInt);
        gl.uniform1i(gl.getUniformLocation(this.depositProg, 'u_growthModel'), modelInt);
        gl.uniform1i(gl.getUniformLocation(this.depositProg, 'u_colonyBehavior'), behaviorInt);
        gl.uniform1i(gl.getUniformLocation(this.depositProg, 'u_isSeedPass'), 0);
        gl.uniform1f(gl.getUniformLocation(this.depositProg, 'u_morphBlend'), seq.morphBlend);
        gl.uniform1f(gl.getUniformLocation(this.depositProg, 'u_pointSize'), 1.0);
        gl.uniform1f(gl.getUniformLocation(this.depositProg, 'u_trailDeposit'), subDeposit);

        gl.drawArrays(gl.POINTS, 0, this.activeParticles);
        gl.bindVertexArray(null);
        gl.blendEquation(gl.FUNC_ADD);
        gl.disable(gl.BLEND);

        // 3. Diffuse / Decay / Preserve Skeleton
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.trailFbos[writeTrail]);
        gl.viewport(0, 0, simWidth, simHeight);
        gl.useProgram(this.diffuseProg);
        gl.bindVertexArray(this.quadVao);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.trailTextures[readTrail]);
        gl.uniform1i(gl.getUniformLocation(this.diffuseProg, 'u_trail'), 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, fromTex);
        gl.uniform1i(gl.getUniformLocation(this.diffuseProg, 'u_guide'), 1);

        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, toTex);
        gl.uniform1i(gl.getUniformLocation(this.diffuseProg, 'u_guide2'), 2);

        gl.uniform2f(gl.getUniformLocation(this.diffuseProg, 'u_texelSize'), 1 / simWidth, 1 / simHeight);
        gl.uniform1f(gl.getUniformLocation(this.diffuseProg, 'u_decay'), subDecay);
        gl.uniform1f(gl.getUniformLocation(this.diffuseProg, 'u_diffusion'), subDiffusion);
        gl.uniform1f(gl.getUniformLocation(this.diffuseProg, 'u_colonyRamp'), seq.colonyRamp);
        gl.uniform1f(gl.getUniformLocation(this.diffuseProg, 'u_imageEngage'), seq.imageEngage);
        gl.uniform1f(gl.getUniformLocation(this.diffuseProg, 'u_pruneRamp'), seq.pruneRamp);
        gl.uniform1f(gl.getUniformLocation(this.diffuseProg, 'u_morphBlend'), seq.morphBlend);
        gl.uniform1f(gl.getUniformLocation(this.diffuseProg, 'u_deathProgress'), seq.deathProgress);
        gl.uniform1i(gl.getUniformLocation(this.diffuseProg, 'u_growthModel'), modelInt);
        gl.uniform1i(gl.getUniformLocation(this.diffuseProg, 'u_colonyBehavior'), behaviorInt);
        gl.uniform1i(gl.getUniformLocation(this.diffuseProg, 'u_growthWaveEffect'), this.getWaveEffectInt(params));
        gl.uniform1f(gl.getUniformLocation(this.diffuseProg, 'u_growthWaveIntensity'), params.growthWaveIntensity ?? 0.6);
        gl.uniform1f(gl.getUniformLocation(this.diffuseProg, 'u_simTime'), this.simTime);
        gl.uniform1i(gl.getUniformLocation(this.diffuseProg, 'u_hasImage'), hasAnyImg);
        gl.uniform1i(gl.getUniformLocation(this.diffuseProg, 'u_hasImage2'), hasImg2);
        gl.uniform1i(gl.getUniformLocation(this.diffuseProg, 'u_guideMode'), guideModeInt);
        gl.uniform2f(gl.getUniformLocation(this.diffuseProg, 'u_seedOffset'), sx, sy);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.bindVertexArray(null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        this.trailReadIdx = writeTrail;
      }
    }
  }

  public render(params: SimulationParams) {
    const { gl, width, height } = this;
    const seq = computeImageTimelineState(params, this.getElapsedSec(params));
    const fromTex = this.getGuideTexture(seq.fromSlot);
    const toTex = this.getGuideTexture(seq.toSlot);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);

    gl.useProgram(this.renderProg);
    gl.bindVertexArray(this.quadVao);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.trailTextures[this.trailReadIdx]);
    gl.uniform1i(gl.getUniformLocation(this.renderProg, 'u_trail'), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, fromTex);
    gl.uniform1i(gl.getUniformLocation(this.renderProg, 'u_guide'), 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, toTex);
    gl.uniform1i(gl.getUniformLocation(this.renderProg, 'u_guide2'), 2);

    const bg = hexToRgbNorm(params.bgColor);
    const prim = hexToRgbNorm(params.primaryColor);

    const sx = (params.seed * 0.137) % 97.3;
    const sy = (params.seed * 0.293) % 83.7;
    const modelInt = this.getGrowthModelInt(params);
    const behaviorInt = this.getBehaviorInt(params);

    gl.uniform2f(gl.getUniformLocation(this.renderProg, 'u_resolution'), width, height);
    gl.uniform2f(gl.getUniformLocation(this.renderProg, 'u_seedOffset'), sx, sy);
    gl.uniform1f(gl.getUniformLocation(this.renderProg, 'u_grain'), params.grain);
    gl.uniform1f(gl.getUniformLocation(this.renderProg, 'u_sporeVisibility'), params.sporeVisibility);
    gl.uniform1f(gl.getUniformLocation(this.renderProg, 'u_morphBlend'), seq.morphBlend);
    gl.uniform3f(gl.getUniformLocation(this.renderProg, 'u_bgColor'), bg[0], bg[1], bg[2]);
    gl.uniform3f(gl.getUniformLocation(this.renderProg, 'u_primaryColor'), prim[0], prim[1], prim[2]);
    gl.uniform1f(gl.getUniformLocation(this.renderProg, 'u_exposure'), params.exposure);
    gl.uniform1f(gl.getUniformLocation(this.renderProg, 'u_gamma'), params.gamma);
    gl.uniform1f(
      gl.getUniformLocation(this.renderProg, 'u_imageOverlayOpacity'),
      params.imageOverlayOpacity
    );
    gl.uniform1i(gl.getUniformLocation(this.renderProg, 'u_growthModel'), modelInt);
    gl.uniform1i(gl.getUniformLocation(this.renderProg, 'u_colonyBehavior'), behaviorInt);
    gl.uniform1i(gl.getUniformLocation(this.renderProg, 'u_growthWaveEffect'), this.getWaveEffectInt(params));
    gl.uniform1f(gl.getUniformLocation(this.renderProg, 'u_growthWaveIntensity'), params.growthWaveIntensity ?? 0.6);
    gl.uniform1f(gl.getUniformLocation(this.renderProg, 'u_simTime'), this.simTime);
    gl.uniform1i(gl.getUniformLocation(this.renderProg, 'u_hasImage'), seq.hasAnyImage ? 1 : 0);
    gl.uniform1i(
      gl.getUniformLocation(this.renderProg, 'u_hasImage2'),
      seq.hasAnyImage && seq.isTransitioning ? 1 : 0
    );

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
  }

  public destroy() {
    const { gl } = this;
    gl.deleteProgram(this.updateProg);
    gl.deleteProgram(this.depositProg);
    gl.deleteProgram(this.diffuseProg);
    gl.deleteProgram(this.lichenMosaicProg);
    gl.deleteProgram(this.renderProg);
    gl.deleteBuffer(this.agentBuffers[0]);
    gl.deleteBuffer(this.agentBuffers[1]);
    gl.deleteBuffer(this.dlaSeedBuffer);
    gl.deleteBuffer(this.quadBuffer);
    gl.deleteVertexArray(this.agentVaos[0]);
    gl.deleteVertexArray(this.agentVaos[1]);
    gl.deleteVertexArray(this.dlaSeedVao);
    gl.deleteVertexArray(this.quadVao);
    gl.deleteTransformFeedback(this.transformFeedbacks[0]);
    gl.deleteTransformFeedback(this.transformFeedbacks[1]);
    gl.deleteTexture(this.trailTextures[0]);
    gl.deleteTexture(this.trailTextures[1]);
    gl.deleteTexture(this.guideTexture);
    gl.deleteTexture(this.guideTexture2);
    gl.deleteTexture(this.guideTexture3);
    gl.deleteFramebuffer(this.trailFbos[0]);
    gl.deleteFramebuffer(this.trailFbos[1]);
  }
}
