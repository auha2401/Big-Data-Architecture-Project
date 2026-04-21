import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import MapScreen from '@/components/MapView';
import BusCard from '@/components/BusCard';
import Header from '@/components/Header';
import { useEffect, useRef, useState } from 'react';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import BottomSheet, {BottomSheetScrollView} from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  adaptStationToBusCard,
  fetchNearestStations,
  getFallbackBusCards,
  hasConfiguredApi,
} from '@/lib/api';
export default function Index() {
 const bottomSheetRef = useRef(null);
 const router = useRouter();
 const [street, setStreet] = useState(null);
 const [city, setCity] = useState(null);
 const [coords, setCoords] = useState(null);
 const [cards, setCards] = useState(
  hasConfiguredApi() ? getFallbackBusCards('loading') : getFallbackBusCards('unconfigured')
 );

 useEffect(() => {
  let isActive = true;

  async function loadNearbyStations() {
    if (!coords) {
      return;
    }

    if (!hasConfiguredApi()) {
      if (isActive) {
        setCards(getFallbackBusCards('unconfigured'));
      }
      return;
    }

    if (isActive) {
      setCards(getFallbackBusCards('loading'));
    }

    try {
      const stations = await fetchNearestStations({
        latitude: coords.latitude,
        longitude: coords.longitude,
        limit: 4,
      });

      if (!isActive) {
        return;
      }

      if (stations.length) {
        setCards(stations.map(adaptStationToBusCard));
      } else {
        setCards(getFallbackBusCards('empty'));
      }
    } catch (_error) {
      if (!isActive) {
        return;
      }

      setCards(getFallbackBusCards('error'));
    }
  }

  loadNearbyStations();

  return () => {
    isActive = false;
  };
 }, [coords]);

    return (    
    <GestureHandlerRootView style = {styles.container}>
     {/* map view  */} 
     <MapScreen
      onAddressChange={(s,c) => {setStreet(s); setCity(c);}}
      onLocationChange={(location) => setCoords(location)}
     />
     <View style={{position: 'absolute', top: 0, left: 0, right: 0}}>
      <Header street={street} city={city} />
      </View>
     {/* card view with no text for now */} 
   <BottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={['25%', '50%']}
      >
   <BottomSheetScrollView>
      <TouchableOpacity style={styles.savedBtn} onPress={() => router.push('/saved')}>
        <Ionicons name="bookmark" size={16} color="#F08C21" />
        <Text style={styles.savedBtnText}>Saved Routes</Text>
        <Text style={styles.savedBtnArrow}>→</Text>
      </TouchableOpacity>
      {cards.map((card) => (
        <BusCard
          key={card.id}
          route={card.route}
          destination={card.destination}
          stop={card.stop}
          minutes={card.minutes}
          delay={card.delay}
          color={card.color}
        />
      ))}
      </BottomSheetScrollView>
       </BottomSheet>
     </GestureHandlerRootView>
      );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  savedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FFF8EE',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F08C21',
    gap: 8,
  },
  savedBtnText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#F08C21',
  },
  savedBtnArrow: {
    fontSize: 14,
    color: '#F08C21',
    fontWeight: '700',
  },
});
