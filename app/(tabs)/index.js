
import { StyleSheet} from 'react-native';
import MapScreen from '@/components/MapView';
import BusCard from '@/components/BusCard';
import Header from '@/components/Header';
import { useRef, useState } from 'react';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import BottomSheet, {BottomSheetScrollView} from '@gorhom/bottom-sheet';
import { View } from 'react-native';
export default function Index() {
 const bottomSheetRef = useRef(null);
 const [street, setStreet] = useState(null);
 const [city, setCity] = useState(null);
    return (    
    <GestureHandlerRootView style = {styles.container}>
     {/* map view  */} 
     <MapScreen onAddressChange={(s,c) => {setStreet(s); setCity(c);}}/>
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
      <BusCard />
      <BusCard />
      <BusCard />
      <BusCard />
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
  
});
