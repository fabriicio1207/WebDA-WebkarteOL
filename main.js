import './style.css';
import {Map, View} from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import VectorLayer from 'ol/layer/Vector';
import XYZSource from 'ol/source/XYZ';
import VectorSource from 'ol/source/Vector';
import { Point } from 'ol/geom';
import { Feature } from 'ol';
import GeoJSON from 'ol/format/GeoJSON';
import {fromLonLat, toLonLat} from 'ol/proj.js';
import {toStringHDMS} from 'ol/coordinate';
import Overlay from 'ol/Overlay';
import { apply } from 'ol-mapbox-style';
import data from '.airline_routes.json' assert { type: 'json' };
import { Style, Circle as CircleStyle, Fill, Stroke, Icon } from 'ol/style';
import arc from 'arc';
import LineString from 'ol/geom/LineString.js';
import Attribution from 'ol/control/Attribution.js';

let userCoordinates = [0, 0];

const mapview = new View({
  center: userCoordinates,
  zoom: 2
});

const map = new Map({
  target: 'map',
  layers: [
  ],
  view: mapview 
});

// Infobutton

 /* const attribution = new ol.control.Attribution({
  className: 'ol-attribution',
  label: 'i',
  collapsible: true,
  collapsed: true,
  target: document.getElementById('attributionsbutton'),
});

map.addControl(attribution); */

// Ende

// Standortbestimmung

if ('geolocation' in navigator) {
  navigator.geolocation.getCurrentPosition(
    (position) => {
      userCoordinates = fromLonLat([
        position.coords.longitude, 
        position.coords.latitude
      ]);

      // Setze das Center und Zoom dynamisch auf die aktuellen Koordinaten
      mapview.setCenter(userCoordinates);
      mapview.setZoom(9); // Zoomstufe auf 9 setzen
      console.log('Aktueller Standort:', toLonLat(userCoordinates));
    },
    (error) => {
      console.error('Fehler bei der Geolocation:', error.message);
    },
    {
      enableHighAccuracy: false,
      timeout: 5000,
      maximumAge: 0,
    }
  );
} else {
  console.error('Geolocation wird nicht unterstützt.');
}

// Ende

// Zielflughäfen von Zürich aus

const zurichIATA = 'ZRH';

const zurichRoutes = data[zurichIATA]?.routes || [];

const allowedAirlines = ['LX', 'WK', '2L', 'GM'];

const filteredRoutes = zurichRoutes.filter(routes =>
  routes.carriers.some(carrier => allowedAirlines.includes(carrier.iata))
);

const destinationAirports = filteredRoutes.map(routes => {
  const destinationIATA = routes.iata;
  const destinationAirport = data[destinationIATA];
    return {
      iata: destinationIATA,
      name: destinationAirport.name,
      latitude: parseFloat(destinationAirport.latitude),
      longitude: parseFloat(destinationAirport.longitude),
      city_name: destinationAirport.city_name,
      country: destinationAirport.country,
    };
  
})

console.log(destinationAirports);

/* filteredRoutes.forEach(route => {
  console.log({
    ...route,
    carriers: route.carriers.filter(carrier => allowedAirlines.includes(carrier.iata))
  });
}); */

const airportFeatures = destinationAirports.map(airport => {
  return new Feature({
    geometry: new Point(fromLonLat([airport.longitude, airport.latitude])),
    name: airport.name,
    iataCode: airport.iata,
    city: airport.city_name,
    country: airport.country,
    routes: filteredRoutes,
  });
});

const dynamicStyleFunction = () => {
  
  const zoom = mapview.getZoom();
  const radius = Math.max(2, zoom * 0.7);

  return new Style({
    image: new Icon({
      scale: radius / 10,
      src: 'PiktogrammeWebkarte.png',
    }),
  });
};

map.on('pointermove', function (event) {
  const hand = map.hasFeatureAtPixel(event.pixel);
  map.getTargetElement().style.cursor = hand ? 'pointer' : ''; // Zeige den Cursor nur über Features
});

const airportLayer = new VectorLayer({
  source: new VectorSource({
    features: airportFeatures, 
    attributions: "test"
  }),
  style: dynamicStyleFunction 
});

// Ende

// Layereinstellungen

const key = 'JPBe5b8iCb5eu2s5N7Nd';
const styleJson = `https://api.maptiler.com/maps/4bd199a8-b3af-4140-b4ae-87d8cb4e763e/style.json?key=${key}`;
apply(map, styleJson);

map.addLayer(airportLayer);

airportLayer.setZIndex(2);

// Ende

// Suchfunktion (mithilfe von ChatGPT)

const searchInput = document.getElementById('search-input');
const resultsContainer = document.getElementById('search-results');

  // Funktion: Flughäfen durchsuchen
function searchAirports(query) {
  query = query.toLowerCase();
  return Object.values(data).filter(airport =>
    airport.iata.toLowerCase().includes(query) ||
    (airport.icao && airport.icao.toLowerCase().includes(query)) ||
    airport.city_name.toLowerCase().includes(query) ||
    airport.name.toLowerCase().includes(query)
  );
}

  // Funktion: Orte/Regionen durchsuchen (Nominatim API)
async function searchPlaces(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Fehler bei der Nominatim API');
  return await response.json();
}

  // Funktion: Suche ausführen
async function handleSearch() {
  const query = searchInput.value.trim();

  if (!query) {
    alert('Bitte einen Suchbegriff eingeben!');
    return;
  }

  // Flughäfen durchsuchen
  const airportResults = searchAirports(query);

  // Orte/Regionen durchsuchen
  let placeResults = [];
  try {
    placeResults = await searchPlaces(query);
  } catch (error) {
    console.error('Fehler bei der Nominatim API:', error.message);
  }

  // Ergebnisse anzeigen
  displaySearchResults(airportResults, placeResults);
}

  // Ergebnisse anzeigen
function displaySearchResults(airports, places) {
  resultsContainer.innerHTML = ''; // Alte Ergebnisse löschen

  // Flughäfen anzeigen
  airports.forEach(airport => {
    const item = document.createElement('div');
    item.className = 'search-item';
    item.textContent = `${airport.name} (${airport.iata}) - ${airport.city_name}`;
    item.addEventListener('click', () => {
      zoomToLocation(airport.longitude, airport.latitude);
      
      // Suchergebnisse ausblenden und Suchfeld zurücksetzen
      resultsContainer.innerHTML = ''; // Ergebnisse löschen
      searchInput.value = ''; // Suchfeld zurücksetzen
    });
    resultsContainer.appendChild(item);
  });

  // Orte/Regionen anzeigen
  places.forEach(place => {
    const item = document.createElement('div');
    item.className = 'search-item';
    item.textContent = place.display_name;
    item.addEventListener('click', () => {
      const lon = place.lon;
      const lat = place.lat;
      zoomToLocation(lon, lat);
      resultsContainer.innerHTML = ''; // Ergebnisse löschen
      searchInput.value = '';
    });
    resultsContainer.appendChild(item);
  });
}

  // Funktion: Karte zentrieren
function zoomToLocation(lon, lat) {
  const coords = fromLonLat([parseFloat(lon), parseFloat(lat)]);
  mapview.animate({
    center: coords,
    zoom: 14, // Zoomstufe
    duration: 1000,
  });
}

  // Such-Event hinzufügen
searchInput.addEventListener('input', handleSearch);

// Ende

// Klick-Events auf Flughäfen

const flightsSource = new VectorSource({});

map.on('singleclick', function (event) {
  
  map.forEachFeatureAtPixel(event.pixel, function (feature) {
    
    if (feature.getGeometry() instanceof Point) {
      const airportName = feature.get('name');
      const airportInfoDiv = document.getElementById('Routendarstellung');
      const airportNameElement = document.getElementById('airportName');
      const transformedCoords = feature.getGeometry().getCoordinates();

      const [longitude, latitude] = toLonLat(transformedCoords)

      const arcGenerator = new arc.GreatCircle(
        { x: 8.561746, y: 47.450604 }, // Startkoordinaten (ZRH)
        { x: longitude, y: latitude }, // Zielkoordinaten (geklickter Flughafen)
        { name: 'ZRH to ' + feature.get('iataCode') } // Name mit IATA-Code 
      );

      const arcLine = arcGenerator.Arc(100, {offset: 10});

      flightsSource.clear();

      const airportIATA = feature.get('iataCode');

      const routes = filteredRoutes.filter(route => route.iata === airportIATA);

      const airlineStyles = {
        LX: `https://api.maptiler.com/maps/8d0dabb7-9177-4bbf-ba93-f110c7b28c46/style.json?key=${key}`,
        WK: `https://api.maptiler.com/maps/e4659f80-8c35-463e-9523-f4d21200a913/style.json?key=${key}`,
        "2L": `https://api.maptiler.com/maps/65d156a8-af46-46f7-ad98-ff3463fe78fb/style.json?key=${key}`,
        GM: `https://api.maptiler.com/maps/e0ba9cbb-7bd6-4305-9385-717416b48101/style.json?key=${key}`,
      };

      // Standardkartenstil
      let selectedStyle = styleJson;

      // Prüfe, ob eine der Airlines enthalten ist und wähle den passenden Stil
      Object.keys(airlineStyles).forEach(airline => {
        const hasAirline = routes.some(route =>
          Array.isArray(route.carriers) && route.carriers.some(carrier => carrier.iata === airline)
        );

        if (hasAirline) {
          selectedStyle = airlineStyles[airline];
          console.log(`Neuer Kartenstil für ${airline} wurde angewendet.`);
        }
      });

      apply(map, selectedStyle);
          
      arcLine.geometries.forEach(function (geometry) {
            const line = new LineString(geometry.coords);
            line.transform('EPSG:4326', 'EPSG:3857');

            flightsSource.addFeature(
              new Feature({
                geometry: line,
                finished: false,
              }),
            );
            console.log(flightsSource);
      });

      mapview.animate({
        center: transformedCoords,
        zoom: 12,
        duration: 2500,           
      });

      // Verschiebung des Kartenbilds
      setTimeout(() => {
        const mapSize = map.getSize();
        const resolution = mapview.getResolution();

        if (mapSize && resolution) {
          const offsetXPixels = mapSize[0] / 6;
          const offsetXCoords = offsetXPixels * resolution;

          // Verschiebung berechnen
          const targetX = transformedCoords[0] + offsetXCoords;
          const targetY = transformedCoords[1];

          // Verschiebung animieren
          mapview.animate({
            center: [targetX, targetY],
            duration: 500,
          });
        }
      }, 2600);

      airportNameElement.textContent = airportName;
      airportInfoDiv.style.display = 'block';
    }
  });
});

// Ende

// Flugroute

function offsetLine(geometry, offset) {
  const coords = geometry.getCoordinates();
  const newCoords = coords.map(([x, y]) => [x + offset, y - offset]); // Verschiebung
  return new LineString(newCoords);
}
const LineStyleWithShadow = [
  new Style({
    stroke: new Stroke({
      color: 'rgba(0, 0, 0, 0.5)',
      width: 8,
      lineCap: 'round',
      lineJoin: 'round',
    }),
    geometry: function (feature) {
      const geometry = feature.getGeometry();
      return offsetLine(geometry, 75); 
    },
  }),
  
  new Style({
    stroke: new Stroke({
      color: '#EAE911',
      width: 3,
      lineCap: 'round',
      lineJoin: 'round',
    }),
  }),
];

const flightsLayer = new VectorLayer({
  source: flightsSource,
  style: LineStyleWithShadow,
});

map.addLayer(flightsLayer);

flightsLayer.setZIndex(1);

// Ende

// Schliessbutton

const closeButton = document.getElementById('closeButton');
const airportInfoDiv = document.getElementById('Routendarstellung');

closeButton.addEventListener('click', function() {
  airportInfoDiv.style.display = 'none';
  flightsSource.clear();
  apply(map, styleJson);
  mapview.animate({
    center: userCoordinates,
    zoom: 9,
    duration: 4000,
  });
});

// Ende