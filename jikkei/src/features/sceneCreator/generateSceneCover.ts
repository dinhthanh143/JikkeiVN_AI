// ============================================================
// TASK-008 — Auto-generated scene cover (client-side canvas compositing)
// ============================================================
//
// Composites the starting background + character portraits into a single
// PNG blob, run once on Create/Save submit (never live during wizard
// editing, never in Personalized story edit — see useSceneSubmit.ts for
// the call site and mode gating).
//
// Source priority per asset, in order:
//   1. `file` (local File, not yet uploaded) — same-origin blob URL, no
//      CORS concern at all.
//   2. `imageUrl` (existing Cloudinary URL, unchanged this session) —
//      requires Cloudinary to send Access-Control-Allow-Origin on the
//      delivery URL; see the CORS note in TasksAndProgress_TAP.md TASK-008.
//
// Any failure anywhere in this pipeline (CORS taint, decode error, missing
// canvas context, etc.) resolves to `null` — the caller is expected to
// treat that as "skip cover update, keep whatever scene_cover already
// exists" rather than blocking the save.

const COVER_WIDTH = 800
const COVER_HEIGHT = 450 // 16:9 — story-card itself crops to 2:3 via object-fit: cover, so this just needs to be a sane wide source image

interface CoverSource {
  file: File | null
  imageUrl: string | null
}

/** Resolves a CharacterDraft/BackgroundDraft into a loadable image source, preferring local file over remote URL. */
function resolveSource(draft: CoverSource): string | null {
  if (draft.file) return URL.createObjectURL(draft.file)
  if (draft.imageUrl) return draft.imageUrl
  return null
}

function loadImage(src: string, isRemote: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (isRemote) img.crossOrigin = 'anonymous' // must be set before img.src
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    img.src = src
  })
}

/** Draws an image into a target box using cover-fit (crop to fill, preserve aspect ratio). */
function drawCoverFit(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const imgRatio = img.width / img.height
  const boxRatio = w / h
  let sx = 0, sy = 0, sw = img.width, sh = img.height
  if (imgRatio > boxRatio) {
    sw = img.height * boxRatio
    sx = (img.width - sw) / 2
  } else {
    sh = img.width / boxRatio
    sy = (img.height - sh) / 2
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}

/** Lays out 1-3 character portraits along the bottom of the canvas. */
function drawCharacters(ctx: CanvasRenderingContext2D, images: HTMLImageElement[], canvasW: number, canvasH: number) {
  const count = images.length
  if (count === 0) return

  const portraitH = canvasH * 0.92
  const portraitW = portraitH * 0.62 // roughly portrait aspect

  // Layout: 1 char = centered, larger; 2 = split left/right; 3 = three-up, slight overlap
  const positions: Array<{ x: number; w: number; h: number }> = []
  if (count === 1) {
    positions.push({ x: canvasW / 2 - portraitW / 2, w: portraitW, h: portraitH })
  } else if (count === 2) {
    const w = portraitW * 0.85
    const h = portraitH * 0.85
    positions.push({ x: canvasW * 0.5 - w * 1.05, w, h })
    positions.push({ x: canvasW * 0.5 + w * 0.05, w, h })
  } else {
    const w = portraitW * 0.68
    const h = portraitH * 0.72
    positions.push({ x: canvasW * 0.5 - w * 1.55, w, h })
    positions.push({ x: canvasW * 0.5 - w * 0.5, w, h })
    positions.push({ x: canvasW * 0.5 + w * 0.55, w, h })
  }

  // Draw outer-then-center so the center character (in the 3-up case) overlaps naturally on top
  const drawOrder = count === 3 ? [0, 2, 1] : positions.map((_, i) => i)
  for (const i of drawOrder) {
    const img = images[i]
    const pos = positions[i]
    if (!img || !pos) continue
    const y = canvasH - pos.h
    drawCoverFit(ctx, img, pos.x, y, pos.w, pos.h)
  }
}

/**
 * Composites the starting background + character portraits into a single
 * PNG blob. Returns null on any failure (caller should silently keep the
 * existing scene_cover rather than blocking submit).
 */
export async function generateSceneCover(
  characters: CoverSource[],
  startingBackground: CoverSource | null,
): Promise<Blob | null> {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = COVER_WIDTH
    canvas.height = COVER_HEIGHT
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    // 1. Draw background, full-bleed cover-fit
    if (startingBackground) {
      const bgSrc = resolveSource(startingBackground)
      if (bgSrc) {
        const bgImg = await loadImage(bgSrc, !startingBackground.file)
        drawCoverFit(ctx, bgImg, 0, 0, COVER_WIDTH, COVER_HEIGHT)
      }
    }

    // 2. Subtle bottom gradient for legibility (matches StoryCard's own overlay style)
    const gradient = ctx.createLinearGradient(0, COVER_HEIGHT * 0.5, 0, COVER_HEIGHT)
    gradient.addColorStop(0, 'rgba(0,0,0,0)')
    gradient.addColorStop(1, 'rgba(0,0,0,0.55)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, COVER_WIDTH, COVER_HEIGHT)

    // 3. Draw character portraits along the bottom — one bad character
    // image shouldn't kill the whole cover, so failures are filtered out
    // rather than propagated.
    const validChars = characters.filter((c) => c.file || c.imageUrl)
    const loadedChars = await Promise.all(
      validChars.map(async (c) => {
        const src = resolveSource(c)
        if (!src) return null
        try {
          return await loadImage(src, !c.file)
        } catch {
          return null
        }
      }),
    )
    const charImages = loadedChars.filter((img): img is HTMLImageElement => img !== null)
    drawCharacters(ctx, charImages, COVER_WIDTH, COVER_HEIGHT)

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png', 0.92)
    })
  } catch {
    // Any failure (CORS taint, decode error, etc.) — fail silently
    return null
  }
}
