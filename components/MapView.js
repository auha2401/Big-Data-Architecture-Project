import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';

export default function MapScreen({ onAddressChange, onLocationChange }) {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const onAddressChangeRef = useRef(onAddressChange);
  const onLocationChangeRef = useRef(onLocationChange);

  useEffect(() => {
    onAddressChangeRef.current = onAddressChange;
    onLocationChangeRef.current = onLocationChange;
  }, [onAddressChange, onLocationChange]);

  useEffect(() => {
    async function getLocation() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Location permission was denied.');
          return;
        }

        const loc = await Location.getCurrentPositionAsync({});
        setLocation(loc.coords);
        onLocationChangeRef.current?.(loc.coords);

        const addr = await Location.reverseGeocodeAsync(loc.coords);
        if (addr[0]) {
          onAddressChangeRef.current?.(addr[0].street, `${addr[0].city}, ${addr[0].region}`);
        }
      } catch (_error) {
        setErrorMsg('Unable to load your location.');
      }
    }

    getLocation();
  }, []);

  return (
    <View style={styles.container}>
      {/* map view */}
      {location ? (
        <MapView
          style={styles.map}
          region={{
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
        >
          <Marker
            coordinate={{
              latitude: location.latitude,
              longitude: location.longitude,
            }}
            title="Your location"
          />
        </MapView>
      ) : (<Text>{errorMsg || 'Loading location...'}</Text>
      )}
    </View>
   );
  }
const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});
