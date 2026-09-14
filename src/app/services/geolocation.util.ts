export interface GeoPosition {
  lat: number
  lng: number
}

/** Never rejects — permission denial, timeout, or missing browser support all resolve null. */
export function getCurrentPosition(timeoutMs = 3000): Promise<GeoPosition | null> {
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
