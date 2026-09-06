import { useState } from "react";
import { Bookmark, Check, Copy, SlidersHorizontal } from "lucide-react";
import {
  GlassActionButton,
  GlassAccordion,
  GlassAlert,
  GlassAvatar,
  GlassBadge,
  GlassButton,
  GlassCard,
  GlassCheckbox,
  GlassDialog,
  GlassDropdownMenu,
  GlassInput,
  GlassPopover,
  GlassProgress,
  GlassRadioGroup,
  GlassSegmented,
  GlassSelect,
  GlassSheet,
  GlassSlider,
  GlassSpotlight,
  GlassSwitch,
  GlassTabs,
  GlassTextarea,
  GlassToast,
  GlassToggle,
  GlassTooltip,
  GlassVideo,
} from "refractive-glass-react/controls";
import { LiquidGlassDemo } from "../demos/LiquidGlassDemo";
import type { Locale } from "../i18n";
import type { ComponentId } from "./catalog";
export const PHOTO =
  "https://images.unsplash.com/photo-1683318854587-3722ba210558?auto=format&fit=crop&w=1800&q=85";
export function ComponentExample({
  id,
  locale = "en",
  theme = "light",
  compact = false,
}: {
  id: ComponentId;
  locale?: Locale;
  theme?: "light" | "dark";
  compact?: boolean;
}) {
  const [enabled, setEnabled] = useState(false),
    [amount, setAmount] = useState(50),
    [text, setText] = useState(""),
    [choice, setChoice] = useState("design"),
    [open, setOpen] = useState(false),
    [count, setCount] = useState(0);
  const t = (en: string, zh: string) => (locale === "zh" ? zh : en);
  const options = [
    { value: "design", label: t("Design", "设计") },
    { value: "motion", label: t("Motion", "动态") },
    { value: "code", label: t("Code", "代码") },
  ];
  const closeLabel = t("Close", "关闭");
  switch (id) {
    case "liquid-button":
      return (
        <GlassActionButton onClick={() => setCount(count + 1)}>
          {count
            ? t(`Pressed ${count}`, `点击 ${count} 次`)
            : t("Press and hold", "长按试试")}
        </GlassActionButton>
      );
    case "button":
      return (
        <div className="example-stack">
          <GlassButton onClick={() => setCount(count + 1)}>
            {count ? <Check size={16} /> : <Copy size={16} />}
            {count
              ? t(`Clicked ${count}`, `点击 ${count} 次`)
              : t("Try a little pressure", "感受一点压力")}
          </GlassButton>
          {!compact && (
            <div className="example-row">
              <GlassButton size="small">{t("Small", "小尺寸")}</GlassButton>
              <GlassButton disabled>{t("Disabled", "禁用状态")}</GlassButton>
            </div>
          )}
        </div>
      );
    case "switch":
      return (
        <div className="example-stack">
          <GlassSwitch
            checked={enabled}
            onCheckedChange={setEnabled}
            ariaLabel={t("Enable notifications", "启用通知")}
          />
          <span className="example-status">
            {enabled
              ? t("Notifications on", "通知已开启")
              : t("Notifications off", "通知已关闭")}
          </span>
        </div>
      );
    case "slider":
      return (
        <div className="example-stack">
          <GlassSlider
            value={amount}
            onValueChange={setAmount}
            ariaLabel={t("Volume", "音量")}
            size={compact ? "small" : "default"}
          />
          <output className="example-status">{amount}%</output>
        </div>
      );
    case "segmented":
      return (
        <GlassSegmented
          items={options}
          value={choice}
          onValueChange={setChoice}
          ariaLabel={t("Workspace view", "工作区视图")}
        />
      );
    case "tabs":
      return (
        <GlassTabs
          label={t("Project sections", "项目内容")}
          items={options.map((option) => ({
            ...option,
            content: (
              <p>
                {option.value === "design"
                  ? t(
                      "A shared visual language, in every detail.",
                      "每一个细节，都使用同一种视觉语言。",
                    )
                  : option.value === "motion"
                    ? t(
                        "Springs keep their momentum when interrupted.",
                        "弹簧在被打断后，仍保留连续的动量。",
                      )
                    : t(
                        "Import only the pieces you need.",
                        "只导入需要的组件。",
                      )}
              </p>
            ),
          }))}
        />
      );
    case "input":
      return (
        <div className="example-form">
          <GlassInput
            label={t("Name", "姓名")}
            placeholder="Ada Lovelace"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          {text && (
            <output className="example-status">
              {t("Hello", "你好")}, {text}.
            </output>
          )}
        </div>
      );
    case "textarea":
      return (
        <div className="example-form">
          <GlassTextarea
            label={t("A thought to keep", "留下一点想法")}
            placeholder={t("Start anywhere…", "从任何地方开始……")}
            value={text}
            maxLength={240}
            onChange={(event) => setText(event.target.value)}
          />
          <output className="example-status">{text.length} / 240</output>
        </div>
      );
    case "checkbox":
      return (
        <GlassCheckbox
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        >
          {t("Keep me in the loop", "接收更新通知")}
        </GlassCheckbox>
      );
    case "radio-group":
      return (
        <GlassRadioGroup
          label={t("What are you working on?", "正在做什么？")}
          value={choice}
          onValueChange={setChoice}
          options={options}
        />
      );
    case "select":
      return (
        <div className="example-form">
          <GlassSelect
            label={t("Workspace", "工作区")}
            value={choice}
            onChange={(event) => setChoice(event.target.value)}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </GlassSelect>
        </div>
      );
    case "toggle":
      return (
        <GlassToggle pressed={enabled} onPressedChange={setEnabled}>
          <Bookmark size={16} fill={enabled ? "currentColor" : "none"} />
          {enabled ? t("Saved", "已收藏") : t("Bookmark", "收藏")}
        </GlassToggle>
      );
    case "card":
      return (
        <GlassCard className="example-card">
          <div className="example-card__top">
            <GlassAvatar name="Ada Lovelace" size={38} />
            <span>{t("Personal space", "个人空间")}</span>
          </div>
          <h3>{t("Room for a good idea.", "留一点空间给好想法。")}</h3>
          <p>{t("A quiet place to make something.", "一个安静的创作角落。")}</p>
        </GlassCard>
      );
    case "badge":
      return (
        <div className="example-row">
          <GlassBadge>{t("In progress", "进行中")}</GlassBadge>
          <GlassBadge>{t("Ready", "就绪")}</GlassBadge>
        </div>
      );
    case "avatar":
      return (
        <div className="example-row">
          <GlassAvatar name="Ada Lovelace" size={40} />
          <GlassAvatar name="Ben" size={56} />
          <GlassAvatar name="Grace Hopper" size={72} />
        </div>
      );
    case "progress":
      return (
        <div className="example-form">
          <GlassProgress value={amount} label={t("Progress", "进度")} />
          <div className="example-between">
            <output>{amount}%</output>
            <GlassButton
              size="small"
              onClick={() =>
                setAmount(amount >= 100 ? 0 : Math.min(100, amount + 10))
              }
            >
              {amount >= 100 ? t("Reset", "重置") : t("Advance", "前进")}
            </GlassButton>
          </div>
        </div>
      );
    case "alert":
      return (
        <GlassAlert title={t("Everything is in sync", "一切已同步")}>
          {t("Your latest changes are ready.", "最新的修改已经准备好。")}
        </GlassAlert>
      );
    case "toast":
      return (
        <div className="example-stack">
          <GlassButton onClick={() => setOpen(true)}>
            {t("Show notification", "显示通知")}
          </GlassButton>
          <GlassToast
            open={open}
            title={t("Changes saved", "已保存")}
            onClose={() => setOpen(false)}
            closeLabel={closeLabel}
          />
        </div>
      );
    case "dialog":
      return (
        <>
          <GlassButton onClick={() => setOpen(true)}>
            {t("Edit profile", "编辑资料")}
          </GlassButton>
          <GlassDialog
            open={open}
            onOpenChange={setOpen}
            title={t("Edit profile", "编辑资料")}
            description={t(
              "Update your name.",
              "修改姓名。",
            )}
            closeLabel={closeLabel}
          >
            <form
              className="example-form"
              onSubmit={(event) => {
                event.preventDefault();
                setOpen(false);
              }}
            >
              <GlassInput
                label={t("Name", "姓名")}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Ada"
              />
              <GlassButton type="submit">
                {t("Save changes", "保存修改")}
              </GlassButton>
            </form>
          </GlassDialog>
        </>
      );
    case "sheet":
      return (
        <>
          <GlassButton onClick={() => setOpen(true)}>
            <SlidersHorizontal />
            {t("Settings", "设置")}
          </GlassButton>
          <GlassSheet
            open={open}
            onOpenChange={setOpen}
            title={t("Your preferences", "你的偏好")}
            closeLabel={closeLabel}
          >
            <div className="example-stack">
              <label className="example-between">
                {t("Notifications", "通知")}
                <GlassSwitch
                  checked={enabled}
                  onCheckedChange={setEnabled}
                  ariaLabel={t("Notifications", "通知")}
                />
              </label>
              <GlassSlider
                value={amount}
                onValueChange={setAmount}
                ariaLabel={t("Intensity", "强度")}
              />
            </div>
          </GlassSheet>
        </>
      );
    case "popover":
      return (
        <GlassPopover
          trigger={t("Quick settings", "快捷设置")}
          label={t("Quick settings", "快捷设置")}
        >
          <div className="example-stack">
            <label className="example-between">
              {t("Quiet mode", "安静模式")}
              <GlassSwitch
                size="small"
                checked={enabled}
                onCheckedChange={setEnabled}
                ariaLabel={t("Quiet mode", "安静模式")}
              />
            </label>
            <GlassSlider
              size="small"
              value={amount}
              onValueChange={setAmount}
              ariaLabel={t("Intensity", "强度")}
            />
          </div>
        </GlassPopover>
      );
    case "dropdown-menu":
      return (
        <div className="example-stack">
          <GlassDropdownMenu
            trigger={t("Actions", "操作")}
            label={t("Actions", "操作")}
            items={[
              {
                label: t("Duplicate", "创建副本"),
                onSelect: () => setCount(count + 1),
              },
              { label: t("Reset", "重置"), onSelect: () => setCount(0) },
              {
                label: t("Archive (unavailable)", "归档（不可用）"),
                disabled: true,
                onSelect: () => {},
              },
            ]}
          />
          <output className="example-status">
            {count
              ? t(`${count} copies created`, `已创建 ${count} 个副本`)
              : ""}
          </output>
        </div>
      );
    case "tooltip":
      return (
        <GlassTooltip
          label={t("Save bookmark", "保存书签")}
        >
          <GlassButton aria-label={t("Bookmark", "收藏")}>
            <Bookmark />
          </GlassButton>
        </GlassTooltip>
      );
    case "accordion":
      return (
        <GlassAccordion
          items={[
            {
              title: t("Is this a CSS filter?", "这是 CSS 滤镜吗？"),
              content: t(
                "The Liquid material is rendered in WebGL2, with one shared SDF and optical pipeline.",
                "Liquid 材质由 WebGL2 渲染，共用同一套 SDF 和光学管线。",
              ),
            },
            {
              title: t("Can I bring my own content?", "可以使用自己的内容吗？"),
              content: t(
                "Yes. Components accept native React content, and the renderer accepts canvas, image and video sources.",
                "可以。组件接收原生 React 内容，渲染器接收 Canvas、图片和视频底图。",
              ),
            },
          ]}
        />
      );
    case "liquid-menu":
      return <LiquidGlassDemo locale={locale} theme={theme} />;
    case "spotlight":
      return (
        <GlassSpotlight
          backgroundImage={PHOTO}
          lens={{
            lensW: compact ? 52 : 95,
            lensH: compact ? 52 : 95,
            borderRadius: 95,
          }}
        />
      );
    case "video":
      return (
        <GlassVideo
          src="/assets/flowers.mp4"
          poster="/assets/flowers-placeholder.webp"
          labels={
            locale === "zh"
              ? {
                  poster: "视频封面",
                  canvas: "实时折射视频的玻璃控件",
                  error: "无法加载此视频。",
                  play: "播放",
                  pause: "暂停",
                  rewind: "后退 15 秒",
                  forward: "前进 15 秒",
                  progress: "播放进度",
                }
              : undefined
          }
        />
      );
  }
}
