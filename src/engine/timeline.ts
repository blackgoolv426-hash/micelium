import { ImageLoopMode, SimulationParams } from '../types/simulation';

export type ImageSlotId = 1 | 2 | 3;

export interface StageSummary {
  stepIndex: number;
  fromSlot: ImageSlotId;
  toSlot: ImageSlotId;
  startSec: number;
  formEndSec: number;
  holdEndSec: number;
}

export interface SimulationTimeline {
  activeSlots: ImageSlotId[];
  hasAnyImage: boolean;
  isMultiImage: boolean;
  isDual: boolean;
  totalDurationSec: number;
  introSec: number;
  formSec: number;
  holdSec: number;
  stepSec: number;
  stages: StageSummary[];
  img1StartSec: number;
  img1EndSec: number;
  img1FinishFrac: number;
  tStartFrac: number;
  tStartSec: number;
  tEndFrac: number;
  tEndSec: number;
  deathStartFrac: number;
  deathStartSec: number;
  effectiveDeathSec: number;
}

export interface ImageTimelineState {
  hasAnyImage: boolean;
  activeSlots: ImageSlotId[];
  fromSlot: ImageSlotId;
  toSlot: ImageSlotId;
  isTransitioning: boolean;
  imageEngage: number;
  colonyRamp: number;
  pruneRamp: number;
  morphBlend: number;
  deathProgress: number;
  phaseLabel: string;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / Math.max(1e-5, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function getActiveImageSlots(
  params: Pick<SimulationParams, 'hasImage' | 'hasImage2' | 'hasImage3'>
): ImageSlotId[] {
  const slots: ImageSlotId[] = [];
  if (params.hasImage) slots.push(1);
  if (params.hasImage2) slots.push(2);
  if (params.hasImage3) slots.push(3);
  return slots;
}

function getSlotIndexAtStep(stepIdx: number, count: number, loopMode: ImageLoopMode): number {
  if (count <= 1) return 0;
  if (loopMode === 'once') {
    return Math.min(stepIdx, count - 1);
  }
  if (loopMode === 'cycle') {
    return stepIdx % count;
  }
  // pingpong: 0, 1, 2, 1, 0, 1, 2...
  const period = 2 * (count - 1);
  const pos = stepIdx % period;
  return pos < count ? pos : period - pos;
}

export function computeSimulationTimeline(
  params: Pick<
    SimulationParams,
    | 'formationDurationSec'
    | 'imageStartSec'
    | 'imageFormationMaxSec'
    | 'imageHoldSec'
    | 'imageLoopMode'
    | 'sporeDeathSec'
    | 'hasImage'
    | 'hasImage2'
    | 'hasImage3'
  >
): SimulationTimeline {
  const activeSlots = getActiveImageSlots(params);
  const N = activeSlots.length;
  const hasAnyImage = N > 0;
  const isMultiImage = N >= 2;
  const T = params.formationDurationSec > 0 ? params.formationDurationSec : 0;

  if (T <= 0) {
    // Continuous mode: unrestricted stage pacing & infinite loops, zero spore death
    const introSec = hasAnyImage ? Math.max(0, params.imageStartSec) : 0;
    const formSec = Math.max(0.5, params.imageFormationMaxSec);
    const holdSec = isMultiImage ? Math.max(0, params.imageHoldSec) : 0;
    const stepSec = formSec + holdSec;

    const previewSteps = isMultiImage
      ? params.imageLoopMode === 'once'
        ? N
        : N + 1
      : hasAnyImage
        ? 1
        : 0;
    const stages: StageSummary[] = [];
    for (let k = 0; k < previewSteps; k++) {
      const toIdx = getSlotIndexAtStep(k, N, params.imageLoopMode);
      const fromIdx = k === 0 ? toIdx : getSlotIndexAtStep(k - 1, N, params.imageLoopMode);
      const startSec = introSec + k * stepSec;
      stages.push({
        stepIndex: k,
        fromSlot: activeSlots[fromIdx],
        toSlot: activeSlots[toIdx],
        startSec,
        formEndSec: startSec + formSec,
        holdEndSec: startSec + stepSec,
      });
    }

    const refTotal = Math.max(20, introSec + Math.max(1, previewSteps) * stepSec);
    const img1EndSec = introSec + formSec;
    const tStartSec = stages[1]?.startSec ?? img1EndSec;
    const tEndSec = stages[1]?.formEndSec ?? img1EndSec;

    return {
      activeSlots,
      hasAnyImage,
      isMultiImage,
      isDual: isMultiImage,
      totalDurationSec: 0,
      introSec,
      formSec,
      holdSec,
      stepSec,
      stages,
      img1StartSec: introSec,
      img1EndSec,
      img1FinishFrac: img1EndSec / refTotal,
      tStartFrac: tStartSec / refTotal,
      tStartSec,
      tEndFrac: tEndSec / refTotal,
      tEndSec,
      deathStartFrac: 2.0,
      deathStartSec: 999,
      effectiveDeathSec: 0,
    };
  }

  // Timed mode (T > 0)
  const rawDeath = params.sporeDeathSec > 0 ? params.sporeDeathSec : 0;

  if (!hasAnyImage) {
    const effectiveDeathSec = rawDeath > 0 ? Math.min(rawDeath, Math.max(0.2, T * 0.6)) : 0;
    const deathStartSec = effectiveDeathSec > 0 ? Math.max(0.2, T - effectiveDeathSec) : T + 10;
    return {
      activeSlots: [],
      hasAnyImage: false,
      isMultiImage: false,
      isDual: false,
      totalDurationSec: T,
      introSec: 0,
      formSec: T,
      holdSec: 0,
      stepSec: T,
      stages: [],
      img1StartSec: 0,
      img1EndSec: T,
      img1FinishFrac: 1,
      tStartFrac: 1,
      tStartSec: T,
      tEndFrac: 1,
      tEndSec: T,
      deathStartFrac: effectiveDeathSec > 0 ? deathStartSec / T : 2.0,
      deathStartSec,
      effectiveDeathSec,
    };
  }

  if (N === 1) {
    const maxDeath = rawDeath > 0 ? Math.min(rawDeath, T * 0.42) : 0;
    const availWindow = Math.max(0.4, T - maxDeath);
    const introSec = Math.max(0, Math.min(params.imageStartSec, availWindow * 0.42));
    const maxForm = Math.max(0.3, availWindow - introSec);
    const formSec = Math.max(0.3, Math.min(params.imageFormationMaxSec, maxForm));
    const img1EndSec = introSec + formSec;

    let deathStartSec = T + 10;
    let effectiveDeathSec = 0;
    if (maxDeath > 0) {
      deathStartSec = Math.max(Math.min(T - 0.15, img1EndSec + 0.1), T - maxDeath);
      effectiveDeathSec = Math.max(0, T - deathStartSec);
    }

    return {
      activeSlots,
      hasAnyImage: true,
      isMultiImage: false,
      isDual: false,
      totalDurationSec: T,
      introSec,
      formSec,
      holdSec: 0,
      stepSec: formSec,
      stages: [
        {
          stepIndex: 0,
          fromSlot: activeSlots[0],
          toSlot: activeSlots[0],
          startSec: introSec,
          formEndSec: img1EndSec,
          holdEndSec: deathStartSec < T ? deathStartSec : T,
        },
      ],
      img1StartSec: introSec,
      img1EndSec,
      img1FinishFrac: img1EndSec / T,
      tStartFrac: 1,
      tStartSec: T,
      tEndFrac: 1,
      tEndSec: T,
      deathStartFrac: effectiveDeathSec > 0 ? deathStartSec / T : 2.0,
      deathStartSec,
      effectiveDeathSec,
    };
  }

  // Multi-image (2 or 3 images): guarantee ALL stages complete BEFORE spore death starts!
  const deathCapFrac = N >= 3 ? 0.25 : 0.30;
  const maxDeath = rawDeath > 0 ? Math.min(rawDeath, T * deathCapFrac) : 0;
  const activeWindow = Math.max(0.8, T - maxDeath);
  const introSec = Math.max(0, Math.min(params.imageStartSec, activeWindow * 0.22));
  const stageBudget = Math.max(0.6, activeWindow - introSec);

  const reqForm = Math.max(0.4, params.imageFormationMaxSec);
  const reqHold = Math.max(0, params.imageHoldSec);
  const reqStep = reqForm + reqHold;
  const formRatio = reqForm / Math.max(0.1, reqStep);

  let numSteps = N;
  if (params.imageLoopMode !== 'once') {
    // Fit clean complete transitions inside stageBudget (at least N stages, or more if time allows)
    numSteps = Math.max(N, Math.round(stageBudget / Math.max(1.5, reqStep)));
  }

  let stepSec = reqStep;
  let formSec = reqForm;
  let holdSec = reqHold;

  if (numSteps * reqStep > stageBudget || params.imageLoopMode !== 'once') {
    stepSec = stageBudget / numSteps;
    formSec = Math.max(0.25, stepSec * formRatio);
    holdSec = Math.max(0, stepSec - formSec);
  }

  const stages: StageSummary[] = [];
  for (let k = 0; k < numSteps; k++) {
    const toIdx = getSlotIndexAtStep(k, N, params.imageLoopMode);
    const fromIdx = k === 0 ? toIdx : getSlotIndexAtStep(k - 1, N, params.imageLoopMode);
    const startSec = introSec + k * stepSec;
    stages.push({
      stepIndex: k,
      fromSlot: activeSlots[fromIdx],
      toSlot: activeSlots[toIdx],
      startSec,
      formEndSec: startSec + formSec,
      holdEndSec: startSec + stepSec,
    });
  }

  const allCompleteSec = introSec + numSteps * stepSec;
  let deathStartSec = T + 10;
  let effectiveDeathSec = 0;
  if (maxDeath > 0) {
    deathStartSec = Math.max(Math.min(T - 0.5, allCompleteSec + 0.15), T - maxDeath);
    effectiveDeathSec = Math.max(0, T - deathStartSec);
  }

  const first = stages[0];
  const last = stages[stages.length - 1];

  return {
    activeSlots,
    hasAnyImage: true,
    isMultiImage: true,
    isDual: true,
    totalDurationSec: T,
    introSec,
    formSec,
    holdSec,
    stepSec,
    stages,
    img1StartSec: first.startSec,
    img1EndSec: first.formEndSec,
    img1FinishFrac: first.formEndSec / T,
    tStartFrac: stages[1].startSec / T,
    tStartSec: stages[1].startSec,
    tEndFrac: last.formEndSec / T,
    tEndSec: last.formEndSec,
    deathStartFrac: effectiveDeathSec > 0 ? deathStartSec / T : 2.0,
    deathStartSec,
    effectiveDeathSec,
  };
}

export function computeImageTimelineState(
  params: Pick<
    SimulationParams,
    | 'formationDurationSec'
    | 'imageStartSec'
    | 'imageFormationMaxSec'
    | 'imageHoldSec'
    | 'imageLoopMode'
    | 'sporeDeathSec'
    | 'hasImage'
    | 'hasImage2'
    | 'hasImage3'
  >,
  elapsedSec: number
): ImageTimelineState {
  const tl = computeSimulationTimeline(params);
  const { activeSlots, hasAnyImage, introSec, formSec, stepSec, totalDurationSec } = tl;

  let deathProgress = 0;
  if (totalDurationSec > 0 && tl.effectiveDeathSec > 0 && elapsedSec >= tl.deathStartSec) {
    const rawDeath = Math.max(
      0,
      Math.min(1, (elapsedSec - tl.deathStartSec) / Math.max(1e-4, totalDurationSec - tl.deathStartSec))
    );
    deathProgress = Math.pow(rawDeath, 1.05);
  }

  if (!hasAnyImage) {
    return {
      hasAnyImage: false,
      activeSlots: [],
      fromSlot: 1,
      toSlot: 1,
      isTransitioning: false,
      imageEngage: 0,
      colonyRamp: 0,
      pruneRamp: 0,
      morphBlend: 0,
      deathProgress,
      phaseLabel: deathProgress > 0.001 ? 'Morte dos Esporos' : 'Crescimento Livre',
    };
  }

  const N = activeSlots.length;

  // Phase 0: Pure free growth before imageStartSec (ZERO image pull or background pruning)
  if (elapsedSec < introSec) {
    return {
      hasAnyImage: true,
      activeSlots,
      fromSlot: activeSlots[0],
      toSlot: activeSlots[0],
      isTransitioning: false,
      imageEngage: 0,
      colonyRamp: 0,
      pruneRamp: 0,
      morphBlend: 0,
      deathProgress,
      phaseLabel: 'Crescimento Livre',
    };
  }

  const tAfterIntro = Math.max(0, elapsedSec - introSec);

  if (N === 1) {
    const p = Math.max(0, Math.min(1, tAfterIntro / Math.max(0.25, formSec)));
    const imageEngage = smoothstep(0.0, 0.65, p);
    const colonyRamp = Math.pow(p, 1.05);
    const pruneRamp = smoothstep(0.28, 0.96, p);
    const label =
      deathProgress > 0.01
        ? 'Morte dos Esporos'
        : p < 0.98
          ? `Formando Img ${activeSlots[0]}`
          : `Img ${activeSlots[0]} Formada`;
    return {
      hasAnyImage: true,
      activeSlots,
      fromSlot: activeSlots[0],
      toSlot: activeSlots[0],
      isTransitioning: false,
      imageEngage,
      colonyRamp,
      pruneRamp,
      morphBlend: 0,
      deathProgress,
      phaseLabel: label,
    };
  }

  // Multi-image sequence / loop
  let stepIdx = Math.floor(tAfterIntro / Math.max(0.25, stepSec));
  let localT = tAfterIntro - stepIdx * stepSec;

  if (totalDurationSec > 0 && tl.stages.length > 0) {
    const maxStageIdx = tl.stages.length - 1;
    if (stepIdx > maxStageIdx) {
      stepIdx = maxStageIdx;
      localT = stepSec;
    }
  } else if (params.imageLoopMode === 'once' && stepIdx >= N) {
    stepIdx = N - 1;
    localT = stepSec;
  }

  const toIdx = getSlotIndexAtStep(stepIdx, N, params.imageLoopMode);
  const fromIdx = stepIdx === 0 ? toIdx : getSlotIndexAtStep(stepIdx - 1, N, params.imageLoopMode);
  const fromSlot = activeSlots[fromIdx];
  const toSlot = activeSlots[toIdx];
  const p = Math.max(0, Math.min(1, localT / Math.max(0.25, formSec)));

  if (stepIdx === 0) {
    const imageEngage = smoothstep(0.0, 0.65, p);
    const colonyRamp = Math.pow(p, 1.05);
    const pruneRamp = smoothstep(0.28, 0.96, p);
    const label =
      deathProgress > 0.01
        ? 'Morte dos Esporos'
        : p < 0.98
          ? `Formando Img ${toSlot}`
          : `Img ${toSlot} Formada`;

    return {
      hasAnyImage: true,
      activeSlots,
      fromSlot,
      toSlot,
      isTransitioning: false,
      imageEngage,
      colonyRamp,
      pruneRamp,
      morphBlend: 0,
      deathProgress,
      phaseLabel: label,
    };
  }

  // Transition stage (fromSlot -> toSlot):
  // Smooth organic growth progression so existing fungal veins sprout bridges toward toSlot
  const morphBlend = smoothstep(0.0, 0.78, p);
  const colonyRamp = 0.25 + 0.75 * smoothstep(0.05, 0.96, p);
  const label =
    deathProgress > 0.01
      ? 'Morte dos Esporos'
      : p < 0.98
        ? `Img ${fromSlot} → Img ${toSlot}`
        : `Img ${toSlot} Formada`;

  return {
    hasAnyImage: true,
    activeSlots,
    fromSlot,
    toSlot,
    isTransitioning: true,
    imageEngage: 1.0,
    colonyRamp,
    pruneRamp: 1.0,
    morphBlend,
    deathProgress,
    phaseLabel: label,
  };
}
