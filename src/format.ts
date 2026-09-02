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
 * El hueco del video. La capa `PLANTILLA` es negro opaco de arriba abajo salvo
 * una ventana con los bordes desvanecidos: el alfa baja de 255 a 0 entre las
 * filas 647 y 802, se queda a 0 hasta la 1355, y vuelve a 255 en la 1512.
 *
 * El techo no se mueve: ahi es donde el marco negro deja de ser opaco, justo
 * debajo del rotulo. Lo que si se mueve es el suelo, porque el degradado de
 * abajo va pegado al borde inferior del video en vez de estar clavado donde lo
 * dejo el PSD. Asi un video que da de si aprovecha toda la parte de abajo, y
 * uno corto deja mas barra negra, en vez de recortarse siempre a la misma
 * altura.
 */
export const VIDEO_Y = 647;

/**
 * Primera fila con alfa 0: donde acaba el degradado de arriba y el video se ve
 * ya entero. Es tambien el alto de la pieza de arriba de la plantilla, que se
 * dibuja siempre igual y en el mismo sitio.
 */
export const FADE_TOP_END = 803;

/**
 * El degradado de abajo, dentro de la plantilla: ultima fila con alfa 0 y
 * primera opaca de vuelta. Esta banda se recorta del PNG y se pega donde acabe
 * el video, con su fila opaca justo en el borde.
 */
export const FADE_BOTTOM_START = 1355;
export const FADE_BOTTOM_END = 1512;
export const FADE_BOTTOM_H = FADE_BOTTOM_END - FADE_BOTTOM_START;

/**
 * Hasta donde puede llegar el video: el borde del lienzo. Ahi no queda barra
 * negra, solo el desvanecido de los ultimos 157 px.
 */
export const VIDEO_MAX_H = CANVAS_H - VIDEO_Y;

/**
 * Y de donde no puede bajar. Con esto el borde inferior nunca sube de 1060, o
 * sea que siempre quedan 100 px de ventana limpia entre los dos degradados.
 * Solo entra en juego con material muy apaisado: un 16:9 a todo lo ancho ya da
 * 607 px de alto.
 */
export const VIDEO_MIN_H = 413;

/**
 * Donde acaba la tinta del logo y los filetes dentro de `PLANTILLA`. Es el
 * techo real del rotulo: por encima de aqui se monta sobre la cara.
 */
export const ART_BOTTOM = 496;

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
export const TEXT_CENTER_Y = 580;

/**
 * Banda por la que se puede mover el rotulo. Por arriba, 16 px de respiro bajo
 * el logo; por abajo, la ultima fila en la que la plantilla todavia es negro
 * opaco, porque en cuanto empieza el degradado el texto se apoyaria sobre el
 * video. Es simetrica respecto a TEXT_CENTER_Y a proposito: asi el caso de dos
 * lineas reproduce el PSD sin desplazarse.
 */
export const TEXT_SAFE_TOP = 513;
export const TEXT_SAFE_BOTTOM = 647;

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
