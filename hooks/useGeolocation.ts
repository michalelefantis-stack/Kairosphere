
import { useState, useEffect, useCallback } from 'react';

export function useGeolocation() {
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);

  const requestLocation = useCallback(() => {
    setIsRequesting(true);
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      setIsRequesting(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords([position.coords.latitude, position.coords.longitude]);
        setError(null);
        setIsRequesting(false);
        
        // Start watching after initial success
        navigator.geolocation.watchPosition(
          (pos) => setCoords([pos.coords.latitude, pos.coords.longitude]),
          (err) => setError(err.message),
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      },
      (err) => {
        setError(err.message);
        setIsRequesting(false);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  }, []);

  return { coords, error, isRequesting, requestLocation };
}
