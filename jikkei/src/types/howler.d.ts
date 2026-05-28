declare module 'howler' {
  export class Howl {
    constructor(options?: {
      src?: string | string[]
      loop?: boolean
      volume?: number
      [key: string]: unknown
    })
    play(): number
    stop(): void
    unload(): void
    loop(value?: boolean): boolean | void
    volume(): number
    volume(value: number): this
    fade(from: number, to: number, duration: number): this
    once(event: string, callback: () => void): this
  }

  export const Howler: {
    volume(value?: number): number | void
  }
}
