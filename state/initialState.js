/**
 * Initial application state
 */
export const initialState = {
    activeDataset: 'recent',
    currentZoom: 6, // Default zoom level
    viewportBounds: null,
    dataLoaded: {
        recent: false,
        historical: false
    },
    data: {
        recent: {
            raw: [],
            filtered: [],
            displayed: []
        },
        historical: {
            raw: [],
            filtered: [],
            displayed: [],
            // For optimizations with large datasets
            indexed: {
                byYear: {}, // Year → earthquakes mapping for quick filtering
                byMagnitude: {}, // Magnitude (rounded) → earthquakes mapping
                spatial: null // Reserved for spatial indexing
            }
        }
    },
    filters: {
        recent: {
            minMagnitude: 0,
            timePeriod: 'month',
            feltOnly: false
        },
        historical: {
            minMagnitude: 0,
            yearRange: [1981, 2023] // Default values, will be updated with config values
        }
    },
    // Color mode setting
    colorMode: {
        recent: 'depth', // Options are 'depth', 'magnitude'
        historical: 'depth'
    },
    // Render mode for historical data
    renderMode: {
        historical: 'points' // Default is 'cluster', alternatives are 'points'
    },
    // Rendering performance tracking
    performance: {
        lastRenderTime: 0,
        renderDuration: 0
    },
    // Plate boundaries toggle state
    showPlateBoundaries: false,
    selectedEarthquake: null,
    loading: true,
    error: null
};