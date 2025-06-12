import React, { useState } from 'react';
import 'leaflet/dist/leaflet.css';
import './MapStyles.css';

import { MapPoint } from 'src/utils/types';
import YandexMapWrapper from './YandexMapWrapper';
import GoogleMapRenderer from './GoogleMapRenderer';
import LeafletMapRenderer from './LeafletMapRenderer';

// MUI Imports
import Box from '@mui/material/Box';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import StraightenIcon from '@mui/icons-material/Straighten';
import { Typography } from '@mui/material';

// --- Configuration ---
type MapProvider = 'google' | 'yandex' | 'leaflet';

interface MapTypeOption { value: string; label: string; }

const mapTypesByProvider: Record<MapProvider, MapTypeOption[]> = {
    google: [
        { value: 'roadmap', label: 'Roadmap' }, { value: 'satellite', label: 'Satellite' },
        { value: 'hybrid', label: 'Hybrid' }, { value: 'terrain', label: 'Terrain' },
    ],
    yandex: [
        { value: 'yandex#map', label: 'Map' }, { value: 'yandex#satellite', label: 'Satellite' },
        { value: 'yandex#hybrid', label: 'Hybrid' },
    ],
    leaflet: [
        { value: 'streets', label: 'Streets' }, { value: 'satellite', label: 'Satellite' },
    ],
};

const mapCenter = { lat: 40.1792, lng: 44.5152 };

interface InteractiveMapProps {
    points?: MapPoint[];
}

const InteractiveMap: React.FC<InteractiveMapProps> = ({ points = [] }) => {
    const [provider, setProvider] = useState<MapProvider>('yandex');
    const [mapType, setMapType] = useState<string>(mapTypesByProvider.yandex[0].value);
    
    // --- State for Measurement UI ---
    const [isMeasureMode, setIsMeasureMode] = useState(false);
    const [totalDistance, setTotalDistance] = useState(0);

    const handleProviderChange = (event: SelectChangeEvent) => {
        const newProvider = event.target.value as MapProvider;
        setProvider(newProvider);
        setMapType(mapTypesByProvider[newProvider][0].value);
        // Reset measurement when provider changes
        setIsMeasureMode(false);
        setTotalDistance(0);
    };

    const handleMapTypeChange = (event: SelectChangeEvent) => {
        setMapType(event.target.value);
    }

    const handleRulerClick = () => {
        const newMode = !isMeasureMode;
        setIsMeasureMode(newMode);
        if (!newMode) { // If turning off measurement, reset distance
            setTotalDistance(0);
        }
    };

    // Callback for map components to report their calculated distance
    const handleDistanceChange = (distance: number) => {
        setTotalDistance(distance);
    };

    const renderMap = () => {
        const commonProps = {
            points,
            isMeasureMode,
            mapType,
            onDistanceChange: handleDistanceChange,
        };
        
        // These props are not needed for Yandex anymore, but might be for others
        // If you refactor Google/Leaflet in the same way, you can remove them.
        const legacyMeasureProps = {
             measurePoints: [],
             mousePosition: null,
             segments: [],
             onMapClick: () => {},
             onMouseMove: () => {},
        };

        switch (provider) {
            case 'google':
                return <GoogleMapRenderer {...commonProps} {...legacyMeasureProps} />;
            case 'yandex':
                return <YandexMapWrapper 
                    {...commonProps} 
                    center={[mapCenter.lat, mapCenter.lng]} 
                    apiKey={import.meta.env.VITE_APP_YANDEX_MAPS_API_KEY}
                />;
            case 'leaflet':
                return <LeafletMapRenderer {...commonProps} {...legacyMeasureProps} />;
            default:
                return <div>Select a map provider</div>;
        }
    };

    return (
        <Box sx={{
            position: 'relative',
            width: '100vw',
            height: '100vh',
            overflow: 'hidden',
        }}>
            <Paper elevation={4} sx={{ position: 'absolute', top: 15, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, p: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
                <IconButton onClick={handleRulerClick} color={isMeasureMode ? 'error' : 'primary'}>
                    <StraightenIcon />
                </IconButton>
                {isMeasureMode && totalDistance > 0 && (
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                        {totalDistance < 1000 ? `${totalDistance.toFixed(0)} m` : `${(totalDistance / 1000).toFixed(2)} km`}
                    </Typography>
                )}
            </Paper>

            <Paper
                elevation={4}
                sx={{
                    position: 'absolute',
                    top: 15,
                    right: 15,
                    zIndex: 1000,
                    p: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    width: 200,
                }}
            >
                <FormControl fullWidth>
                    <InputLabel id="provider-select-label">Provider</InputLabel>
                    <Select
                        labelId="provider-select-label"
                        value={provider}
                        label="Provider"
                        onChange={handleProviderChange}
                        size="small"
                    >
                        <MenuItem value="google">Google</MenuItem>
                        <MenuItem value="yandex">Yandex</MenuItem>
                        <MenuItem value="leaflet">Leaflet (OSM)</MenuItem>
                    </Select>
                </FormControl>
                <FormControl fullWidth>
                    <InputLabel id="type-select-label">Map Type</InputLabel>
                    <Select
                        labelId="type-select-label"
                        value={mapType}
                        label="Map Type"
                        onChange={handleMapTypeChange}
                        size="small"
                    >
                        {mapTypesByProvider[provider].map((type) => (
                            <MenuItem key={type.value} value={type.value}>
                                {type.label}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Paper>

            {renderMap()}
        </Box>
    );
};

export default InteractiveMap;