import {
  CANVAS_H,
  CANVAS_W,
  CAP_RATIO,
  FAUX_BOLD_ADVANCE_EM,
  FAUX_BOLD_EM,
  FONT_SIZE_MIN,
  LINE_RATIO,
  TEXT_CENTER_Y,
  TEXT_MAX_W,
  TEXT_SAFE_BOTTOM,
  TEXT_SAFE_TOP,
  TRACKING_EM,
  VIDEO_H,
  VIDEO_Y,
  type Font,
} from "./format.js";

/** Un trozo de texto con su color. Lo que va entre *asteriscos* se resalta. */
export interface Segment {
  text: string;
  highlight: boolean;
}

export interface VideoTransform {
  /** 1 = encaje "cover" justo en el hueco. Mas de 1 amplia el video. */
  zoom: number;
  /** Desplazamiento en px de lienzo, respecto al encaje centrado. */
  offsetX: number;
  offsetY: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RenderOptions {
  /** El fotograma que se esta encuadrando. En la pieza final va el video. */
  frame: CanvasImageSource | null;
  frameSize: { width: number; height: number } | null;
  transform: VideoTransform;
  /** La capa `PLANTILLA` del PSD, con su hueco y sus degradados. */
  overlay: CanvasImageSource | null;
  text: string;
  font: Font;
  /**
   * Cuerpo pedido. Es un tope, no una orden: si el rotulo no cabe entre el
   * logo y el hueco del video, se compone mas pequeño.
   */
  fontSize: number;
  colorText: string;
  colorHighlight: string;
}

/** El hueco del video, tal cual sale del PSD. No se mueve. */
export const VIDEO_AREA: Rect = { x: 0, y: VIDEO_Y, w: CANVAS_W, h: VIDEO_H };

/** Alto util del rotulo, entre el logo y el borde del degradado. */
const TEXT_BAND_H = TEXT_SAFE_BOTTOM - TEXT_SAFE_TOP;

/**
 * Parte el texto en segmentos. Lo que va entre asteriscos se resalta, el mismo
 * convenio que en news-maker y memegenerator, para no tener que aprender tres.
 */
export function parseSegments(text: string): Segment[] {
  const out: Segment[] = [];
  const re = /\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), highlight: false });
    out.push({ text: m[1] ?? "", highlight: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), highlight: false });
  return out.filter((s) => s.text.length > 0);
}

/** Un token es una palabra o un espacio, con el color que le toca. */
interface Token {
  text: string;
  highlight: boolean;
  space: boolean;
}

/**
 * La capa del PSD lleva `FontCaps: 2`, o sea versalitas completas: todo va en
 * mayusculas pase lo que pase, igual que en la plantilla original.
 */
function tokenize(segments: Segment[]): Token[] {
  const tokens: Token[] = [];
  for (const seg of segments) {
    for (const part of seg.text.toUpperCase().split(/(\s+)/)) {
      if (part === "") continue;
      tokens.push({ text: part, highlight: seg.highlight, space: /^\s+$/.test(part) });
    }
  }
  return tokens;
}

type Line = Token[];

/**
 * Lo que se mete entre caracter y caracter: el tracking del PSD mas el avance
 * que añade la negrita sintetica. Los dos van en emes, asi que escalan con el
 * cuerpo, y se aplican juntos con `letterSpacing` para no perder el kerning
 * por el camino.
 */
function spacing(size: number): number {
  return (TRACKING_EM + FAUX_BOLD_ADVANCE_EM) * size;
}

export function setFont(ctx: CanvasRenderingContext2D, font: Font, size: number): void {
  ctx.font = `${font.weight} ${size}px ${font.stack}`;
  ctx.letterSpacing = `${spacing(size)}px`;
}

/**
 * Ancho de tinta de un trozo. `letterSpacing` mete el espacio **detras de cada
 * caracter**, tambien del ultimo, asi que `measureText` devuelve una cola de
 * mas que hay que descontar; con el tracking negativo del PSD la diferencia
 * juega en contra y descentraria el rotulo medio pixel.
 */
function textWidth(ctx: CanvasRenderingContext2D, text: string, size: number): number {
  if (text.length === 0) return 0;
  return ctx.measureText(text).width - spacing(size);
}

function layoutLines(
  ctx: CanvasRenderingContext2D,
  tokens: Token[],
  size: number,
  maxWidth: number,
): Line[] {
  const lines: Line[] = [];
  let line: Line = [];
  let width = 0;

  for (const token of tokens) {
    const w = textWidth(ctx, token.text, size);
    // Un salto de linea explicito manda sobre el ajuste automatico. Dos
    // seguidos dejan una linea en blanco, que es un parrafo separado a
    // proposito y el bloque tiene que crecer para respetarlo.
    if (token.space && token.text.includes("\n")) {
      const breaks = (token.text.match(/\n/g) ?? []).length;
      lines.push(line);
      for (let i = 1; i < breaks; i += 1) lines.push([]);
      line = [];
      width = 0;
      continue;
    }
    if (!token.space && width + w > maxWidth && line.length > 0) {
      while (line.length > 0 && line[line.length - 1]!.space) line.pop();
      lines.push(line);
      line = [token];
      width = w;
      continue;
    }
    if (token.space && line.length === 0) continue; // no abrir linea con espacio
    line.push(token);
    width += w;
  }
  while (line.length > 0 && line[line.length - 1]!.space) line.pop();
  if (line.length > 0) lines.push(line);
  // Una linea vacia al final es un salto suelto que quedo escribiendo, no un
  // parrafo: no debe abultar el bloque.
  while (lines.length > 0 && lines[lines.length - 1]!.length === 0) lines.pop();
  return lines;
}

function lineWidth(ctx: CanvasRenderingContext2D, line: Line, size: number): number {
  let w = 0;
  for (const t of line) w += textWidth(ctx, t.text, size);
  return w;
}

/**
 * Alto de tinta del bloque: de la cabeza de las mayusculas de la primera linea
 * a la baseline de la ultima. Es lo que se centra en `TEXT_CENTER_Y`, y por eso
 * no entran ni ascendentes ni descendentes: el rotulo va todo en mayusculas.
 */
function blockHeight(lineCount: number, size: number): number {
  if (lineCount === 0) return 0;
  return (lineCount - 1) * size * LINE_RATIO + size * CAP_RATIO;
}

export interface Layout {
  width: number;
  height: number;
  /** Cuerpo con el que se ha compuesto de verdad, ya reducido si hizo falta. */
  fontSize: number;
  /** true cuando el rotulo no cabia al cuerpo pedido. */
  shrunk: boolean;
  lineHeight: number;
  lines: Line[];
  /** Cabeza de las mayusculas de la primera linea. */
  blockTop: number;
  /** Hueco del video en la plantilla. Fijo. */
  videoArea: Rect;
  /** Donde se pinta el video dentro del hueco. null si aun no hay video. */
  video: Rect | null;
}

/**
 * Calcula la caja de todo antes de pintar nada. Va aparte del dibujo porque la
 * interfaz necesita las mismas medidas para el arrastre, y porque a ffmpeg hay
 * que darle el rectangulo del video exactamente igual que en la previa.
 */
export function computeLayout(
  ctx: CanvasRenderingContext2D,
  opts: RenderOptions,
): Layout {
  let size = opts.fontSize;
  let lines: Line[] = [];

  // El cuerpo pedido es un tope. Si el rotulo no cabe entre el logo y el
  // degradado, o se sale de la caja de composicion, se reduce. Cada pasada
  // puede cambiar el numero de lineas, asi que se vuelve a componer; converge
  // en dos o tres vueltas y el bucle esta acotado por si acaso.
  for (let i = 0; i < 24; i += 1) {
    setFont(ctx, opts.font, size);
    lines = layoutLines(ctx, tokenize(parseSegments(opts.text)), size, TEXT_MAX_W);
    if (lines.length === 0) break;

    const h = blockHeight(lines.length, size);
    const widest = Math.max(0, ...lines.map((l) => lineWidth(ctx, l, size)));
    // Una palabra sola mas larga que la caja no se puede partir por espacios:
    // ahi el unico remedio es encoger.
    const factor = Math.min(
      h > TEXT_BAND_H ? TEXT_BAND_H / h : 1,
      widest > TEXT_MAX_W ? TEXT_MAX_W / widest : 1,
    );
    if (factor >= 1) break;
    const next = Math.max(FONT_SIZE_MIN, size * factor);
    if (next >= size) break; // ya esta en el minimo
    size = next;
  }

  setFont(ctx, opts.font, size);
  const blockTop = TEXT_CENTER_Y - blockHeight(lines.length, size) / 2;

  let video: Rect | null = null;
  if (opts.frameSize) {
    // El hueco es el que es, asi que hay que recortar: encaje cover. Se
    // redondea aqui, y no al dibujar, porque este mismo rectangulo se le pasa
    // a ffmpeg: si la previa y la pieza final redondean distinto, no cuadran.
    const scale = coverScale(opts.frameSize, VIDEO_AREA, opts.transform.zoom);
    const w = Math.round(opts.frameSize.width * scale);
    const h = Math.round(opts.frameSize.height * scale);
    video = {
      x: Math.round((VIDEO_AREA.w - w) / 2 + opts.transform.offsetX),
      y: Math.round(VIDEO_AREA.y + (VIDEO_AREA.h - h) / 2 + opts.transform.offsetY),
      w,
      h,
    };
  }

  return {
    width: CANVAS_W,
    height: CANVAS_H,
    fontSize: size,
    shrunk: size < opts.fontSize - 0.01,
    lineHeight: size * LINE_RATIO,
    lines,
    blockTop,
    videoArea: VIDEO_AREA,
    video,
  };
}

function coverScale(
  size: { width: number; height: number },
  area: Rect,
  zoom: number,
): number {
  return Math.max(area.w / size.width, area.h / size.height) * zoom;
}

/**
 * Recorta el encuadre para que el video siga cubriendo todo el hueco. Con el
 * encaje cover siempre sobra imagen por algun lado: eso es justo lo que se
 * puede desplazar, y ni un pixel mas.
 */
export function clampVideoOffset(
  frameSize: { width: number; height: number },
  transform: VideoTransform,
): void {
  const scale = coverScale(frameSize, VIDEO_AREA, transform.zoom);
  const maxX = Math.max(0, (frameSize.width * scale - VIDEO_AREA.w) / 2);
  const maxY = Math.max(0, (frameSize.height * scale - VIDEO_AREA.h) / 2);
  transform.offsetX = Math.min(maxX, Math.max(-maxX, transform.offsetX));
  transform.offsetY = Math.min(maxY, Math.max(-maxY, transform.offsetY));
}

function prepare(ctx: CanvasRenderingContext2D, layout: Layout): void {
  const { canvas } = ctx;
  if (canvas.width !== layout.width || canvas.height !== layout.height) {
    canvas.width = layout.width;
    canvas.height = layout.height;
  }
  ctx.clearRect(0, 0, layout.width, layout.height);
}

/**
 * La previa: fotograma, plantilla y rotulo. Es exactamente lo que va a salir,
 * porque la pieza final se monta con esta misma plantilla y este mismo rotulo
 * y lo unico que cambia es que debajo hay video en movimiento.
 */
export function render(ctx: CanvasRenderingContext2D, opts: RenderOptions): Layout {
  const layout = computeLayout(ctx, opts);
  prepare(ctx, layout);

  // Fondo negro: es el de la plantilla, y ademas es lo que se ve mientras no
  // hay video cargado.
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, layout.width, layout.height);

  if (opts.frame && layout.video) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(VIDEO_AREA.x, VIDEO_AREA.y, VIDEO_AREA.w, VIDEO_AREA.h);
    ctx.clip();
    ctx.drawImage(opts.frame, layout.video.x, layout.video.y, layout.video.w, layout.video.h);
    ctx.restore();
  }

  drawPlate(ctx, opts, layout);
  return layout;
}

/**
 * La capa que se le pasa a ffmpeg: plantilla y rotulo sobre transparente, sin
 * fotograma. El filtro `overlay` la pega encima del video tal cual, asi que lo
 * que se vio en la previa es literalmente lo que se monta.
 */
export function renderPlate(ctx: CanvasRenderingContext2D, opts: RenderOptions): Layout {
  const layout = computeLayout(ctx, opts);
  prepare(ctx, layout);
  drawPlate(ctx, opts, layout);
  return layout;
}

function drawPlate(
  ctx: CanvasRenderingContext2D,
  opts: RenderOptions,
  layout: Layout,
): void {
  if (opts.overlay) ctx.drawImage(opts.overlay, 0, 0, layout.width, layout.height);
  drawText(ctx, opts, layout);
}

function drawText(
  ctx: CanvasRenderingContext2D,
  opts: RenderOptions,
  layout: Layout,
): void {
  if (layout.lines.length === 0) return;

  setFont(ctx, opts.font, layout.fontSize);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  // La negrita sintetica del PSD: un trazo centrado en el contorno, del grosor
  // medido sobre la capa original.
  ctx.lineWidth = layout.fontSize * FAUX_BOLD_EM;

  const cap = layout.fontSize * CAP_RATIO;

  layout.lines.forEach((line, i) => {
    if (line.length === 0) return;
    const baseline = layout.blockTop + cap + i * layout.lineHeight;
    // El parrafo del PSD va centrado (`Justification: 2`), y su caja esta
    // centrada en el lienzo, asi que cada linea se centra en 1080.
    let x = (layout.width - lineWidth(ctx, line, layout.fontSize)) / 2;
    for (const token of line) {
      const color = token.highlight ? opts.colorHighlight : opts.colorText;
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.strokeText(token.text, x, baseline);
      ctx.fillText(token.text, x, baseline);
      x += textWidth(ctx, token.text, layout.fontSize);
    }
  });
}
