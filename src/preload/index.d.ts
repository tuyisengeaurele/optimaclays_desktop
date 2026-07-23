export interface ExposedApi {
  setToken: (token: string | null) => void
  invoke: <TPayload, TResult>(channel: string, payload: TPayload) => Promise<TResult>
  invokePublic: <TPayload, TResult>(channel: string, payload: TPayload) => Promise<TResult>
  versions: {
    node: string
    chrome: string
    electron: string
  }
}

declare global {
  interface Window {
    api: ExposedApi
  }
}
