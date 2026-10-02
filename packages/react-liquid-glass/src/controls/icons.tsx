import type { SVGProps } from "react";

// The four Lucide icons the controls use (paths from Lucide, ISC), rendered with Lucide's own
// attributes and class names so existing styling and QA selectors keep matching.
type IconProps = SVGProps<SVGSVGElement> & { size?: number };
const icon = (name: string, paths: readonly string[]) => function Icon({ size = 24, className = "", ...props }: IconProps) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`lucide lucide-${name} ${className}`.trim()} {...props}>
    {paths.map(d => <path key={d} d={d} />)}
  </svg>;
};
export const Check = icon("check", ["M20 6 9 17l-5-5"]);
export const ChevronDown = icon("chevron-down", ["m6 9 6 6 6-6"]);
export const X = icon("x", ["M18 6 6 18", "m6 6 12 12"]);
export const Plus = icon("plus", ["M5 12h14", "M12 5v14"]);
