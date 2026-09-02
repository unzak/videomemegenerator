import { FFmpeg } from "@ffmpeg/ffmpeg";
// Empaquetado por Vite. Sin esto, @ffmpeg/ffmpeg busca su worker en
// `new URL("./worker.js", import.meta.url)`, y como Vite reescribe el modulo a
// `node_modules/.vite/deps`, ahi no hay ningun worker.js: el Worker no llega a
// arrancar, nadie contesta al mensaje de carga y `load()` se queda colgado
// para siempre, sin un solo error en la consola.
import ffmpegWorkerURL from "@ffmpeg/ffmpeg/worker?worker&url";
import { fetchFile } from "@ffmpeg/util";
import { CANVAS_H, CANVAS_W } from "./format.js";
import type { Rect } from "./render.js";

/**
 * El motor. Es una build de ffmpeg compilada a WebAssembly, asi que el montaje
 * ocurre entero en el navegador: la pagina publicada en GitHub Pages funciona
 * sola, sin servidor y sin instalar nada.
 *
 * Es la de un solo hilo a proposito. La multihilo necesita `SharedArrayBuffer`,
 * que solo se habilita con las cabeceras COOP/COEP, y GitHub Pages no deja
 * poner cabeceras. Seria unas tres veces mas rapida, pero no se puede servir.
 *
 * Se carga desde unpkg, con la version clavada, porque el .wasm son 32 MB y no
 * tiene sentido meterlos en el repo. Para servirlo del propio dominio, copia
 * `ffmpeg-core.js` y `ffmpeg-core.wasm` de `@ffmpeg/core/dist/esm` a
 * `public/ffmpeg/` y cambia esta constante por `./ffmpeg`.
 *
 * **Tiene que ser la build `esm`, no la `umd`.** El worker se crea con
 * `type: "module"`, y en un worker de modulo no existe `importScripts`, que es
 * lo unico con lo que se puede cargar la UMD. @ffmpeg/ffmpeg tiene un respaldo
 * que cambia solo a `esm`, pero solo salta cuando no le has dado ninguna URL;
 * si le pasas la de la UMD, la intenta importar y falla con un escueto
 * "failed to import ffmpeg-core.js".
 */
const CORE_BASE = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm";

/**
 * Calidad del H.264. 18 es el punto en el que la recodificacion deja de
 * distinguirse del original a simple vista; por debajo solo engorda el archivo.
 */
const CRF = 18;

/**
 * Compromiso entre velocidad y tamaño. En WebAssembly, y a un solo hilo, los
 * presets lentos multiplican la espera sin que se note en pantalla.
 */
const PRESET = "veryfast";

export interface EncodeJob {
  /** El video original, tal cual lo eligio el usuario. */
  source: File;
  /** La plantilla con el rotulo, PNG con alfa de 1080x1920. */
  plate: Blob;
  /** Donde va el video dentro del lienzo. Sale de `computeLayout`. */
  rect: Rect;
}

export interface EncodeHandlers {
  /** 0..1 mientras codifica. Antes de eso solo hay carga y descarga. */
  onProgress: (ratio: number) => void;
  onStage: (message: string) => void;
}

let ffmpeg: FFmpeg | null = null;
/** Las ultimas lineas del log, que es lo unico que explica un fallo. */
let tail: string[] = [];

async function engine(handlers: EncodeHandlers): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg;
  handlers.onStage("Cargando el motor de vídeo… (unos 30 MB la primera vez)");
  const created = new FFmpeg();
  created.on("log", ({ message }) => {
    tail.push(message);
    if (tail.length > 40) tail.shift();
  });
  await created.load({
    classWorkerURL: ffmpegWorkerURL,
    coreURL: `${CORE_BASE}/ffmpeg-core.js`,
    wasmURL: `${CORE_BASE}/ffmpeg-core.wasm`,
  });
  ffmpeg = created;
  return created;
}

/**
 * Recorta el trozo del video escalado que cae dentro del lienzo. `pad` no
 * admite desplazamientos negativos, y con el zoom el encuadre se sale por
 * arriba y por los lados constantemente, asi que hay que quitar primero lo que
 * sobra y colocar despues lo que queda.
 *
 * No hace falta recortarlo al hueco de la plantilla: por encima y por debajo
 * del hueco la plantilla es negro opaco, asi que lo que se salga queda tapado.
 */
function place(rect: Rect): { crop: string; pad: string } {
  const cx = Math.max(0, -rect.x);
  const cy = Math.max(0, -rect.y);
  const px = Math.max(0, rect.x);
  const py = Math.max(0, rect.y);
  const cw = Math.min(rect.w - cx, CANVAS_W - px);
  const ch = Math.min(rect.h - cy, CANVAS_H - py);
  return {
    crop: `crop=${cw}:${ch}:${cx}:${cy}`,
    pad: `pad=${CANVAS_W}:${CANVAS_H}:${px}:${py}:color=black`,
  };
}

/** La extension importa: es de donde ffmpeg deduce con que demuxer abrirlo. */
function extension(name: string): string {
  const m = /\.([a-z0-9]{1,5})$/i.exec(name);
  return m ? m[1]!.toLowerCase() : "mp4";
}

function args(input: string, audio: "copy" | "aac", rect: Rect): string[] {
  const { crop, pad } = place(rect);
  // Escalar, quitar lo que se sale, colocar sobre el lienzo negro y pegarle la
  // plantilla encima. Es exactamente lo que hace la previa en el canvas.
  //
  // El `setsar=1` no es opcional. Al recortar cambiamos la proporcion a
  // proposito, y `scale` intenta conservar la del original metiendo un pixel
  // no cuadrado: sin esto el MP4 sale marcado como 865:1538 en vez de 9:16 y
  // los reproductores lo estiran.
  const chain =
    `[0:v]scale=${rect.w}:${rect.h}:flags=lanczos,setsar=1,${crop},${pad}[v];` +
    `[v][1:v]overlay=0:0:format=auto[out]`;

  return [
    "-i", input,
    "-i", "plate.png",
    "-filter_complex", chain,
    "-map", "[out]",
    // El `?` hace que el audio sea opcional: hay videos que no traen ninguno.
    "-map", "0:a?",
    "-c:v", "libx264",
    "-preset", PRESET,
    "-crf", String(CRF),
    "-pix_fmt", "yuv420p",
    ...(audio === "copy"
      // Copiar el audio es literalmente no tocarlo: sale bit a bit igual que
      // en el original. Solo se recodifica si el contenedor no lo admite.
      ? ["-c:a", "copy"]
      : ["-c:a", "aac", "-b:a", "192k"]),
    // Con el indice al principio el MP4 empieza a verse sin descargarlo entero.
    "-movflags", "+faststart",
    "-y", "out.mp4",
  ];
}

export async function encode(job: EncodeJob, handlers: EncodeHandlers): Promise<Blob> {
  const ff = await engine(handlers);
  const input = `in.${extension(job.source.name)}`;

  handlers.onStage("Preparando los archivos…");
  await ff.writeFile(input, await fetchFile(job.source));
  await ff.writeFile("plate.png", new Uint8Array(await job.plate.arrayBuffer()));

  const onProgress = ({ progress }: { progress: number }) => {
    handlers.onProgress(Math.min(1, Math.max(0, progress)));
  };
  ff.on("progress", onProgress);

  try {
    handlers.onStage("Montando el vídeo…");
    tail = [];
    let code = await ff.exec(args(input, "copy", job.rect));
    if (code !== 0) {
      // El audio del original puede no caber en un MP4 tal cual (pasa con los
      // .webm, que suelen traer Opus). Entonces no queda otra que recodificarlo.
      handlers.onStage("El audio no cabe tal cual en un MP4; recodificándolo…");
      tail = [];
      code = await ff.exec(args(input, "aac", job.rect));
    }
    if (code !== 0) throw new Error(`ffmpeg terminó con el código ${code}.\n${tail.join("\n")}`);

    const data = await ff.readFile("out.mp4");
    if (typeof data === "string") throw new Error("ffmpeg devolvió texto en vez del vídeo.");
    // `data` apunta al monton de memoria del wasm, que se reutiliza en el
    // siguiente montaje: hay que quedarse con una copia antes de borrar nada.
    return new Blob([data.slice()], { type: "video/mp4" });
  } finally {
    ff.off("progress", onProgress);
    await ff.deleteFile(input).catch(() => {});
    await ff.deleteFile("plate.png").catch(() => {});
    await ff.deleteFile("out.mp4").catch(() => {});
  }
}
