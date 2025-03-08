/**
 * Map module for the Earthquake Visualization App
 * Handles map initialization and earthquake rendering
 */

// Define MapManager in the global scope immediately
window.MapManager = {};

// Then implement its functionality
(function(exports) {
    // Store a reference to the legend
    let legendControl = null;
    
    /**
     * Initialize the Leaflet map
     * @returns {Object} Leaflet map instance
     */
    function initializeMap() {
        try {
            const map = L.map('map').setView(CONFIG.map.center, CONFIG.map.zoom);
            
            // Add OpenStreetMap base layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: CONFIG.map.maxZoom,
                minZoom: CONFIG.map.minZoom
            }).addTo(map);
            
            // Add a legend to the map
            updateLegend(map);
            
            // Track zoom level for adaptive rendering
            map.on('zoomend', function() {
                const newZoom = map.getZoom();
                if (newZoom !== window.AppState.currentZoom) {
                    window.AppState.currentZoom = newZoom;
                    // Re-render with appropriate sampling for zoom level
                    if (window.AppState.activeDataset === 'historical') {
                        // Use a small delay to ensure smooth zooming
                        setTimeout(() => {
                            renderCurrentData();
                        }, 100);
                    }
                }
            });
            
            // Track viewport for viewport-constrained rendering
            map.on('moveend', function() {
                window.AppState.viewportBounds = map.getBounds();
                // No need to re-render on every pan, only on bigger movements
                if (window.AppState.activeDataset === 'historical' && CONFIG.render.useCanvas) {
                    // Skip re-rendering if the last render was very recent (for smooth panning)
                    const now = Date.now();
                    if (now - window.AppState.performance.lastRenderTime > 500) {
                        renderCurrentData();
                    }
                }
            });
            
            // Initial viewport bounds
            window.AppState.viewportBounds = map.getBounds();
            window.AppState.currentZoom = map.getZoom();
            
            return map;
        } catch (error) {
            console.error('Map initialization error:', error);
            throw new Error('Failed to initialize map: ' + error.message);
        }
    }
    
    /**
     * Update the map legend based on current color mode
     * @param {Object} map - Leaflet map instance
     */
    function updateLegend(map) {
        // Remove existing legend if it exists
        if (legendControl) {
            map.removeControl(legendControl);
        }
        
        // Create a new legend
        legendControl = L.control({ position: 'bottomright' });
        
        legendControl.onAdd = function() {
            const div = L.DomUtil.create('div', 'legend');
            let colorMode = 'depth'; // Default fallback
            
            // Safely get the current dataset and color mode
            try {
                const activeDataset = window.AppState.activeDataset || 'recent';
                if (window.AppState.colorMode && 
                    window.AppState.colorMode[activeDataset] !== undefined) {
                    colorMode = window.AppState.colorMode[activeDataset];
                }
                console.log("Active color mode:", colorMode);
            } catch (e) {
                console.error("Error getting color mode:", e);
            }
            
            if (colorMode === 'magnitude') {
                // Magnitude legend
                div.innerHTML = createMagnitudeLegend();
            } else {
                // Depth legend (default)
                div.innerHTML = createDepthLegend();
            }
            
            return div;
        };
        
        legendControl.addTo(map);
    }
    
    /**
     * Create HTML for magnitude legend
     * @returns {string} HTML for magnitude legend
     */
    function createMagnitudeLegend() {
        return `
            <h4>Legend</h4>
            <div><strong>Magnitude:</strong></div>
            <div class="legend-item">
                <div class="legend-color" style="background-color: ${CONFIG.colors.magnitude.verySmall};"></div>
                <span>&lt; 2 (Very Small)</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background-color: ${CONFIG.colors.magnitude.small};"></div>
                <span>2-3 (Small)</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background-color: ${CONFIG.colors.magnitude.medium};"></div>
                <span>3-4 (Medium)</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background-color: ${CONFIG.colors.magnitude.large};"></div>
                <span>4-5 (Large)</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background-color: ${CONFIG.colors.magnitude.veryLarge};"></div>
                <span>5-6 (Very Large)</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background-color: ${CONFIG.colors.magnitude.major};"></div>
                <span>6-7 (Major)</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background-color: ${CONFIG.colors.magnitude.great};"></div>
                <span>&gt; 7 (Great)</span>
            </div>
            <div><strong>Size:</strong> Inversely proportional to depth<br>(deeper events are smaller)</div>
        `;
    }
    
    /**
     * Create HTML for depth legend
     * @returns {string} HTML for depth legend
     */
    function createDepthLegend() {
        return `
            <h4>Legend</h4>
            <div><strong>Depth:</strong></div>
            <div class="legend-item">
                <div class="legend-color" style="background-color: ${CONFIG.colors.depth.veryShallow};"></div>
                <span>&lt; 5 km (Very Shallow)</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background-color: ${CONFIG.colors.depth.shallow};"></div>
                <span>5-10 km (Shallow)</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background-color: ${CONFIG.colors.depth.medium};"></div>
                <span>10-20 km (Medium)</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background-color: ${CONFIG.colors.depth.deep};"></div>
                <span>&gt; 20 km (Deep)</span>
            </div>
            <div><strong>Size:</strong> Proportional to magnitude</div>
        `;
    }
    
    /**
     * Clear all map layers (markers, canvas, etc.)
     */
    function clearAllMapLayers() {
        // Remove standard marker layer if it exists
        if (window.AppState.markerLayer) {
            window.AppState.map.removeLayer(window.AppState.markerLayer);
            window.AppState.markerLayer = null;
        }
        
        // Remove canvas layer if it exists
        if (window.AppState.canvasLayer) {
            window.AppState.map.removeLayer(window.AppState.canvasLayer);
            window.AppState.canvasLayer = null;
        }
        
        // Remove any other layers that might have been added
        if (window.AppState.heatLayer) {
            window.AppState.map.removeLayer(window.AppState.heatLayer);
            window.AppState.heatLayer = null;
        }
        
        // Force a redraw of the map to ensure all visual elements are cleared
        window.AppState.map.invalidateSize();
    }
    
    /**
     * Render the current filtered dataset on the map
     */
    function renderCurrentData() {
        console.time('renderCurrentData');
        window.AppState.performance.lastRenderTime = Date.now();
        
        // First, clear all existing layers
        clearAllMapLayers();
        
        // Update the legend to match current color mode
        updateLegend(window.AppState.map);
        
        const isHistorical = window.AppState.activeDataset === 'historical';
        let earthquakes;
        
        if (isHistorical) {
            earthquakes = window.AppState.data.historical.displayed;
            // For historical data, choose the appropriate rendering method
            if (CONFIG.render.useCanvas && earthquakes.length > CONFIG.render.maxStandardMarkers) {
                renderCanvasMarkers(earthquakes);
            } else {
                displayEarthquakeMarkers(earthquakes);
            }
        } else {
            earthquakes = window.AppState.data.recent.filtered;
            displayEarthquakeMarkers(earthquakes);
        }
        
        // Update information panel
        window.UIManager.updateStatisticsDisplay();
        
        // Track rendering performance
        window.AppState.performance.renderDuration = Date.now() - window.AppState.performance.lastRenderTime;
        console.log(`Rendering completed in ${window.AppState.performance.renderDuration}ms`);
        console.timeEnd('renderCurrentData');
    }
    
    /**
     * Display earthquake markers on the map using standard Leaflet markers
     * @param {Array} earthquakes - Array of earthquake data objects
     */
    function displayEarthquakeMarkers(earthquakes) {
        console.time('displayEarthquakeMarkers');
        
        // Clear existing layers first - crucial for proper filtering and tab switching
        clearAllMapLayers();
        
        // Create a simple layer group for markers
        window.AppState.markerLayer = L.layerGroup();
        
        // Show a warning if there are a lot of earthquakes
        if (earthquakes.length > 1000) {
            console.warn(`Rendering ${earthquakes.length} earthquake markers using standard markers.`);
            window.Utils.showStatus(`Displaying ${earthquakes.length} earthquakes - this might be slow. Consider applying more filters.`);
        }
        
        // Only render what's potentially visible for large datasets
        let markersToRender = earthquakes;
        
        // If we have over 1000 points and it's historical data, filter by viewport
        if (earthquakes.length > 1000 && window.AppState.activeDataset === 'historical' && window.AppState.viewportBounds) {
            // Add padding to the bounds to include points just outside the viewport
            const padFactor = 0.2; // 20% padding
            const bounds = window.AppState.viewportBounds;
            
            // Calculate padded bounds
            const latPad = (bounds.getNorth() - bounds.getSouth()) * padFactor;
            const lngPad = (bounds.getEast() - bounds.getWest()) * padFactor;
            
            const paddedBounds = L.latLngBounds(
                [bounds.getSouth() - latPad, bounds.getWest() - lngPad],
                [bounds.getNorth() + latPad, bounds.getEast() + lngPad]
            );
            
            // Filter to points in the padded viewport
            markersToRender = earthquakes.filter(quake => 
                paddedBounds.contains([quake.latitude, quake.longitude])
            );
            
            console.log(`Viewport filtering: ${markersToRender.length} of ${earthquakes.length} earthquakes are in current view`);
        }
        
        // Batch DOM operations for better performance
        const markers = [];
        
        // Process each earthquake to create markers (batched)
        for (const quake of markersToRender) {
            // Skip if coordinates are invalid
            if (!quake.latitude || !quake.longitude || isNaN(quake.latitude) || isNaN(quake.longitude)) {
                console.warn('Skipping earthquake with invalid coordinates:', quake);
                continue;
            }
            
            // Ensure magnitude and depth are valid numbers
            const magnitude = parseFloat(quake.magnitude) || 0;
            const depth = parseFloat(quake.depth) || 0;
            
            // Determine marker size and color
            const markerSize = window.Utils.calculateMarkerSize(magnitude, depth);
            const markerColor = window.Utils.calculateMarkerColor(depth, magnitude);
            
            // Create a circular marker
            const marker = L.circleMarker([quake.latitude, quake.longitude], {
                radius: markerSize,
                fillColor: markerColor,
                color: '#000',
                weight: 1,
                opacity: 1,
                fillOpacity: 0.8
            });
            
            // Add popup with information
            const popupContent = `
                <strong>Magnitude:</strong> ${quake.magnitude.toFixed(1)}<br>
                <strong>Date & Time:</strong> ${window.Utils.formatDateTime(quake.dateTime)}<br>
                <strong>Depth:</strong> ${quake.depth.toFixed(1)} km<br>
                <strong>Region:</strong> ${quake.region || 'Unknown'}<br>
                <strong>Type:</strong> ${quake.type || 'Unknown'}
            `;
            marker.bindPopup(popupContent);
            
            // Store the earthquake data with the marker
            marker.earthquake = quake;
            
            // Add click event to display details in the info panel
            marker.on('click', () => {
                window.AppState.selectedEarthquake = quake;
                window.UIManager.displayEarthquakeDetails(quake);
            });
            
            // Collect markers for batch adding
            markers.push(marker);
        }
        
        // Add all markers to the layer in a single operation
        markers.forEach(marker => window.AppState.markerLayer.addLayer(marker));
        
        // Add the layer to the map
        window.AppState.map.addLayer(window.AppState.markerLayer);
        
        // Show appropriate status messages
        if (earthquakes.length === 0) {
            window.Utils.showStatus("No earthquakes match the current filters. Try adjusting your criteria.");
        } else if (markersToRender.length < earthquakes.length) {
            window.Utils.showStatus(`Showing ${markersToRender.length} of ${earthquakes.length} earthquakes in the current viewport. Zoom out to see more, or pan the map.`);
        } else {
            window.Utils.hideStatus();
        }
        
        console.timeEnd('displayEarthquakeMarkers');
    }
    
    /**
     * Render markers using canvas for better performance with large datasets
     * @param {Array} earthquakes - Array of earthquake data objects
     */
    function renderCanvasMarkers(earthquakes) {
        console.time('renderCanvasMarkers');
        
        // Clear existing layers first
        clearAllMapLayers();
        
        // Check for very large datasets
        if (earthquakes.length > 10000) {
            console.warn(`Rendering ${earthquakes.length} points on canvas, performance may be impacted`);
            window.Utils.showStatus(`Rendering ${earthquakes.length} earthquakes. For better performance, apply more filters.`);
        }
        
        // Create an array of features for faster canvas rendering
        const features = earthquakes.filter(quake => {
            // Filter out invalid coordinates
            return quake.latitude && quake.longitude && !isNaN(quake.latitude) && !isNaN(quake.longitude);
        }).map(quake => {
            // Ensure magnitude and depth are valid numbers
            const magnitude = parseFloat(quake.magnitude) || 0;
            const depth = parseFloat(quake.depth) || 0;
            
            const markerSize = window.Utils.calculateMarkerSize(magnitude, depth);
            const markerColor = window.Utils.calculateMarkerColor(depth, magnitude);
            
            return {
                type: 'Feature',
                properties: {
                    magnitude: magnitude,
                    depth: depth,
                    size: markerSize,
                    color: markerColor,
                    id: quake.id,
                    earthquake: quake
                },
                geometry: {
                    type: 'Point',
                    coordinates: [quake.longitude, quake.latitude]
                }
            };
        });
        
        // Create a GeoJSON layer for canvas rendering
        const geojsonOptions = {
            pointToLayer: function(feature, latlng) {
                const quake = feature.properties.earthquake;
                const opts = {
                    radius: feature.properties.size,
                    fillColor: feature.properties.color,
                    color: '#000',
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                };
                
                const marker = L.circleMarker(latlng, opts);
                
                // Add popup
                const popupContent = `
                    <strong>Magnitude:</strong> ${quake.magnitude.toFixed(1)}<br>
                    <strong>Date & Time:</strong> ${window.Utils.formatDateTime(quake.dateTime)}<br>
                    <strong>Depth:</strong> ${quake.depth.toFixed(1)} km<br>
                    <strong>Region:</strong> ${quake.region || 'Unknown'}<br>
                    <strong>Type:</strong> ${quake.type || 'Unknown'}
                `;
                marker.bindPopup(popupContent);
                
                // Add click handler
                marker.on('click', () => {
                    window.AppState.selectedEarthquake = quake;
                    window.UIManager.displayEarthquakeDetails(quake);
                });
                
                return marker;
            }
        };
        
        // Use a normal GeoJSON layer with optimized rendering
        window.AppState.canvasLayer = L.geoJSON({ 
            type: 'FeatureCollection', 
            features: features 
        }, geojsonOptions).addTo(window.AppState.map);
        
        // Show a message if no earthquakes match the current filters
        if (earthquakes.length === 0) {
            window.Utils.showStatus("No earthquakes match the current filters. Try adjusting your criteria.");
        } else {
            window.Utils.hideStatus();
        }
        
        console.timeEnd('renderCanvasMarkers');
    }
    
    // Assign methods to the MapManager object
    exports.initializeMap = initializeMap;
    exports.renderCurrentData = renderCurrentData;
    exports.clearAllMapLayers = clearAllMapLayers;
    exports.updateLegend = updateLegend;
    
})(window.MapManager);

// Signal that MapManager is fully loaded
console.log('MapManager module loaded and initialized');