import { EventEmitter } from 'events'
import type { CaptureResult, RecordResult } from '@shared/ipc'

/** 메인 프로세스 내부 이벤트 버스 — 모듈 간 직접 의존 없이 연결한다.
 * capture → library(자동 저장), recorder → library 등. 소유자: Architect */
interface BusEvents {
  captureCompleted: (result: CaptureResult) => void
  recordCompleted: (result: RecordResult) => void
}

class TypedBus {
  private emitter = new EventEmitter()

  emit<E extends keyof BusEvents>(event: E, ...args: Parameters<BusEvents[E]>): void {
    this.emitter.emit(event, ...args)
  }

  on<E extends keyof BusEvents>(event: E, listener: BusEvents[E]): () => void {
    this.emitter.on(event, listener as (...args: unknown[]) => void)
    return () => this.emitter.off(event, listener as (...args: unknown[]) => void)
  }
}

export const bus = new TypedBus()
