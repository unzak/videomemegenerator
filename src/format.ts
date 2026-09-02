/**
 * Constantes extraidas directamente de "VIDEO MEME NUEVO.psd".
 * No tocar a ojo: si cambia la plantilla, volver a medir sobre el PSD.
 *
 * El PSD trae dos capas y nada mas: `PLANTILLA`, que es el marco negro con el
 * logo, los filetes y el hueco por donde se ve el video, y `TEXTO`, que es la
 * que sustituye el rotulo que se escriba aqui.
 */

/** Lienzo del PSD: 1080x1920, el 9:16 de reels, shorts y TikTok. */
export const CANVAS_W = 1080;
export const CANVAS_H = 1920;

/**
 * Filas de `overlay.png`, que es la capa `PLANTILLA` tal cual salio del PSD.
 * Son coordenadas **del archivo**, no del lienzo: las piezas se recortan de
 * aqui y se pegan donde toque, que ya no es donde estaban.
 */
const SRC_FADE_TOP_Y = 647;
export const SRC_FADE_TOP_H = 803 - SRC_FADE_TOP_Y;
export const SRC_FADE_BOTTOM_Y = 1355;
export const SRC_FADE_BOTTOM_H = 1512 - SRC_FADE_BOTTOM_Y;
/** Lo que hay por encima del degradado: marco, logo y filetes, en una pieza. */
export const SRC_HEADER_H = SRC_FADE_TOP_Y;

/**
 * Lo que sube todo el bloque de arriba —logo, filetes y rotulo— respecto al
 * PSD. Por encima del logo el PSD deja 347 px de negro vacio que no pintan
 * nada, y subiendo el bloque ese aire se le regala al video.
 *
 * Es el unico numero de este archivo que no sale de medir: es una decision de
 * diseño, y esta suelto justo para poder moverla de un sitio. Con 0 la
 * composicion vuelve a ser la del PSD, clavada.
 */
export const HEADER_LIFT = 30;

/**
 * El hueco del video. La capa `PLANTILLA` es negro opaco de arriba abajo salvo
 * una ventana con los bordes desvanecidos: el alfa baja de 255 a 0 entre las
 * filas 647 y 802, se queda a 0 hasta la 1355, y vuelve a 255 en la 1512.
 *
 * Aqui ninguno de los dos bordes esta clavado donde lo dejo el PSD: **los dos
 * degradados siguen a lo que tienen al lado**. El de arriba baja cuando el
 * rotulo necesita mas sitio, y el de abajo va pegado al filo inferior del
 * video. Lo que no se mueve es el logo ni los filetes, que se quedan donde el
 * PSD los puso.
 *
 * En el PSD el techo esta en 647, la ultima fila opaca. Aqui todo el bloque de
 * arriba va `HEADER_LIFT` px mas alto, asi que el techo por defecto sube con
 * el. De ese techo el degradado no sube nunca; con una o dos lineas de rotulo,
 * que es el caso normal, el hueco empieza justo ahi.
 */
export const VIDEO_Y = SRC_FADE_TOP_Y - HEADER_LIFT;

/**
 * Lo que nunca se estrecha el hueco, pase lo que pase con el rotulo o con la
 * barra de abajo. Deja 100 px de ventana limpia entre los dos degradados.
 */
export const VIDEO_MIN_H = 413;

/**
 * Donde acaba la tinta del logo y los filetes dentro de `PLANTILLA`, en filas
 * del archivo. De aqui sale `TEXT_SAFE_TOP`: 17 px mas abajo, y luego los dos
 * suben lo mismo que el bloque.
 */
export const SRC_ART_BOTTOM = 496;

/**
 * Capa `TEXTO`: SFProDisplay-Bold, FontSize 42 x la escala 1.24484 del layer.
 * El descriptor trae ademas `FauxBold: true` y `FontCaps: 2`, es decir, negrita
 * sintetica encima de la negrita real y todo en mayusculas.
 */
export const FONT_SIZE = 52.28;
export const FONT_SIZE_MIN = 26;
export const FONT_SIZE_MAX = 76;

/**
 * `AutoLeading: true` con el 1.2 del ParagraphSheet. Comprobado sobre el
 * composite: las dos baselines caen en 568 y 631, 63 px, que es 1.2 x 52.28.
 */
export const LINE_RATIO = 1.2;

/** `Tracking: -20`, que en Photoshop son milesimas de eme. */
export const TRACKING_EM = -0.02;

/**
 * Grosor de la negrita sintetica, en eme. Photoshop no dice cuanto engorda con
 * `FauxBold`, asi que sale de medir: la tinta de las mayusculas del PSD ocupa
 * 39 px de alto y la Bold a secas da 38, o sea medio pixel por lado. Se pinta
 * con un trazo centrado en el contorno, de ahi que el valor sea el doble.
 */
export const FAUX_BOLD_EM = 0.015;

/**
 * Lo que la negrita sintetica ensancha **el avance** de cada glifo. El trazo
 * del contorno engorda la letra pero no la separa de la siguiente, y Photoshop
 * si las separa: con el tracking a secas las dos lineas de la plantilla salian
 * 7 y 4 px cortas, que son 0,004 emes por hueco en las dos. Con esto puestas,
 * la tinta cuadra con el PSD dentro de un pixel.
 */
export const FAUX_BOLD_ADVANCE_EM = 0.004;

/** Altura de mayusculas de la SF Pro Display: sCapHeight 1443 / 2048 upm. */
export const CAP_RATIO = 0.70459;

/**
 * Caja de composicion del parrafo, del descriptor de tipo: BoxBounds 736 x la
 * escala horizontal 1.24321 = 915 px, pegada en x = 82. Su centro cae en
 * 539.5, y la tinta del PSD esta centrada en 539: es caja de texto, no texto
 * de punto, y va centrada en el lienzo.
 */
export const TEXT_MAX_W = 915;

/**
 * Centro vertical del bloque de texto. En el PSD las mayusculas de la primera
 * linea empiezan en 529 y la baseline de la segunda cae en 631, asi que la
 * tinta se centra en 580. Anclar por el centro y no por la primera linea es lo
 * que mantiene el rotulo equilibrado tanto con una linea como con cuatro.
 */
export const TEXT_CENTER_Y = 580 - HEADER_LIFT;

/**
 * Techo del rotulo: 16 px de respiro bajo el logo. De aqui no sube, porque por
 * encima se montaria sobre la cara.
 */
export const TEXT_SAFE_TOP = SRC_ART_BOTTOM + 17 - HEADER_LIFT;

/**
 * Aire entre la ultima baseline del rotulo y el techo del hueco. Sale del PSD:
 * la segunda linea cae en 631 y la ventana se abre en 647. Es lo que empuja el
 * degradado de arriba cuando el rotulo crece.
 */
export const TEXT_GAP_BOTTOM = SRC_FADE_TOP_Y - 631;

/**
 * Hasta donde puede bajar la tinta del rotulo. No es una medida del PSD: es lo
 * que queda de empujar el techo del hueco hasta dejarlo en su minimo. Con el
 * cuerpo topado en 76 px caben once lineas antes de llegar aqui, asi que en la
 * practica el rotulo ya no se reduce nunca: lo que se mueve es el degradado.
 */
export const TEXT_MAX_BOTTOM = CANVAS_H - VIDEO_MIN_H - TEXT_GAP_BOTTOM;

/** `FillColor` del StyleRun: blanco puro. */
export const COLOR_TEXT = "#ffffff";

/**
 * Color de lo que va entre *asteriscos*, el mismo convenio que en news-maker y
 * en memegenerator. El PSD no lo usa, asi que por defecto va el rosa del logo,
 * medido sobre la propia capa `PLANTILLA` (el tono dominante de la mascota).
 */
export const COLOR_HIGHLIGHT = "#e9397e";

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 3;

export interface Font {
  /** Nombre a secas de la familia, para comprobar si esta cargada. */
  family: string;
  /** Pila completa, con respaldo por si la familia no llega a cargar. */
  stack: string;
  weight: number;
}

/**
 * La tipografia del rotulo. SF Pro Display Bold, servida por el propio repo en
 * `src/assets` y declarada en `style.css`, asi que sale igual en cualquier
 * equipo sin depender de lo que tenga instalado.
 */
export const FONT: Font = {
  family: "SF Pro Display",
  stack: '"SF Pro Display", system-ui, sans-serif',
  weight: 700,
};

export interface Swatch {
  label: string;
  hex: string;
}

/**
 * Paleta de la casa. El rosa de arriba es el del logo de esta plantilla, mas
 * claro que el `#cc1c65` de news-maker porque aqui la mascota lleva halo.
 */
export const COLORS: Swatch[] = [
  { label: "Blanco", hex: "#ffffff" },
  { label: "Rosa plantilla", hex: COLOR_HIGHLIGHT },
  { label: "Rosa Cabronazi", hex: "#cc1c65" },
  { label: "Amarillo", hex: "#ffde00" },
  { label: "Verde Cabrodeportes", hex: "#00ce5c" },
  { label: "Negro", hex: "#000000" },
];
