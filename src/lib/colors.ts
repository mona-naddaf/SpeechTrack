export type ColorOption = {
  value: string;
  label: string;
  /** solid background — small dot/swatch */
  swatchClass: string;
  /** light background + dark text — pill/badge */
  badgeClass: string;
};

export const COLOR_OPTIONS: ColorOption[] = [
  {
    value: "green",
    label: "Green",
    swatchClass: "bg-green-500",
    badgeClass: "bg-green-100 text-green-800",
  },
  {
    value: "teal",
    label: "Teal",
    swatchClass: "bg-teal-500",
    badgeClass: "bg-teal-100 text-teal-800",
  },
  {
    value: "amber",
    label: "Amber",
    swatchClass: "bg-amber-500",
    badgeClass: "bg-amber-100 text-amber-800",
  },
  {
    value: "clay",
    label: "Clay",
    swatchClass: "bg-orange-500",
    badgeClass: "bg-orange-100 text-orange-800",
  },
  {
    value: "grey",
    label: "Grey",
    swatchClass: "bg-slate-400",
    badgeClass: "bg-slate-100 text-slate-700",
  },
  {
    value: "blue",
    label: "Blue",
    swatchClass: "bg-blue-500",
    badgeClass: "bg-blue-100 text-blue-800",
  },
  {
    value: "purple",
    label: "Purple",
    swatchClass: "bg-purple-500",
    badgeClass: "bg-purple-100 text-purple-800",
  },
  {
    value: "red",
    label: "Red",
    swatchClass: "bg-red-500",
    badgeClass: "bg-red-100 text-red-800",
  },
];

const FALLBACK_COLOR: ColorOption = {
  value: "grey",
  label: "Grey",
  swatchClass: "bg-slate-400",
  badgeClass: "bg-slate-100 text-slate-700",
};

export function getColorOption(value: string): ColorOption {
  return COLOR_OPTIONS.find((c) => c.value === value) ?? FALLBACK_COLOR;
}
