import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import RouteResultCard from '@/components/RouteResultCard';
import { getSavedRoutes } from '@/lib/savedRoutes';

export default function Saved() {
  const router = useRouter();
  const [routes, setRoutes] = useState([]);

  // Reload whenever the screen comes into focus so unsaves from other screens reflect here
  useFocusEffect(
    useCallback(() => {
      getSavedRoutes().then(setRoutes);
    }, [])
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Saved Routes</Text>
        <Ionicons name="bookmark" size={22} color="#fff" style={styles.titleIcon} />
      </View>

      <View style={styles.panel}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {routes.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="bookmark-outline" size={48} color="#fff" />
              <Text style={styles.emptyTitle}>No saved routes yet</Text>
              <Text style={styles.emptyHint}>
                Tap the bookmark icon on any route result to save it here.
              </Text>
            </View>
          ) : (
            routes.map((route) => (
              <RouteResultCard key={route.route_id} route={route} />
            ))
          )}
        </ScrollView>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F08C21',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 16,
    backgroundColor: '#F08C21',
  },
  backBtn: {
    backgroundColor: '#6698CC',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  backText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    lineHeight: 26,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },
  titleIcon: {
    marginLeft: 8,
  },
  panel: {
    flex: 1,
    backgroundColor: '#F08C21',
    paddingHorizontal: 16,
  },
  content: {
    paddingBottom: 32,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 64,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  emptyHint: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 24,
    opacity: 0.85,
  },
});
