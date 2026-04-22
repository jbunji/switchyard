export interface Point {
  x: number;
  y: number;
}

export interface Sample {
  x: number;
  y: number;
  tx: number;
  ty: number;
}

export interface EdgeGeometry {
  d: string;
  control: Point;
  midpoint: Point;
  perp: Point;
  length: number;
  sampleAt: (t: number) => Sample;
  samples: (count: number) => Sample[];
}

function norm(x: number, y: number): Point {
  const m = Math.hypot(x, y);
  if (m === 0) return { x: 1, y: 0 };
  return { x: x / m, y: y / m };
}

export function edgeGeometry(from: Point, to: Point, curve: number): EdgeGeometry {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  const midpoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const perp: Point = len === 0 ? { x: 0, y: 1 } : { x: -dy / len, y: dx / len };

  if (curve === 0 || len === 0) {
    const tangent = norm(dx, dy);
    return {
      d: `M ${from.x} ${from.y} L ${to.x} ${to.y}`,
      control: midpoint,
      midpoint,
      perp,
      length: len,
      sampleAt: (t) => ({
        x: from.x + dx * t,
        y: from.y + dy * t,
        tx: tangent.x,
        ty: tangent.y,
      }),
      samples: (count) => straightSamples(from, to, count, tangent),
    };
  }

  const control: Point = {
    x: midpoint.x + perp.x * curve,
    y: midpoint.y + perp.y * curve,
  };

  const sampleAt = (t: number): Sample => {
    const u = 1 - t;
    const x = u * u * from.x + 2 * u * t * control.x + t * t * to.x;
    const y = u * u * from.y + 2 * u * t * control.y + t * t * to.y;
    const dxt = 2 * u * (control.x - from.x) + 2 * t * (to.x - control.x);
    const dyt = 2 * u * (control.y - from.y) + 2 * t * (to.y - control.y);
    const m = Math.hypot(dxt, dyt);
    return {
      x,
      y,
      tx: m === 0 ? 1 : dxt / m,
      ty: m === 0 ? 0 : dyt / m,
    };
  };

  return {
    d: `M ${from.x} ${from.y} Q ${control.x} ${control.y} ${to.x} ${to.y}`,
    control,
    midpoint,
    perp,
    length: approximateBezierLength(from, control, to, 16),
    sampleAt,
    samples: (count) => {
      const out: Sample[] = [];
      for (let i = 0; i < count; i++) {
        out.push(sampleAt(i / (count - 1)));
      }
      return out;
    },
  };
}

function straightSamples(from: Point, to: Point, count: number, tangent: Point): Sample[] {
  const out: Sample[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    out.push({
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
      tx: tangent.x,
      ty: tangent.y,
    });
  }
  return out;
}

function approximateBezierLength(a: Point, c: Point, b: Point, steps: number): number {
  let total = 0;
  let prev = a;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const x = u * u * a.x + 2 * u * t * c.x + t * t * b.x;
    const y = u * u * a.y + 2 * u * t * c.y + t * t * b.y;
    total += Math.hypot(x - prev.x, y - prev.y);
    prev = { x, y };
  }
  return total;
}

export function projectOntoPerpendicular(
  point: Point,
  from: Point,
  to: Point,
): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return 0;
  const perpX = -dy / len;
  const perpY = dx / len;
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  return (point.x - mx) * perpX + (point.y - my) * perpY;
}
