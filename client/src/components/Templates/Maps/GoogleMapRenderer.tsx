// GoogleMapRenderer.tsx
import React from 'react';
import { GoogleMap, LoadScript, MarkerF, Polyline, OverlayView } from '@react-google-maps/api';
import { MapPoint } from 'src/utils/types';
import { SpecialMode } from './InteractiveMap';

const googleMapOptions = { disableDefaultUI: true, gestureHandling: 'cooperative' };
const googleMarkerIcon = { url: `data:image/svg+xml;charset=UTF-8,...` /* same as before */ };

interface Props {
  points: MapPoint[];
  measurePoints: MapPoint[];
  mousePosition: MapPoint | null;
  specialMode: SpecialMode;
  onMapClick: (e: google.maps.MapMouseEvent) => void;
  onMouseMove: (e: google.maps.MapMouseEvent) => void;
  segments: { p1: MapPoint, p2: MapPoint, distance: number }[];
}

const GoogleMapRenderer: React.FC<Props> = ({ points, measurePoints, mousePosition, specialMode, onMapClick, onMouseMove, segments }) => {
  const mapRef = React.useRef<google.maps.Map | null>(null);

  const isMeasureMode = specialMode === 'ruler';

  React.useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setOptions({ draggable: !isMeasureMode, draggableCursor: isMeasureMode ? 'crosshair' : 'grab' });
    }
  }, [isMeasureMode]);

  const getPixelPositionOffset = (width: number, height: number) => ({
    x: -(width / 2),
    y: -(height / 2),
  });

  const handleMapRef = (map: google.maps.Map) => {
    mapRef.current = map;
  }

  return (
    <LoadScript googleMapsApiKey={import.meta.env.VITE_APP_Maps_API_KEY!}>
      <GoogleMap
        mapContainerClassName="map-container"
        center={{ lat: 40.1792, lng: 44.5152 }}
        zoom={12}
        options={googleMapOptions}
        onLoad={handleMapRef}
        onClick={onMapClick}
        onMouseMove={onMouseMove}
      >
        {/* Regular markers */}
        {points.map(p => <MarkerF key={p.id} position={p} icon={googleMarkerIcon} />)}

        {/* Measurement markers */}
        {measurePoints.map(p => <MarkerF key={p.id} position={p} icon={googleMarkerIcon} />)}

        {/* Permanent measurement lines and labels */}
        {segments.map((seg, index) => (
          <React.Fragment key={index}>
            <Polyline path={[seg.p1, seg.p2]} options={{ strokeColor: '#FF0000', strokeOpacity: 1, strokeWeight: 2, zIndex: 1, icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 2 }, offset: '0', repeat: '10px' }] }} />
            <OverlayView position={{ lat: (seg.p1.lat + seg.p2.lat) / 2, lng: (seg.p1.lng + seg.p2.lng) / 2 }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET} getPixelPositionOffset={getPixelPositionOffset}>
              <div className="distance-label">{seg.distance.toFixed(0)} m</div>
            </OverlayView>
          </React.Fragment>
        ))}

        {/* Live measurement line */}
        {isMeasureMode && mousePosition && measurePoints.length > 0 && (
          <Polyline path={[measurePoints[measurePoints.length - 1], mousePosition]} options={{ strokeColor: '#FF0000', strokeOpacity: 0.7, strokeWeight: 2, icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 2 }, offset: '0', repeat: '10px' }] }} />
        )}
      </GoogleMap>
    </LoadScript>
  );
};

export default GoogleMapRenderer;