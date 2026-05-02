const fs = require('fs');
async function test() {
  const reqUrl = 'https://routes.googleapis.com/directions/v2:computeRoutes';
  const body = JSON.stringify({
    origin: { location: { latLng: { latitude: 37.7749, longitude: -122.4194 } } },
    destination: { location: { latLng: { latitude: 37.8044, longitude: -122.2711 } } },
    travelMode: 'TRANSIT',
  });
  
  const res = await fetch(reqUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': 'AIzaSyCrUE9aDASa33gEe3CqaOp0P9-9G-wB8Qs',
      'X-Goog-FieldMask': '*'
    },
    body
  });
  const data = await res.json();
  const transitStep = data.routes?.[0]?.legs?.[0]?.steps?.find(s => s.transitDetails);
  
  fs.writeFileSync('C:\\Projekty\\Sara Itinerary\\Sara_itinerary\\debugTransit.json', JSON.stringify(transitStep, null, 2));
}
test();
