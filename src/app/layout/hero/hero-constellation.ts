import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';

type Vec2 = { x: number; y: number };
type OrbitRing = 'outer' | 'inner';

type OrbitIcon = {
  emoji: string;
  title: string;
  body: string;
  ring: OrbitRing;
  slot: number;
  slotsOnRing: number;
  size: number;
  shadow: string;
};

type Dust = { angle: number; r: number; size: number; alpha: number; speed: number };

type BubbleState = {
  index: number;
  progress: number;
  visible: boolean;
  cooldown: number;
};

const OUTER_ITEMS: readonly Omit<OrbitIcon, 'slot' | 'slotsOnRing' | 'ring'>[] = [
  {
    emoji: '✨',
    title: 'Pisanie AI',
    body: 'Generuj drafty w tonie marki — szybciej, bez chaosu narzędzi.',
    size: 1,
    shadow: 'rgba(37, 99, 235, 0.28)',
  },
  {
    emoji: '❤️',
    title: 'Zaangażowanie',
    body: 'Pilnuj rytmu publikacji, które realnie budują społeczność.',
    size: 0.96,
    shadow: 'rgba(225, 29, 72, 0.24)',
  },
  {
    emoji: '📸',
    title: 'Biblioteka mediów',
    body: 'Trzymaj assety i wersje w jednym, spokojnym miejscu.',
    size: 0.98,
    shadow: 'rgba(2, 132, 199, 0.24)',
  },
  {
    emoji: '📊',
    title: 'Analityka',
    body: 'Widzisz, co działa — i od razu poprawiasz kolejny cykl.',
    size: 0.94,
    shadow: 'rgba(5, 150, 105, 0.24)',
  },
];

const INNER_ITEMS: readonly Omit<OrbitIcon, 'slot' | 'slotsOnRing' | 'ring'>[] = [
  {
    emoji: '💬',
    title: 'Współpraca',
    body: 'Komentarze, feedback i akceptacje w jednym flow zespołu.',
    size: 0.94,
    shadow: 'rgba(37, 99, 235, 0.26)',
  },
  {
    emoji: '📝',
    title: 'Szkice i briefy',
    body: 'Od briefu do gotowego postu bez gubienia kontekstu.',
    size: 0.95,
    shadow: 'rgba(217, 119, 6, 0.24)',
  },
  {
    emoji: '🚀',
    title: 'Publikowanie',
    body: 'Zaplanuj i wyślij treści na kanały w przewidywalnym rytmie.',
    size: 0.96,
    shadow: 'rgba(29, 78, 216, 0.26)',
  },
  {
    emoji: '🔔',
    title: 'Powiadomienia',
    body: 'Wiesz, kiedy coś wymaga uwagi — bez ciągłego sprawdzania.',
    size: 0.92,
    shadow: 'rgba(202, 138, 4, 0.24)',
  },
];

const OUTER_SPEED = 0.065;
const INNER_SPEED = -0.095;
const BUBBLE_SHOW = 4.4;
const BUBBLE_FADE = 0.45;
const BUBBLE_GAP = 1.1;
const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

@Component({
  selector: 'app-hero-constellation',
  styleUrl: './hero-constellation.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="hc"
      role="img"
      aria-label="Orbitujące emotikony ekosystemu Starvia"
      (pointermove)="onPointerMove($event)"
      (pointerleave)="onPointerLeave()"
      (pointerdown)="onPointerMove($event)"
    >
      <div class="hc__stage" aria-hidden="true">
        <canvas #canvas class="hc__canvas"></canvas>
      </div>

      <!-- Classic CSS speech-bubble — follows the active emoji -->
      <div #tip class="hc__speech" data-side="top" aria-hidden="true">
        <p class="hc__speech-title"></p>
        <p class="hc__speech-body"></p>
      </div>
    </div>
  `,
})
export class HeroConstellation implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true })
  private readonly canvasRef!: ElementRef<HTMLCanvasElement>;

  @ViewChild('tip', { static: true })
  private readonly tipRef!: ElementRef<HTMLDivElement>;

  private ctx: CanvasRenderingContext2D | null = null;
  private raf = 0;
  private idleHandle: number | null = null;
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private reducedMotion = false;
  private running = false;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private t0 = 0;
  private lastTs = 0;

  private orbits: OrbitIcon[] = [];
  private dust: Dust[] = [];
  private outerPhase = -Math.PI / 2;
  private innerPhase = Math.PI / 2;
  private logo: HTMLImageElement | null = null;
  private lastTipKey = '';
  private lastTipSide: 'top' | 'bottom' | 'left' | 'right' = 'top';

  private bubble: BubbleState = {
    index: 0,
    progress: 0,
    visible: false,
    cooldown: 1.2,
  };

  private pointer: Vec2 = { x: 0.5, y: 0.5 };
  private pointerTarget: Vec2 = { x: 0.5, y: 0.5 };
  private pointerActive = false;
  private parallax: Vec2 = { x: 0, y: 0 };

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d', { alpha: true });

    this.loadLogo();
    this.hideTip();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvasRef.nativeElement.closest('.hc') ?? canvas);

    const start = () => {
      if (this.running) {
        return;
      }
      this.running = true;
      this.resize();
      this.seed();
      this.t0 = performance.now();
      this.lastTs = this.t0;
      if (this.reducedMotion) {
        this.drawStatic();
        return;
      }
      this.raf = requestAnimationFrame((ts) => this.frame(ts));
    };

    const ric = (
      window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      }
    ).requestIdleCallback;

    if (typeof ric === 'function') {
      this.idleHandle = ric(start, { timeout: 200 });
    } else {
      this.timeoutHandle = setTimeout(start, 32);
    }
  }

  ngOnDestroy(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.resizeObserver?.disconnect();
    if (this.idleHandle !== null && typeof cancelIdleCallback === 'function') {
      cancelIdleCallback(this.idleHandle);
    }
    if (this.timeoutHandle !== null) {
      clearTimeout(this.timeoutHandle);
    }
  }

  protected onPointerMove(event: PointerEvent): void {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return;
    }

    this.pointerActive = true;
    this.pointerTarget = {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  }

  protected onPointerLeave(): void {
    this.pointerActive = false;
    this.pointerTarget = { x: 0.5, y: 0.5 };
  }

  private loadLogo(): void {
    const img = new Image();
    img.decoding = 'async';
    img.src = '/starvia-logo.png';
    img.onload = () => {
      this.logo = img;
      if (this.reducedMotion && this.running) {
        this.drawStatic();
      }
    };
  }

  private resize(): void {
    const canvas = this.canvasRef.nativeElement;
    const parent = canvas.parentElement;
    if (!parent || !this.ctx) {
      return;
    }

    const rect = parent.getBoundingClientRect();
    const nextW = Math.max(1, Math.floor(rect.width));
    const nextH = Math.max(1, Math.floor(rect.height));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    if (this.w === nextW && this.h === nextH && canvas.width === nextW * this.dpr) {
      return;
    }

    this.w = nextW;
    this.h = nextH;
    canvas.width = Math.floor(nextW * this.dpr);
    canvas.height = Math.floor(nextH * this.dpr);
    canvas.style.width = `${nextW}px`;
    canvas.style.height = `${nextH}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    if (this.reducedMotion && this.running) {
      this.drawStatic();
    }
  }

  private seed(): void {
    const outer: OrbitIcon[] = OUTER_ITEMS.map((item, i) => ({
      ...item,
      ring: 'outer',
      slot: i,
      slotsOnRing: OUTER_ITEMS.length,
    }));

    const inner: OrbitIcon[] = INNER_ITEMS.map((item, i) => ({
      ...item,
      ring: 'inner',
      slot: i,
      slotsOnRing: INNER_ITEMS.length,
    }));

    this.orbits = [...outer, ...inner];
    this.outerPhase = -Math.PI / 2;
    this.innerPhase = Math.PI / 2;
    this.bubble = { index: 0, progress: 0, visible: false, cooldown: 1.1 };

    this.dust = Array.from({ length: 14 }, (_, i) => ({
      angle: (i / 14) * Math.PI * 2,
      r: 0.72 + (i % 5) * 0.07,
      size: 0.65 + (i % 4) * 0.3,
      alpha: 0.08 + (i % 3) * 0.04,
      speed: 0.026 + (i % 4) * 0.01,
    }));
  }

  private angleOf(orbit: OrbitIcon): number {
    const phase = orbit.ring === 'outer' ? this.outerPhase : this.innerPhase;
    return phase + (orbit.slot / orbit.slotsOnRing) * Math.PI * 2;
  }

  private radiusScaleOf(orbit: OrbitIcon): number {
    return orbit.ring === 'outer' ? 1 : 0.56;
  }

  private frame(ts: number): void {
    if (!this.running || !this.ctx) {
      return;
    }

    const dt = Math.min(0.033, (ts - this.lastTs) / 1000);
    this.lastTs = ts;
    const elapsed = (ts - this.t0) / 1000;

    this.update(elapsed, dt);
    this.draw(elapsed);

    this.raf = requestAnimationFrame((next) => this.frame(next));
  }

  private update(_elapsed: number, dt: number): void {
    const lerp = 1 - Math.exp(-dt * 4.5);
    this.pointer.x += (this.pointerTarget.x - this.pointer.x) * lerp;
    this.pointer.y += (this.pointerTarget.y - this.pointer.y) * lerp;

    const targetParallaxX = (this.pointer.x - 0.5) * (this.pointerActive ? 8 : 3);
    const targetParallaxY = (this.pointer.y - 0.5) * (this.pointerActive ? 6 : 2.5);
    this.parallax.x += (targetParallaxX - this.parallax.x) * lerp;
    this.parallax.y += (targetParallaxY - this.parallax.y) * lerp;

    const hoverBoost = this.pointerActive ? 1.2 : 1;
    this.outerPhase += OUTER_SPEED * hoverBoost * dt;
    this.innerPhase += INNER_SPEED * hoverBoost * dt;

    for (const d of this.dust) {
      d.angle += d.speed * dt;
    }

    this.updateBubble(dt);
  }

  private updateBubble(dt: number): void {
    if (this.orbits.length === 0) {
      return;
    }

    const b = this.bubble;
    if (!b.visible) {
      b.cooldown -= dt;
      if (b.cooldown <= 0) {
        b.visible = true;
        b.progress = 0;
        b.index = (b.index + 1) % this.orbits.length;
      }
      return;
    }

    b.progress += dt;
    if (b.progress >= BUBBLE_SHOW) {
      b.visible = false;
      b.progress = 0;
      b.cooldown = BUBBLE_GAP;
    }
  }

  private bubbleAlpha(): number {
    const b = this.bubble;
    if (!b.visible) {
      return 0;
    }
    if (b.progress < BUBBLE_FADE) {
      return b.progress / BUBBLE_FADE;
    }
    if (b.progress > BUBBLE_SHOW - BUBBLE_FADE) {
      return (BUBBLE_SHOW - b.progress) / BUBBLE_FADE;
    }
    return 1;
  }

  private drawStatic(): void {
    this.parallax = { x: 0, y: 0 };
    this.bubble = { index: 0, progress: BUBBLE_FADE + 0.5, visible: true, cooldown: 0 };
    this.draw(0);
  }

  private draw(elapsed: number): void {
    const ctx = this.ctx;
    if (!ctx || this.w === 0) {
      return;
    }

    // Reset any leftover canvas filter (e.g. logo whitening) every frame
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.clearRect(0, 0, this.w, this.h);

    const cx = this.w * 0.5 + this.parallax.x * 0.2;
    const cy = this.h * 0.5 + this.parallax.y * 0.2;
    const base = Math.min(this.w, this.h);
    const ringR = base * 0.4;

    this.drawCore(ctx, cx, cy, ringR, elapsed);
    this.drawOrbitRings(ctx, cx, cy, ringR, elapsed);
    this.drawDust(ctx, cx, cy, ringR);
    this.drawIcons(ctx, cx, cy, ringR);
    this.syncSpeechBubble(cx, cy, ringR);
  }

  private drawCore(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    ringR: number,
    elapsed: number
  ): void {
    const pulse = 1 + Math.sin(elapsed * 0.55) * 0.025;
    this.drawCenterMark(ctx, cx, cy, ringR * 0.072 * pulse);
  }

  private drawCenterMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
    ctx.save();
    ctx.translate(cx, cy);

    const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 2.8);
    halo.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
    halo.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)');
    halo.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, size * 2.8, 0, Math.PI * 2);
    ctx.fill();

    if (this.logo?.complete && this.logo.naturalWidth > 0) {
      const s = size * 1.95;
      ctx.save();
      ctx.shadowColor = 'rgba(255, 255, 255, 0.55)';
      ctx.shadowBlur = 10;
      ctx.filter = 'brightness(0) invert(1)';
      ctx.globalAlpha = 0.98;
      ctx.drawImage(this.logo, -s / 2, -s / 2, s, s);
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
      this.starPath(ctx, size);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawOrbitRings(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    ringR: number,
    elapsed: number
  ): void {
    const outerR = ringR;
    const innerR = ringR * 0.56;

    this.strokeRing(ctx, cx, cy, outerR, 1.85);
    this.strokeRing(ctx, cx, cy, innerR, 1.45);

    this.drawRingSweep(ctx, cx, cy, outerR, elapsed * 0.55, 0.5);
    this.drawRingSweep(ctx, cx, cy, innerR, -elapsed * 0.7 + Math.PI, 0.38);
  }

  private strokeRing(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    width: number
  ): void {
    // White body so it reads on blue areas
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.58)';
    ctx.lineWidth = width;
    ctx.stroke();

    // Light black outline so it stays visible on bright/white areas
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.38)';
    ctx.lineWidth = Math.max(1.05, width * 0.6);
    ctx.stroke();
  }

  private drawRingSweep(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    angle: number,
    alpha: number
  ): void {
    const span = Math.PI * 0.28;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = 2.1;
    const grad = ctx.createLinearGradient(
      cx + Math.cos(angle - span) * r,
      cy + Math.sin(angle - span) * r,
      cx + Math.cos(angle + span) * r,
      cy + Math.sin(angle + span) * r
    );
    grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    grad.addColorStop(0.5, `rgba(255, 255, 255, ${alpha})`);
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.strokeStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, angle - span, angle + span);
    ctx.stroke();
    ctx.restore();
  }

  private drawDust(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    ringR: number
  ): void {
    for (const d of this.dust) {
      const x = cx + Math.cos(d.angle) * ringR * d.r + this.parallax.x * 0.15;
      const y = cy + Math.sin(d.angle) * ringR * d.r + this.parallax.y * 0.15;
      ctx.beginPath();
      ctx.fillStyle = `rgba(255, 255, 255, ${d.alpha})`;
      ctx.arc(x, y, d.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private iconPosition(
    orbit: OrbitIcon,
    cx: number,
    cy: number,
    ringR: number
  ): { x: number; y: number; angle: number; chip: number } {
    const angle = this.angleOf(orbit);
    const r = ringR * this.radiusScaleOf(orbit);
    // Stable orbit — no bob / depth scale (avoids visual jumping)
    const x = cx + Math.cos(angle) * r + this.parallax.x * 0.3;
    const y = cy + Math.sin(angle) * r + this.parallax.y * 0.3;
    const chip = Math.max(32, Math.min(this.w, this.h) * 0.076) * orbit.size;
    return { x, y, angle, chip };
  }

  private drawIcons(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    ringR: number
  ): void {
    const activeIndex = this.bubble.visible ? this.bubble.index : -1;
    const highlight = this.bubbleAlpha();

    for (let i = 0; i < this.orbits.length; i++) {
      const orbit = this.orbits[i];
      const { x, y, chip } = this.iconPosition(orbit, cx, cy, ringR);
      const glyphSize = Math.round(chip * 0.64);
      const isActive = i === activeIndex && highlight > 0.02;

      ctx.save();
      ctx.translate(x, y);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${glyphSize}px ${EMOJI_FONT}`;
      // Critical: never use shadowBlur on color emoji — Chromium paints a gray silhouette
      ctx.filter = 'none';
      ctx.globalAlpha = 1;
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      if (isActive) {
        const pop = 1 + highlight * 0.12;
        // Soft round glow (not emoji shadow) so color stays vivid
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, glyphSize * 0.9);
        glow.addColorStop(0, `rgba(255, 255, 255, ${0.6 * highlight})`);
        glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, glyphSize * 0.9, 0, Math.PI * 2);
        ctx.fill();

        ctx.scale(pop, pop);
      } else {
        // Idle: soft bright lift behind emoji (no desaturate)
        const lift = ctx.createRadialGradient(0, 0, 0, 0, 0, glyphSize * 0.78);
        lift.addColorStop(0, 'rgba(255, 255, 255, 0.42)');
        lift.addColorStop(0.55, 'rgba(255, 255, 255, 0.14)');
        lift.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = lift;
        ctx.beginPath();
        ctx.arc(0, 0, glyphSize * 0.78, 0, Math.PI * 2);
        ctx.fill();
        ctx.filter = 'brightness(1.12)';
      }

      ctx.fillText(orbit.emoji, 0, 1);
      ctx.filter = 'none';
      ctx.restore();
    }
  }

  private placeTip(angle: number): 'top' | 'bottom' | 'left' | 'right' {
    // Triangle sits on this edge and points toward the emoji.
    const ax = Math.cos(angle);
    const ay = Math.sin(angle);
    if (Math.abs(ax) > Math.abs(ay)) {
      return ax > 0 ? 'left' : 'right';
    }
    return ay > 0 ? 'top' : 'bottom';
  }

  private syncSpeechBubble(cx: number, cy: number, ringR: number): void {
    const tip = this.tipRef?.nativeElement;
    if (!tip) {
      return;
    }

    const alpha = this.bubbleAlpha();
    if (alpha <= 0.01 || this.orbits.length === 0) {
      this.hideTip();
      return;
    }

    const orbit = this.orbits[this.bubble.index];
    const pos = this.iconPosition(orbit, cx, cy, ringR);
    const side = this.placeTip(pos.angle);
    const gap = pos.chip * 0.78 + 16;

    let x = pos.x;
    let y = pos.y;
    let anchor = '';

    switch (side) {
      case 'top':
        x = pos.x;
        y = pos.y - gap;
        anchor = 'translate(-50%, -100%)';
        break;
      case 'bottom':
        x = pos.x;
        y = pos.y + gap;
        anchor = 'translate(-50%, 0)';
        break;
      case 'left':
        x = pos.x - gap;
        y = pos.y;
        anchor = 'translate(-100%, -50%)';
        break;
      case 'right':
        x = pos.x + gap;
        y = pos.y;
        anchor = 'translate(0, -50%)';
        break;
    }

    // Keep bubble inside the panel
    const pad = 10;
    const tipW = tip.offsetWidth || 220;
    const tipH = tip.offsetHeight || 72;
    if (side === 'top' || side === 'bottom') {
      x = Math.min(this.w - tipW / 2 - pad, Math.max(tipW / 2 + pad, x));
    }
    if (side === 'left' || side === 'right') {
      y = Math.min(this.h - tipH / 2 - pad, Math.max(tipH / 2 + pad, y));
    }

    const tipKey = `${orbit.title}|${orbit.body}`;
    if (tipKey !== this.lastTipKey) {
      const titleEl = tip.querySelector('.hc__speech-title');
      const bodyEl = tip.querySelector('.hc__speech-body');
      if (titleEl) {
        titleEl.textContent = orbit.title;
      }
      if (bodyEl) {
        bodyEl.textContent = orbit.body;
      }
      this.lastTipKey = tipKey;
    }

    if (side !== this.lastTipSide) {
      tip.dataset['side'] = side;
      this.lastTipSide = side;
    }

    tip.style.opacity = String(alpha);
    tip.style.transform = `translate(${x}px, ${y}px) ${anchor}`;
    tip.classList.add('hc__speech--visible');
  }

  private hideTip(): void {
    const tip = this.tipRef?.nativeElement;
    if (!tip) {
      return;
    }
    tip.style.opacity = '0';
    tip.classList.remove('hc__speech--visible');
  }

  private starPath(ctx: CanvasRenderingContext2D, s: number): void {
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.quadraticCurveTo(s * 0.16, -s * 0.16, s, 0);
    ctx.quadraticCurveTo(s * 0.16, s * 0.16, 0, s);
    ctx.quadraticCurveTo(-s * 0.16, s * 0.16, -s, 0);
    ctx.quadraticCurveTo(-s * 0.16, -s * 0.16, 0, -s);
    ctx.closePath();
  }
}
