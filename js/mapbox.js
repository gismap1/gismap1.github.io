var foles;
const res = fetch('https://pets-backend-api.herokuapp.com/geo/get')
    .then(response => response.json())
    .then(data => foles = data)

mapboxgl.accessToken = 'pk.eyJ1IjoiZXJnaXMxIiwiYSI6ImNrd2NqcGNpdzFqNDMycXAydzN5amU5cngifQ.DL--NY3BJoVgzTZh6kXZ7A'; // Access token for mapbox api

//  Set map location when map is initialized
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11',
    center: [21.86279296875, 38.805470223177466],
    zoom: 7
});

const size = 100; // size of pulsing dot

// This implements `StyleImageInterface`
// to draw a pulsing dot icon on the map.
const pulsingDot = {
    width: size,
    height: size,
    data: new Uint8Array(size * size * 4),

    // When the layer is added to the map,
    // get the rendering context for the map canvas.
    onAdd: function () {
        const canvas = document.createElement('canvas');
        canvas.width = this.width;
        canvas.height = this.height;
        this.context = canvas.getContext('2d');
    },

    // Call once before every frame where the icon will be used.
    render: function () {
        const duration = 1000;
        const t = (performance.now() % duration) / duration;

        const radius = (size / 2) * 0.3;
        const outerRadius = (size / 2) * 0.7 * t + radius;
        const context = this.context;

        // Draw the outer circle.
        context.clearRect(0, 0, this.width, this.height);
        context.beginPath();
        context.arc(
            this.width / 2,
            this.height / 2,
            outerRadius,
            0,
            Math.PI * 2
        );
        context.fillStyle = `rgba(255, 200, 200, ${1 - t})`;
        context.fill();

        // Draw the inner circle.
        context.beginPath();
        context.arc(
            this.width / 2,
            this.height / 2,
            radius,
            0,
            Math.PI * 2
        );
        context.fillStyle = 'rgba(255, 100, 100, 1)';
        context.strokeStyle = 'white';
        context.lineWidth = 2 + 4 * (1 - t);
        context.fill();
        context.stroke();

        // Update this image's data with data from the canvas.
        this.data = context.getImageData(
            0,
            0,
            this.width,
            this.height
        ).data;

        // Continuously repaint the map, resulting
        // in the smooth animation of the dot.
        map.triggerRepaint();

        // Return `true` to let the map know that the image was updated.
        return true;
    }
};

map.on('load', () => {

    // add pulsing dot when map is loaded.
    map.addImage('pulsing-dot', pulsingDot, { pixelRatio: 2 });

    // Get coordinates when map is initialized.
    map.addSource('dot-point', {
        'type': 'geojson',
        'data': ('https://pets-backend-api.herokuapp.com/geo/get')
    });

    // Get coordinates from the api every 5 seconds.
    window.setInterval(function () {
        map.getSource('dot-point').setData('https://pets-backend-api.herokuapp.com/geo/get');
        fetch('https://pets-backend-api.herokuapp.com/geo/get')
            .then(response => response.json())
            .then(data => foles = data)
    }, 5000);

    // Add button to locate the user.
    map.addControl(geolocate);

    // ??
    map.addLayer({
        'id': 'search-radius',
        'type': 'symbol',
        'source': 'dot-point',
        'layout': {
            'icon-image': 'pulsing-dot'
        }
    });


    // New addition 
    map.addLayer({
        id: 'search-radius',
        source: {
            type: 'geojson',
            data: { "type": "FeatureCollection", "features": [] }
        },
        type: 'fill',
        paint: {
            'fill-color': '#000',
            'fill-opacity': 0.4
        }
    });
});

// Add search bar for location search.
// map.addControl(
//     new MapboxGeocoder({
//         accessToken: mapboxgl.accessToken,
//         mapboxgl: mapboxgl
//     })
// );


// Initialize the GeolocateControl.
const geolocate = new mapboxgl.GeolocateControl({
    positionOptions: {
        enableHighAccuracy: true
    },
    trackUserLocation: true
});

// Set an event listener that fires
// when a geolocate event occurs.
geolocate.on('geolocate', (e) => {
    var lon = e.coords.longitude;
    var lat = e.coords.latitude
    var position = [lon, lat];
    var searchRadius = makeRadius(position, 2000);
    var featuresInBuffer = spatialJoin(foles, searchRadius);
    console.log(featuresInBuffer)
    if (turf.featureCollection(featuresInBuffer).features[0]) {
        Toastify({
            text: "Warning you are near fola",
            duration: 2000
        }).showToast();
    }
});


map.on('click', 'search-radius', (e) => {
    // Copy coordinates array.
    const coordinates = e.features[0].geometry.coordinates.slice();
    const folaType = e.features[0].properties.folaType
    const isFola = e.features[0].properties.isFola
    // const description = e.features[0].properties.folaType;
    // const description = '<button type="button" onclick="alert(\'Reported Fola\')">Report as false positive!</button>'

    // Ensure that if the map is zoomed out such that multiple
    // copies of the feature are visible, the popup appears
    // over the copy being pointed to.
    while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
    }

    Swal.fire({
        title: '<strong>Fola</strong>',
        icon: 'warning',
        html:
            'Fola Type: <b>' + folaType + '</b>, ' +
            'Is Fola: <b>' + isFola + '</b>',
        showCloseButton: true,
        showCancelButton: true,
        focusConfirm: false,
        confirmButtonText:
            '<i class="fa fa-thumbs-up"></i>',
        confirmButtonAriaLabel: 'Thumbs up, great!',
        cancelButtonText:
            '<i class="fa fa-thumbs-down"></i>',
        cancelButtonAriaLabel: 'Thumbs down'
    })
});

map.on('mouseenter', 'search-radius', () => {
    map.getCanvas().style.cursor = 'pointer';
});

// Change it back to a pointer when it leaves.
map.on('mouseleave', 'search-radius', () => {
    map.getCanvas().style.cursor = '';
});

//makeRadius function goes here!
function makeRadius(lngLatArray, radiusInMeters) {
    var point = turf.point(lngLatArray);
    var buffered = turf.buffer(point, radiusInMeters, { units: 'meters' });
    return buffered;
}

function spatialJoin(sourceGeoJSON, filterFeature) {
    // Loop through all the features in the source geojson and return the ones that
    // are inside the filter feature (buffered radius) and are confirmed landing sites
    var joined = sourceGeoJSON.features.filter(function (feature) {
        return turf.booleanPointInPolygon(feature, filterFeature) && feature.properties.isFola === 'true';
    });




    return joined;





}

