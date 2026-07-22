/**
 * OCR(Grab Text) 엔진 — tesseract.js 기반. 소유자: Library.
 *
 * - 워커는 게으르게 1회 생성 후 재사용하고, 동시 요청은 큐로 직렬화한다.
 * - 블로킹 근거: tesseract.js의 Node 워커는 worker_threads로 별도 스레드에서 인식을
 *   수행한다(node_modules/tesseract.js/src/worker/node/spawnWorker.js — `new Worker(workerPath)`).
 *   따라서 오래 걸리는 인식 중에도 메인 프로세스의 이벤트 루프(창/IPC/UI)는 멈추지 않고,
 *   메인 스레드 비용은 이미지 버퍼 직렬화 정도뿐이라 그대로 호출해도 안전하다.
 */
import { app } from 'electron'
import { mkdirSync } from 'fs'
import { join } from 'path'
import { createWorker, type Worker as TessWorker, type Block as TessBlock } from 'tesseract.js'
import { handle } from '../typedIpc'
import type { OcrRequest, OcrResult } from '@shared/ipc'

const DEFAULT_LANGS = 'kor+eng'

/** traineddata 캐시 디렉터리 — userData/tesseract */
function tessCacheDir(): string {
  const dir = join(app.getPath('userData'), 'tesseract')
  mkdirSync(dir, { recursive: true })
  return dir
}

let workerPromise: Promise<TessWorker> | null = null
let workerLangs: string | null = null

/** 워커를 게으르게 1회 생성. 언어 조합이 바뀌면 기존 워커를 종료하고 재생성한다. */
async function getWorker(langs: string): Promise<TessWorker> {
  if (workerPromise && workerLangs === langs) return workerPromise

  if (workerPromise) {
    const old = workerPromise
    workerPromise = null
    void old.then((w) => w.terminate()).catch(() => undefined)
  }

  workerLangs = langs
  // traineddata는 tesseract.js 기본 CDN(jsdelivr @tesseract.js-data)에서 내려받고,
  // cachePath(userData/tesseract)에 캐시되어 이후 실행에선 네트워크가 필요 없다.
  // TODO(Phase 4): 첫 실행 시 kor+eng 합계 수십 MB 다운로드 — 진행률 표시/오프라인 번들 검토
  const promise = createWorker(langs, undefined, { cachePath: tessCacheDir() })
  workerPromise = promise
  try {
    return await promise
  } catch (err) {
    // 생성 실패(예: 오프라인 첫 실행)는 다음 요청에서 재시도할 수 있게 초기화
    if (workerPromise === promise) {
      workerPromise = null
      workerLangs = null
    }
    throw err
  }
}

/** blocks 트리(블록→문단→줄→단어)를 OcrResult.words로 평탄화 */
function flattenWords(blocks: TessBlock[] | null | undefined): OcrResult['words'] {
  const words: OcrResult['words'] = []
  for (const block of blocks ?? []) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        for (const word of line.words) {
          words.push({
            text: word.text,
            bbox: { x0: word.bbox.x0, y0: word.bbox.y0, x1: word.bbox.x1, y1: word.bbox.y1 },
            confidence: word.confidence
          })
        }
      }
    }
  }
  return words
}

async function recognize(req: OcrRequest): Promise<OcrResult> {
  const worker = await getWorker(req.languages ?? DEFAULT_LANGS)
  // source: 파일 경로 또는 dataURL — tesseract.js Node loadImage가 둘 다 처리한다
  // (node_modules/tesseract.js/src/worker/node/loadImage.js)
  const { data } = await worker.recognize(req.source, {}, { text: true, blocks: true })
  return { text: data.text.trim(), words: flattenWords(data.blocks) }
}

// ── 직렬화 큐: 동시 요청이 와도 워커 하나에서 순서대로 처리 ──
let queueTail: Promise<unknown> = Promise.resolve()

/** OCR 실행 (공개 API). 내부적으로 순차 실행되며, 실패해도 큐는 계속 흐른다. */
export function runOcr(req: OcrRequest): Promise<OcrResult> {
  const task = queueTail.then(() => recognize(req))
  queueTail = task.catch(() => undefined)
  return task
}

export function registerOcrIpc(): void {
  handle('ocr:run', (req) => runOcr(req))
}
