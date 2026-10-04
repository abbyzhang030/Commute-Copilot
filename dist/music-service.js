(function (global) {
  "use strict";

  const PlayerState = Object.freeze({
    idle: "idle",
    loading: "loading",
    ready: "ready",
    playing: "playing",
    paused: "paused",
    stopped: "stopped",
    unavailable: "unavailable",
  });

  class MusicService {
    constructor() {
      this.provider = "base";
      this.state = PlayerState.idle;
      this.listeners = new Set();
    }
    subscribe(listener) {
      this.listeners.add(listener);
      listener(this.getState());
      return () => this.listeners.delete(listener);
    }
    emit(state, detail = {}) {
      this.state = state;
      const snapshot = this.getState(detail);
      this.listeners.forEach((listener) => listener(snapshot));
    }
    getState(detail = {}) { return { provider: this.provider, state: this.state, ...detail }; }
    async initialize() { throw new Error("MusicService.initialize must be implemented"); }
    async loadPlaylist() { throw new Error("MusicService.loadPlaylist must be implemented"); }
    async play() { throw new Error("MusicService.play must be implemented"); }
    async pause() { throw new Error("MusicService.pause must be implemented"); }
    async resume() { return this.play(); }
    async stop() { throw new Error("MusicService.stop must be implemented"); }
    async setVolume() { throw new Error("MusicService.setVolume must be implemented"); }
    async next() { throw new Error("MusicService.next must be implemented"); }
  }

  class MockMusicService extends MusicService {
    constructor(reason = "YouTube is not configured") {
      super();
      this.provider = "mock";
      this.reason = reason;
      this.volume = 70;
    }
    async initialize() { this.emit(PlayerState.ready, { reason: this.reason }); return this; }
    async loadPlaylist() { return true; }
    async play() { this.emit(PlayerState.playing, { reason: this.reason }); return true; }
    async pause() { this.emit(PlayerState.paused, { reason: this.reason }); return true; }
    async stop() { this.emit(PlayerState.stopped, { reason: this.reason }); return true; }
    async setVolume(value) { this.volume = Math.max(0, Math.min(100, Number(value) || 0)); return this.volume; }
    async next() { this.emit(PlayerState.playing, { reason: this.reason }); return true; }
  }

  let iframeApiPromise;
  function loadIframeApi() {
    if (global.YT?.Player) return Promise.resolve(global.YT);
    if (iframeApiPromise) return iframeApiPromise;
    iframeApiPromise = new Promise((resolve, reject) => {
      const previous = global.onYouTubeIframeAPIReady;
      global.onYouTubeIframeAPIReady = () => {
        if (typeof previous === "function") previous();
        resolve(global.YT);
      };
      const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
      if (existing) return;
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => reject(new Error("YouTube IFrame API failed to load"));
      document.head.appendChild(script);
      setTimeout(() => reject(new Error("YouTube IFrame API timed out")), 10000);
    });
    return iframeApiPromise;
  }

  class YouTubeMusicService extends MusicService {
    constructor({ elementId, playlistId, volume = 70 }) {
      super();
      this.provider = "youtube";
      this.elementId = elementId;
      this.playlistId = playlistId;
      this.volume = volume;
      this.player = null;
      this.readyPromise = null;
      this.desiredState = PlayerState.paused;
    }
    async initialize() {
      if (this.readyPromise) return this.readyPromise;
      this.emit(PlayerState.loading);
      this.readyPromise = loadIframeApi().then(() => new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("YouTube player initialization timed out")), 10000);
        this.player = new global.YT.Player(this.elementId, {
          width: 200,
          height: 200,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            playsinline: 1,
            rel: 0,
            origin: global.location.origin,
          },
          events: {
            onReady: () => {
              clearTimeout(timeout);
              this.player.setVolume(this.volume);
              this.loadPlaylist(this.playlistId, false);
              this.emit(PlayerState.ready);
              resolve(this);
            },
            onStateChange: (event) => this.handlePlayerState(event.data),
            onError: (event) => this.emit(PlayerState.unavailable, { errorCode: event.data }),
          },
        });
      })).catch((error) => {
        this.emit(PlayerState.unavailable, { message: error.message });
        throw error;
      });
      return this.readyPromise;
    }
    handlePlayerState(value) {
      const yt = global.YT?.PlayerState;
      if (!yt) return;
      if (value === yt.PLAYING) this.emit(PlayerState.playing);
      else if (value === yt.PAUSED) this.emit(PlayerState.paused);
      else if (value === yt.ENDED) this.emit(PlayerState.stopped);
      else if (value === yt.CUED) this.emit(PlayerState.ready);
    }
    async loadPlaylist(playlistId = this.playlistId, autoplay = false) {
      this.playlistId = playlistId;
      if (!this.player?.cuePlaylist) return false;
      if (autoplay) this.player.loadPlaylist({ listType: "playlist", list: playlistId, index: 0, startSeconds: 0 });
      else this.player.cuePlaylist({ listType: "playlist", list: playlistId, index: 0, startSeconds: 0 });
      return true;
    }
    async play() {
      this.desiredState = PlayerState.playing;
      await this.initialize();
      this.player.playVideo();
      return true;
    }
    async pause() {
      this.desiredState = PlayerState.paused;
      if (this.player?.pauseVideo) this.player.pauseVideo();
      else this.emit(PlayerState.paused);
      return true;
    }
    async stop() {
      this.desiredState = PlayerState.stopped;
      if (this.player?.stopVideo) this.player.stopVideo();
      this.emit(PlayerState.stopped);
      return true;
    }
    async setVolume(value) {
      this.volume = Math.max(0, Math.min(100, Number(value) || 0));
      await this.initialize();
      this.player.setVolume(this.volume);
      return this.volume;
    }
    async next() {
      await this.initialize();
      this.player.nextVideo();
      return true;
    }
  }

  async function createConfiguredService(elementId = "youtubePlayer") {
    try {
      const response = await fetch("/api/music/config", { cache: "no-store" });
      if (!response.ok) throw new Error("Music configuration unavailable");
      const config = await response.json();
      if (config.provider !== "youtube" || !config.playlistId) throw new Error("YouTube playlist not configured");
      return new YouTubeMusicService({ elementId, playlistId: config.playlistId });
    } catch (error) {
      return new MockMusicService(error.message);
    }
  }

  global.CommuteMusic = { MusicService, MockMusicService, YouTubeMusicService, PlayerState, createConfiguredService };
})(window);
