import { CodeBlock, PageHeading, type PageProps } from "./Pages";
import { DocsPagination, guideList } from "./docs-index";

type Section = { en: string; zh: string; body: [string, string][]; code?: string; label?: string };
type Guide = { id: string; en: string; zh: string; summary: [string, string]; sections: Section[] };

const guides: Guide[] = [
  {
    id: "theming",
    en: "Theming",
    zh: "主题",
    summary: ["Light and dark, design tokens, and ink that adapts to what sits behind the glass.", "浅色与深色、设计变量，以及随玻璃背后内容调整的文字颜色。"],
    sections: [
      {
        en: "Light and dark",
        zh: "浅色与深色",
        body: [["Components follow the CSS color-scheme of the page. Stages and resting control colors use light-dark() values, so declaring the scheme is enough; a data-theme attribute lets readers override the system.", "组件跟随页面的 CSS color-scheme。底图与控件的静止颜色使用 light-dark()，声明配色方案即可；再用 data-theme 属性让读者覆盖系统设置。"]],
        label: "CSS",
        code: ':root { color-scheme: light dark; }\n:root[data-theme="light"] { color-scheme: light; }\n:root[data-theme="dark"] { color-scheme: dark; }',
      },
      {
        en: "Tokens",
        zh: "设计变量",
        body: [["Switch, Slider and Tabs read --dg-control-* tokens, which fall back to common application tokens such as --primary and --fg-1 when you already define them. Override them for any subtree.", "Switch、Slider 与 Tabs 读取 --dg-control-* 变量；若应用已定义 --primary、--fg-1 等常见变量，则自动沿用。可以在任意子树中覆盖。"]],
        label: "CSS",
        code: ".settings {\n  --dg-control-accent: #0a84ff;\n  --dg-control-track: #d8d8d6;\n  --dg-switch-on: #34c759;\n}",
      },
      {
        en: "Ink that adapts",
        zh: "自适应文字",
        body: [
          ["Glass surfaces publish data-dg-tone=\"light\" or \"dark\" from the luminance behind them. The value changes with hysteresis and is read outside scrolling and animation, so it never flickers.", "玻璃表面会根据背后内容的亮度发布 data-dg-tone=\"light\" 或 \"dark\"。该值带有滞后区间，并在滚动与动画之外读取，因此不会闪烁。"],
          ["The attribute is informational: the library never recolors your content. Style it where glass floats over photos or video.", "这个属性只提供信息，库不会自动改变内容颜色。在玻璃悬浮于照片或视频之上时自行设置样式即可。"],
        ],
        label: "CSS",
        code: '.dg-surface[data-dg-tone="dark"] { color: #fff; }\n.dg-surface[data-dg-tone="light"] { color: #111; }',
      },
    ],
  },
  {
    id: "material",
    en: "Material & HDR",
    zh: "材质与 HDR",
    summary: ["One provider tunes every glass surface beneath it, without erasing each component's calibration.", "一个 Provider 调整其下所有玻璃，同时保留每个组件自身的校准。"],
    sections: [
      {
        en: "One provider",
        zh: "统一的 Provider",
        body: [["LiquidGlassProvider applies optical material to every component below it. An empty material keeps every component's calibrated defaults; nested providers inherit their parent's values.", "LiquidGlassProvider 将光学材质应用到其下的所有组件。空材质保留每个组件的校准默认值；嵌套的 Provider 会继承父级的设置。"]],
        code: 'import { LiquidGlassProvider } from "rglass/liquid-glass";\n\n<LiquidGlassProvider material={{ blurStrength: 2.8, chromaAmount: 0.2 }}>\n  <App />\n</LiquidGlassProvider>;',
      },
      {
        en: "Precedence",
        zh: "优先级",
        body: [
          ["Values resolve in this order, later winning: the renderer's base material, the shared defaults for ordinary glass (dispersion 0.33, dome depth 28), each component's calibration, the HDR highlight default, and finally explicit provider material.", "取值按以下顺序，后者优先：渲染器基础材质、普通玻璃的共享默认值（色散 0.33、弧面深度 28）、组件自身校准、HDR 高光默认值，最后是 Provider 中显式设置的材质。"],
          ["Calibrated lenses such as the Switch and Slider thumbs, Tabs, Spotlight and the Morph Menu keep their own dispersion and dome depth unless you set them explicitly. Pass inherit={false} to start a subtree fresh; it still keeps the parent's HDR preference.", "Switch 与 Slider 滑块、Tabs、Spotlight 和 Morph Menu 等已校准的透镜，除非显式设置，否则保留自身的色散与弧面深度。传入 inherit={false} 可以让子树重新开始，但仍保留父级的 HDR 偏好。"],
        ],
        code: '<LiquidGlassProvider material={{ refractionStrength: 0.3 }}>\n  {/* A comparison panel that ignores the page material */}\n  <LiquidGlassProvider material={{}} inherit={false}>\n    <GlassButton>Default</GlassButton>\n  </LiquidGlassProvider>\n</LiquidGlassProvider>;',
      },
      {
        en: "HDR",
        zh: "HDR",
        body: [["On a display that matches (dynamic-range: high), reflections and pointer light extend above SDR white and the default highlight rises to 0.48. SDR displays keep each component's own highlight. Set hdr: false in material, or hdr={false} on a component, to stay in SDR.", "在匹配 (dynamic-range: high) 的显示器上，反光与指针光可以超过 SDR 白，默认高光提高到 0.48。SDR 显示器保留每个组件自身的高光。在材质中设置 hdr: false，或在组件上传入 hdr={false}，即可保持 SDR。"]],
        code: 'import { useDisplayHDR } from "rglass/liquid-glass";\n\nconst hdr = useDisplayHDR(); // true on HDR displays\n<LiquidGlassProvider material={{ hdr: false }}>…</LiquidGlassProvider>;',
      },
      {
        en: "Lens profile and light",
        zh: "透镜轮廓与光源",
        body: [
          ["refractionModel: \"bevel\" models a flat slab with a rounded rim: the top stays clear, the rim refracts by Snell's law, and dispersion follows physical order with blue bending most. The default \"dome\" is the calibrated spherical-cap lens.", "refractionModel: \"bevel\" 模拟带圆角边缘的平板玻璃：顶部保持清晰，边缘按斯涅尔定律折射，色散遵循蓝光偏折最大的物理顺序。默认的 \"dome\" 是经过校准的球冠透镜。"],
          ["lightSource: \"pointer\" steers highlights toward a mouse or pen; \"device\" follows orientation events where the platform grants them (on iOS, call DeviceOrientationEvent.requestPermission() from a user gesture first). Reduced motion keeps the light fixed.", "lightSource: \"pointer\" 让高光朝向鼠标或触控笔；\"device\" 在平台允许时跟随设备方向（在 iOS 上需先在用户手势中调用 DeviceOrientationEvent.requestPermission()）。开启减少动态效果时光源保持固定。"],
        ],
        code: '<LiquidGlassProvider material={{ refractionModel: "bevel", lightSource: "pointer" }}>\n  <App />\n</LiquidGlassProvider>;',
      },
    ],
  },
  {
    id: "motion",
    en: "Motion & gestures",
    zh: "动态与手势",
    summary: ["Springs that keep their momentum, glass that responds to touch, and shapes that fuse.", "保留动量的弹簧、回应触摸的玻璃，以及可以融合的形状。"],
    sections: [
      {
        en: "Springs that keep momentum",
        zh: "保留动量的弹簧",
        body: [["apple-motion provides analytic springs, keyframe trajectories and presets. Interrupting a motion retains its current velocity, so reversals stay continuous instead of restarting.", "apple-motion 提供解析弹簧、关键帧轨迹与预设。中断动画会保留当前速度，因此反向运动保持连续，而不是从头开始。"]],
        code: 'import { stepSpring } from "rglass/apple-motion";\n\n// Advance one frame: returns [position, velocity].\nconst [x, v] = stepSpring(x0, v0, target, {\n  mass: 1, stiffness: 170, damping: 22,\n}, 1 / 60);',
      },
      {
        en: "Touching glass",
        zh: "触摸玻璃",
        body: [["Buttons and surfaces light the actual press point, resist pulling while the opposite side stays anchored, and return elastically on release. Switch, Slider and Tabs keep their own gestures and add the same contact light. On GlassSurface, interactive=\"light\" keeps the light but leaves dragging to your application.", "按钮与表面会照亮真实的按压位置，拉伸时对侧保持锚定并产生阻力，松手后弹性回位。Switch、Slider 与 Tabs 保留各自的手势，并加入相同的接触光。GlassSurface 上的 interactive=\"light\" 保留光效，把拖动交给你的应用。"]],
      },
      {
        en: "Fusion",
        zh: "融合",
        body: [["Nearby shapes merge through one signed-distance field. GlassGroup fuses its DOM children once they come within spacing, following layout changes and CSS transitions; LiquidGlassCanvas takes up to eight blobs and a mergeDistance for custom scenes.", "相邻形状通过同一个有符号距离场融合。GlassGroup 会在子元素彼此进入 spacing 距离时将其融合，并跟随布局变化与 CSS 过渡；自定义场景可以使用 LiquidGlassCanvas，最多八个形体，并设置 mergeDistance。"]],
        code: '<GlassGroup spacing={24} className={merged ? "tools merged" : "tools"}>\n  <GlassButton aria-label="Bold">B</GlassButton>\n  <GlassButton aria-label="Italic">I</GlassButton>\n</GlassGroup>\n\n/* CSS */\n.tools .dg-glass-group__items { transition: gap .5s; }\n.tools.merged .dg-glass-group__items { gap: 2px; }',
      },
      {
        en: "Reduced motion",
        zh: "减少动态效果",
        body: [["With prefers-reduced-motion: reduce, controls reach their end states directly, highlights stay fixed and ambient showcase motion stops. Keyboard and pointer behavior is unchanged.", "开启 prefers-reduced-motion: reduce 时，控件直接到达最终状态，高光保持固定，展示中的环境动画停止。键盘与指针行为不变。"]],
      },
    ],
  },
  {
    id: "renderer",
    en: "Renderer",
    zh: "渲染器",
    summary: ["Native WebGPU with a WebGL2 fallback, drawing only when something changes.", "原生 WebGPU 与 WebGL2 回退，只在内容变化时绘制。"],
    sections: [
      {
        en: "WebGPU first",
        zh: "WebGPU 优先",
        body: [["The WebGPU renderer is primary and WebGL2 is the fallback; both implement the same optical equations. A failed or lost WebGPU device falls back to WebGL2, and a lost WebGL2 context is restored. Force a backend for comparisons with the provider.", "WebGPU 渲染器为主，WebGL2 为回退，两者实现相同的光学方程。WebGPU 设备初始化失败或丢失时回退到 WebGL2，WebGL2 上下文丢失后会自动恢复。可以通过 Provider 指定后端以便比较。"]],
        code: '<LiquidGlassProvider material={{}} backend="webgl2">\n  <App />\n</LiquidGlassProvider>;',
      },
      {
        en: "Drawing on demand",
        zh: "按需绘制",
        body: [["A canvas draws only when one of its inputs changes. Offscreen canvases and hidden pages suspend, small controls share one GPU context, and the shared GPU device is released as soon as no surface uses it.", "画布只在输入发生变化时绘制。离屏画布与隐藏页面会暂停，小型控件共享同一个 GPU 上下文，当不再有玻璃表面使用时立即释放共享的 GPU 设备。"]],
      },
      {
        en: "What glass can see",
        zh: "玻璃能看到什么",
        body: [
          ["Glass refracts a source. UI components use a bounded DOM backdrop adapter that re-rasterizes common page content — backgrounds, text, images, canvases and SVG — inside each surface's bounds. Video and Spotlight sample their media directly, and custom scenes pass a canvas.", "玻璃折射的是一个源。UI 组件使用有边界的 DOM 背景适配器，在每个表面的范围内重新绘制常见页面内容，包括背景、文字、图片、画布与 SVG。视频与 Spotlight 直接采样媒体，自定义场景传入画布。"],
          ["The adapter is not universal browser capture: CSS filters, iframes, cross-origin media without CORS and some effects are not reproduced. Supply same-origin or CORS-enabled media.", "该适配器并非完整的浏览器画面捕获：CSS 滤镜、iframe、未开启 CORS 的跨域媒体以及部分效果不会被还原。请使用同源或启用 CORS 的媒体。"],
        ],
      },
      {
        en: "Custom scenes",
        zh: "自定义场景",
        body: [["LiquidGlassCanvas wraps the renderer for React: pass a source canvas, a revision that changes when its pixels change, and MotionValue-driven blobs.", "LiquidGlassCanvas 为 React 封装了渲染器：传入源画布、在像素变化时递增的版本号，以及由 MotionValue 驱动的形体。"]],
        code: 'import { LiquidGlassCanvas } from "rglass/liquid-glass";\n\n<LiquidGlassCanvas\n  sourceRef={canvasRef}\n  sourceRevision={revision}\n  width={640} height={440}\n  blobs={[{ x, y, radius: 48 }, { x: 0.7, y: 0.5, radius: 40 }]}\n  mergeDistance={38}\n  transparentOutside\n/>;',
      },
    ],
  },
  {
    id: "performance",
    en: "Performance",
    zh: "性能",
    summary: ["What costs frames, what does not, and how to measure it.", "什么会消耗帧，什么不会，以及如何测量。"],
    sections: [
      {
        en: "Keep motion out of React",
        zh: "让动画绕开 React",
        body: [["Drive moving glass with MotionValues rather than React state. Only surfaces whose inputs change are redrawn, so a handful of moving shapes costs little while dozens redraw every frame.", "使用 MotionValue 而不是 React state 驱动移动的玻璃。只有输入变化的表面会重绘，少量移动形状开销很小，而几十个同时移动的形状每帧都要重绘。"]],
      },
      {
        en: "Frost and sources",
        zh: "磨砂与源",
        body: [["Strong frost resamples cached reductions that are rebuilt only when the source changes. Moving glass over a still source is cheap; changing the source every frame is not. Large decorative surfaces can lower pixelRatio in material.", "强磨砂会重采样缓存的降采样层，只在源变化时重建。在静止的源上移动玻璃开销很小；每帧改变源则不然。大面积装饰性玻璃可以在材质中降低 pixelRatio。"]],
      },
      {
        en: "Scrolling",
        zh: "滚动",
        body: [["Glass that scrolls with its content keeps its backdrop. Fixed glass over scrolling content repaints only its own region, batched with every other surface once per frame. Pointer-driven light redraws visible glass on each pointer frame, so opt in deliberately.", "随内容一起滚动的玻璃会保留背景。固定在滚动内容上方的玻璃只重绘自身区域，并与其他表面在每帧合并处理。指针驱动的光源会在每个指针帧重绘可见玻璃，请按需开启。"]],
      },
      {
        en: "Measure",
        zh: "测量",
        body: [["Count presented frames to confirm that glass stops drawing at rest.", "统计已呈现的帧数，确认玻璃在静止时停止绘制。"]],
        code: 'import { subscribeLiquidFrames } from "rglass/liquid-glass/renderer";\n\nlet frames = 0;\nconst stop = subscribeLiquidFrames(() => frames++);\n// … interact, wait, then:\nconsole.log(frames);\nstop();',
      },
    ],
  },
  {
    id: "accessibility",
    en: "Accessibility",
    zh: "无障碍",
    summary: ["Native semantics first; the glass is presentation.", "原生语义优先，玻璃只负责呈现。"],
    sections: [
      {
        en: "Native semantics",
        zh: "原生语义",
        body: [["Switch and Slider are native inputs, Tabs follow the tabs pattern with arrow keys, dialogs and sheets use the native dialog element, and popovers use the Popover API. Menus and button groups support arrow keys, Home and End; Escape dismisses overlays. Optical layers behind controls are hidden from assistive technology; a standalone canvas is exposed as a labelled image.", "Switch 与 Slider 是原生输入控件，Tabs 遵循标签页模式并支持方向键，对话框与侧边面板使用原生 dialog，浮层使用 Popover API。菜单与按钮组支持方向键、Home 与 End，Escape 关闭浮层。控件背后的光学层对辅助技术隐藏；独立画布以带标签的图像呈现。"]],
      },
      {
        en: "Labels",
        zh: "标签",
        body: [["Give every control an accessible name: ariaLabel on Switch and Slider, label on Tabs and button groups, and localized labels on GlassVideo, whose seek bar also reports its time as text.", "为每个控件提供可访问名称：Switch 与 Slider 使用 ariaLabel，Tabs 与按钮组使用 label，GlassVideo 使用可本地化的 labels，其进度条也会以文本报告时间。"]],
        code: '<GlassSwitch ariaLabel="Notifications" />\n<GlassVideo src="/film.mp4" labels={{ play: "Reproducir", pause: "Pausa" }} />',
      },
      {
        en: "Contrast and motion",
        zh: "对比度与动态",
        body: [["Glass floats over arbitrary content, so check contrast where it meets photos or video and use data-dg-tone to adapt ink. Reduced motion is respected throughout, and forced-colors mode keeps visible focus.", "玻璃会悬浮在任意内容之上，在照片或视频上请检查对比度，并用 data-dg-tone 调整文字颜色。全程遵循减少动态效果设置，强制颜色模式下保留可见焦点。"]],
      },
    ],
  },
  {
    id: "browser-support",
    en: "Browser support",
    zh: "浏览器支持",
    summary: ["What the library needs from a browser, and what degrades gracefully.", "库对浏览器的要求，以及可以平稳降级的部分。"],
    sections: [
      {
        en: "Requirements",
        zh: "基本要求",
        body: [["A browser with WebGPU or WebGL2. WebGPU is used where the browser exposes it, such as current Chrome, Edge and Safari; every other capable browser uses WebGL2 with the same optics. Overlays require the Popover API and the dialog element (Chrome and Edge 114+, Safari 17+, Firefox 125+).", "浏览器需要支持 WebGPU 或 WebGL2。在提供 WebGPU 的浏览器中（例如新版 Chrome、Edge 与 Safari）使用 WebGPU，其余浏览器使用光学效果相同的 WebGL2。浮层需要 Popover API 与 dialog 元素（Chrome 与 Edge 114+、Safari 17+、Firefox 125+）。"]],
      },
      {
        en: "Progressive features",
        zh: "渐进增强",
        body: [["HDR highlights need an HDR display and extended-range canvas support; otherwise glass renders in SDR. Pointer light needs a hovering pointer, and device light needs orientation events. Missing features fall back without changing layout.", "HDR 高光需要 HDR 显示器以及扩展范围画布支持，否则以 SDR 渲染。指针光源需要可悬停的指针，设备光源需要方向事件。缺少这些能力时会回退，不影响布局。"]],
      },
      {
        en: "Testing on devices",
        zh: "真机测试",
        body: [["Desktop viewport emulation does not reproduce mobile GPUs, dynamic toolbars or HDR output. Validate important flows, especially on Mobile Safari, on real devices.", "桌面浏览器的视口模拟无法还原移动 GPU、动态工具栏或 HDR 输出。重要流程（尤其是 Mobile Safari）请在真机上验证。"]],
      },
    ],
  },
  {
    id: "ssr",
    en: "Server rendering",
    zh: "服务端渲染",
    summary: ["Import on the server, draw after hydration.", "在服务端导入，水合后绘制。"],
    sections: [
      {
        en: "Rendering on the server",
        zh: "在服务端渲染",
        body: [["Library modules touch no browser APIs at import time and render static markup with react-dom/server. Glass starts drawing after hydration, when the canvas and its sources exist.", "库模块在导入时不访问浏览器 API，可以通过 react-dom/server 渲染静态标记。玻璃在水合之后、画布与源准备好时开始绘制。"]],
      },
      {
        en: "Next.js App Router",
        zh: "Next.js App Router",
        body: [["Components use effects and refs, so render them from client components. Import the stylesheet once in the root layout.", "组件依赖 effect 与 ref，请在客户端组件中渲染，并在根布局中导入一次样式表。"]],
        code: '"use client";\nimport { GlassButton } from "rglass/controls";\n\nexport function Actions() {\n  return <GlassButton>Continue</GlassButton>;\n}\n\n// app/layout.tsx\nimport "rglass/controls.css";',
      },
      {
        en: "Avoid a theme flash",
        zh: "避免主题闪烁",
        body: [["Set the theme before first paint with a small inline script, as this site does, so server-rendered pages never flash the wrong scheme.", "像本站一样，用一段内联脚本在首次绘制前设置主题，避免服务端渲染的页面闪现错误的配色。"]],
        label: "HTML",
        code: '<script>\n  try {\n    const saved = localStorage.getItem("theme");\n    document.documentElement.dataset.theme = saved ??\n      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");\n  } catch {}\n</script>',
      },
    ],
  },
];

export function GuidePage({ id, locale }: PageProps & { id: string }) {
  const zh = locale === "zh";
  const guide = guides.find(item => item.id === id) ?? guides[0];
  const title = guideList.find(item => item.id === guide.id)!;
  return (
    <>
      <PageHeading kicker={zh ? "指南" : "GUIDE"} title={zh ? title.zh : title.en} description={guide.summary[zh ? 1 : 0]} />
      {guide.sections.map(section => (
        <section className="doc-section" key={section.en}>
          <h2>{zh ? section.zh : section.en}</h2>
          {section.body.map(([en, zhText]) => <p key={en}>{zh ? zhText : en}</p>)}
          {section.code && <CodeBlock code={section.code} label={section.label} locale={locale} />}
        </section>
      ))}
      <DocsPagination id={guide.id} locale={locale} />
    </>
  );
}
