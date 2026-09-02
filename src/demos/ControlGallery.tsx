import { useState, type ReactNode } from "react";
import { GlassSegmented, GlassSlider, GlassSwitch } from "../lib";
import { DemoLabel } from "../demo/Primitives";
import type { Locale } from "../i18n";
import { GlassActionDemo } from "./AdditionalGlassDemos";

const copy = {
  zh: {
    switch: "开关",
    switchAria: "启用玻璃效果",
    slider: "滑杆",
    sliderAria: "数值",
    tabs: "标签组",
    tabsAria: "选项",
    button: "按钮",
    hold: "按住",
    labels: { hubs: "中心", spokes: "分支", reserves: "储备", assets: "资产", chains: "网络" },
  },
  en: {
    switch: "Switch",
    switchAria: "Enable glass effect",
    slider: "Slider",
    sliderAria: "Value",
    tabs: "Tabs",
    tabsAria: "Options",
    button: "Button",
    hold: "Hold",
    labels: { hubs: "Center", spokes: "Branches", reserves: "Reserves", assets: "Assets", chains: "Networks" },
  },
} as const;

function ControlPanel({
  title,
  children,
  wide,
}: {
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <article className={["control-panel", wide ? "control-panel--wide" : ""].filter(Boolean).join(" ")}>
      <DemoLabel title={title} />
      <div className="control-panel__stage">{children}</div>
    </article>
  );
}

export function ControlGallery({ locale }: { locale: Locale }) {
  const [enabled, setEnabled] = useState(false);
  const [amount, setAmount] = useState(50);
  const [segment, setSegment] = useState("hubs");
  const text = copy[locale];

  return (
    <div className="control-showcase">
      <ControlPanel
        title={text.switch}
      >
        <div className="control-plinth">
          <GlassSwitch
            checked={enabled}
            onCheckedChange={setEnabled}
            ariaLabel={text.switchAria}
          />
        </div>
      </ControlPanel>

      <ControlPanel
        title={text.slider}
      >
        <div className="control-plinth control-plinth--wide">
          <GlassSlider value={amount} onValueChange={setAmount} ariaLabel={text.sliderAria} />
        </div>
      </ControlPanel>

      <ControlPanel
        title={text.tabs}
        wide
      >
        <div className="control-plinth control-plinth--segmented">
          <GlassSegmented value={segment} onValueChange={setSegment} labels={text.labels} ariaLabel={text.tabsAria} />
        </div>
      </ControlPanel>

      <ControlPanel title={text.button} wide>
        <GlassActionDemo label={text.hold} />
      </ControlPanel>
    </div>
  );
}
