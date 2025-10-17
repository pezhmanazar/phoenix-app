// app.plugin.js
// یک پلاگینِ نانیاز (noop) تا رزولوشن پلاگین خطا ندهد.
// در آینده می‌تونیم تو همین فایل ادغام‌های بومی رو اضافه کنیم.
const { createRunOncePlugin } = require('@expo/config-plugins');

/** @type {import('@expo/config-plugins').ConfigPlugin} */
const withPhoenixNoop = (config) => {
  // فعلاً هیچ تغییری روی config اعمال نمی‌کنیم
  return config;
};

module.exports = createRunOncePlugin(withPhoenixNoop, 'phoenix-noop', '1.0.0');