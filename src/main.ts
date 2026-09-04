import overlayUrl from "./assets/overlay.png";
import { encode } from "./encode.js";
import {
  CANVAS_W,
  COLOR_HIGHLIGHT,
  COLOR_TEXT,
  COLORS,
  FONT,
  FONT_SIZE,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  VIDEO_Y,
  ZOOM_MAX,
  ZOOM_MIN,
} from "./format.js";
import {
  centerVideoOffset,
  clampVideoOffset,
  computeLayout,
  render,
  renderPlate,
  zoomVideoAt,
  type RenderOptions,
  type VideoTransform,
} from "./render.js";
import { applyFixes, check, type Issue } from "./spell.js";
import "./style.css";

function need<T extends Element>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Falta el elemento #${id} en el HTML`);
  return el as unknown as T;
}

const textEl = need<HTMLTextAreaElement>("text");
const sizeEl = need<HTMLInputElement>("size");
const sizeValueEl = need<HTMLSpanElement>("size-value");
const dropEl = need<HTMLDivElement>("drop");
const fileEl = need<HTMLInputElement>("file");
const pickEl = need<HTMLButtonElement>("pick");
const fileNameEl = need<HTMLParagraphElement>("file-name");
const seekEl = need<HTMLInputElement>("seek");
const seekValueEl = need<HTMLSpanElement>("seek-value");
const zoomEl = need<HTMLInputElement>("zoom");
const zoomValueEl = need<HTMLSpanElement>("zoom-value");
const bottomEl = need<HTMLInputElement>("bottom");
const bottomValueEl = need<HTMLSpanElement>("bottom-value");
const textColorEl = need<HTMLInputElement>("color-text");
const highlightEl = need<HTMLInputElement>("color-highlight");
const generateEl = need<HTMLButtonElement>("generate");
const progressEl = need<HTMLDivElement>("progress");
const progressBarEl = need<HTMLDivElement>("progress-bar");
const statusEl = need<HTMLParagraphElement>("status");
const previewEl = need<HTMLCanvasElement>("preview");
const previewInfoEl = need<HTMLParagraphElement>("preview-info");
const outputEl = need<HTMLElement>("output");
const resultEl = need<HTMLVideoElement>("result");
const resultInfoEl = need<HTMLParagraphElement>("result-info");
const reviewEl = need<HTMLDivElement>("review");
const reviewTitleEl = need<HTMLParagraphElement>("review-title");
const reviewListEl = need<HTMLUListElement>("review-list");
const reviewFixEl = need<HTMLDivElement>("review-fix");
const reviewProposalEl = need<HTMLParagraphElement>("review-proposal");
const fixEl = need<HTMLButtonElement>("fix");
const downloadEl = need<HTMLButtonElement>("download");
const sourceEl = need<HTMLVideoElement>("source");

function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Este navegador no soporta canvas 2D");
  return ctx;
}

const previewCtx = context(previewEl);

interface State {
  /** El <video> oculto, parado en el fotograma que se esta encuadrando. */
  hasVideo: boolean;
  frameSize: { width: number; height: number } | null;
  file: File | null;
  transform: VideoTransform;
  overlay: HTMLImageElement | null;
  /** URL del MP4 ya montado, para el boton de descarga. */
  result: string | null;
  busy: boolean;
}

const state: State = {
  hasVideo: false,
  frameSize: null,
  file: null,
  transform: { zoom: 1, offsetX: 0, offsetY: 0 },
  overlay: null,
  result: null,
  busy: false,
};

function options(): RenderOptions {
  return {
    frame: state.hasVideo ? sourceEl : null,
    frameSize: state.frameSize,
    transform: state.transform,
    overlay: state.overlay,
    text: textEl.value,
    font: FONT,
    fontSize: Number(sizeEl.value),
    bottomMargin: Number(bottomEl.value),
    colorText: textColorEl.value,
    colorHighlight: highlightEl.value,
  };
}

function setStatus(message: string, kind: "" | "error" = ""): void {
  statusEl.textContent = message;
  statusEl.className = kind === "error" ? "status error" : "status";
}

// --- Recursos ---------------------------------------------------------------

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    img.src = src;
  });
}

/**
 * Espera a que cargue SF Pro antes de medir. Sin esto, la primera pasada mide
 * con la de respaldo y el rotulo sale con un ajuste que no corresponde.
 */
async function ensureFont(): Promise<void> {
  try {
    await document.fonts.load(`${FONT.weight} 64px ${FONT.stack}`);
    await document.fonts.ready;
  } catch {
    setStatus("No se pudo cargar SF Pro; se usará una de respaldo.", "error");
  }
}

// --- Colores ----------------------------------------------------------------

for (const row of document.querySelectorAll<HTMLDivElement>(".swatches")) {
  const target = need<HTMLInputElement>(row.dataset.for ?? "");
  for (const { label, hex } of COLORS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "swatch";
    btn.style.background = hex;
    btn.title = `${label} · ${hex}`;
    btn.addEventListener("click", () => {
      target.value = hex;
      draw();
    });
    row.append(btn);
  }
}

/** m:ss, que es como lo escribe cualquier reproductor. */
function clock(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function showTime(): void {
  seekValueEl.textContent = `${clock(sourceEl.currentTime)} / ${clock(sourceEl.duration)}`;
}

// --- Video ------------------------------------------------------------------

/** Espera a un evento del <video>, con el error del propio elemento si falla. */
function once(el: HTMLVideoElement, type: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ok = () => {
      el.removeEventListener("error", ko);
      resolve();
    };
    const ko = () => {
      el.removeEventListener(type, ok);
      reject(new Error("El navegador no puede reproducir este vídeo."));
    };
    el.addEventListener(type, ok, { once: true });
    el.addEventListener("error", ko, { once: true });
  });
}

async function loadFile(file: File): Promise<void> {
  if (!file.type.startsWith("video/")) {
    setStatus("Ese archivo no es un vídeo.", "error");
    return;
  }

  const url = URL.createObjectURL(file);
  const previous = sourceEl.src;
  sourceEl.src = url;
  try {
    await once(sourceEl, "loadedmetadata");
    // `loadeddata` significa que ya hay un fotograma pintable, y ese fotograma
    // es el primero: no hace falta buscar nada para tener la previa.
    await once(sourceEl, "loadeddata");
  } catch (err) {
    URL.revokeObjectURL(url);
    sourceEl.src = previous;
    setStatus(err instanceof Error ? err.message : "No se pudo abrir el vídeo.", "error");
    return;
  }
  if (previous) URL.revokeObjectURL(previous);

  state.hasVideo = true;
  state.file = file;
  state.frameSize = { width: sourceEl.videoWidth, height: sourceEl.videoHeight };
  state.transform = { zoom: 1, offsetX: 0, offsetY: 0 };
  zoomEl.value = "1";
  bottomEl.value = "0";
  // De partida, centrado en el hueco: con un video mas largo que el hueco, ver
  // el centro es lo que se espera. Uno que cabe entero se pega al techo solo.
  // El techo hay que preguntarlo, porque un rotulo largo lo habra bajado.
  state.transform.offsetY = centerVideoOffset(
    state.frameSize,
    1,
    computeLayout(previewCtx, options()).videoTop,
  );
  seekEl.disabled = false;
  seekEl.max = String(sourceEl.duration || 1);
  seekEl.value = "0";
  showTime();

  const mb = file.size / (1024 * 1024);
  fileNameEl.textContent =
    `${file.name} · ${sourceEl.videoWidth} × ${sourceEl.videoHeight} · ` +
    `${sourceEl.duration.toFixed(1)} s · ${mb.toFixed(1)} MB`;

  // El hueco de la plantilla mide 1080 de ancho: por debajo de eso el video se
  // amplia, y ampliar es lo unico de todo el montaje que se ve de verdad.
  if (sourceEl.videoWidth < CANVAS_W) {
    setStatus(
      `Aviso: el vídeo tiene ${sourceEl.videoWidth} px de ancho y el hueco pide ${CANVAS_W}. Se verá pixelado.`,
      "error",
    );
  } else {
    setStatus("Listo para generar.");
  }
  draw();
}

pickEl.addEventListener("click", () => fileEl.click());
fileEl.addEventListener("change", () => {
  const file = fileEl.files?.[0];
  if (file) void loadFile(file);
});

/**
 * Se suelta en cualquier parte de la ventana. `dragleave` salta tambien al
 * pasar de un elemento a otro por dentro, asi que hay que contar entradas y
 * salidas en vez de fiarse del evento: si no, el aviso parpadea al cruzar
 * cualquier borde de camino a donde se quiere soltar.
 */
let dragDepth = 0;

function showDrop(visible: boolean): void {
  dragDepth = visible ? dragDepth : 0;
  dropEl.hidden = !visible;
}

window.addEventListener("dragenter", (e) => {
  e.preventDefault();
  dragDepth += 1;
  dropEl.hidden = false;
});

window.addEventListener("dragover", (e) => e.preventDefault());

window.addEventListener("dragleave", (e) => {
  e.preventDefault();
  dragDepth -= 1;
  if (dragDepth <= 0) showDrop(false);
});

window.addEventListener("drop", (e) => {
  e.preventDefault();
  showDrop(false);
  const file = e.dataTransfer?.files?.[0];
  if (file) void loadFile(file);
});

// El fotograma solo cambia la previa: el montaje usa el video entero. Sirve
// para encuadrar cuando el primer fotograma esta en negro, que pasa a menudo.
seekEl.addEventListener("input", () => {
  if (!state.hasVideo) return;
  sourceEl.currentTime = Number(seekEl.value);
});
sourceEl.addEventListener("seeked", () => {
  showTime();
  draw();
});

// --- Encuadre ---------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Del espacio de pantalla al del lienzo: la previa va escalada. */
function canvasScale(): number {
  return previewEl.width / previewEl.getBoundingClientRect().width;
}

function clampOffset(): void {
  if (!state.frameSize) return;
  // El techo del hueco depende del rotulo y del cuerpo, nunca del encuadre, asi
  // que se le puede preguntar a la composicion antes de recortar nada.
  const { videoTop } = computeLayout(previewCtx, options());
  clampVideoOffset(state.frameSize, state.transform, videoTop);
}

function toCanvas(clientX: number, clientY: number): { x: number; y: number } {
  const rect = previewEl.getBoundingClientRect();
  const s = canvasScale();
  return { x: (clientX - rect.left) * s, y: (clientY - rect.top) * s };
}

type Target = "text" | "video";

/**
 * Que hay bajo el puntero. Decide a que afecta cada gesto. El hueco ya no esta
 * en un sitio fijo, asi que hay que preguntarselo a la composicion.
 */
function targetAt(clientX: number, clientY: number): Target | null {
  const p = toCanvas(clientX, clientY);
  const area = computeLayout(previewCtx, options()).videoArea;
  if (p.y >= area.y && p.y < area.y + area.h) return state.hasVideo ? "video" : null;
  return "text";
}

function setFontSize(size: number): void {
  sizeEl.value = String(clamp(size, FONT_SIZE_MIN, FONT_SIZE_MAX).toFixed(1));
  draw();
}

/**
 * `anchor` es el punto del lienzo que tiene que quedarse quieto: el puntero, o
 * el punto medio de los dedos. Sin el —cuando el zoom viene de la barra, que no
 * apunta a nada— se ancla en el centro de lo que se ve, que es lo que uno esta
 * mirando.
 */
function setZoom(zoom: number, anchor?: { x: number; y: number }): void {
  const next = clamp(zoom, ZOOM_MIN, ZOOM_MAX);
  if (state.frameSize) {
    const { videoTop, videoArea } = computeLayout(previewCtx, options());
    const at = anchor ?? { x: CANVAS_W / 2, y: videoArea.y + videoArea.h / 2 };
    zoomVideoAt(state.frameSize, state.transform, next, videoTop, at);
  } else {
    state.transform.zoom = next;
  }
  zoomEl.value = String(state.transform.zoom);
  clampOffset();
  draw();
}

zoomEl.addEventListener("input", () => setZoom(Number(zoomEl.value)));
bottomEl.addEventListener("input", draw);

const pointers = new Map<number, { x: number; y: number }>();
let lastX = 0;
let lastY = 0;
let target: Target | null = null;
let pinch: { dist: number; zoom: number; fontSize: number } | null = null;

function pinchGeometry(): { dist: number; mx: number; my: number } | null {
  const [a, b] = [...pointers.values()];
  if (!a || !b) return null;
  return {
    dist: Math.hypot(a.x - b.x, a.y - b.y),
    mx: (a.x + b.x) / 2,
    my: (a.y + b.y) / 2,
  };
}

previewEl.addEventListener("pointerdown", (e) => {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (pointers.size >= 2) {
    const g = pinchGeometry();
    if (!g) return;
    // El destino lo decide el punto medio: pellizcar sobre el rotulo cambia el
    // cuerpo de la letra, y sobre el hueco hace zoom del video.
    target = targetAt(g.mx, g.my);
    if (!target) return;
    pinch = { dist: g.dist, zoom: state.transform.zoom, fontSize: Number(sizeEl.value) };
    lastX = g.mx;
    lastY = g.my;
    return;
  }

  target = targetAt(e.clientX, e.clientY);
  if (target !== "video") return;
  lastX = e.clientX;
  lastY = e.clientY;
  previewEl.setPointerCapture(e.pointerId);
});

previewEl.addEventListener("pointermove", (e) => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (!target) return;

  const s = canvasScale();

  if (pinch && pointers.size >= 2) {
    const g = pinchGeometry();
    if (!g || pinch.dist === 0) return;
    const ratio = g.dist / pinch.dist;
    if (target === "text") {
      setFontSize(pinch.fontSize * ratio);
    } else {
      // El punto medio arrastra y ademas ancla el zoom, asi que se coloca y se
      // dimensiona de un solo gesto y sin que la imagen se escape del dedo.
      state.transform.offsetX += (g.mx - lastX) * s;
      state.transform.offsetY += (g.my - lastY) * s;
      setZoom(pinch.zoom * ratio, toCanvas(g.mx, g.my));
    }
    lastX = g.mx;
    lastY = g.my;
    return;
  }

  // Arrastrar solo mueve el video: el rotulo va siempre centrado en su banda.
  if (target === "video") {
    state.transform.offsetX += (e.clientX - lastX) * s;
    state.transform.offsetY += (e.clientY - lastY) * s;
    lastX = e.clientX;
    lastY = e.clientY;
    draw();
  }
});

for (const type of ["pointerup", "pointercancel"] as const) {
  previewEl.addEventListener(type, (e) => {
    pointers.delete(e.pointerId);
    pinch = null;
    if (pointers.size === 1) {
      // Al levantar un dedo, seguir con el que queda en vez de dar un salto.
      const [p] = [...pointers.values()];
      if (p) {
        lastX = p.x;
        lastY = p.y;
      }
    } else if (pointers.size === 0) {
      target = null;
    }
  });
}

/** Una muesca de rueda manda deltaY 100, asi que con 2000 sale un ~5%. */
const WHEEL_DIVISOR = 2000;
/** Tope por evento, para que un golpe fuerte no pegue un salto. */
const WHEEL_MAX_DELTA = 120;

previewEl.addEventListener(
  "wheel",
  (e) => {
    const hit = targetAt(e.clientX, e.clientY);
    if (!hit) return;
    e.preventDefault();
    // deltaMode: 0 = px, 1 = lineas (Firefox), 2 = paginas.
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
    const delta = clamp(e.deltaY * unit, -WHEEL_MAX_DELTA, WHEEL_MAX_DELTA);
    // Exponencial, para que el paso se note igual en cualquier escala.
    const factor = Math.exp(-delta / WHEEL_DIVISOR);
    if (hit === "text") setFontSize(Number(sizeEl.value) * factor);
    else setZoom(state.transform.zoom * factor, toCanvas(e.clientX, e.clientY));
  },
  { passive: false },
);

// --- Dibujo -----------------------------------------------------------------

function draw(): void {
  // Centralizado aqui: asi ningun cambio puede dejar un encuadre invalido.
  clampOffset();
  const layout = render(previewCtx, options());
  sizeValueEl.textContent = Number(sizeEl.value).toFixed(1).replace(/\.0$/, "");
  zoomValueEl.textContent = String(Math.round(state.transform.zoom * 100));

  const n = layout.lines.length;
  const rotulo = n === 0
    ? "sin rótulo"
    : `${n} ${n === 1 ? "línea" : "líneas"} a ${layout.fontSize.toFixed(1)} px` +
      (layout.shrunk ? " (reducido para que quepa)" : "");
  const subido = layout.videoBottomAuto - layout.videoBottom;
  bottomValueEl.textContent = subido > 0 ? `subido ${subido} px` : "automático";

  const hueco = state.hasVideo
    ? ` · hueco ${layout.videoArea.h} px` +
      (layout.videoBottom >= layout.height
        ? ", sin barra negra"
        : `, barra de ${layout.height - layout.videoBottom} px`) +
      (layout.videoTop === VIDEO_Y ? "" : ` · degradado en ${layout.videoTop}`)
    : "";
  previewInfoEl.textContent = `${layout.width} × ${layout.height} px · ${rotulo}${hueco}`;
}

for (const el of [textEl, sizeEl, textColorEl, highlightEl]) {
  el.addEventListener("input", draw);
}

// --- Salida -----------------------------------------------------------------

/**
 * La plantilla con el rotulo, sobre transparente. Es lo que ffmpeg pega encima
 * del video, asi que la previa y la pieza final salen de este mismo dibujo.
 */
function plate(): Promise<Blob> {
  const canvas = document.createElement("canvas");
  renderPlate(context(canvas), options());
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("No se pudo componer la plantilla."));
    }, "image/png");
  });
}

function setBusy(busy: boolean): void {
  state.busy = busy;
  generateEl.disabled = busy;
  generateEl.textContent = busy ? "MONTANDO…" : "GENERA";
  progressEl.hidden = !busy;
  if (!busy) progressBarEl.style.width = "0";
}

function generate(): void {
  if (state.busy) return;
  if (!state.file) {
    setStatus("Falta el vídeo.", "error");
    return;
  }

  // La revision arranca ya, no al final: montar el video tarda, y de nada
  // sirve enterarse de la errata cuando el rotulo lleva un minuto incrustado.
  outputEl.hidden = false;
  void review(textEl.value);

  void (async () => {
    setBusy(true);
    try {
      await ensureFont();
      const layout = computeLayout(previewCtx, options());
      if (!layout.video) throw new Error("Falta el vídeo.");

      const started = performance.now();
      const mp4 = await encode(
        { source: state.file!, plate: await plate(), rect: layout.video },
        {
          onStage: (message) => setStatus(message),
          onProgress: (ratio) => {
            progressBarEl.style.width = `${(ratio * 100).toFixed(1)}%`;
            setStatus(`Montando el vídeo… ${Math.round(ratio * 100)} %`);
          },
        },
      );
      const seconds = (performance.now() - started) / 1000;

      if (state.result) URL.revokeObjectURL(state.result);
      state.result = URL.createObjectURL(mp4);
      resultEl.src = state.result;
      outputEl.hidden = false;
      resultInfoEl.textContent =
        `${layout.width} × ${layout.height} px · ${(mp4.size / (1024 * 1024)).toFixed(1)} MB · ` +
        `montado en ${seconds.toFixed(0)} s`;
      setStatus("Listo.");
      outputEl.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      console.error(err);
      setStatus(err instanceof Error ? err.message : "No se pudo montar el vídeo.", "error");
    } finally {
      setBusy(false);
    }
  })();
}

generateEl.addEventListener("click", generate);

// --- Revision del texto ----------------------------------------------------

/** Ultimo texto revisado con exito, para no preguntar dos veces por lo mismo. */
let reviewed = "";
/** Cada revision anula el pintado de la anterior, que pudo tardar mas. */
let reviewToken = 0;
/** Texto propuesto por la ultima revision, el que aplica CORREGIR. */
let proposal = "";

function setReview(title: string, issues: Issue[] = []): void {
  reviewEl.hidden = false;
  reviewTitleEl.textContent = title;

  reviewListEl.replaceChildren();
  reviewListEl.hidden = issues.length === 0;
  for (const issue of issues) {
    const li = document.createElement("li");
    const marked = document.createElement("q");
    marked.textContent = issue.text;
    li.append(marked);
    if (issue.replacements.length > 0) {
      const to = document.createElement("b");
      to.textContent = issue.replacements.join(", ");
      li.append(" → ", to);
    }
    const why = document.createElement("span");
    why.className = "muted";
    why.textContent = ` · ${issue.message}`;
    li.append(why);
    reviewListEl.append(li);
  }

  // La propuesta solo sale si de verdad cambia algo respecto a lo escrito.
  proposal = issues.length > 0 ? applyFixes(textEl.value, issues) : "";
  const usable = proposal !== "" && proposal !== textEl.value;
  reviewFixEl.hidden = !usable;
  reviewProposalEl.textContent = usable ? proposal : "";
}

async function review(text: string): Promise<void> {
  if (text.trim() === reviewed) return;
  const token = ++reviewToken;
  setReview("Revisando el texto…");
  try {
    const issues = await check(text);
    if (token !== reviewToken) return;
    reviewed = text.trim();
    const n = issues.length;
    setReview(n === 0 ? "Sin erratas." : `${n} ${n === 1 ? "aviso" : "avisos"} en el texto`, issues);
  } catch {
    if (token !== reviewToken) return;
    // Que no se pueda revisar no debe estropear el montaje, que ya va en marcha.
    setReview("No se pudo revisar el texto.");
  }
}

/**
 * Aplica la propuesta al rotulo y vuelve a montar el video. Aqui eso cuesta
 * bastante mas que en las imagenes, pero el rotulo va incrustado: sin rehacerlo
 * el video que te llevas sigue teniendo la errata.
 */
fixEl.addEventListener("click", () => {
  if (state.busy) return;
  if (proposal === "" || proposal === textEl.value) return;
  textEl.value = proposal;
  draw();
  generate();
});

downloadEl.addEventListener("click", () => {
  if (!state.result) {
    setStatus("Todavía no hay nada que descargar.", "error");
    return;
  }
  const a = document.createElement("a");
  a.href = state.result;
  a.download = `${state.file?.name.replace(/\.[^.]+$/, "") || "videomeme"}-videomeme.mp4`;
  a.click();
});

// --- Arranque ---------------------------------------------------------------

textEl.value = "";
sizeEl.value = String(FONT_SIZE);
previewEl.width = CANVAS_W;
textColorEl.value = COLOR_TEXT;
highlightEl.value = COLOR_HIGHLIGHT;

void (async () => {
  const [overlay] = await Promise.all([loadImage(overlayUrl), ensureFont()]);
  state.overlay = overlay;
  draw();
})();
