import { useEffect, useState } from 'react';
import { StyleSheet, View, Text} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';

export default function MapScreen({onAddressChange}) {

  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [address, setAddress] = useState(null);
  useEffect(() => {
    async function getLocation() {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
      let addr = await Location.reverseGeocodeAsync(loc.coords);
      setAddress(addr[0]);
      if (addr[0]) {
        setAddress(`${addr[0].street}, ${addr[0].city}`);
        onAddressChange?.(addr[0].street, `${addr[0].city}, ${addr[0].region}`);
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