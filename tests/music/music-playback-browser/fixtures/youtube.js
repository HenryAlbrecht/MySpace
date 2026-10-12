// Explicit confirmation prevents a test from racing onReady/autoplay.
window.YT = { Player: class {
  constructor(frame, { events }) {
    this.events = events;
    this.url = frame.src.replace("/embed/", "/watch?v=").split("&")[0];
    this.state = -1;
    this.position = 42;
    this.started = performance.now();
    this.calls = 0;
    window.__ytCreations = (window.__ytCreations || 0) + 1;
    window.__ytTest = this;
    queueMicrotask(() => events.onReady({ target: this }));
  }
  getVideoUrl() { return this.url; }
  getPlayerState() { return this.state; }
  getCurrentTime() {
    return this.position + (this.state === 1 ? (performance.now() - this.started) / 1000 : 0);
  }
  getDuration() { return 240; }
  emit(state) {
    this.position = this.getCurrentTime();
    this.started = performance.now();
    this.state = state;
    if (state === 1) this.confirmed = true;
    this.events.onStateChange({ target: this, data: state });
  }
  playVideo() {
    this.calls++;
    if (this.confirmed) this.emit(1);
  }
  pauseVideo() { this.emit(2); }
  stopVideo() { this.emit(-1); }
  setVolume(value) { this.volume = value; }
  destroy() { this.destroyed = true; }
} };
window.onYouTubeIframeAPIReady();
