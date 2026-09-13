import { Injectable } from '@angular/core'
import { EcosystemBlockchain } from 'organic-money/src/index.js'
import type { EcosystemInfoResponse } from 'organic-protocol'

export type LoadedEcosystem = EcosystemInfoResponse & { blockchain: any }

@Injectable({ providedIn: 'root' })
export class ViewedEcosystemService {
  private viewedEcosystem: LoadedEcosystem | null = null

  public setViewedEcosystem(info: EcosystemInfoResponse): void {
    this.viewedEcosystem = { ...info, blockchain: new EcosystemBlockchain(info.blocks) }
  }

  public getViewedEcosystem(): LoadedEcosystem | null {
    return this.viewedEcosystem
  }
}
