/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 将这些包标记为外部依赖，不在 webpack 中打包
  serverComponentsExternalPackages: [
    'chromadb',
    '@chroma-core/default-embed',
    '@huggingface/transformers',
    'onnxruntime-node',
    'sharp',
  ],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // 在服务器端，将这些包标记为外部依赖
      config.externals = config.externals || [];
      config.externals.push({
        'chromadb': 'commonjs chromadb',
        '@chroma-core/default-embed': 'commonjs @chroma-core/default-embed',
        '@huggingface/transformers': 'commonjs @huggingface/transformers',
        'onnxruntime-node': 'commonjs onnxruntime-node',
        'sharp': 'commonjs sharp',
      });
    } else {
      // 在客户端，完全排除这些包
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'chromadb': false,
        '@chroma-core/default-embed': false,
        '@huggingface/transformers': false,
        'onnxruntime-node': false,
        'sharp': false,
      };
    }

    // 忽略 .node 二进制文件
    config.module.rules.push({
      test: /\.node$/,
      use: 'raw-loader',
    });

    return config;
  },
}

module.exports = nextConfig
