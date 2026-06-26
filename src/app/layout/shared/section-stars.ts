export type SectionStar = {
  id: number;
  x: number;
  y: number;
  glyph: boolean;
  style: string;
};

export type SectionStarsConfig = {
  gridCols: number;
  gridRows: number;
  skipProbability: number;
  extraCount: number;
  minY: number;
  maxY: number;
  sizeMin?: number;
  sizeMax?: number;
  opacityMin?: number;
  opacityMax?: number;
};

export const SECTION_STAR_NEAR_RADIUS_PX = 168;

const DEFAULT_CONFIG: SectionStarsConfig = {
  gridCols: 9,
  gridRows: 11,
  skipProbability: 0.8,
  extraCount: 16,
  minY: 0,
  maxY: 100,
};

const HERO_CONFIG: SectionStarsConfig = {
  gridCols: 8,
  gridRows: 10,
  skipProbability: 0.74,
  extraCount: 14,
  minY: 70,
  maxY: 108,
  sizeMin: 2.7,
  sizeMax: 4.2,
};

const FEATURES_CONFIG: SectionStarsConfig = {
  gridCols: 7,
  gridRows: 8,
  skipProbability: 0.86,
  extraCount: 8,
  minY: 0,
  maxY: 100,
  sizeMin: 2.2,
  sizeMax: 3.6,
};

function createStar(
  id: number,
  x: number,
  y: number,
  sizeMin = 2.7,
  sizeMax = 4.2,
  opacityMin = 0.48,
  opacityMax = 0.86
): SectionStar {
  const driftSign = () => (Math.random() > 0.5 ? 1 : -1);
  const size = Math.random() * (sizeMax - sizeMin) + sizeMin;
  const opacity = Math.random() * (opacityMax - opacityMin) + opacityMin;
  const driftDuration = Math.random() * 5 + 3.5;
  const driftDelay = Math.random() * -14;
  const driftX = driftSign() * (Math.random() * 14 + 10);
  const driftY = driftSign() * (Math.random() * 14 + 10);
  const twinkleDuration = Math.random() * 2 + 1.5;
  const glyph = Math.random() > 0.05;

  return {
    id,
    x,
    y,
    glyph,
    style: [
      `left:${x}%`,
      `top:${y}%`,
      `--star-size:${size}px`,
      `--star-opacity:${opacity}`,
      `--drift-duration:${driftDuration}s`,
      `--drift-delay:${driftDelay}s`,
      `--drift-x:${driftX}px`,
      `--drift-y:${driftY}px`,
      `--twinkle-duration:${twinkleDuration}s`,
    ].join(';'),
  };
}

function clampY(y: number, minY: number, maxY: number): number {
  return Math.min(maxY, Math.max(minY, y));
}

export function createSectionStars(config: Partial<SectionStarsConfig> = {}): SectionStar[] {
  const {
    gridCols,
    gridRows,
    skipProbability,
    extraCount,
    minY,
    maxY,
    sizeMin = 2.2,
    sizeMax = 4.2,
    opacityMin = 0.48,
    opacityMax = 0.86,
  } = {
    ...DEFAULT_CONFIG,
    ...config,
  };
  const stars: SectionStar[] = [];
  let id = 0;
  const cellW = 100 / gridCols;
  const cellH = 100 / gridRows;
  const startRow = minY > 0 ? Math.ceil(minY / cellH) : 0;
  const ySpan = maxY - minY;

  for (let row = startRow; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
      if (Math.random() > skipProbability) {
        continue;
      }

      stars.push(
        createStar(
          id++,
          col * cellW + Math.random() * cellW,
          clampY(row * cellH + Math.random() * cellH, minY, maxY),
          sizeMin,
          sizeMax,
          opacityMin,
          opacityMax
        )
      );
    }
  }

  for (let i = 0; i < extraCount; i++) {
    stars.push(
      createStar(
        id++,
        Math.random() * 96 + 2,
        minY + Math.random() * ySpan,
        sizeMin,
        sizeMax,
        opacityMin,
        opacityMax
      )
    );
  }

  return stars;
}

export function createHeroStars(): SectionStar[] {
  return createSectionStars(HERO_CONFIG);
}

export function createFeaturesStars(): SectionStar[] {
  return createSectionStars(FEATURES_CONFIG);
}

export function getNearStarIds(
  stars: readonly SectionStar[],
  rect: DOMRect,
  mouseX: number,
  mouseY: number,
  radiusPx = SECTION_STAR_NEAR_RADIUS_PX
): Set<number> {
  const near = new Set<number>();
  const { width, height, left, top } = rect;

  if (width === 0 || height === 0) {
    return near;
  }

  const radiusSq = radiusPx * radiusPx;
  const pointerX = ((mouseX - left) / width) * 100;
  const pointerY = ((mouseY - top) / height) * 100;
  const boundX = (radiusPx / width) * 100;
  const boundY = (radiusPx / height) * 100;

  for (const star of stars) {
    if (Math.abs(star.x - pointerX) > boundX || Math.abs(star.y - pointerY) > boundY) {
      continue;
    }

    const starX = left + (star.x / 100) * width;
    const starY = top + (star.y / 100) * height;
    const dx = mouseX - starX;
    const dy = mouseY - starY;

    if (dx * dx + dy * dy <= radiusSq) {
      near.add(star.id);
    }
  }

  return near;
}

function nearStarSetsEqual(
  nextNear: ReadonlySet<number>,
  currentNear: ReadonlySet<number>
): boolean {
  if (nextNear.size !== currentNear.size) {
    return false;
  }

  for (const id of nextNear) {
    if (!currentNear.has(id)) {
      return false;
    }
  }

  return true;
}
