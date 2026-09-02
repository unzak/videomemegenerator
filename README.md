# videomemegenerator

Generador de video memes de Cabronazi: coges un vídeo, escribes el rótulo, lo
encuadras, y sale el **MP4 de 1080 × 1920** listo para reels, shorts y TikTok.

Reproduce `VIDEO MEME NUEVO.psd`: el marco negro con el logo y los filetes, el
rótulo donde va la capa `TEXTO`, y el vídeo asomando por el hueco de la ventana
con sus bordes desvanecidos.

Con una diferencia: **el suelo del hueco no está clavado**. El degradado de
abajo va pegado al borde inferior del vídeo, así que la barra negra crece y
mengua con él y un vídeo que da de sí aprovecha toda la parte de abajo.

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
   Pasado el mayor cuerpo al que cabe, seguir subiendo no hace nada: se queda
   ahí, nunca encoge.
3. Arrastra el **vídeo**, o elígelo con el botón.
4. Si el primer fotograma sale en negro —que pasa a menudo—, mueve la barra de
   **fotograma de la previa** hasta ver algo. Solo cambia lo que se ve mientras
   encuadras: al vídeo no le recorta nada.
5. Ajusta el **tamaño del vídeo** con la barra. **La barra negra de abajo se
   adapta sola**: al ampliar, el vídeo baja y la barra se encoge, hasta llegar
   al borde del lienzo y desaparecer; al reducir, la barra vuelve a crecer.
   Arrastrando sobre la vista previa lo mueves; si es más largo que el hueco lo
   recorres de arriba abajo, y el encuadre está topado para que no deje nunca
   hueco.
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

Lo que de verdad se nota es otra cosa: el hueco ocupa siempre los **1080 px** de
ancho del lienzo, así que un vídeo más estrecho se amplía para cubrirlo. Si te
avisa de que se verá pixelado, es por eso, y no hay recodificación que lo
arregle.

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
| Techo del hueco | y = 647 | capa `PLANTILLA`: última fila opaca antes de la ventana |
| Degradado de arriba | y 647 … 802 | de alfa 255 a 0 |
| Degradado de abajo | 157 px | y 1355 … 1511 en el PSD, de alfa 0 a 255 |
| Ventana limpia del PSD | y 803 … 1355 | el tramo con alfa 0 |
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

- **El vídeo tiene que llegar por debajo de los degradados, no hasta el borde de
  la ventana limpia.** El alfa de la plantilla no cae a cero de golpe: baja de
  255 a 0 entre 647 y 802, y vuelve a subir a lo largo de 157 px. Si el vídeo se
  corta donde empieza el desvanecido, este deja pasar medio degradado sobre nada
  y se ve un corte cruzando el ancho entero. Por eso el borde de arriba del
  vídeo va siempre por encima de 647, y el degradado de abajo se coloca de modo
  que su fila opaca caiga justo en el filo inferior.
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

## El suelo que se adapta

El PSD deja la ventana clavada entre 647 y 1511. Aquí solo el techo es fijo —ahí
es donde acaba el rótulo y el marco deja de ser opaco—, y el suelo lo pone el
propio vídeo:

- La escala base es el **encaje a lo ancho**: el hueco ocupa siempre los 1080 px
  del lienzo, y el tamaño del vídeo solo decide cuánto baja.
- El borde inferior del vídeo marca dónde se pega el degradado de abajo y dónde
  arranca la barra negra, topado al borde del lienzo. Un 16:9 a tamaño 1 deja
  608 px de hueco y 665 de barra; ampliándolo al 250 % llega abajo del todo y no
  queda barra.
- El borde superior se puede subir pero **nunca bajar** del techo: por encima del
  techo la plantilla es negro opaco y tapa el corte, y bajándolo se vería el filo.
- Un vídeo que cabe entero no se puede subir, porque su borde de abajo es el que
  manda dónde va la barra. Uno más largo que el hueco sí se recorre.

Para esto la plantilla se dibuja **en tres piezas** en vez de como un PNG de una
sola pieza: la parte de arriba hasta que se abre la ventana, que va siempre
igual; el degradado de abajo recortado del propio PNG y pegado al filo del
vídeo; y negro macizo de ahí al final del lienzo.

## Cómo se monta el MP4

El navegador dibuja la plantilla y el rótulo en un canvas de 1080 × 1920 sobre
transparente, y ffmpeg lo pega encima del vídeo. **La previa y la pieza final
salen del mismo dibujo**, así que lo que se ve es literalmente lo que se monta;
el rectángulo del vídeo se redondea a enteros en `computeLayout` y se le pasa a
ffmpeg tal cual, para que las dos no puedan redondear distinto.

La cadena de filtros es una sola línea: escalar, quitar lo que se sale, colocar
sobre el lienzo negro y superponer la plantilla. Lo que el vídeo se salga por
arriba o por abajo no hay que recortarlo: la plantilla es negro opaco en esas
dos zonas y lo tapa igual, tanto en la previa como en el montaje.

Cuatro cosas que no son opcionales, y que fallan de formas poco evidentes:

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
- **`-fps_mode vfr`.** Un origen sin cadencia fija se convierte en un montaje
  eterno. Los `.webm` de MediaRecorder, por ejemplo, declaran una base de
  tiempos de 1/1000 y ffmpeg deduce que van a 1000 fps: entonces duplica
  fotogramas hasta llenar esa cadencia y un clip de 46 se codifica como 1840.
  Con `vfr` respeta las marcas de tiempo del original y no duplica ni descarta
  ninguno, así que un 30 fps sigue saliendo a 30 fps y un 60 fps a 60.

En la consola queda el log de ffmpeg, en nivel `debug`, que es lo único que dice
por dónde va un montaje cuando se atasca. El `Aborted()` del final **no es un
fallo**: es el `exit()` normal de Emscripten cuando ffmpeg termina, y sale
también en los montajes que van bien.

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
