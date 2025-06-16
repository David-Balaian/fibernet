import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPoint } from 'src/utils/types';
import { SpecialMode } from './InteractiveMap';
interface Props {
    points: MapPoint[];
    measurePoints: MapPoint[];
    mousePosition: MapPoint | null;
    specialMode: SpecialMode;
    onMapClick: (e: google.maps.MapMouseEvent) => void;
    onMouseMove: (e: google.maps.MapMouseEvent) => void;
    segments: { p1: MapPoint, p2: MapPoint, distance: number }[];
    mapType: string
}

// For Leaflet: Custom DivIcon using a CSS class
const leafletMarkerIcon = L.divIcon({
    className: 'custom-leaflet-marker',
    iconSize: [22, 22], // Size of the icon
    iconAnchor: [11, 11], // Anchor point, centered
});


const mapCenter = { lat: 40.1792, lng: 44.5152 };

function LeafletMapRenderer({
    points,
    measurePoints,
    mousePosition,
    specialMode,
    onMapClick,
    onMouseMove,
    segments,
    mapType,
}: Props) {
    return (
        <MapContainer center={[mapCenter.lat, mapCenter.lng]} zoom={12} className="map-container" zoomControl={false}>
            {mapType === 'satellite' ? (
                <TileLayer attribution='&copy; Esri' url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
            ) : (
                <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            )}
            {/* ADDED: Render markers for Leaflet */}
            {points.map(point => (
                <Marker key={point.id} position={[point.lat, point.lng]} icon={leafletMarkerIcon} />
            ))}
        </MapContainer>
    )
}

export default LeafletMapRenderer