import { useCallback, useEffect, useRef, useState } from 'react';
import { ControlSidebar, SidebarTab } from './components/ControlSidebar';
import { SimulationStage } from './components/SimulationStage';
import { TopBar } from './components/TopBar';
import { VideoExportModal } from './components/VideoExportModal';
import { PhysarumEngine } from './engine/PhysarumEngine';
import { ISimulationEngine } from './engine/SimulationEngine';
import {
  SampleTemplateId,
  generateSampleTemplate,
  processImageToGuideMap,
} from './engine/imageProcessor';
import {
  DEFAULT_PARAMS,
  PRESETS,
  PresetDefinition,
  SimulationParams,
} from './types/simulation';

function nextRandomSeed(): number {
  return Math.floor(Math.random() * 999999) + 1;
}

export default function App() {
  const [params, setParams] = useState<SimulationParams>(() => ({
    ...DEFAULT_PARAMS,
    seed: nextRandomSeed(),
  }));
  const paramsRef = useRef<SimulationParams>(params);
  paramsRef.current = params;

  const [activeTab, setActiveTab] = useState<SidebarTab>('fungus');
  const [activePresetId, setActivePresetId] = useState<string | null>(PRESETS[0].id);
  const [isPlaying, setIsPlaying] = useState(true);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const [formationComplete, setFormationComplete] = useState(false);
  const [formationProgress, setFormationProgress] = useState(0);

  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const speedRef = useRef(speedMultiplier);
  speedRef.current = speedMultiplier;

  const [exportOpen, setExportOpen] = useState(false);
  const [webglError, setWebglError] = useState<string | null>(null);

  const [fps, setFps] = useState(60);
  const [stepCount, setStepCount] = useState(0);
  const [activeCount, setActiveCount] = useState(DEFAULT_PARAMS.particleCount);

  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [image2PreviewUrl, setImage2PreviewUrl] = useState<string | null>(null);
  const [image2Name, setImage2Name] = useState<string | null>(null);
  const [image3PreviewUrl, setImage3PreviewUrl] = useState<string | null>(null);
  const [image3Name, setImage3Name] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<ISimulationEngine | null>(null);
  const sourceImageRef = useRef<HTMLImageElement | HTMLCanvasElement | null>(null);
  const sourceImage2Ref = useRef<HTMLImageElement | HTMLCanvasElement | null>(null);
  const sourceImage3Ref = useRef<HTMLImageElement | HTMLCanvasElement | null>(null);

  const applyCurrentImageGuide = useCallback((nextParams: SimulationParams) => {
    const engine = engineRef.current;
    const src = sourceImageRef.current;
    if (!engine || !src) return;

    const processed = processImageToGuideMap(src, {
      width: nextParams.width,
      height: nextParams.height,
      invert: nextParams.imageInvert,
      contrast: nextParams.imageContrast,
      threshold: nextParams.imageThreshold,
      fit: nextParams.imageFit,
    });

    engine.setImageGuide(processed.guideRGB);
    setImagePreviewUrl(processed.previewDataUrl);
  }, []);

  const applyImageGuide2 = useCallback((nextParams: SimulationParams) => {
    const engine = engineRef.current;
    const src2 = sourceImage2Ref.current;
    if (!engine || !src2) return;

    const processed2 = processImageToGuideMap(src2, {
      width: nextParams.width,
      height: nextParams.height,
      invert: nextParams.imageInvert,
      contrast: nextParams.imageContrast,
      threshold: nextParams.imageThreshold,
      fit: nextParams.imageFit,
    });

    engine.setSecondImageGuide(processed2.guideRGB);
    setImage2PreviewUrl(processed2.previewDataUrl);
  }, []);

  const applyImageGuide3 = useCallback((nextParams: SimulationParams) => {
    const engine = engineRef.current;
    const src3 = sourceImage3Ref.current;
    if (!engine || !src3) return;

    const processed3 = processImageToGuideMap(src3, {
      width: nextParams.width,
      height: nextParams.height,
      invert: nextParams.imageInvert,
      contrast: nextParams.imageContrast,
      threshold: nextParams.imageThreshold,
      fit: nextParams.imageFit,
    });

    engine.setThirdImageGuide(processed3.guideRGB);
    setImage3PreviewUrl(processed3.previewDataUrl);
  }, []);

  // Initialize WebGL2 Physarum engine once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const curInit = paramsRef.current;
      const engine = new PhysarumEngine(canvas, curInit);
      engineRef.current = engine;

      let loadedAny = false;
      if (curInit.hasImage && sourceImageRef.current) {
        const processed = processImageToGuideMap(sourceImageRef.current, {
          width: curInit.width,
          height: curInit.height,
          invert: curInit.imageInvert,
          contrast: curInit.imageContrast,
          threshold: curInit.imageThreshold,
          fit: curInit.imageFit,
        });
        engine.setImageGuide(processed.guideRGB);
        setImagePreviewUrl(processed.previewDataUrl);
        loadedAny = true;
      }

      if (curInit.hasImage2 && sourceImage2Ref.current) {
        const processed2 = processImageToGuideMap(sourceImage2Ref.current, {
          width: curInit.width,
          height: curInit.height,
          invert: curInit.imageInvert,
          contrast: curInit.imageContrast,
          threshold: curInit.imageThreshold,
          fit: curInit.imageFit,
        });
        engine.setSecondImageGuide(processed2.guideRGB);
        setImage2PreviewUrl(processed2.previewDataUrl);
        loadedAny = true;
      }

      if (curInit.hasImage3 && sourceImage3Ref.current) {
        const processed3 = processImageToGuideMap(sourceImage3Ref.current, {
          width: curInit.width,
          height: curInit.height,
          invert: curInit.imageInvert,
          contrast: curInit.imageContrast,
          threshold: curInit.imageThreshold,
          fit: curInit.imageFit,
        });
        engine.setThirdImageGuide(processed3.guideRGB);
        setImage3PreviewUrl(processed3.previewDataUrl);
        loadedAny = true;
      }

      if (loadedAny) {
        engine.resetSimulation(curInit);
      }

      engine.render(curInit);
      setStepCount(engine.getStepCount());
      setActiveCount(engine.getActiveCount());
      setFormationComplete(false);
      setFormationProgress(0);
      setIsPlaying(true);
      setWebglError(null);

      let rafId = 0;
      let frameCounter = 0;
      let lastFpsCheck = performance.now();
      let lastTime = lastFpsCheck;
      let stepAccumulator = 0;

      const loop = (now: number) => {
        const curParams = paramsRef.current;
        const dtSec = Math.min(0.1, Math.max(0, (now - lastTime) / 1000));
        lastTime = now;

        const targetSteps = engine.getTargetSteps(curParams);

        if (isPlayingRef.current) {
          if (targetSteps > 0 && engine.getStepCount() >= targetSteps) {
            setIsPlaying(false);
            setFormationComplete(true);
            setFormationProgress(1);
            setStepCount(engine.getStepCount());
            setActiveCount(engine.getActiveCount());
          } else {
            // Base simulation pacing calibrated to 24 steps/s at 1x
            stepAccumulator += dtSec * 24 * speedRef.current;
            const wholeSteps = Math.min(8, Math.floor(stepAccumulator));

            if (wholeSteps > 0) {
              stepAccumulator -= wholeSteps;
              const remaining =
                targetSteps > 0 ? Math.max(1, targetSteps - engine.getStepCount()) : wholeSteps;
              const steps = targetSteps > 0 ? Math.min(wholeSteps, remaining) : wholeSteps;
              engine.step(curParams, steps);

              if (targetSteps > 0 && engine.getStepCount() >= targetSteps) {
                setIsPlaying(false);
                setFormationComplete(true);
                setFormationProgress(1);
                setStepCount(engine.getStepCount());
                setActiveCount(engine.getActiveCount());
              }
            }
          }
        } else {
          stepAccumulator = 0;
        }

        engine.render(curParams);

        frameCounter++;
        const elapsed = now - lastFpsCheck;
        if (elapsed >= 200) {
          setFps(Math.round((frameCounter * 1000) / elapsed));
          setStepCount(engine.getStepCount());
          setActiveCount(engine.getActiveCount());
          setFormationProgress(engine.getGrowthProgress(curParams));
          frameCounter = 0;
          lastFpsCheck = now;
        }

        rafId = requestAnimationFrame(loop);
      };

      rafId = requestAnimationFrame(loop);

      return () => {
        cancelAnimationFrame(rafId);
        engine.destroy();
        engineRef.current = null;
      };
    } catch (err) {
      setWebglError(err instanceof Error ? err.message : 'Erro ao inicializar WebGL2.');
    }
  }, []);

  // Handle resolution or complexity changes
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.resize(params.width, params.height, params);
    if (params.hasImage && sourceImageRef.current) {
      applyCurrentImageGuide(params);
    }
    if (params.hasImage2 && sourceImage2Ref.current) {
      applyImageGuide2(params);
    }
    if (params.hasImage3 && sourceImage3Ref.current) {
      applyImageGuide3(params);
    }
    engine.resetSimulation(params);
    engine.render(params);
    setStepCount(engine.getStepCount());
    setActiveCount(engine.getActiveCount());
    setFormationComplete(false);
    setFormationProgress(0);
    setIsPlaying(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.width, params.height, params.complexity]);

  // Handle particle count changes
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (engine instanceof PhysarumEngine) {
      engine.updateParticleCount(params);
      setActiveCount(engine.getActiveCount());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.particleCount]);

  // Handle growthModel, spawnMode, imageGuideMode, or formationDurationSec changes -> fresh restart
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.resetSimulation(params);
    engine.render(params);
    setStepCount(engine.getStepCount());
    setActiveCount(engine.getActiveCount());
    setFormationComplete(false);
    setFormationProgress(0);
    setIsPlaying(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.growthModel, params.spawnMode, params.imageGuideMode, params.formationDurationSec]);

  // Handle image tuning changes
  useEffect(() => {
    if (params.hasImage && sourceImageRef.current) {
      applyCurrentImageGuide(params);
    }
    if (params.hasImage2 && sourceImage2Ref.current) {
      applyImageGuide2(params);
    }
    if (params.hasImage3 && sourceImage3Ref.current) {
      applyImageGuide3(params);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    params.imageInvert,
    params.imageContrast,
    params.imageThreshold,
    params.imageFit,
    params.hasImage,
    params.hasImage2,
    params.hasImage3,
  ]);

  const handleUpdateParam = useCallback(
    <K extends keyof SimulationParams>(key: K, value: SimulationParams[K]) => {
      setParams((prev) => {
        const next = { ...prev, [key]: value };
        if (
          (key === 'seed' ||
            (key === 'colonyBehavior' && next.growthModel === 'lichen_mosaic')) &&
          engineRef.current
        ) {
          engineRef.current.resetSimulation(next);
          engineRef.current.render(next);
          setStepCount(0);
          setActiveCount(engineRef.current.getActiveCount());
          setFormationComplete(false);
          setFormationProgress(0);
          setIsPlaying(true);
        }
        return next;
      });
      if (
        key === 'growthModel' ||
        key === 'gsFeed' ||
        key === 'gsKill' ||
        key === 'sensorAngle' ||
        key === 'turnAngle' ||
        key === 'sensorDistance' ||
        key === 'decay' ||
        key === 'colonyBehavior'
      ) {
        setActivePresetId(null);
      }
    },
    []
  );

  const handleSelectPreset = useCallback((preset: PresetDefinition) => {
    setActivePresetId(preset.id);
    setParams((prev) => {
      const next: SimulationParams = {
        ...prev,
        ...preset.patch,
        seed: prev.lockSeed ? prev.seed : nextRandomSeed(),
      };
      if (engineRef.current) {
        engineRef.current.resetSimulation(next);
        engineRef.current.render(next);
        setStepCount(engineRef.current.getStepCount());
        setActiveCount(engineRef.current.getActiveCount());
        setFormationComplete(false);
        setFormationProgress(0);
        setIsPlaying(true);
      }
      return next;
    });
  }, []);

  const handleResetSimulation = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    setParams((prev) => {
      const freshSeed = prev.lockSeed ? prev.seed : nextRandomSeed();
      const next = { ...prev, seed: freshSeed };
      engine.resetSimulation(next);
      engine.render(next);
      setStepCount(engine.getStepCount());
      setActiveCount(engine.getActiveCount());
      setFormationComplete(false);
      setFormationProgress(0);
      setIsPlaying(true);
      return next;
    });
  }, []);

  const handleResetAllControls = useCallback(() => {
    sourceImageRef.current = null;
    sourceImage2Ref.current = null;
    sourceImage3Ref.current = null;
    setImagePreviewUrl(null);
    setImageName(null);
    setImage2PreviewUrl(null);
    setImage2Name(null);
    setImage3PreviewUrl(null);
    setImage3Name(null);
    setActivePresetId(PRESETS[0].id);
    setSpeedMultiplier(1);

    const freshParams: SimulationParams = {
      ...DEFAULT_PARAMS,
      seed: nextRandomSeed(),
    };

    const engine = engineRef.current;
    if (engine) {
      engine.setImageGuide(null);
      engine.setSecondImageGuide(null);
      engine.setThirdImageGuide(null);
      engine.resize(freshParams.width, freshParams.height, freshParams);
      engine.resetSimulation(freshParams);
      engine.render(freshParams);
      setStepCount(0);
      setActiveCount(engine.getActiveCount());
    }

    setParams(freshParams);
    setFormationComplete(false);
    setFormationProgress(0);
    setIsPlaying(true);
  }, []);

  const handleTogglePlay = useCallback(() => {
    if (formationComplete) {
      handleResetSimulation();
      return;
    }
    setIsPlaying((p) => !p);
  }, [formationComplete, handleResetSimulation]);

  const handleStepOnce = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.step(paramsRef.current, 1);
    engine.render(paramsRef.current);
    setStepCount(engine.getStepCount());
    setActiveCount(engine.getActiveCount());
    setFormationProgress(engine.getGrowthProgress(paramsRef.current));
  }, []);

  const resetAfterImageChange = useCallback((next: SimulationParams) => {
    if (engineRef.current) {
      engineRef.current.resetSimulation(next);
      engineRef.current.render(next);
      setStepCount(0);
      setActiveCount(engineRef.current.getActiveCount());
      setFormationComplete(false);
      setFormationProgress(0);
      setIsPlaying(true);
    }
    setParams(next);
  }, []);

  const handleUploadImageFile = useCallback(
    (file: File) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        sourceImageRef.current = img;
        setImageName(file.name);

        const prev = paramsRef.current;
        const next: SimulationParams = {
          ...prev,
          hasImage: true,
          seed: prev.lockSeed ? prev.seed : nextRandomSeed(),
        };
        applyCurrentImageGuide(next);
        if (next.hasImage2 && sourceImage2Ref.current) applyImageGuide2(next);
        if (next.hasImage3 && sourceImage3Ref.current) applyImageGuide3(next);
        resetAfterImageChange(next);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
      };
      img.src = url;
    },
    [applyCurrentImageGuide, applyImageGuide2, applyImageGuide3, resetAfterImageChange]
  );

  const handleLoadSampleTemplate = useCallback(
    (id: SampleTemplateId) => {
      const labels: Record<SampleTemplateId, string> = {
        typography: 'Tipografia.png',
        botanical: 'Silhueta.png',
        sacred_ring: 'Geometria.png',
        labyrinth: 'Labirinto.png',
      };
      const prev = paramsRef.current;
      const canvas = generateSampleTemplate(id, prev.width, prev.height);
      sourceImageRef.current = canvas;
      setImageName(labels[id]);

      const next: SimulationParams = {
        ...prev,
        hasImage: true,
        seed: prev.lockSeed ? prev.seed : nextRandomSeed(),
      };
      applyCurrentImageGuide(next);
      if (next.hasImage2 && sourceImage2Ref.current) applyImageGuide2(next);
      if (next.hasImage3 && sourceImage3Ref.current) applyImageGuide3(next);
      resetAfterImageChange(next);
    },
    [applyCurrentImageGuide, applyImageGuide2, applyImageGuide3, resetAfterImageChange]
  );

  const handleClearImage = useCallback(() => {
    sourceImageRef.current = null;
    setImagePreviewUrl(null);
    setImageName(null);
    engineRef.current?.setImageGuide(null);

    const prev = paramsRef.current;
    const next: SimulationParams = {
      ...prev,
      hasImage: false,
      seed: prev.lockSeed ? prev.seed : nextRandomSeed(),
    };
    resetAfterImageChange(next);
  }, [resetAfterImageChange]);

  const handleUploadImage2File = useCallback(
    (file: File) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        sourceImage2Ref.current = img;
        setImage2Name(file.name);

        const prev = paramsRef.current;
        const next: SimulationParams = {
          ...prev,
          hasImage2: true,
          seed: prev.lockSeed ? prev.seed : nextRandomSeed(),
        };
        applyImageGuide2(next);
        resetAfterImageChange(next);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
      };
      img.src = url;
    },
    [applyImageGuide2, resetAfterImageChange]
  );

  const handleLoadSampleTemplate2 = useCallback(
    (id: SampleTemplateId) => {
      const labels: Record<SampleTemplateId, string> = {
        typography: 'Tipografia.png',
        botanical: 'Silhueta.png',
        sacred_ring: 'Geometria.png',
        labyrinth: 'Labirinto.png',
      };
      const prev = paramsRef.current;
      const canvas = generateSampleTemplate(id, prev.width, prev.height);
      sourceImage2Ref.current = canvas;
      setImage2Name(labels[id]);

      const next: SimulationParams = {
        ...prev,
        hasImage2: true,
        seed: prev.lockSeed ? prev.seed : nextRandomSeed(),
      };
      applyImageGuide2(next);
      resetAfterImageChange(next);
    },
    [applyImageGuide2, resetAfterImageChange]
  );

  const handleClearImage2 = useCallback(() => {
    sourceImage2Ref.current = null;
    setImage2PreviewUrl(null);
    setImage2Name(null);
    engineRef.current?.setSecondImageGuide(null);

    const prev = paramsRef.current;
    const next: SimulationParams = {
      ...prev,
      hasImage2: false,
      seed: prev.lockSeed ? prev.seed : nextRandomSeed(),
    };
    resetAfterImageChange(next);
  }, [resetAfterImageChange]);

  const handleUploadImage3File = useCallback(
    (file: File) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        sourceImage3Ref.current = img;
        setImage3Name(file.name);

        const prev = paramsRef.current;
        const next: SimulationParams = {
          ...prev,
          hasImage3: true,
          seed: prev.lockSeed ? prev.seed : nextRandomSeed(),
        };
        applyImageGuide3(next);
        resetAfterImageChange(next);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
      };
      img.src = url;
    },
    [applyImageGuide3, resetAfterImageChange]
  );

  const handleLoadSampleTemplate3 = useCallback(
    (id: SampleTemplateId) => {
      const labels: Record<SampleTemplateId, string> = {
        typography: 'Tipografia.png',
        botanical: 'Silhueta.png',
        sacred_ring: 'Geometria.png',
        labyrinth: 'Labirinto.png',
      };
      const prev = paramsRef.current;
      const canvas = generateSampleTemplate(id, prev.width, prev.height);
      sourceImage3Ref.current = canvas;
      setImage3Name(labels[id]);

      const next: SimulationParams = {
        ...prev,
        hasImage3: true,
        seed: prev.lockSeed ? prev.seed : nextRandomSeed(),
      };
      applyImageGuide3(next);
      resetAfterImageChange(next);
    },
    [applyImageGuide3, resetAfterImageChange]
  );

  const handleClearImage3 = useCallback(() => {
    sourceImage3Ref.current = null;
    setImage3PreviewUrl(null);
    setImage3Name(null);
    engineRef.current?.setThirdImageGuide(null);

    const prev = paramsRef.current;
    const next: SimulationParams = {
      ...prev,
      hasImage3: false,
      seed: prev.lockSeed ? prev.seed : nextRandomSeed(),
    };
    resetAfterImageChange(next);
  }, [resetAfterImageChange]);

  const handleSaveSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    engineRef.current?.render(paramsRef.current);
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `micelio-q${String(stepCount).padStart(4, '0')}.png`;
    a.click();
  }, [stepCount]);

  const handlePrepareResolution = useCallback(
    (targetWidth: number, targetHeight: number) => {
      const engine = engineRef.current;
      if (!engine) return;
      const cur = paramsRef.current;
      const tempParams: SimulationParams = {
        ...cur,
        width: targetWidth,
        height: targetHeight,
      };
      engine.resize(targetWidth, targetHeight, tempParams);
      if (tempParams.hasImage && sourceImageRef.current) {
        const p1 = processImageToGuideMap(sourceImageRef.current, {
          width: targetWidth,
          height: targetHeight,
          invert: tempParams.imageInvert,
          contrast: tempParams.imageContrast,
          threshold: tempParams.imageThreshold,
          fit: tempParams.imageFit,
        });
        engine.setImageGuide(p1.guideRGB);
      }
      if (tempParams.hasImage2 && sourceImage2Ref.current) {
        const p2 = processImageToGuideMap(sourceImage2Ref.current, {
          width: targetWidth,
          height: targetHeight,
          invert: tempParams.imageInvert,
          contrast: tempParams.imageContrast,
          threshold: tempParams.imageThreshold,
          fit: tempParams.imageFit,
        });
        engine.setSecondImageGuide(p2.guideRGB);
      }
      if (tempParams.hasImage3 && sourceImage3Ref.current) {
        const p3 = processImageToGuideMap(sourceImage3Ref.current, {
          width: targetWidth,
          height: targetHeight,
          invert: tempParams.imageInvert,
          contrast: tempParams.imageContrast,
          threshold: tempParams.imageThreshold,
          fit: tempParams.imageFit,
        });
        engine.setThirdImageGuide(p3.guideRGB);
      }
      engine.resetSimulation(tempParams);
      engine.render(tempParams);
      setStepCount(engine.getStepCount());
      setActiveCount(engine.getActiveCount());
      setFormationComplete(false);
      setFormationProgress(0);
    },
    []
  );

  return (
    <div className="min-h-screen lg:h-screen flex flex-col bg-[#07090E] text-slate-100 overflow-x-hidden lg:overflow-hidden">
      <TopBar onOpenExport={() => setExportOpen(true)} />

      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        <ControlSidebar
          params={params}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          activePresetId={activePresetId}
          speedMultiplier={speedMultiplier}
          onSpeedChange={setSpeedMultiplier}
          onUpdateParam={handleUpdateParam}
          onSelectPreset={handleSelectPreset}
          onResetSimulation={handleResetSimulation}
          onResetAllControls={handleResetAllControls}
          onUploadImageFile={handleUploadImageFile}
          onLoadSampleTemplate={handleLoadSampleTemplate}
          onClearImage={handleClearImage}
          imagePreviewUrl={imagePreviewUrl}
          imageName={imageName}
          onUploadImage2File={handleUploadImage2File}
          onLoadSampleTemplate2={handleLoadSampleTemplate2}
          onClearImage2={handleClearImage2}
          image2PreviewUrl={image2PreviewUrl}
          image2Name={image2Name}
          onUploadImage3File={handleUploadImage3File}
          onLoadSampleTemplate3={handleLoadSampleTemplate3}
          onClearImage3={handleClearImage3}
          image3PreviewUrl={image3PreviewUrl}
          image3Name={image3Name}
        />

        <SimulationStage
          canvasRef={canvasRef}
          complexity={params.complexity}
          width={params.width}
          height={params.height}
          isPlaying={isPlaying}
          formationComplete={formationComplete}
          formationDurationSec={params.formationDurationSec}
          formationProgress={formationProgress}
          imageStartSec={params.imageStartSec}
          imageFormationMaxSec={params.imageFormationMaxSec}
          imageHoldSec={params.imageHoldSec}
          imageLoopMode={params.imageLoopMode}
          sporeDeathSec={params.sporeDeathSec}
          onTogglePlay={handleTogglePlay}
          onStepOnce={handleStepOnce}
          onReset={handleResetSimulation}
          speedMultiplier={speedMultiplier}
          onSpeedChange={setSpeedMultiplier}
          onSaveSnapshot={handleSaveSnapshot}
          fps={fps}
          stepCount={stepCount}
          activeCount={activeCount}
          hasImage={params.hasImage}
          hasImage2={params.hasImage2}
          hasImage3={params.hasImage3}
          webglError={webglError}
        />
      </div>

      <VideoExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        canvasRef={canvasRef}
        engineRef={engineRef}
        params={params}
        onPauseSimulation={() => setIsPlaying(false)}
        onPrepareResolution={handlePrepareResolution}
      />
    </div>
  );
}
