import { defineConfig, type UserConfigExport } from '@tarojs/cli';
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import devConfig from './dev';
import prodConfig from './prod';
import vitePluginImp from 'vite-plugin-imp';
// https://taro-docs.jd.com/docs/next/config#defineconfig-辅助函数
export default defineConfig<'webpack5'>(async (merge, { command, mode }) => {
  const baseConfig: UserConfigExport<'webpack5'> = {
    projectName: 'taro_template',
    date: '2025-12-10',
    designWidth: 375,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      375: 2,
      828: 1.81 / 2,
    },
    sourceRoot: 'src',
    // H5 产物独立输出到 dist-h5（Capacitor App 的 webDir），与微信小程序产物 dist 隔离，
    // 两端可同时构建互不覆盖；仍可用 TARO_OUTPUT_DIR 显式覆盖
    outputRoot:
      process.env.TARO_OUTPUT_DIR ||
      (process.env.TARO_ENV === 'h5' ? 'dist-h5' : 'dist'),
    plugins: ['@tarojs/plugin-html'],
    defineConstants: {},
    copy: {
      patterns: [],
      options: {},
    },
    framework: 'react',
    compiler: {
      type: 'webpack5',
      prebundle: {
        enable: false,
      },
    },
    cache: {
      enable: false, // Webpack 持久化缓存配置，建议开启。默认配置请参考：https://docs.taro.zone/docs/config-detail#cache
    },
    mini: {
      // 默认 babel 不编译 node_modules；CloudBase SDK / jwt-decode 含 ES2020（??、?.），
      // 微信开发者工具预览打包的解析器不识别会报 SyntaxError，需纳入 babel 降级到 ES5
      compile: {
        include: [
          (modulePath: string) => modulePath.includes('@cloudbase'),
          (modulePath: string) => modulePath.includes('jwt-decode'),
          (modulePath: string) => modulePath.includes('bson')
        ]
      },
      postcss: {
        pxtransform: {
          enable: true,
          config: {
            selectorBlackList: ['nut-'],
          },
        },
        cssModules: {
          enable: true, // 开启 CSS Modules
          config: {
            namingPattern: 'module', // 仅 *.module.scss 生效
            generateScopedName: '[name]__[local]___[hash:base64:5]',
          },
        },
      },
      webpackChain(chain) {
        chain.resolve.plugin('tsconfig-paths').use(TsconfigPathsPlugin);
        // 微信小程序预览/上传要求 sitemap.json，显式拷贝到产物根目录
        chain.plugin('copy-sitemap-json').use(CopyWebpackPlugin, [
          {
            patterns: [{ from: 'src/sitemap.json', to: 'sitemap.json' }]
          }
        ]);
      },
    },
    h5: {
      publicPath: '/',
      // hash 路由：Capacitor WebView（https://localhost）下不依赖服务端回退，加载最稳
      router: { mode: 'hash' },
      staticDirectory: 'static',
      output: {
        filename: 'js/[name].[hash:8].js',
        chunkFilename: 'js/[name].[chunkhash:8].js',
      },
      miniCssExtractPluginOption: {
        ignoreOrder: true,
        filename: 'css/[name].[hash].css',
        chunkFilename: 'css/[name].[chunkhash].css',
      },
      postcss: {
        autoprefixer: {
          enable: true,
          config: {},
        },
        cssModules: {
          enable: true, // 开启 CSS Modules
          config: {
            namingPattern: 'module', // 仅 *.module.scss 生效
            generateScopedName: '[name]__[local]___[hash:base64:5]',
          },
        },
        pxtransform: {
          enable: true,
          config: {
            selectorBlackList: ['body'],
            baseFontSize: 37.5,
            unitPrecision: 5,
          },
        },
      },
      webpackChain(chain) {
        chain.resolve.plugin('tsconfig-paths').use(TsconfigPathsPlugin);
      },
    },
    rn: {
      appName: 'taroDemo',
      postcss: {
        cssModules: {
          enable: true,
        },
      },
    },
  };
  if (process.env.NODE_ENV === 'development') {
    // 本地开发构建配置（不混淆压缩）
    return merge({}, baseConfig, devConfig);
  }
  // 生产构建配置（默认开启压缩混淆等）
  return merge({}, baseConfig, prodConfig);
});
