import './style.css';
import {Map, View} from 'ol';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Point } from 'ol/geom';
import { Feature } from 'ol';
import {fromLonLat, toLonLat} from 'ol/proj.js';
import { apply } from 'ol-mapbox-style';
import data from './data/airline_routes.json' assert { type: 'json' };
import { Style, Circle as CircleStyle, Stroke, Icon } from 'ol/style';
import arc from 'arc';
import LineString from 'ol/geom/LineString.js';

// Grundeinstellungen

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

// Ende

// Standortbestimmung

if ('geolocation' in navigator) {
  navigator.geolocation.getCurrentPosition(
    (position) => {
      userCoordinates = fromLonLat([
        position.coords.longitude, 
        position.coords.latitude
      ]);

      mapview.setCenter(userCoordinates);
      mapview.setZoom(9);
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

// Ende

// Cursoränderung

map.on('pointermove', function (event) {
  const pixel = event.pixel;
  let cursorSet = false;

  map.forEachFeatureAtPixel(pixel, function (feature) {
    if (feature instanceof Feature) {
      const iataCode = feature.get('iataCode');

      if (iataCode) {
        map.getTargetElement().style.cursor = 'pointer';
        cursorSet = true;
        return;
      }
    }
  });

  if (!cursorSet) {
    map.getTargetElement().style.cursor = '';
  }
});

// Ende

// AirportLayerInitialisierung

const airportLayer = new VectorLayer({
  source: new VectorSource({
    features: airportFeatures, 
    attributions: '<a href="https://github.com/Jonty/airline-route-data?tab=readme-ov-file" target="_blank">Routendaten</a>' 
  }),
  style: dynamicStyleFunction 
});

// Ende

// Symbol ZRH

const zurichAirport = {
  iata: 'ZRH',
  name: 'Zürich Flughafen',
  latitude: 47.450604,
  longitude: 8.561746,
  city_name: 'Zürich',
  country: 'Schweiz',
};

const zurichAirportFeature = new Feature({
  geometry: new Point(fromLonLat([zurichAirport.longitude, zurichAirport.latitude])),
  name: zurichAirport.name,
  iataCode: zurichAirport.iata,
  city: zurichAirport.city_name,
  country: zurichAirport.country,
  routes: []
});

zurichAirportFeature.setStyle(dynamicStyleFunction);

airportLayer.getSource().addFeature(zurichAirportFeature);

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

// Flugroutenlayerdefinition (wird später dynamisch angepasst)

const flightsSource = new VectorSource({});

const LineStyleWithShadow = (lineColor) => [
  new Style({
    stroke: new Stroke({
    }),
  }),

  new Style({
    stroke: new Stroke({
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

// Umrechnung min in Stunden und Minuten:

function convertMin(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}min`;
}

// Ende

// Klick-Events auf Flughäfen

map.on('singleclick', function (event) {
  
  map.forEachFeatureAtPixel(event.pixel, function (feature) {
    
    if (feature.getGeometry() instanceof Point) {
      const airportName = feature.get('name');
      const airportNameElement = document.getElementById('airportName');

      const airportInfoDiv = document.getElementById('Routendarstellung');
      
      const transformedCoords = feature.getGeometry().getCoordinates();
      const [longitude, latitude] = toLonLat(transformedCoords)

      const airportCityName = feature.get('city');
      const airportCityNameElement = document.getElementById('airportCity');

      const airportCountry = feature.get('country');
      const airportCountryElement = document.getElementById('airportCountry');

      const arcGenerator = new arc.GreatCircle(
        { x: 8.561746, y: 47.450604 },
        { x: longitude, y: latitude },
        { name: 'ZRH to ' + feature.get('iataCode') }
      );

      const arcLine = arcGenerator.Arc(100, {offset: 10});

      flightsSource.clear();

      const airportIATA = feature.get('iataCode');
      const airportIATAElement = document.getElementById('airportIATA');

      const routes = filteredRoutes.filter(route => route.iata === airportIATA);
      const routesElement = document.getElementById('airportRoutes');

      const airlineColors = {
        LX: '#000000',
        WK: '#b0201d',
        "2L": '#ee1200',
        GM: '#ff2c1b',
      };

      const airlineStyles = {
        "2L": `https://api.maptiler.com/maps/65d156a8-af46-46f7-ad98-ff3463fe78fb/style.json?key=${key}`,
        GM: `https://api.maptiler.com/maps/e0ba9cbb-7bd6-4305-9385-717416b48101/style.json?key=${key}`,
        WK: `https://api.maptiler.com/maps/e4659f80-8c35-463e-9523-f4d21200a913/style.json?key=${key}`,
        LX: `https://api.maptiler.com/maps/8d0dabb7-9177-4bbf-ba93-f110c7b28c46/style.json?key=${key}`,
      };

      let selectedStyle = styleJson;
      let selectedAirline = null;
      let lineColor = '#EAE911';

      Object.keys(airlineStyles).forEach(airline => {
        const hasAirline = routes.some(route =>
          Array.isArray(route.carriers) && route.carriers.some(carrier => carrier.iata === airline)
        );

        if (hasAirline) {
          selectedStyle = airlineStyles[airline];
          selectedAirline = airline;
          lineColor = airlineColors[airline];
        }
      });

      apply(map, selectedStyle);

      const dynamicLineStyle = [
        new Style({
          stroke: new Stroke({
            color: lineColor,
            width: 4,
            lineCap: 'round',
            lineJoin: 'round',
          }),
        }),
      ];
      
      // Aktualisieren des Linienstils
      flightsLayer.setStyle(dynamicLineStyle);
          
      arcLine.geometries.forEach(function (geometry) {
            const line = new LineString(geometry.coords);
            line.transform('EPSG:4326', 'EPSG:3857');

            flightsSource.addFeature(
              new Feature({
                geometry: line,
                finished: false,
              }),
            );
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

          const targetX = transformedCoords[0] + offsetXCoords;
          const targetY = transformedCoords[1];

          mapview.animate({
            center: [targetX, targetY],
            duration: 500,
          });
        }
      }, 2600);

      airportNameElement.textContent = airportName;
      airportCityNameElement.textContent = airportCityName;
      airportIATAElement.textContent = airportIATA;
      airportCountryElement.textContent = airportCountry;
      routesElement.innerHTML = '';

      const airlineRoutes = routes
        .map(route => ({
          ...route,
          carriers: route.carriers.filter(carrier => allowedAirlines.includes(carrier.iata))
        }))
        .filter(route => route.carriers.length > 0);

      if (airlineRoutes.length > 0) {
        airlineRoutes.forEach(route => {
          const listItem = document.createElement('li');
          const flightDuration = convertMin(route.min);
          listItem.textContent = `Flug ab ${route.iata} (${route.km} km, ${flightDuration}) - Airline: ${route.carriers.map(c => c.name).join(', ')}`;
          routesElement.appendChild(listItem);
        });
      } else {
        routesElement.innerHTML = '<li>Keine Routen mit erlaubten Airlines gefunden.</li>';
      }

      airportInfoDiv.style.display = 'block';
    }
  });
});

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
    zoom: 7,
    duration: 1000,
  });
});

// Ende

// Autor-Button
 
document.getElementById("autor-button").addEventListener("click", function() {
  const autorInfo = document.getElementById("autor-info");

  if (autorInfo.style.display === "none" || autorInfo.style.display === "") {
      autorInfo.style.display = "block";
  } else {
      autorInfo.style.display = "none";
  }
});

// Ende