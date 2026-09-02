# videomemegenerator

Generador de video memes de Cabronazi: coges un vídeo, escribes el rótulo, lo
encuadras, y sale el **MP4 de 1080 × 1920** listo para reels, shorts y TikTok.

Reproduce `VIDEO MEME NUEVO.psd`: el marco negro con el logo y los filetes, el
rótulo donde va la capa `TEXTO`, y el vídeo asomando por el hueco de la ventana
con sus bordes desvanecidos.

**Todo ocurre en el navegador.** No hay servidor y no hay nada que instalar: el
montaje lo hace una build de ffmpeg compilada a WebAssembly, así que la página
publicada funciona sola.

## Uso

1. Escribe el **rótulo**. Sale siempre en mayúsculas, como en el PSD. Lo que
   envuelvas en `*asteriscos*` sale en el color de resaltado, igual que en
   news-maker y memegenerator.
2. Ajusta el **tamaño de letra** si quieres. Viene puesto el del PSD, 52,3 px.
   Es un tope, no una orden: el rótulo se compone más pequeño si no cabe entre
   el logo y el hueco del vídeo, y abajo te dice si ha tenido que reducirlo.
3. Arrastra el **vídeo**, o elígelo con el botón.
4. Si el primer fotograma sale en negro —que pasa a menudo—, mueve la barra de
   **fotograma de la previa** hasta ver algo. Solo cambia lo que se ve mientras
   encuadras: al vídeo no le recorta nada.
5. Ajusta el **tamaño del vídeo** con la barra, y arrastra sobre la vista previa
   para moverlo. El encuadre está topado para que el vídeo no deje nunca hueco.
6. Cambia los **colores** si quieres. El apartado va plegado, porque casi
   siempre son los mismos.
7. **GENERA**. La primera vez tarda más porque se descarga el motor de vídeo
   (unos 30 MB, luego queda en caché). Abajo aparece el resultado con el botón
   de descarga.

La **rueda del ratón** y el **pellizco de dos dedos** actúan sobre lo que haya
debajo, como en news-maker: encima del hueco hacen zoom del vídeo, y encima del
marco cambian el tamaño de la letra. Al pellizcar el vídeo, el punto medio de
los dedos arrastra a la vez, así que se coloca y se dimensiona de un solo gesto.

## Calidad

El vídeo hay que recodificarlo, porque le estamos quemando el rótulo encima. Se
hace en H.264 con **CRF 18**, que es donde la recodificación deja de
distinguirse del original a simple vista.

El **audio se copia tal cual**, bit a bit, sin tocarlo. Solo se recodifica a AAC
si el contenedor no lo admite, que en la práctica pasa con los `.webm`, porque
suelen traer Opus.

Lo que de verdad se nota es otra cosa: el hueco mide **1080 × 865**, así que un
vídeo más estrecho se amplía para cubrirlo. Si te avisa de que se verá pixelado,
es por eso, y no hay recodificación que lo arregle.

## Requisitos

- Node.js >= 20

```bash
npm install
```

## Desarrollo

```bash
npm run dev
```

## Publicar

```bash
npm run build
```

La build sale en `dist/` con rutas relativas, así que funciona tanto en GitHub
Pages como abriendo el HTML directamente. El workflow de `.github/workflows`
despliega a Pages en cada push a `main`.

## De dónde salen las medidas

Todo lo de `src/format.ts` está medido sobre `VIDEO MEME NUEVO.psd`, no puesto a
ojo. Si cambia la plantilla hay que volver a medirlo, porque son valores que no
se adivinan mirando la imagen:

| Dato | Valor | Origen |
| --- | --- | --- |
| Lienzo | 1080 × 1920 | cabecera del PSD |
| Hueco del vídeo | y 647 … 1511 (865 px) | capa `PLANTILLA`: última fila opaca 646, primera opaca de vuelta 1512 |
| Ventana limpia | y 803 … 1355 (553 px) | el tramo con alfa 0 |
| Fin del logo | y = 496 | tinta de la capa `PLANTILLA` |
| Fuente | SF Pro Display Bold, 52,28 px | `FontSize` 42 × escala 1,24484 de la capa |
| Negrita sintética | sí | `FauxBold: true` sobre la Bold |
| Mayúsculas | siempre | `FontCaps: 2` |
| Interlineado | 62,74 px | `AutoLeading` 1,2 × cuerpo; baselines del PSD en 568 y 631 |
| Tracking | −20 / 1000 eme | `Tracking` del `StyleRun` |
| Ancho de párrafo | 915 px | `BoxBounds` 736 × escala 1,24321 |
| Centro del bloque | y = 580 | tinta del PSD de 529 a 631 |
| Color | `#ffffff` | `FillColor` del `StyleRun` |

Comparado píxel a píxel con la referencia exportada del PSD, el marco entero
(logo, filetes y fondo) sale con **0 de diferencia**, y en la banda del rótulo
solo quedan los bordes de las letras, que es donde el rasterizador de Chrome no
puede coincidir con el de Photoshop.

Cuatro trampas que costaron encontrar, por si alguien vuelve por aquí:

- **El vídeo tiene que cubrir 647 … 1511, no solo la ventana limpia.** El alfa
  de la plantilla no cae a cero de golpe: baja de 255 a 0 entre 647 y 802, y
  vuelve a subir entre 1356 y 1511. Recortando el vídeo en el borde de la
  ventana, el desvanecido deja pasar medio degradado sobre nada y se ve un corte
  cruzando el ancho entero.
- **La negrita sintética también ensancha el avance.** Emularla solo con un
  trazo sobre el contorno engorda la letra pero no la separa de la siguiente, y
  Photoshop sí las separa: las dos líneas de la plantilla salían 7 y 4 px
  cortas. Son 0,004 emes por hueco en las dos, así que van sumadas al tracking.
- **`letterSpacing` mete el espacio detrás de cada carácter, también del
  último.** Con el tracking negativo del PSD, `measureText` devuelve una cola de
  menos que descentraría el rótulo medio píxel si no se descuenta.
- El alfa de la plantilla es **función pura de la fila**: no varía a lo ancho.
  Eso es lo que permite recortar y colocar el vídeo con números enteros sin que
  se note ninguna costura.

## Cómo se monta el MP4

El navegador dibuja la plantilla y el rótulo en un canvas de 1080 × 1920 sobre
transparente, y ffmpeg lo pega encima del vídeo. **La previa y la pieza final
salen del mismo dibujo**, así que lo que se ve es literalmente lo que se monta;
el rectángulo del vídeo se redondea a enteros en `computeLayout` y se le pasa a
ffmpeg tal cual, para que las dos no puedan redondear distinto.

La cadena de filtros es una sola línea: escalar, quitar lo que se sale, colocar
sobre el lienzo negro y superponer la plantilla.

Tres cosas que no son opcionales, y que fallan de formas poco evidentes:

- **El core de ffmpeg tiene que ser la build `esm`, no la `umd`.** El worker se
  crea con `type: "module"`, y ahí no existe `importScripts`, que es lo único
  con lo que se puede cargar la UMD. `@ffmpeg/ffmpeg` tiene un respaldo que
  cambia solo a `esm`, pero solo salta si no le has dado ninguna URL; si le
  pasas la de la UMD, la intenta importar y falla con un escueto
  `failed to import ffmpeg-core.js`.
- **El worker hay que empaquetarlo con Vite** y pasarlo en `classWorkerURL`. Por
  su cuenta, `@ffmpeg/ffmpeg` lo busca en `new URL("./worker.js",
  import.meta.url)`, y como Vite reescribe el módulo a `node_modules/.vite/deps`
  ahí no hay ningún `worker.js`: el Worker no llega a arrancar, nadie contesta al
  mensaje de carga y `load()` se queda colgado **para siempre, sin un solo error
  en la consola**. Por eso `vite.config.ts` lleva `worker.format: "es"`.
- **`setsar=1` después de `scale`.** Al recortar cambiamos la proporción a
  propósito, y `scale` intenta conservar la del original metiendo un píxel no
  cuadrado: sin eso el MP4 sale marcado como 865:1538 en vez de 9:16 y los
  reproductores lo estiran.

Se usa la build de **un solo hilo** a propósito. La multihilo necesita
`SharedArrayBuffer`, que solo se habilita con las cabeceras COOP/COEP, y GitHub
Pages no deja poner cabeceras. Sería unas tres veces más rápida, pero no se
puede servir.

El `.wasm` son 32 MB, así que se carga desde unpkg con la versión clavada en vez
de meterlo en el repo. Para servirlo del propio dominio, copia `ffmpeg-core.js`
y `ffmpeg-core.wasm` de `@ffmpeg/core/dist/esm` a `public/ffmpeg/` y cambia
`CORE_BASE` en `src/encode.ts` por `./ffmpeg`.

## Los assets

`src/assets/overlay.png` es la capa `PLANTILLA` extraída con su alfa, tal cual:
48 KB, de los que casi todo es el logo con su halo. El resto es negro y
degradado, que el PNG comprime a nada.

La tipografía es **SF Pro Display Bold**, servida por el propio repo, así que
sale igual en cualquier equipo sin depender de lo que tenga instalado. El `.otf`
original pesa 5,1 MB porque trae 30.853 glifos; aquí va reducido a Latin y en
woff2, 51 KB, sin perder acentos, eñes, ¿¡, comillas angulares ni el símbolo del
euro.

## Estructura

| Archivo | Qué hay dentro |
| --- | --- |
| `src/assets/` | La plantilla del PSD y la SF Pro. |
| `src/format.ts` | Las medidas del PSD, la tipografía y la paleta. Es lo único que hay que tocar para cambiar el diseño. |
| `src/render.ts` | El ajuste del rótulo y el dibujo sobre el lienzo. No toca el DOM. |
| `src/encode.ts` | ffmpeg en WebAssembly: de la plantilla y el rectángulo al MP4. |
| `src/main.ts` | La interfaz: carga del vídeo, encuadre, colores y descarga. |

## Parientes

- [news-maker](../news-maker) — las noticias de Cabronazi, 1080 × 1350, también
  clavado sobre su PSD.
- [memegenerator](../memegenerator) — la banda con el texto arriba y la foto
  debajo, sin plantilla fija.
