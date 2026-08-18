# Video Stories

Pipeline para generar, revisar, producir y publicar historias narradas originales
de 18–25 minutos en el canal de YouTube de Peekr.

Vive dentro del dashboard admin existente (`/admin` → pestaña **🎬 Video Stories**).
No es un proyecto aparte.

---

## Cómo funciona

```
cron horario ──► genera SOLO el borrador
                        │
                   [Pendiente] ──► editas / regeneras ──► [Aprobada]
                                                              │
                                              "Generar audio" ─┴─► cola de jobs
                                                                       │
                                                       worker local (FFmpeg)
                                                                       │
                                                                [Audio listo]
                                                                       │
                                              "Generar video" ─────────┴─► cola
                                                                       │
                                                                [Video listo]
                                                                       │
                                        "Publicar en YouTube" + confirmación
                                                                       │
                                                                 [Publicada]
```

Nada se publica solo. La tarea programada **solo genera el borrador**; audio,
video y publicación siempre se disparan a mano.

### Por qué hay un worker local

Un video de 20 minutos necesita minutos de CPU sostenidos y un binario de
FFmpeg. Las funciones de Vercel cortan a 300 s y no traen FFmpeg. Por eso:

- **Vercel** hace lo corto: generar texto, planificar escenas, encolar jobs,
  firmar URLs, publicar en YouTube.
- **Tu Mac** hace lo largo: sintetizar la narración completa y renderizar el
  video.

El worker no recibe la service key de Supabase, ni la key del proveedor de voz,
ni ningún token de YouTube. El TTS pasa por un relay del backend y el acceso a
storage es por objeto con URLs firmadas de vida corta.

---

## Cálculo de duración

La narración se reproduce a **1.5x**, así que el guion necesita más palabras que
una lectura de 20 minutos:

```
palabras por minuto efectivas = words_per_minute × playback_speed
                              = 150 × 1.5 = 225

18 min → 4.050 palabras
25 min → 5.625 palabras
```

Los tres valores (`words_per_minute`, `playback_speed`, y el rango de minutos)
son configurables desde ⚙ Configuración en la pestaña. El worker aplica la
velocidad de verdad al encodear (`atempo`), no solo en el cálculo.

---

## Variables de entorno

### Obligatorias

| Variable | Para qué | Dónde |
|---|---|---|
| `GEMINI_API_KEY` | Genera las historias **y** la voz. Es la misma key que ya usan los carruseles de Peekrbuzz. | Vercel |
| `SUPABASE_SERVICE_ROLE_KEY` | Escrituras server-side y URLs firmadas. Ya existía. | Vercel |
| `NEXT_PUBLIC_SUPABASE_URL` | Ya existía. | Vercel |
| `CRON_SECRET` | Autentica el cron y firma el `state` de OAuth. Ya existía. | Vercel |
| `VIDEO_STORY_WORKER_SECRET` | Secreto compartido con el worker local. Genera uno largo y aleatorio. | Vercel **y** tu Mac |

### YouTube (necesarias para publicar)

| Variable | Para qué |
|---|---|
| `YOUTUBE_OAUTH_CLIENT_ID` | OAuth client de Google Cloud |
| `YOUTUBE_OAUTH_CLIENT_SECRET` | OAuth client secret |
| `YOUTUBE_OAUTH_REDIRECT_URI` | Opcional. Default: `https://www.peekr.app/api/admin/video-stories/youtube/callback` |

### Opcionales

| Variable | Default | Para qué |
|---|---|---|
| `VIDEO_STORY_AI_PROVIDER` | `gemini` | `gemini` o `anthropic` |
| `VIDEO_STORY_GEMINI_MODEL` | `gemini-2.5-flash` | Modelo para el texto |
| `VIDEO_STORY_TTS_PROVIDER` | `gemini` | Proveedor de voz |
| `VIDEO_STORY_TTS_MODEL` | `gemini-2.5-flash-preview-tts` | Modelo de voz |
| `ANTHROPIC_API_KEY` | — | Solo si usas `VIDEO_STORY_AI_PROVIDER=anthropic` |
| `VIDEO_STORY_ANTHROPIC_MODEL` | `claude-opus-5` | Modelo de Claude |
| `PEEKR_API_BASE` | `https://www.peekr.app` | Base que consulta el worker |
| `VIDEO_WORKER_POLL_SECONDS` | `15` | Cada cuánto consulta la cola |

> **Sobre Anthropic:** una suscripción a Claude Code o claude.ai **no** da acceso
> a la API. `ANTHROPIC_API_KEY` es facturación aparte (pay-as-you-go). El
> adaptador está escrito y funciona; se activa con una env var el día que lo
> quieras usar.

---

## Setup

### 1. Base de datos

La migración `supabase/migrations/20260805120000_video_stories.sql` es aditiva
y ya está aplicada. Crea:

| Tabla | Para qué |
|---|---|
| `video_stories` | Las historias, su texto, estado y rutas de media |
| `video_story_jobs` | Cola que drena el worker local |
| `video_story_settings` | Singleton: horario, zona horaria, duración objetivo, voz |
| `video_story_youtube_connection` | Singleton: tokens OAuth de Google |

También crea dos buckets privados: `video-story-assets` y `video-story-output`.

### 2. Material visual

> **Lo que va en pantalla NO ilustra la historia.** La voz cuenta el relato y
> la pantalla muestra otra cosa: clips de alto estímulo que enganchan solos —
> cosas que se abren, se sirven, se arman, se cortan. Es el formato que
> funciona en YouTube para historias narradas.
>
> Atar los visuales al tono de la historia (pasillos oscuros para misterio,
> etc.) produce videos monocromáticos y monótonos que pierden espectadores. El
> pipeline hacía eso al principio; se cambió a propósito.

Sube el material al bucket **`video-story-assets`**, en carpetas por categoría:

```
video-story-assets/
├── unboxing/      cajas, regalos, sorpresas
├── liquidos/      jugos, café, resina, miel sirviéndose
├── squishy/       slime, arena cinética, apretables
├── maquillaje/    aplicación paso a paso, transformación
├── pintura/       cuadros y murales en ejecución
├── cocina/        preparación, emplatado, postres
├── corte/         jabón, prensa hidráulica, cortes precisos
├── armado/        lego, muebles, maquetas
├── restauracion/  limpiezas, antes/después
├── orden/         organizar, acomodar, encastrar
│
├── branding/      intro.mp4 · outro.mp4 · logo.png
└── musica/        *.mp3
```

Agregar una categoría = crear la carpeta y sumarla a `VISUAL_TAGS` en
[`lib/video-stories/types.ts`](../lib/video-stories/types.ts). Sin migración.

**Qué buscar en el material:**

- **Video, no fotos.** El movimiento constante es la mitad del efecto.
- **Vertical 9:16**, 1080×1920 o más — es la carpeta que usa el render
  (`vertical/…`) y el corte de salida. Material horizontal pierde los costados.
- **Clips largos antes que muchos clips.** Un plano de 90 s vale más que seis
  de 15 s: el render entra por un punto distinto cada vez que lo reusa, así que
  uno largo rinde como varios.
- **Color saturado y luz alta.** Justo lo contrario de la paleta oscura de
  Peekr, que queda confinada al intro, el outro y el logo.
- **Un proceso con recompensa visible**, que se entienda sin mirar fijo.

Los clips se reproducen **acelerados a la misma velocidad que la narración**
(1.5x por defecto, tomado de `voice_speed`). Material lento debajo de una voz
rápida se siente desfasado.

También acepta imágenes fijas (`.jpg`, `.png`, `.webp`), a las que aplica un
zoom lento tipo Ken Burns para que no se sientan muertas — pero son el plan B:
el formato pide video.

**Cuánto material hace falta.** La cuenta que importa no es cuántos archivos
hay sino **cuántos minutos de metraje**, porque los clips corren acelerados:

```
minutos necesarios = duración del video × voice_speed
```

Un video de 20 min a 1.5x consume **30 minutos de material** para que ninguna
toma se repita. Eso es *cobertura 1.0x*. Por debajo, el render sigue
funcionando —vuelve a entrar en los clips ya usados, desfasado medio plano para
que no sea el mismo encuadre— pero se empieza a notar. Referencias:

| Cobertura | Qué se ve |
| --- | --- |
| < 0.5x | Se nota el bucle. Es lo que había antes de este cambio. |
| 0.7x | Aceptable: repite pero con encuadres distintos. |
| **1.0x+** | Objetivo. Cada toma del video es material distinto. |
| 1.5x+ | Sobra, y el mismo material aguanta varios videos sin repetirse. |

El worker imprime la cobertura real al empezar cada render y avisa cuántos
minutos faltan, así que no hace falta estimarlo a mano.

**De dónde sacarlo, legalmente:** Pexels y Pixabay tienen bastante (buscá en
inglés: *slime, pouring, coffee pour, unboxing, makeup tutorial, painting
timelapse, soap cutting*). Varias categorías las podés filmar vos con el
teléfono en diez minutos — servir un jugo, abrir una caja.

> ⚠️ **No uses clips bajados de TikTok o YouTube.** Es infracción de copyright
> y el canal se come strikes; con tres, YouTube lo cierra. Es exactamente el
> riesgo que hace que este formato le explote en la cara a mucha gente.

### 3. Worker local

```bash
brew install ffmpeg
```

En `peekr-links/.env.local`:

```
VIDEO_STORY_WORKER_SECRET=<el mismo valor que en Vercel>
PEEKR_API_BASE=https://www.peekr.app
```

Y lo dejas corriendo cuando quieras procesar la cola:

```bash
npm run video:worker
```

Consulta la cola cada 15 s, procesa lo que haya y sigue. No hace falta que esté
siempre prendido: los jobs esperan en la cola.

Además de FFmpeg, el worker necesita dos paquetes de Python. Los verifica al
arrancar y no procesa nada si falta alguno:

```bash
python3 -m pip install --user Pillow faster-whisper
```

> **Pillow — dibuja los subtítulos.** El build de FFmpeg de Homebrew viene sin
> `libass` ni `libfreetype`, así que no tiene ni el filtro `subtitles` ni
> `drawtext`. En vez de pedirte compilar FFmpeg desde el código fuente,
> [`scripts/render-subtitles.py`](../scripts/render-subtitles.py) dibuja cada
> subtítulo como PNG transparente y el worker los superpone como una sola
> pista con alpha.

> **faster-whisper — los sincroniza.** Antes el timing se calculaba repartiendo
> la duración de cada fragmento de TTS proporcionalmente a la cantidad de
> caracteres. Un fragmento son ~1.800 caracteres (más de un minuto de voz) y la
> cantidad de caracteres no sabe nada de pausas ni de cómo se lee un número, así
> que los subtítulos se iban segundos en el medio de cada fragmento.
> [`scripts/transcribe-captions.py`](../scripts/transcribe-captions.py)
> transcribe la narración ya renderizada con timestamps por palabra y alinea el
> guion contra esa transcripción: los tiempos salen del audio real y el texto
> sale siempre del guion aprobado.
>
> La primera corrida descarga el modelo (~150 MB, queda cacheado). Suma un par
> de minutos por narración. Con `VIDEO_WHISPER_MODEL` se puede cambiar el
> tamaño (`tiny`, `base` por defecto, `small`).

> **Regla de firewall necesaria.** El Bot Protection de Vercel responde a
> cualquier cliente que no sea un navegador con un desafío JavaScript
> (`HTTP 429`, header `x-vercel-mitigated: challenge`), y el worker no puede
> resolverlo. Hay una regla de bypass publicada — *"Allow video stories
> worker"* — que exime únicamente a `/api/admin/video-stories/jobs` y
> `/api/admin/video-stories/tts`. Los dos siguen exigiendo
> `VIDEO_STORY_WORKER_SECRET`, así que el bypass no abre nada: sin el secreto
> devuelven 401.
>
> Si el worker empieza a devolver 429, verificá que la regla siga viva:
>
> ```bash
> npx vercel firewall rules ls
> ```

### 4. YouTube

1. [Google Cloud Console](https://console.cloud.google.com/) → crea un proyecto
   (o usa uno existente).
2. **APIs y servicios → Biblioteca** → habilita **YouTube Data API v3**.
3. **Pantalla de consentimiento OAuth** → tipo **Externo**. Completa nombre de
   la app y correo. En **Usuarios de prueba**, agrega tu cuenta de Google.
   No hace falta verificación de Google para subir en modo privado con tu
   propia cuenta.
4. **Credenciales → Crear credenciales → ID de cliente OAuth → Aplicación web**.
   En **URIs de redireccionamiento autorizados**, agrega exactamente:
   ```
   https://www.peekr.app/api/admin/video-stories/youtube/callback
   ```
5. Copia el Client ID y el Client Secret a Vercel como
   `YOUTUBE_OAUTH_CLIENT_ID` y `YOUTUBE_OAUTH_CLIENT_SECRET`.
6. En `/admin` → Video Stories → ⚙ Configuración → **Conectar cuenta de Google**.

> Sin verificación de Google, el refresh token caduca a los 7 días mientras la
> app esté en modo *Testing*. Reconectas desde el mismo botón, o publicas la app
> (modo *In production*) para que deje de caducar.

---

## Programación

Por defecto: **lunes, miércoles y sábado a las 09:00 America/Argentina/Buenos_Aires**.

El cron de Vercel corre **cada hora** (`0 * * * *`) y la ruta decide si le toca,
leyendo día/hora/zona de `video_story_settings`. Así cambiar el horario es un
campo del formulario, no un deploy.

Es idempotente: solo genera una historia por fecha programada, aunque el cron se
reintente.

Para probarlo a mano:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://www.peekr.app/api/cron/generate-video-story?force=1"
```

---

## Estados

| Estado | Significa |
|---|---|
| `pending` | Borrador generado, esperando revisión |
| `needs_review` | La revisión automática marcó algo entre 4 y 6 |
| `approved` | Aprobada a mano. Habilita generar audio |
| `generating_audio` | En la cola / procesándose en el worker |
| `audio_ready` | Narración lista. Habilita generar video |
| `generating_video` | Renderizando |
| `video_ready` | Listo para revisar y publicar |
| `published` | Subido a YouTube |
| `error` | Falló algo; el detalle está en `error_message` |

**Una historia aprobada no se sobrescribe sin confirmación.** Guardar o
regenerar sobre ella devuelve `409` y el editor pregunta antes de repetir la
llamada. Al confirmar, vuelve a `pending` y hay que aprobarla de nuevo.

---

## Revisión automática

Después de generar, un segundo pase puntúa de 0 a 10: coherencia, repeticiones,
originalidad, duración, calidad del gancho y calidad del final.

El veredicto se recalcula desde los puntajes, no se confía en la etiqueta que
devuelve el modelo:

- todos ≥ 7 → `pending` (lista para revisar)
- alguno entre 4 y 6 → `needs_review`
- alguno ≤ 3 → `error`

La originalidad es una regla dura en todos los prompts: la historia puede
inspirarse en convenciones de género, pero no copiar argumentos, personajes,
diálogos ni giros de obras existentes. Si el revisor reconoce un parecido
concreto, lo nombra en las notas y baja el puntaje.

La revisión es asesora, no bloqueante: puedes aprobar igual si no estás de
acuerdo.

---

## Seguridad

- Todas las rutas exigen `profiles.is_admin` (`requireAdmin`), salvo el callback
  de OAuth (protegido por un `state` firmado con HMAC que caduca a los 15 min) y
  las dos rutas del worker (secreto compartido dedicado).
- RLS activo en las cuatro tablas. `video_stories`, `video_story_jobs` y
  `video_story_settings` dan **SELECT a admins**; toda escritura pasa por la API
  con service role.
- `video_story_youtube_connection` tiene **RLS activo y ninguna policy**: solo
  el service role puede leer los tokens. La UI recibe únicamente
  `{ connected, channel_title }`.
- Los buckets son privados. El acceso es por URL firmada de vida corta, generada
  server-side.
- Ningún token se escribe en logs. Los errores de OAuth solo propagan el
  `error_description` de Google, nunca el cuerpo de la request.
- Las keys de IA y voz nunca salen del backend, ni siquiera hacia el worker.

---

## Limitaciones conocidas

- **Publicar desde Vercel tiene techo de tiempo.** La subida a YouTube hace
  streaming desde Supabase Storage sin bufferear, pero corre en una función con
  300 s de límite. El worker encodea a ~1.8 Mbps (≈250 MB para 22 min) para que
  entre. Si alguna vez expira, descarga el MP4 con el botón **Descargar para
  revisión** y súbelo a mano.
- **La biblioteca visual es deliberadamente simple**: carpetas por etiqueta,
  sin metadatos por clip. Suficiente para la v1.
- **`words_per_minute` hay que re-medirlo.** El valor por defecto (104) salió de
  una narración que resultó anómalamente lenta. Renders posteriores dieron ~170.
  Con 104, un guion pensado para 25 min sale de 15. Se ajusta en la
  configuración del tab: `word_count ÷ (duración real del audio en min) ÷
  voice_speed`.
- **Gemini TTS es preview.** Devuelve PCM crudo y tiene contexto chico, por eso
  la narración se sintetiza en fragmentos de ~1.800 caracteres y se concatena.
  Si el modelo cambia de nombre, `VIDEO_STORY_TTS_MODEL` lo sobreescribe sin
  tocar código.
- **Sin miniaturas generadas.** Si subes una a
  `video-story-output/<id>/thumbnail.jpg`, la publicación la usa; si no, la
  omite. Un fallo de miniatura no revierte una subida exitosa.

---

## Archivos

| Ruta | Qué es |
|---|---|
| `app/admin/VideoStoriesTab.tsx` | Listado, filtros, generar, configuración |
| `app/admin/VideoStoryEditor.tsx` | Editor, voz, audio, video, preview, publicar |
| `app/admin/videoStoriesApi.ts` | Cliente autenticado del dashboard |
| `app/api/admin/video-stories/**` | Rutas de la API |
| `app/api/cron/generate-video-story/` | Tarea programada (solo borradores) |
| `lib/video-stories/types.ts` | Tipos, estados, etiquetas, matemática de duración |
| `lib/video-stories/prompts.ts` | Prompts (premisa, actos, CTA, revisión, escenas) |
| `lib/video-stories/generate.ts` | Orquestación de la generación |
| `lib/video-stories/scenes.ts` | División en escenas y asignación de recursos |
| `lib/video-stories/ai/` | Interfaz de proveedor de IA + Gemini + Anthropic |
| `lib/video-stories/tts/` | Interfaz de proveedor de voz + Gemini TTS |
| `lib/video-stories/youtube.ts` | OAuth y subida a YouTube |
| `lib/video-stories/storage.ts` | Buckets y URLs firmadas |
| `scripts/video-worker.mjs` | Worker local de FFmpeg |
| `scripts/transcribe-captions.py` | Alineación de subtítulos con la voz (Whisper) |
| `scripts/render-subtitles.py` | Dibujo de los subtítulos como pista con alpha |
| `supabase/migrations/20260805120000_video_stories.sql` | Esquema |

## Comandos

```bash
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm test           # vitest
npm run video:worker
```
