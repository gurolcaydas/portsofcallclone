import { sounds } from '../sound/SoundManager.js';

export type PullToRefreshState = 'idle' | 'pulling' | 'ready' | 'refreshing';

export class PullToRefresh {
  private indicatorEl: HTMLElement | null = null;
  private iconEl: HTMLElement | null = null;
  private spinnerEl: HTMLElement | null = null;
  private appEl: HTMLElement | null = null;

  private startY = 0;
  private startX = 0;
  private isTracking = false;
  private currentDistance = 0;
  private state: PullToRefreshState = 'idle';
  private hasVibrated = false;

  private readonly THRESHOLD = 65; // px required to trigger reload
  private readonly MAX_PULL = 100; // max visual displacement

  constructor() {
    this.appEl = document.getElementById('app');
    this.createIndicator();
    this.bindEvents();
  }

  private createIndicator() {
    // Remove any legacy indicator if present
    const existing = document.getElementById('pull-to-refresh-indicator');
    if (existing) existing.remove();

    this.indicatorEl = document.createElement('div');
    this.indicatorEl.id = 'pull-to-refresh-indicator';
    this.indicatorEl.className = 'pull-refresh-indicator';

    // Pure minimalist circular bead — zero text labels on screen
    this.indicatorEl.innerHTML = `
      <div class="pull-refresh-bead glass-panel">
        <span class="pull-refresh-anchor">⚓</span>
        <div class="pull-refresh-spinner hidden"></div>
      </div>
    `;

    if (this.appEl) {
      this.appEl.prepend(this.indicatorEl);
    } else {
      document.body.prepend(this.indicatorEl);
    }

    this.iconEl = this.indicatorEl.querySelector('.pull-refresh-anchor') as HTMLElement;
    this.spinnerEl = this.indicatorEl.querySelector('.pull-refresh-spinner') as HTMLElement;
  }

  private isMinigameActive(): boolean {
    const docking = document.getElementById('view-docking-3d');
    const hazard = document.getElementById('view-hazard-3d');
    const isDockingActive = docking ? docking.classList.contains('active') && !docking.classList.contains('hidden') : false;
    const isHazardActive = hazard ? hazard.classList.contains('active') && !hazard.classList.contains('hidden') : false;
    return isDockingActive || isHazardActive;
  }

  private getScrollParent(target: HTMLElement | null): HTMLElement | null {
    let el = target;
    while (el && el !== document.body && el !== document.documentElement) {
      const overflowY = window.getComputedStyle(el).overflowY;
      if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
        return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  private bindEvents() {
    window.addEventListener('touchstart', this.onTouchStart, { passive: true });
    window.addEventListener('touchmove', this.onTouchMove, { passive: false });
    window.addEventListener('touchend', this.onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', this.onTouchCancel, { passive: true });
  }

  private onTouchStart = (e: TouchEvent) => {
    if (this.state === 'refreshing' || e.touches.length !== 1) return;
    if (this.isMinigameActive()) return;

    const touch = e.touches[0];
    const target = e.target as HTMLElement | null;

    // Check if target is inside an element that is already scrolled down
    const scrollParent = this.getScrollParent(target);
    if (scrollParent && scrollParent.scrollTop > 2) {
      return;
    }

    this.startY = touch.clientY;
    this.startX = touch.clientX;
    this.isTracking = true;
    this.hasVibrated = false;
    this.currentDistance = 0;
  };

  private onTouchMove = (e: TouchEvent) => {
    if (!this.isTracking || this.state === 'refreshing' || e.touches.length !== 1) return;

    const touch = e.touches[0];
    const rawDeltaY = touch.clientY - this.startY;
    const rawDeltaX = Math.abs(touch.clientX - this.startX);

    // Cancel if horizontal swipe (e.g. tabs or slider)
    if (rawDeltaX > 15 && rawDeltaX > Math.abs(rawDeltaY)) {
      this.cancelPull();
      return;
    }

    // Cancel if user is scrolling up/down into content
    if (rawDeltaY <= 0) {
      this.cancelPull();
      return;
    }

    // Double check scroll position of active screen
    const target = e.target as HTMLElement | null;
    const scrollParent = this.getScrollParent(target);
    if (scrollParent && scrollParent.scrollTop > 2) {
      this.cancelPull();
      return;
    }

    // Elastic damping formula
    this.currentDistance = Math.min(this.MAX_PULL, Math.pow(rawDeltaY, 0.84));

    if (this.currentDistance > 8) {
      if (e.cancelable) e.preventDefault();

      const progress = Math.min(1, this.currentDistance / this.THRESHOLD);

      if (this.currentDistance >= this.THRESHOLD) {
        if (this.state !== 'ready') {
          this.state = 'ready';
          this.updateUi('ready', progress);
          if (!this.hasVibrated) {
            this.hasVibrated = true;
            try {
              if ('vibrate' in navigator) navigator.vibrate(15);
            } catch {
              // Ignore if unsupported
            }
          }
        }
      } else {
        this.state = 'pulling';
        this.updateUi('pulling', progress);
      }

      this.renderTransform(this.currentDistance, progress);
    }
  };

  private onTouchEnd = () => {
    if (!this.isTracking) return;
    this.isTracking = false;

    if (this.state === 'ready') {
      this.triggerRefresh();
    } else {
      this.cancelPull();
    }
  };

  private onTouchCancel = () => {
    this.cancelPull();
  };

  private updateUi(state: PullToRefreshState, progress: number) {
    if (!this.indicatorEl) return;

    if (state === 'pulling') {
      this.indicatorEl.classList.remove('ready', 'refreshing');
      this.indicatorEl.classList.add('pulling');
      if (this.spinnerEl) this.spinnerEl.classList.add('hidden');
      if (this.iconEl) {
        this.iconEl.classList.remove('hidden');
        this.iconEl.style.transform = `rotate(${progress * 300}deg) scale(${0.8 + progress * 0.25})`;
      }
    } else if (state === 'ready') {
      this.indicatorEl.classList.remove('pulling');
      this.indicatorEl.classList.add('ready');
      if (this.iconEl) {
        this.iconEl.style.transform = 'rotate(360deg) scale(1.15)';
      }
    } else if (state === 'refreshing') {
      this.indicatorEl.classList.remove('pulling', 'ready');
      this.indicatorEl.classList.add('refreshing');
      if (this.iconEl) this.iconEl.classList.add('hidden');
      if (this.spinnerEl) this.spinnerEl.classList.remove('hidden');
    }
  }

  private renderTransform(distance: number, progress: number, animate = false) {
    if (!this.indicatorEl) return;
    if (animate) {
      this.indicatorEl.style.transition = 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.28s ease';
    } else {
      this.indicatorEl.style.transition = 'none';
    }
    const opacity = Math.min(1, Math.max(0, (progress - 0.1) / 0.7));
    this.indicatorEl.style.opacity = `${opacity}`;
    this.indicatorEl.style.transform = `translateY(${distance}px)`;
  }

  private cancelPull() {
    this.isTracking = false;
    this.state = 'idle';
    this.currentDistance = 0;
    if (this.indicatorEl) {
      this.renderTransform(0, 0, true);
      this.indicatorEl.classList.remove('pulling', 'ready', 'refreshing');
    }
  }

  private triggerRefresh() {
    this.state = 'refreshing';
    this.updateUi('refreshing', 1);
    this.renderTransform(52, 1, true);

    try {
      sounds.playBell();
    } catch {
      // Audio fallback
    }

    setTimeout(() => {
      window.location.reload();
    }, 350);
  }
}
