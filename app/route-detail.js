import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { fetchRouteDetails, fetchRouteVehicles, fetchStopSchedule } from '@/lib/api';
import MapScreen from '@/components/MapView';
import { useFonts, Bungee_400Regular } from '@expo-google-fonts/bungee';


function parseInitialArrivals(rawValue) {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildVehicleMarker(vehicle, routeLabel) {
  if (!vehicle || !Number.isFinite(vehicle.latitude) || !Number.isFinite(vehicle.longitude)) {
    return [];
  }

  const label = vehicle.vehicle_label || vehicle.vehicle_id || routeLabel || 'Vehicle';
  return [
    {
      id: vehicle.vehicle_id || vehicle.trip_id || 'live-vehicle',
      latitude: vehicle.latitude,
      longitude: vehicle.longitude,
      title: `${label} live location`,
      description: vehicle.updated_at ? `Updated ${vehicle.updated_at}` : 'Live vehicle position',
      type: 'bus',
    },
  ];
}

function buildStationMarkers(stops) {
  if (!Array.isArray(stops)) return [];

  return stops
    .filter(
      (s) =>
        Number.isFinite(s.latitude) &&
        Number.isFinite(s.longitude)
    )
    .map((s) => ({
      id: `stop-${s.stop_id || s.stop_name}`,
      latitude: s.latitude,
      longitude: s.longitude,
      title: s.stop_name,
      description: 'Station',
      type: 'station',
    }));
}


//page when clicking bus card, shows more details about the route and arrival times, walking time, and a scrollable list of past arrivals at that stop
export default function RouteDetail() {
  const router = useRouter();
  const { route, destination, stop, color, minutes, nextArrivals, routeId, stopId } = useLocalSearchParams();
  const [arrivals, setArrivals] = useState(() => parseInitialArrivals(nextArrivals));
  const [stops, setStops] = useState([]);
  const [liveVehicle, setLiveVehicle] = useState(null);
  const [mapExpanded, setMapExpanded] = useState(false);

  useEffect(() => {
    let isActive = true;
    const parsedFallbackArrivals = parseInitialArrivals(nextArrivals);

    async function loadRouteData() {
      try {
        const [details, schedule, vehicles] = await Promise.all([
          routeId ? fetchRouteDetails(routeId) : Promise.resolve(null),
          stopId ? fetchStopSchedule(stopId) : Promise.resolve([]),
          routeId ? fetchRouteVehicles(routeId) : Promise.resolve([]),
        ]);
 

        if (!isActive) {
          return;
        }
 

        setStops(details?.stops || []);
      

        const routeSpecificSchedule = routeId
          ? schedule.filter((entry) => entry.route_id === routeId)
          : schedule;
        setArrivals(routeSpecificSchedule.length ? routeSpecificSchedule.slice(0, 3) : parsedFallbackArrivals);
        setLiveVehicle(Array.isArray(vehicles) && vehicles.length ? vehicles[0] : null);
      } catch {
        if (!isActive) {
          return;
        }

        setStops([]);
        setArrivals(parsedFallbackArrivals);
        setLiveVehicle(null);
      }
    }

    loadRouteData();

    return () => {
      isActive = false;
    };
  }, [nextArrivals, routeId, stopId]);
  const [fontsLoaded] = useFonts({ Bungee_400Regular });
  if (!fontsLoaded) return null;
  const currentIndex = stops.findIndex(s => s.stop_name === stop);
  const visibleStops = currentIndex === -1
    ? stops.slice(0, 5)
    : stops.slice(Math.max(0, currentIndex - 2), currentIndex + 5);
  const vehicleMarkers = buildVehicleMarker(liveVehicle, route);
  const stationMarkers = buildStationMarkers(visibleStops);
  const mapMarkers = [
    ...stationMarkers,
    ...vehicleMarkers,
  ];
  const focusCoordinate = vehicleMarkers[0]
  ? { latitude: vehicleMarkers[0].latitude, longitude: vehicleMarkers[0].longitude }
  : null;
  return (
   
      <View style={{ flex: 1, backgroundColor: color }}>
    <ScrollView style={[styles.container, { backgroundColor: color }]}>
      
    <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
  <Text style={styles.backBtnText}>X</Text>
</TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.routeName}>{route}</Text>
        <Text style={styles.destination}>→ {destination}</Text>
        <Text style={styles.headerStop}>{stop}</Text>
      </View>

      <View style={styles.chipsRow}>
        {arrivals.length > 0 ? (
          arrivals.map((arrival, index) => (
            <View key={index} style={styles.chip}>
              {index === 0 && <Text style={styles.chipLabel}>Next</Text>}
              <Text style={styles.chipTime}>
                {arrival.minutes_until_arrival === 0
                  ? 'Arriving'
                  : Number.isFinite(arrival.minutes_until_arrival)
                  ? `${arrival.minutes_until_arrival} min`
                  : '--'}
              </Text>
            </View>
          ))
        ) : (
          <View style = {styles.chip}>
          <Text style={styles.chipLabel}>Next</Text>
          <Text style={styles.chipTime}>{minutes}</Text>
          </View>
        )}
      </View>

      {/* stop timeline, past stops, nearest stop, future stops  */}
      <View style={styles.timeline}>
         <View style={styles.timelineLine}/>
         {visibleStops.map((s, index) => (
  <View key={index} style={styles.timelineItem}>
    <View style={[styles.stopDot, s.stop_name === stop && styles.stopDotActive]} />
    <Text style={[
      styles.stopName,
      s.stop_name === stop && styles.stopNameBold,
      s.stop_name !== stop && styles.stopNameDim,
    ]}>
      {s.stop_name}
    </Text>
    {s.stop_name == stop && (
    <View style={styles.youBadge}>
      <Text style={styles.youBadgeText}>You</Text>
    </View>
  )}
  </View>
))} 


      </View>
       </ScrollView>


  <View style={{ height: mapExpanded ? 400 : 150,
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      overflow: 'hidden',
   }}>
  <MapScreen
  onAddressChange={() => {}}
  onLocationChange={() => {}}
  markers = {mapMarkers}
  focusCoordinate={focusCoordinate}
/>
    {
      !mapExpanded && (<TouchableOpacity style = {styles.expandBtn}
      onPress = {() => setMapExpanded(true)}
    >
      <Text style = {styles.expandBtnText}>^ Expand</Text>
      </TouchableOpacity>
      )}
      {
        mapExpanded && (<TouchableOpacity style = {styles.collapseBtn}
          onPress = {() => setMapExpanded(false)}
        >
          <Text style = {styles.expandBtnText}>Close</Text>
          </TouchableOpacity>
          )}
      
  </View>
      </View>
     

  );
}

const styles = StyleSheet.create({
  container: { flex: 1,
   },
  backBtn: {
    width: 50,
    height: 50,
    borderRadius: 30,
    backgroundColor: '#F08C21',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 20,
    marginTop: 100,
  },
  backBtnText: {
    color: 'white',
    fontSize: 30,
    fontFamily: 'Bungee_400Regular',
  },
  header: {
    padding: 5,
    alignItems: 'center',
  },
  routeName: {
    fontSize: 72,
    color: 'white',
    fontFamily: 'Bungee_400Regular',
  },
  destination: {
    fontSize: 16,
    color: 'white',
    marginTop: 4,
  },
  headerStop: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    padding: 5,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 0.5,
  },
  chipLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  chipTime: {
    fontSize: 14,
    fontWeight: '700',
    color: 'white',
    marginTop: 2,
  },
  timeline: {
    marginHorizontal: 20,
    marginTop: 16,
    position: 'relative',
    minHeight: 200,
  },
  timelineLine: {
    position: 'absolute',
    left: 5,
    top: 0,
    bottom: 0,
    width: 20,
    backgroundColor: '#000000',
    borderRadius: 10,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingLeft: 30,
    gap: 10,
  },
  stopDot: {
    width: 14,
    height: 14,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.4)',
    position: 'absolute',
    left: 7,
  },
  stopDotActive: {
    backgroundColor: 'white',
    width: 14,
    height: 14,
    borderRadius: 7,
    left: 7,
  },
  stopName: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  stopNameBold: {
    fontWeight: '700',
    fontSize: 15,
  },
  stopNameDim: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
  stopTime: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  expandBtn: {
    position: 'absolute',
    top: 8,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    padding: 6,
  },
  collapseBtn: {
    position: 'absolute',
    top: 8,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    padding: 6,
  },
  expandBtnText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  youBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 90,

  },
  youBadgeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
});
