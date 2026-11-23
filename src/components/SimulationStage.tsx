import React from 'react';
import { Camera, Pause, Play, RotateCcw, StepForward } from 'lucide-react';
import { computeImageTimelineState } from '../engine/timeline';
import { ImageLoopMode } from '../types/simulation';

interface SimulationStageProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  complexity: number;
  width: number;
  height: number;
  isPlaying: boolean;
  formationComplete: boolean;
  formationDurationSec: number;
  formationProgress: number; // 0..1
  imageStartSec?: number;
  imageFormationMaxSec?: number;
  imageHoldSec?: number;
  imageLoopMode?: ImageLoopMode;
  sporeDeathSec?: number;
  onTogglePlay: () => void;
  onStepOnce: () => void;
  onReset: () => void;
  speedMultiplier: number;
  onSpeedChange: (mult: number) => void;
  onSaveSnapshot: () => void;
  fps: number;
  stepCount: number;
  activeCount: number;
  hasImage?: boolean;
  hasImage2?: boolean;
  hasImage3?: boolean;
  webglError: string | null;
}

export const SimulationStage: React.FC<SimulationStageProps> = ({
  canvasRef,
  complexity,
  width,
  height,
  isPlaying,
  formationComplete,
  formationDurationSec,
  formationProgress,
  imageStartSec = 0,
  imageFormationMaxSec = 8,
  imageHoldSec = 1.5,
  imageLoopMode = 'once',
  sporeDeathSec = 5,
  onTogglePlay,
  onStepOnce,
  onReset,
  speedMultiplier,
  onSpeedChange,
  onSaveSnapshot,
  fps,
  stepCount,
  activeCount,
  hasImage = false,
  hasImage2 = false,
  hasImage3 = false,
  webglError,
}) => {
  const pct = Math.round(formationProgress * 100);
  const elapsedSecNum =
    formationDurationSec > 0 ? formationProgress * formationDurationSec : stepCount / 24;
  const elapsedSec = elapsedSecNum.toFixed(1);

  const seq = computeImageTimelineState(
    {
      formationDurationSec,
      imageStartSec,
      imageFormationMaxSec,
      imageHoldSec,
      imageLoopMode,
      sporeDeathSec,
      hasImage,
      hasImage2,
      hasImage3,
    },
    elapsedSecNum
  );

  const isDying = seq.deathProgress > 0.01;

  return (
    <main className="flex-1 flex flex-col min-w-0 bg-[#07090E] overflow-hidden">
      {/* Top Playback & Telemetry Ribbon */}
      <div className="px-4 py-2.5 border-b border-slate-800/80 bg-[#0A0D14] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTogglePlay}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'Pausar' : 'Continuar'}</span>
          </button>

          <button
            type="button"
            onClick={onStepOnce}
            disabled={isPlaying}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-[#111622] border border-slate-800 hover:border-slate-600 disabled:opacity-40 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <StepForward className="w-3.5 h-3.5" />
            <span>+1 Quadro</span>
          </button>

          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-[#111622] border border-slate-800 hover:border-slate-600 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reiniciar</span>
          </button>

          <div className="flex items-center gap-0.5 p-0.5 bg-[#07090E] border border-slate-800 rounded ml-1">
            {[0.25, 0.5, 1, 2, 4].map((mult) => (
              <button
                key={mult}
                type="button"
                onClick={() => onSpeedChange(mult)}
                className={`px-2 py-1 text-[11px] font-mono rounded transition-colors cursor-pointer whitespace-nowrap ${
                  speedMultiplier === mult
                    ? 'bg-slate-800 text-cyan-300 font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {mult}×
              </button>
            ))}
          </div>
        </div>

        {/* Clean Unboxed Telemetry Metadata */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-slate-400">
            {formationDurationSec > 0 ? (
              <>
                <span className={formationComplete ? 'text-emerald-400' : 'text-cyan-300'}>
                  {formationComplete
                    ? `Concluído (${formationDurationSec}s)`
                    : `${elapsedSec}s / ${formationDurationSec}s (${pct}%)`}
                </span>
                <span aria-hidden="true">·</span>
              </>
            ) : (
              <>
                <span className="text-slate-300">{elapsedSec}s</span>
                <span aria-hidden="true">·</span>
              </>
            )}
            {seq.hasAnyImage && (
              <>
                <span
                  className={
                    isDying
                      ? 'text-amber-300'
                      : seq.isTransitioning
                      ? 'text-cyan-300'
                      : 'text-slate-300'
                  }
                >
                  {seq.phaseLabel}
                </span>
                <span aria-hidden="true">·</span>
              </>
            )}
            <span className="text-slate-200">{fps} FPS</span>
            <span aria-hidden="true">·</span>
            <span className={isDying ? 'text-amber-300' : undefined}>
              {activeCount.toLocaleString('pt-BR')} {isDying ? 'vivos' : 'esporos'}
            </span>
            {complexity > 1 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-cyan-300">Comp. {complexity}×</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span>Q{String(stepCount).padStart(4, '0')}</span>
            <span aria-hidden="true">·</span>
            <span>
              {width}×{height}
            </span>
          </div>

          <button
            type="button"
            onClick={onSaveSnapshot}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-[#111622] border border-slate-800 hover:border-slate-600 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Salvar PNG</span>
          </button>
        </div>
      </div>

      {/* Formation Progress Hairline */}
      {formationDurationSec > 0 && (
        <div className="h-0.5 w-full bg-slate-900 shrink-0">
          <div
            className={`h-full transition-all duration-150 ${
              formationComplete
                ? 'bg-emerald-400'
                : isDying
                ? 'bg-amber-400'
                : 'bg-cyan-400'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {/* Central Canvas Stage */}
      <div className="flex-1 relative flex items-center justify-center p-4 sm:p-6 overflow-auto">
        {webglError ? (
          <div className="max-w-md p-5 bg-[#0D1119] border border-rose-800/70 rounded-md text-sm text-rose-200">
            <div className="font-semibold mb-1">WebGL2 Indisponível</div>
            <p className="text-xs text-rose-300/90">{webglError}</p>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            style={{
              aspectRatio: `${width} / ${height}`,
              maxWidth: '100%',
              maxHeight: 'calc(100vh - 155px)',
              width: `min(${width}px, 100%, calc((100vh - 155px) * ${width} / ${height}))`,
            }}
            className="border border-slate-800 bg-black block shadow-2xl"
          />
        )}
      </div>
    </main>
  );
};
