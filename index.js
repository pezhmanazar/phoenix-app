// index.js
import "expo-router/entry";
import TrackPlayer from "react-native-track-player";
import playbackService from "./lib/notifSession";

// ثبت سرویس بک‌گراند برای کنترل‌های نوتیفیکیشن
TrackPlayer.registerPlaybackService(() => playbackService);