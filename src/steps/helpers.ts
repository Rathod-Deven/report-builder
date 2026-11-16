import { AppState } from '../types'
export interface StepProps { s: AppState; set: (p: Partial<AppState>) => void }

export const lines = (t: string) => t.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
