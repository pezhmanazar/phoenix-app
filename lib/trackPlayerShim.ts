// lib/trackPlayerShim.ts — جایگزین موقت
type AnyFn = (...args: any[]) => any;
const no: AnyFn = async () => {};

const TrackPlayer = {
  setupPlayer: no,
  updateOptions: no,
  add: no,
  play: no,
  pause: no,
  stop: no,
  reset: no,
  destroy: no,
  seekTo: no,
  skip: no,
  skipToNext: no,
  skipToPrevious: no,
  setRepeatMode: no,
  setVolume: no,
  getState: async () => 0,
  getActiveTrackIndex: async () => -1,
  getTrack: async () => null,
  addEventListener: (_event: any, _cb: AnyFn) => ({ remove: () => {} }),
};

export default TrackPlayer;

// هرچی تو پروژه استفاده کردی، حداقل تعریف‌شو بده:
export const State = { None: 0, Ready: 1, Playing: 2, Paused: 3, Stopped: 4, Buffering: 5, Loading: 6 };
export const Capability: any = {};
export const Event: any = {};
export const RepeatMode: any = {};
export const AppKilledPlaybackBehavior: any = {};
export const useTrackPlayerEvents = (_events: any, _handler: AnyFn) => {};