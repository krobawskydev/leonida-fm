type Rectangle = Pick<DOMRect, "left" | "right" | "top" | "bottom">;
type Size = { width: number; height: number };

const EDGE = 12;
const GAP = 14;
const SPOTLIGHT_PADDING = 5;

export function radioTourLayout(targets: Rectangle[], viewport: Size, card: Size) {
  const { width, height } = viewport;
  const spots = targets.map((target) => ({
    left: Math.max(0, Math.floor(target.left - SPOTLIGHT_PADDING)),
    right: Math.min(width, Math.ceil(target.right + SPOTLIGHT_PADDING)),
    top: Math.max(0, Math.floor(target.top - SPOTLIGHT_PADDING)),
    bottom: Math.min(height, Math.ceil(target.bottom + SPOTLIGHT_PADDING)),
  })).filter((spot) => spot.right > spot.left && spot.bottom > spot.top);

  const x = (left: number) => Math.max(EDGE, Math.min(left, width - card.width - EDGE));
  const y = (top: number) => Math.max(EDGE, Math.min(top, height - card.height - EDGE));
  const left = Math.min(...spots.map((spot) => spot.left));
  const right = Math.max(...spots.map((spot) => spot.right));
  const top = Math.min(...spots.map((spot) => spot.top));
  const bottom = Math.max(...spots.map((spot) => spot.bottom));
  const centeredLeft = x((left + right - card.width) / 2);
  const centeredTop = y((top + bottom - card.height) / 2);
  const sides = [
    { left: right + GAP, top: centeredTop },
    { left: left - card.width - GAP, top: centeredTop },
  ];
  const rows = [
    { left: centeredLeft, top: bottom + GAP },
    { left: centeredLeft, top: top - card.height - GAP },
  ];
  const candidates = width >= 640 ? [...sides, ...rows] : [...rows, ...sides];
  const position = spots.length ? candidates.find((point) => x(point.left) === point.left && y(point.top) === point.top) : undefined;
  const fallbackTop = spots.length && (top + bottom) / 2 > height / 2 ? EDGE : y(height);
  const cardPosition = position ?? { left: x((width - card.width) / 2), top: fallbackTop };

  const cutouts = spots.map(({ left, right, top, bottom }) => {
    const radius = Math.min(8, (right - left) / 2, (bottom - top) / 2);
    return `M${left + radius} ${top} H${right - radius} Q${right} ${top} ${right} ${top + radius} V${bottom - radius} Q${right} ${bottom} ${right - radius} ${bottom} H${left + radius} Q${left} ${bottom} ${left} ${bottom - radius} V${top + radius} Q${left} ${top} ${left + radius} ${top} Z`;
  });
  const clipPath = `path(evenodd, "M0 0 H${width} V${height} H0 Z ${cutouts.join(" ")}")`;
  return { cardPosition, clipPath, spots };
}
