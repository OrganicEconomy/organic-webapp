import { Injectable } from '@angular/core'

export interface GeoPosition {
  lat: number
  lng: number
}

@Injectable({ providedIn: 'root' })
export class GeolocationService {
  /** Never rejects — permission denial, timeout, or missing browser support all resolve null. */
  public getCurrentPosition(timeoutMs = 3000): Promise<GeoPosition | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null)
        return
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
        () => resolve(null),
        { timeout: timeoutMs },
      )
    })
  }
}
