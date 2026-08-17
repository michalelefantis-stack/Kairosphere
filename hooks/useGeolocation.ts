
import { useState, useEffect, useCallback, useRef } from 'react';

export function useGeolocation() {
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  // The watch id has to outlive the callback so it can be cleared on unmount.
  const watchId = useRef<number | null>(null);

  useEffect(() => () => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  }, []);

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
        
        // Start watching after initial success. Replace any existing watch —
        // calling requestLocation twice used to leave the first one running
        // forever, with no handle to stop it.
        if (watchId.current !== null) {
          navigator.geolocation.clearWatch(watchId.current);
        }
        watchId.current = navigator.geolocation.watchPosition(
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
