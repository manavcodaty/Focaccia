module.exports = function babelConfig(api) {
  api.cache(true);

  return {
    // nativewind/babel already appends react-native-reanimated/plugin last.
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    plugins: ['react-native-worklets-core/plugin'],
  };
};
