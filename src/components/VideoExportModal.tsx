import React, { useEffect, useRef, useState } from 'react';
import { Download, Film, RotateCcw, X } from 'lucide-react';
import {
  ExportProgress,
  VideoExportOptions,
  VideoExportResult,
  VideoFormat,
  exportSimulationVideo,
} from '../engine/videoExporter';
import { ISimulationEngine } from '../engine/SimulationEngine';
import { SimulationParams } from '../types/simulation';

interface VideoExportModalProps {
  open: boolean;
  onClose: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  engineRef: React.RefObject<ISimulationEngine | null>;
  params: SimulationParams;
  onPauseSimulation: () => void;
  onPrepareResolution: (width: number, height: number) => void;
}

type QualityId = 'normal' | 'hd' | 'fullhd' | 'ultra2k';

const QUALITY_PRESETS: Array<{
  id: QualityId;
  label: string;
  resLabel: string;
  size: number;
  defaultBitrate: number;
}> = [
  { id: 'normal', label: 'Normal', resLabel: '512×512', size: 512, defaultBitrate: 6 },
  { id: 'hd', label: 'HD', resLabel: '720×720', size: 720, defaultBitrate: 10 },
  { id: 'fullhd', label: 'Full HD', resLabel: '1080×1080', size: 1080, defaultBitrate: 14 },
  { id: 'ultra2k', label: '2K Ultra', resLabel: '1440×1440', size: 1440, defaultBitrate: 20 },
];

export const VideoExportModal: React.FC<VideoExportModalProps> = ({
  open,
  onClose,
  canvasRef,
  engineRef,
  params,
  onPauseSimulation,
  onPrepareResolution,
}) => {
  const [format, setFormat] = useState<VideoFormat>('mp4');
  const [qualityId, setQualityId] = useState<QualityId>('fullhd');
  const [durationSec, setDurationSec] = useState(
    params.formationDurationSec > 0 ? params.formationDurationSec : 10
  );
  const [fps, setFps] = useState(24);
  const [stepsPerFrame, setStepsPerFrame] = useState(1);
  const [bitrateMbps, setBitrateMbps] = useState(14);
  const [resetBeforeRender, setResetBeforeRender] = useState(true);

  const [isRendering, setIsRendering] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [result, setResult] = useState<VideoExportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const selectedQuality =
    QUALITY_PRESETS.find((q) => q.id === qualityId) ?? QUALITY_PRESETS[2];

  useEffect(() => {
    if (open && params.formationDurationSec > 0) {
      setDurationSec(params.formationDurationSec);
      setStepsPerFrame(1);
    }
  }, [open, params.formationDurationSec]);

  useEffect(() => {
    return () => {
      if (result?.url) {
        URL.revokeObjectURL(result.url);
      }
    };
  }, [result]);

  if (!open) return null;

  const handleStartRender = async () => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;

    onPauseSimulation();
    setErrorMsg(null);
    if (result?.url) {
      URL.revokeObjectURL(result.url);
      setResult(null);
    }

    const targetSize = selectedQuality.size;
    const sizeChanged = targetSize !== params.width || targetSize !== params.height;

    const controller = new AbortController();
    abortRef.current = controller;
    setIsRendering(true);
    setProgress({
      frame: 0,
      totalFrames: Math.round(durationSec * fps),
      percent: 0,
      phase: 'encoding',
    });

    const baseParams: SimulationParams = {
      ...params,
      width: targetSize,
      height: targetSize,
    };

    // Ensure targetSteps matches video total steps (at 24 steps/sec baseline) if formationDurationSec > 0
    const scaledDuration = (durationSec * fps * stepsPerFrame) / 24;
    const exportParams: SimulationParams =
      baseParams.formationDurationSec > 0
        ? {
            ...baseParams,
            formationDurationSec: scaledDuration,
            imageStartSec:
              baseParams.imageStartSec * (scaledDuration / baseParams.formationDurationSec),
            imageFormationMaxSec:
              baseParams.imageFormationMaxSec * (scaledDuration / baseParams.formationDurationSec),
            imageHoldSec:
              baseParams.imageHoldSec * (scaledDuration / baseParams.formationDurationSec),
            sporeDeathSec:
              baseParams.sporeDeathSec * (scaledDuration / baseParams.formationDurationSec),
          }
        : baseParams;

    const options: VideoExportOptions = {
      format,
      durationSec,
      fps,
      stepsPerFrame,
      resetBeforeRender: resetBeforeRender || sizeChanged,
      bitrateMbps,
    };

    try {
      if (sizeChanged) {
        onPrepareResolution(targetSize, targetSize);
      }
      const res = await exportSimulationVideo(
        canvas,
        engine,
        exportParams,
        options,
        (p) => setProgress(p),
        controller.signal
      );
      setResult(res);
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'Não foi possível renderizar o vídeo neste navegador.'
        );
      }
    } finally {
      if (sizeChanged) {
        onPrepareResolution(params.width, params.height);
      }
      setIsRendering(false);
      abortRef.current = null;
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  const handleDownload = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = `micelio-${result.width}x${result.height}-${fps}fps.${result.extension}`;
    a.click();
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
    >
      <div className="w-full max-w-xl bg-[#0D1119] border border-slate-800 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h2 id="export-modal-title" className="text-base font-semibold text-slate-100">
              Renderizar Vídeo da Simulação
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 font-mono tabular-nums">
              {selectedQuality.size} × {selectedQuality.size} px (1:1 · {selectedQuality.label}) · Complexidade {params.complexity}× · Sem perda
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (isRendering) handleCancel();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-100 rounded transition-colors cursor-pointer"
            aria-label="Fechar janela de renderização"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {!isRendering && !result && (
            <>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Qualidade e Resolução (Formato 1:1 Quadrado)
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {QUALITY_PRESETS.map((q) => {
                    const active = qualityId === q.id;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => {
                          setQualityId(q.id);
                          setBitrateMbps(q.defaultBitrate);
                        }}
                        className={`py-2 px-2 rounded-md border text-left transition-colors cursor-pointer ${
                          active
                            ? 'bg-cyan-400 border-cyan-400 text-slate-950'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-semibold">{q.label}</div>
                        <div
                          className={`text-[10px] font-mono tabular-nums ${
                            active ? 'text-slate-900' : 'text-slate-400'
                          }`}
                        >
                          {q.resLabel}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-300">Formato</label>
                  <div className="grid grid-cols-2 gap-1 p-1 bg-slate-900 border border-slate-800 rounded-md">
                    <button
                      type="button"
                      onClick={() => setFormat('mp4')}
                      className={`py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                        format === 'mp4'
                          ? 'bg-cyan-400 text-slate-950'
                          : 'text-slate-400 hover:text-slate-100'
                      }`}
                    >
                      MP4 (H.264)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormat('webm')}
                      className={`py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                        format === 'webm'
                          ? 'bg-cyan-400 text-slate-950'
                          : 'text-slate-400 hover:text-slate-100'
                      }`}
                    >
                      WebM (VP9)
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-300">Taxa de Quadros</label>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-slate-900 border border-slate-800 rounded-md">
                    {[24, 30, 60].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setFps(rate)}
                        className={`py-1.5 text-xs font-mono font-medium rounded transition-colors cursor-pointer ${
                          fps === rate
                            ? 'bg-cyan-400 text-slate-950'
                            : 'text-slate-400 hover:text-slate-100'
                        }`}
                      >
                        {rate} fps
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="text-slate-300 font-medium">Duração</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={durationSec}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (Number.isFinite(val) && val >= 1) {
                            setDurationSec(val);
                          }
                        }}
                        className="w-16 px-1.5 py-0.5 text-xs font-mono tabular-nums text-right bg-slate-900 border border-slate-700 rounded text-slate-200 outline-none focus:border-cyan-400"
                      />
                      <span className="font-mono text-slate-400">s</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={Math.max(120, Math.ceil(durationSec))}
                    step={1}
                    value={durationSec}
                    onChange={(e) => setDurationSec(Number(e.target.value))}
                    className="w-full studio-slider"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="text-slate-300 font-medium">Passos por Quadro</label>
                    <span className="font-mono tabular-nums text-slate-200">
                      {stepsPerFrame}×/quadro
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={6}
                    step={1}
                    value={stepsPerFrame}
                    onChange={(e) => setStepsPerFrame(Number(e.target.value))}
                    className="w-full studio-slider"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="text-slate-300 font-medium">Taxa de Bits (Compressão)</label>
                  <span className="font-mono tabular-nums text-slate-200">{bitrateMbps} Mbps</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={28}
                  step={2}
                  value={bitrateMbps}
                  onChange={(e) => setBitrateMbps(Number(e.target.value))}
                  className="w-full studio-slider"
                />
              </div>

              <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={resetBeforeRender}
                  onChange={(e) => setResetBeforeRender(e.target.checked)}
                  className="w-4 h-4 accent-cyan-400 rounded border-slate-700 bg-slate-900"
                />
                <span>Reiniciar simulação do quadro 0 para capturar todo o crescimento</span>
              </label>

              {errorMsg && (
                <div className="p-3 text-xs text-rose-300 bg-rose-950/50 border border-rose-800/70 rounded-md">
                  {errorMsg}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <span className="text-xs font-mono tabular-nums text-slate-400">
                  Total: {Math.round(durationSec * fps)} quadros
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-slate-100 rounded-md transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleStartRender}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-md transition-colors cursor-pointer"
                  >
                    <Film className="w-3.5 h-3.5" />
                    <span>Iniciar Renderização</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {isRendering && progress && (
            <div className="py-4 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-200 font-medium">
                  {progress.phase === 'finalizing'
                    ? 'Finalizando arquivo de vídeo...'
                    : 'Codificando quadros em GPU...'}
                </span>
                <span className="font-mono tabular-nums text-cyan-400">
                  {progress.frame} / {progress.totalFrames} ({progress.percent}%)
                </span>
              </div>
              <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-cyan-400 transition-all duration-150"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 text-xs font-medium text-rose-300 border border-rose-800/80 hover:bg-rose-950/40 rounded-md transition-colors cursor-pointer"
                >
                  Cancelar Renderização
                </button>
              </div>
            </div>
          )}

          {!isRendering && result && (
            <div className="space-y-4">
              <div className="bg-black border border-slate-800 rounded-md overflow-hidden flex items-center justify-center">
                <video
                  src={result.url}
                  controls
                  loop
                  autoPlay
                  playsInline
                  className="max-h-72 w-auto"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 font-mono tabular-nums">
                <span>
                  {result.width}×{result.height} · {result.durationSec.toFixed(1)}s ·{' '}
                  {result.extension.toUpperCase()} · {formatBytes(result.blob.size)}
                </span>
                <div className="flex items-center gap-2 font-sans">
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(result.url);
                      setResult(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 border border-slate-700 hover:border-slate-500 rounded-md transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Nova Renderização</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-md transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar Vídeo</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
