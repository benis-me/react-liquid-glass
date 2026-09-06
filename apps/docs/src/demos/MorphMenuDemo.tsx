import { useCallback, useState } from "react";
import type { Locale } from "../i18n";
import { GlassMorphMenu } from "refractive-glass-react/controls";
import {
  Check,
  ChevronRight,
  Clock3,
  Ellipsis,
  Gamepad2,
  Grid2X2,
  Layers3,
  Network,
  Smartphone,
  UsersRound,
  WifiOff,
} from "lucide-react";
const copy = {
  zh: {
    menu: "游戏排序与筛选菜单",
    open: "打开菜单",
    sortHeading: "排序",
    filterHeading: "筛选",
    recentDetail: "按日期降序",
    sorts: {
      recent: "最近玩过的游戏",
      name: "游戏名",
      size: "大小",
      updated: "上次更新",
    },
    filters: {
      device: "本机",
      unplayed: "从未玩过",
      friends: "在玩的朋友",
      controller: "控制器支持",
      subscription: "游戏订阅",
      category: "类别",
      offline: "离线可用",
      multiplayer: "多人游戏",
    },
  },
  en: {
    menu: "Game sorting and filter menu",
    open: "Open menu",
    sortHeading: "Sort",
    filterHeading: "Filter",
    recentDetail: "Newest first",
    sorts: {
      recent: "Recently played",
      name: "Game name",
      size: "Size",
      updated: "Last updated",
    },
    filters: {
      device: "On this device",
      unplayed: "Never played",
      friends: "Friends playing",
      controller: "Controller support",
      subscription: "Game subscription",
      category: "Categories",
      offline: "Available offline",
      multiplayer: "Multiplayer",
    },
  },
} as const;

type MenuCopy = (typeof copy)[Locale];
const SORT_OPTIONS = ["recent", "name", "size", "updated"] as const;
type SortId = (typeof SORT_OPTIONS)[number];

const FILTER_OPTIONS = [
  { id: "device", icon: Smartphone },
  { id: "unplayed", icon: Clock3 },
  { id: "friends", icon: UsersRound },
  { id: "controller", icon: Gamepad2 },
  { id: "subscription", icon: Layers3 },
  { id: "category", icon: Grid2X2, trailing: true },
  { id: "offline", icon: WifiOff },
  { id: "multiplayer", icon: Network },
] as const;

type FilterId = (typeof FILTER_OPTIONS)[number]["id"];

interface MenuContentsProps {
  text: MenuCopy;
  open: boolean;
  sort: SortId;
  filters: Set<FilterId>;
  onSort?: (id: SortId) => void;
  onFilter?: (id: FilterId) => void;
}

function MenuContents({
  text,
  open,
  sort,
  filters,
  onSort,
  onFilter,
}: MenuContentsProps) {
  return (
    <div className="dg-liquid-menu__scroll">
      <p className="dg-liquid-menu__heading">{text.sortHeading}</p>
      <div className="dg-liquid-menu__section" role="group" aria-label={text.sortHeading}>
        {SORT_OPTIONS.map((id) => {
          const selected = sort === id;
          return (
            <button
              key={id}
              className="dg-liquid-menu__sort-row"
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              tabIndex={open ? 0 : -1}
              data-selected={selected ? "true" : "false"}
              onClick={() => onSort?.(id)}
            >
              <span className="dg-liquid-menu__check" aria-hidden="true">
                {selected ? <Check /> : null}
              </span>
              <span className="dg-liquid-menu__label-block">
                <span>{text.sorts[id]}</span>
                {id === "recent" ? <small>{text.recentDetail}</small> : null}
              </span>
            </button>
          );
        })}
      </div>

      <div className="dg-liquid-menu__divider" />
      <p className="dg-liquid-menu__heading">{text.filterHeading}</p>
      <div className="dg-liquid-menu__section" role="group" aria-label={text.filterHeading}>
        {FILTER_OPTIONS.map(({ id, icon: Icon, ...option }) => {
          const active = filters.has(id);
          return (
            <button
              key={id}
              className="dg-liquid-menu__filter-row"
              type="button"
              role="menuitemcheckbox"
              aria-checked={active}
              tabIndex={open ? 0 : -1}
              data-active={active ? "true" : "false"}
              onClick={() => onFilter?.(id)}
            >
              <Icon aria-hidden="true" />
              <span>{text.filters[id]}</span>
              {"trailing" in option
                ? <ChevronRight className="dg-liquid-menu__chevron" aria-hidden="true" />
                : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MorphMenuDemo({ locale, theme }: { locale: Locale; theme: "light" | "dark" }) {
  const text = copy[locale];
  const [sort, setSort] = useState<SortId>("recent");
  const [filters, setFilters] = useState<Set<FilterId>>(() => new Set(["device"]));
  const toggleFilter = useCallback((id: FilterId) => {
    setFilters((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return <GlassMorphMenu theme={theme} menuLabel={text.menu} openLabel={text.open} trigger={<Ellipsis aria-hidden="true" />}>
    {open => <MenuContents text={text} open={open} sort={sort} filters={filters} onSort={setSort} onFilter={toggleFilter} />}
  </GlassMorphMenu>;
}
