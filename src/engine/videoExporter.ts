import { ArrayBufferTarget as Mp4BufferTarget, Muxer as Mp4Muxer } from 'mp4-muxer';
import { ArrayBufferTarget as WebmBufferTarget, Muxer as WebmMuxer } from 'webm-muxer';
import { SimulationParams } from '../types/simulation';
import { ISimulationEngine } from './SimulationEngine';

export type VideoFormat = 'mp4' | 'webm';

export interface VideoExportOptions {
  format: VideoFormat;
  durationSec: number;
  fps: number;
  stepsPerFrame: number;
  resetBeforeRender: boolean;
  bitrateMbps: number;
}

export interface VideoExportResult {
  blob: Blob;
  url: string;
  extension: 'mp4' | 'webm';
  mimeType: string;
  frameCount: number;
  durationSec: number;
  width: number;
  height: number;
}

export interface ExportProgress {
  frame: number;
  totalFrames: number;
  percent: number;
  phase: 'encoding' | 'finalizing';
}

interface CodecCandidate {
  webCodec: string;
  muxCodec: 'avc' | 'av1' | 'vp9' | 'V_VP9' | 'V_VP8';
}

const DEFAULT_COLOR_SPACE: VideoColorSpaceInit = {
  primaries: 'bt709',
  transfer: 'iec61966-2-1',
  matrix: 'bt709',
  fullRange: false,
};

function buildEncoderConfig(
  candidate: CodecCandidate,
  width: number,
  height: number,
  fps: number,
  bitrate: number
): VideoEncoderConfig {
  const cfg: VideoEncoderConfig = {
    codec: candidate.webCodec,
    width,
    height,
    bitrate,
    framerate: fps,
  };
  if (candidate.muxCodec === 'avc') {
    cfg.avc = { format: 'avc' };
  }
  return cfg;
}

function normalizeMetadata(
  meta: EncodedVideoChunkMetadata | undefined,
  candidate: CodecCandidate,
  width: number,
  height: number
): EncodedVideoChunkMetadata | undefined {
  const rawDc = meta?.decoderConfig;
  if (!rawDc) {
    // Only synthesize decoderConfig for codecs that do not require an out-of-band AVCC description
    if (candidate.muxCodec === 'vp9' || candidate.muxCodec === 'av1' || candidate.muxCodec === 'V_VP9' || candidate.muxCodec === 'V_VP8') {
      return {
        ...meta,
        decoderConfig: {
          codec: candidate.webCodec,
          codedWidth: width,
          codedHeight: height,
          colorSpace: DEFAULT_COLOR_SPACE,
        },
      };
    }
    return meta;
  }

  const cs = rawDc.colorSpace;
  return {
    ...meta,
    decoderConfig: {
      ...rawDc,
      colorSpace: {
        primaries: cs?.primaries ?? 'bt709',
        transfer: cs?.transfer ?? 'iec61966-2-1',
        matrix: cs?.matrix ?? 'bt709',
        fullRange: cs?.fullRange ?? false,
      },
    },
  };
}

async function probeCodecCandidate(
  candidate: CodecCandidate,
  width: number,
  height: number,
  fps: number,
  bitrate: number,
  probeCanvas: HTMLCanvasElement
): Promise<boolean> {
  const config = buildEncoderConfig(candidate, width, height, fps, bitrate);
  try {
    const support = await VideoEncoder.isConfigSupported(config);
    if (!support.supported) return false;
  } catch {
    return false;
  }

  return new Promise<boolean>((resolve) => {
    let resolved = false;
    let gotChunk = false;
    let gotValidMeta = false;
    let encoder: VideoEncoder | null = null;

    const finish = (ok: boolean) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      try {
        if (encoder && encoder.state !== 'closed') {
          encoder.close();
        }
      } catch {
        // ignore close error
      }
      resolve(ok);
    };

    const timer = setTimeout(() => finish(false), 1500);

    try {
      encoder = new VideoEncoder({
        output: (_chunk, meta) => {
          gotChunk = true;
          if (candidate.muxCodec === 'avc') {
            if (meta?.decoderConfig?.description) {
              gotValidMeta = true;
            }
          } else {
            gotValidMeta = true;
          }
        },
        error: () => finish(false),
      });

      encoder.configure(config);
      const vf = new VideoFrame(probeCanvas, {
        timestamp: 0,
        duration: Math.round(1_000_000 / fps),
      });
      encoder.encode(vf, { keyFrame: true });
      vf.close();

      encoder
        .flush()
        .then(() => finish(gotChunk && gotValidMeta))
        .catch(() => finish(false));
    } catch {
      finish(false);
    }
  });
}

async function pickSupportedVideoCodec(
  format: VideoFormat,
  width: number,
  height: number,
  fps: number,
  bitrate: number
): Promise<CodecCandidate | null> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
    return null;
  }

  const candidates: CodecCandidate[] =
    format === 'mp4'
      ? [
          { webCodec: 'avc1.640032', muxCodec: 'avc' },
          { webCodec: 'avc1.64002A', muxCodec: 'avc' },
          { webCodec: 'avc1.640028', muxCodec: 'avc' },
          { webCodec: 'avc1.64001F', muxCodec: 'avc' },
          { webCodec: 'avc1.4D4028', muxCodec: 'avc' },
          { webCodec: 'avc1.4D401F', muxCodec: 'avc' },
          { webCodec: 'avc1.42E01E', muxCodec: 'avc' },
          { webCodec: 'avc1.42001E', muxCodec: 'avc' },
          { webCodec: 'vp09.00.10.08', muxCodec: 'vp9' },
          { webCodec: 'av01.0.04M.08', muxCodec: 'av1' },
        ]
      : [
          { webCodec: 'vp09.00.10.08', muxCodec: 'V_VP9' },
          { webCodec: 'vp8', muxCodec: 'V_VP8' },
        ];

  const probeCanvas = document.createElement('canvas');
  probeCanvas.width = width;
  probeCanvas.height = height;
  const ctx = probeCanvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
  }

  for (const c of candidates) {
    const ok = await probeCodecCandidate(c, width, height, fps, bitrate, probeCanvas);
    if (ok) {
      return c;
    }
  }

  return null;
}

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function exportSimulationVideo(
  canvas: HTMLCanvasElement,
  engine: ISimulationEngine,
  params: SimulationParams,
  options: VideoExportOptions,
  onProgress: (p: ExportProgress) => void,
  signal?: AbortSignal
): Promise<VideoExportResult> {
  const { format, durationSec, fps, stepsPerFrame, resetBeforeRender, bitrateMbps } = options;
  const width = canvas.width;
  const height = canvas.height;
  const totalFrames = Math.max(1, Math.round(durationSec * fps));
  const bitrate = Math.round(bitrateMbps * 1_000_000);

  let codecMatch = await pickSupportedVideoCodec(format, width, height, fps, bitrate);
  let effectiveFormat: VideoFormat = format;

  // If MP4 WebCodecs couldn't find any working codec (e.g., Firefox lacking H.264/AV1 MP4 decoderConfig),
  // try WebM WebCodecs first before falling back to MediaRecorder so capture remains deterministic.
  if (!codecMatch && format === 'mp4') {
    const webmFallback = await pickSupportedVideoCodec('webm', width, height, fps, bitrate);
    if (webmFallback) {
      codecMatch = webmFallback;
      effectiveFormat = 'webm';
    }
  }

  if (resetBeforeRender) {
    engine.resetSimulation(params);
    engine.render(params);
  }

  if (codecMatch) {
    try {
      return await exportWithWebCodecs(
        canvas,
        engine,
        params,
        effectiveFormat,
        codecMatch,
        width,
        height,
        fps,
        totalFrames,
        stepsPerFrame,
        bitrate,
        onProgress,
        signal
      );
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') {
        throw err;
      }
      // If WebCodecs muxing fails mid-flight, reset cleanly and fall back to MediaRecorder
      if (resetBeforeRender) {
        engine.resetSimulation(params);
        engine.render(params);
      }
    }
  }

  return exportWithMediaRecorder(
    canvas,
    engine,
    params,
    format,
    fps,
    totalFrames,
    stepsPerFrame,
    bitrate,
    onProgress,
    signal
  );
}

async function exportWithWebCodecs(
  canvas: HTMLCanvasElement,
  engine: ISimulationEngine,
  params: SimulationParams,
  format: VideoFormat,
  candidate: CodecCandidate,
  width: number,
  height: number,
  fps: number,
  totalFrames: number,
  stepsPerFrame: number,
  bitrate: number,
  onProgress: (p: ExportProgress) => void,
  signal?: AbortSignal
): Promise<VideoExportResult> {
  let encoderError: Error | null = null;
  const encoderConfig = buildEncoderConfig(candidate, width, height, fps, bitrate);

  if (format === 'mp4') {
    const target = new Mp4BufferTarget();
    const muxer = new Mp4Muxer({
      target,
      video: {
        codec: candidate.muxCodec as 'avc' | 'vp9' | 'av1',
        width,
        height,
        frameRate: fps,
      },
      fastStart: 'in-memory',
    });

    const encoder = new VideoEncoder({
      output: (chunk, meta) => {
        const normalized = normalizeMetadata(meta, candidate, width, height);
        muxer.addVideoChunk(chunk, normalized);
      },
      error: (err) => {
        encoderError = err instanceof Error ? err : new Error(String(err));
      },
    });

    encoder.configure(encoderConfig);

    const frameDurationUs = Math.round(1_000_000 / fps);

    for (let frame = 0; frame < totalFrames; frame++) {
      if (signal?.aborted) {
        encoder.close();
        throw new DOMException('Renderização cancelada.', 'AbortError');
      }
      if (encoderError) {
        encoder.close();
        throw encoderError;
      }

      if (frame > 0 || !engine.getStepCount()) {
        engine.step(params, stepsPerFrame);
      }
      engine.render(params);

      const vf = new VideoFrame(canvas, {
        timestamp: frame * frameDurationUs,
        duration: frameDurationUs,
      });

      encoder.encode(vf, { keyFrame: frame % (fps * 2) === 0 });
      vf.close();

      onProgress({
        frame: frame + 1,
        totalFrames,
        percent: Math.round(((frame + 1) / totalFrames) * 100),
        phase: 'encoding',
      });

      if (encoder.encodeQueueSize > 8 || frame % 4 === 0) {
        await yieldToUi();
      }
    }

    onProgress({
      frame: totalFrames,
      totalFrames,
      percent: 100,
      phase: 'finalizing',
    });

    await encoder.flush();
    encoder.close();
    if (encoderError) {
      throw encoderError;
    }
    muxer.finalize();

    const blob = new Blob([target.buffer], { type: 'video/mp4' });
    return {
      blob,
      url: URL.createObjectURL(blob),
      extension: 'mp4',
      mimeType: 'video/mp4',
      frameCount: totalFrames,
      durationSec: totalFrames / fps,
      width,
      height,
    };
  } else {
    const target = new WebmBufferTarget();
    const muxer = new WebmMuxer({
      target,
      video: {
        codec: candidate.muxCodec,
        width,
        height,
        frameRate: fps,
      },
    });

    const encoder = new VideoEncoder({
      output: (chunk, meta) => {
        const normalized = normalizeMetadata(meta, candidate, width, height);
        muxer.addVideoChunk(chunk, normalized);
      },
      error: (err) => {
        encoderError = err instanceof Error ? err : new Error(String(err));
      },
    });

    encoder.configure(encoderConfig);

    const frameDurationUs = Math.round(1_000_000 / fps);

    for (let frame = 0; frame < totalFrames; frame++) {
      if (signal?.aborted) {
        encoder.close();
        throw new DOMException('Renderização cancelada.', 'AbortError');
      }
      if (encoderError) {
        encoder.close();
        throw encoderError;
      }

      if (frame > 0 || !engine.getStepCount()) {
        engine.step(params, stepsPerFrame);
      }
      engine.render(params);

      const vf = new VideoFrame(canvas, {
        timestamp: frame * frameDurationUs,
        duration: frameDurationUs,
      });

      encoder.encode(vf, { keyFrame: frame % (fps * 2) === 0 });
      vf.close();

      onProgress({
        frame: frame + 1,
        totalFrames,
        percent: Math.round(((frame + 1) / totalFrames) * 100),
        phase: 'encoding',
      });

      if (encoder.encodeQueueSize > 8 || frame % 4 === 0) {
        await yieldToUi();
      }
    }

    onProgress({
      frame: totalFrames,
      totalFrames,
      percent: 100,
      phase: 'finalizing',
    });

    await encoder.flush();
    encoder.close();
    if (encoderError) {
      throw encoderError;
    }
    muxer.finalize();

    const blob = new Blob([target.buffer], { type: 'video/webm' });
    return {
      blob,
      url: URL.createObjectURL(blob),
      extension: 'webm',
      mimeType: 'video/webm',
      frameCount: totalFrames,
      durationSec: totalFrames / fps,
      width,
      height,
    };
  }
}

async function exportWithMediaRecorder(
  canvas: HTMLCanvasElement,
  engine: ISimulationEngine,
  params: SimulationParams,
  preferredFormat: VideoFormat,
  fps: number,
  totalFrames: number,
  stepsPerFrame: number,
  bitrate: number,
  onProgress: (p: ExportProgress) => void,
  signal?: AbortSignal
): Promise<VideoExportResult> {
  const mimeCandidates =
    preferredFormat === 'mp4'
      ? [
          'video/mp4;codecs=avc1',
          'video/mp4',
          'video/webm;codecs=vp9',
          'video/webm;codecs=vp8',
          'video/webm',
        ]
      : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];

  const mimeType =
    mimeCandidates.find(
      (m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)
    ) || 'video/webm';
  const isMp4 = mimeType.startsWith('video/mp4');

  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: bitrate,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const stopPromise = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    recorder.onerror = () => reject(new Error('Falha ao gravar vídeo via MediaRecorder.'));
  });

  recorder.start(200);
  const frameIntervalMs = 1000 / fps;

  for (let frame = 0; frame < totalFrames; frame++) {
    if (signal?.aborted) {
      recorder.stop();
      stream.getTracks().forEach((t) => t.stop());
      throw new DOMException('Renderização cancelada.', 'AbortError');
    }

    const start = performance.now();
    engine.step(params, stepsPerFrame);
    engine.render(params);

    onProgress({
      frame: frame + 1,
      totalFrames,
      percent: Math.round(((frame + 1) / totalFrames) * 100),
      phase: 'encoding',
    });

    const elapsed = performance.now() - start;
    const waitMs = Math.max(0, frameIntervalMs - elapsed);
    await new Promise((r) => setTimeout(r, waitMs));
  }

  onProgress({
    frame: totalFrames,
    totalFrames,
    percent: 100,
    phase: 'finalizing',
  });

  recorder.stop();
  stream.getTracks().forEach((t) => t.stop());
  const blob = await stopPromise;

  return {
    blob,
    url: URL.createObjectURL(blob),
    extension: isMp4 ? 'mp4' : 'webm',
    mimeType,
    frameCount: totalFrames,
    durationSec: totalFrames / fps,
    width: canvas.width,
    height: canvas.height,
  };
}
