import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPoint } from 'src/utils/types'; // Assumes this type definition exists
import { calculateDistance } from 'src/utils/MapsHelpers/distance'; // Assumes this helper exists
import { SpecialMode } from './InteractiveMap';

// Props interface for the component
interface YandexMapProps {
  apiKey: string;
  center: [number, number];
  zoom?: number;
  mapType: string;
  points: MapPoint[]; // Default points to display
  specialMode: SpecialMode;
  onDistanceChange: (distance: number) => void; // Callback to update parent with total distance
}

// Declare ymaps in the window scope to avoid TypeScript errors
declare global {
  interface Window {
    ymaps: any;
  }
}

/**
 * A React wrapper for the Yandex Map API with a smooth, custom measurement/ruler functionality.
 */
const YandexMapWrapper: React.FC<YandexMapProps> = ({
  apiKey,
  center,
  zoom = 16,
  mapType,
  points,
  specialMode,
  onDistanceChange,
}) => {
  // --- Refs for Map and API Objects ---
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const defaultPlacemarks = useRef<any>(null);
  const measureObjects = useRef<any>(null);
  const isMounted = useRef<any>(null);

  // --- Refs for Live Ruler Objects (for smooth updates) ---
  const liveRulerLine = useRef<any>(null);
  const liveRulerLabel = useRef<any>(null);

  // --- Component State ---
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<MapPoint[]>([]);
  const [mousePosition, setMousePosition] = useState<MapPoint | null>(null);

  const isMeasureMode = specialMode === 'ruler'
  const isPillarMode = specialMode === 'pillar';
  // --- Event Handlers for Measurement ---
  const handleMapClick = (e: any) => {
    console.log(e);

    const coords = e.get('coords');
    const newPoint: MapPoint = {
      id: Date.now(),
      lat: coords[0],
      lng: coords[1],
    };
    switch (specialMode) {
      case 'ruler':
        setMeasurePoints(prev => [...prev, newPoint]);
        break;
      case 'pillar':
        console.log("Adding pillar at:", newPoint);
        
        const placemarkLayout = window.ymaps.templateLayoutFactory.createClass('<div class="pillar-placemark"></div>');
        const placemark = new window.ymaps.Placemark([newPoint.lat, newPoint.lng], {}, {
          iconLayout: placemarkLayout,
          iconShape: { type: 'Circle', coordinates: [0, 0], radius: 11 }
        });
        console.log(defaultPlacemarks.current);
        
        defaultPlacemarks.current.add(placemark);
        break;

      default:
        break;
    }
  };

  const handleMapRightClick = (e: any) => {
    e.stopPropagation()
    console.log("Double click detected, clearing measurement points.");
    setMousePosition(null)
    mapInstance.current.events.remove('mousemove', handleMouseMove);
  }

  const handleMouseMove = (e: any) => {
    const coords = e.get('coords');
    setMousePosition({
      id: 'mouse',
      lat: coords[0],
      lng: coords[1],
    });
  };

  // --- Memoization and Callbacks ---
  const segments = useMemo(() => {
    return measurePoints.slice(0, -1).map((point, i) => {
      const p1 = measurePoints[i];
      const p2 = measurePoints[i + 1];
      return { p1, p2, distance: calculateDistance(p1, p2) };
    });
  }, [measurePoints]);

  useEffect(() => {
    const total = segments.reduce((acc, seg) => acc + seg.distance, 0);
    onDistanceChange(total);
  }, [segments, onDistanceChange]);


  // --- Map Initialization and Configuration Effects ---
  useEffect(() => {
    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/2.1/?lang=en_US&apikey=${apiKey}`;
    script.async = true;
    script.onload = () => window.ymaps.ready(() => setIsScriptLoaded(true));
    script.onerror = () => console.error("Yandex Maps script could not be loaded.");
    document.head.appendChild(script);

    return () => {
      // Clean up the script tag on component unmount
      document.head.removeChild(script);
    };
  }, [apiKey]);

  useEffect(() => {
    if (isScriptLoaded && mapRef.current && !mapInstance.current) {
      mapInstance.current = new window.ymaps.Map(mapRef.current, { center, zoom, type: mapType, controls: [] });
      defaultPlacemarks.current = new window.ymaps.GeoObjectCollection();
      measureObjects.current = new window.ymaps.GeoObjectCollection();
      mapInstance.current.geoObjects.add(defaultPlacemarks.current);
      mapInstance.current.geoObjects.add(measureObjects.current);
    }
    return () => {
      if (mapInstance.current) {
        mapInstance.current.destroy();
        mapInstance.current = null;
      }
    };
  }, [isScriptLoaded]);

  useEffect(() => {
    if (mapInstance.current && !isMounted.current) {
      isMounted.current = true
      mapInstance.current.setType(mapType);
      mapInstance.current.setCenter(center, zoom);
    }
  }, [center, zoom, mapType]);

  // --- Measurement Mode Effects ---
  useEffect(() => {
    if (mapInstance.current && isScriptLoaded) {
      if (specialMode) {
        mapInstance.current.options.set('cursor', 'crosshair');
        mapInstance.current.events.add('click', handleMapClick);
        mapInstance.current.events.add('contextmenu', handleMapRightClick);
        mapInstance.current.events.add('mousemove', handleMouseMove);
      } else {
        mapInstance.current.options.set('cursor', 'grab');
        setMeasurePoints([]);
        setMousePosition(null);
      }
    }
    return () => {
      if (mapInstance.current && isScriptLoaded) {
        mapInstance.current.events.remove('click', handleMapClick);
        mapInstance.current.events.remove('mousemove', handleMouseMove);
      }
    };
  }, [specialMode, isScriptLoaded]);


  // --- Drawing Effects (Optimized) ---

  // Effect to draw STATIC objects (history points and lines).
  // This runs ONLY when a point is added (or all are cleared).
  useEffect(() => {
    if (!mapInstance.current || !isScriptLoaded) return;

    measureObjects.current.removeAll();

    // After clearing, the refs to live objects are invalid. Nullify them.
    liveRulerLine.current = null;
    liveRulerLabel.current = null;

    if (!isMeasureMode) return;
    const placemarkLayout = window.ymaps.templateLayoutFactory.createClass('<div class="ruler-x-placemark"></div>');
    const labelLayout = window.ymaps.templateLayoutFactory.createClass('<div class="distance-label">$[properties.text]</div>');

    segments.forEach(seg => {
      const line = new window.ymaps.Polyline([[seg.p1.lat, seg.p1.lng], [seg.p2.lat, seg.p2.lng]], {}, { strokeColor: "#FF0000", strokeWidth: 2 });
      const labelCenter = [(seg.p1.lat + seg.p2.lat) / 2, (seg.p1.lng + seg.p2.lng) / 2];
      const distanceLabel = new window.ymaps.Placemark(labelCenter, {
        text: `${seg.distance.toFixed(0)} m`
      }, {
        iconLayout: labelLayout,
        iconShape: { type: 'Rectangle', coordinates: [[-50, -15], [50, 15]] }
      });
      measureObjects.current.add(line);
      measureObjects.current.add(distanceLabel);
    });

    measurePoints.forEach(p => {
      const placemark = new window.ymaps.Placemark([p.lat, p.lng], {}, {
        iconLayout: placemarkLayout,
        // *** MODIFIED HERE: Update clickable area for the larger icon ***
        iconShape: { type: 'Rectangle', coordinates: [[-10, -10], [10, 10]] }
      });
      measureObjects.current.add(placemark);
    });

  }, [measurePoints, isMeasureMode, isScriptLoaded]);

  // Effect to draw/update DYNAMIC objects (the live ruler).
  // This runs on every mouse move for a smooth update.
  useEffect(() => {
    if (!isMeasureMode || !mousePosition || measurePoints.length === 0 || !isScriptLoaded) {
      // If we shouldn't be showing a ruler, ensure any old one is gone.
      if (liveRulerLine.current) {
        measureObjects.current.remove(liveRulerLine.current);
        liveRulerLine.current = null;
      }
      if (liveRulerLabel.current) {
        measureObjects.current.remove(liveRulerLabel.current);
        liveRulerLabel.current = null;
      }
      return;
    }

    const lastPoint = measurePoints[measurePoints.length - 1];
    const lineCoords = [[lastPoint.lat, lastPoint.lng], [mousePosition.lat, mousePosition.lng]];
    const labelCoords = [(lastPoint.lat + mousePosition.lat) / 2, (lastPoint.lng + mousePosition.lng) / 2];
    const distanceText = `${calculateDistance(lastPoint, mousePosition).toFixed(0)} m`;

    // If the live ruler objects don't exist yet, create them.
    if (!liveRulerLine.current) {
      const line = new window.ymaps.Polyline(lineCoords, {}, {
        strokeColor: "#FF0000",
        strokeWidth: 2,
        strokeStyle: 'dot',
        opacity: 0.7
      });

      const labelLayout = window.ymaps.templateLayoutFactory.createClass('<div class="distance-label">$[properties.text]</div>');
      const label = new window.ymaps.Placemark(labelCoords, { text: distanceText }, {
        iconLayout: labelLayout,
        iconShape: { type: 'Rectangle', coordinates: [[-50, -15], [50, 15]] }
      });

      liveRulerLine.current = line;
      liveRulerLabel.current = label;
      measureObjects.current.add(line).add(label);
    } else {
      // If they exist, just update their data for a smooth change.
      liveRulerLine.current.geometry.setCoordinates(lineCoords);
      liveRulerLabel.current.geometry.setCoordinates(labelCoords);
      liveRulerLabel.current.properties.set('text', distanceText);
    }
  }, [mousePosition, isMeasureMode]); // Depends only on mouse position and mode

  // Effect for default points from props (unchanged)
  useEffect(() => {
    if (mapInstance.current && defaultPlacemarks.current) {
      defaultPlacemarks.current.removeAll();
      const placemarkLayout = window.ymaps.templateLayoutFactory.createClass('<div class="pillar-placemark"></div>');
      points.forEach(point => {
        const placemark = new window.ymaps.Placemark([point.lat, point.lng], {}, {
          iconLayout: placemarkLayout,
          iconShape: { type: 'Circle', coordinates: [0, 0], radius: 11 }
        });
        defaultPlacemarks.current.add(placemark);
      });
    }
  }, [points, isScriptLoaded]);

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />;
};

export default YandexMapWrapper;