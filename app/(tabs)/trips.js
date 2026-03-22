import { StyleSheet, View} from 'react-native';
import MapScreen from '@/components/MapView';
import Header from '@/components/Header';
import { useState } from 'react';

export default function Trips() {
 const [street, setStreet] = useState(null);
 const [city, setCity] = useState(null);
    return (   
   <View style = {styles.container}>
      <MapScreen onAddressChange={(s,c) => {setStreet(s); setCity(c);}}/>
      <View style={{position: 'absolute', top: 0, left: 0, right: 0}}>
        <Header street={street} city={city} />
       </View>
      </View>
         );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
