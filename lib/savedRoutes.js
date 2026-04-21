import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'saved_routes';

export async function getSavedRoutes() {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function saveRoute(route) {
  const routes = await getSavedRoutes();
  if (!routes.find((r) => r.route_id === route.route_id)) {
    routes.push(route);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
  }
}

export async function removeRoute(routeId) {
  const routes = await getSavedRoutes();
  const filtered = routes.filter((r) => r.route_id !== routeId);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export async function isRouteSaved(routeId) {
  const routes = await getSavedRoutes();
  return routes.some((r) => r.route_id === routeId);
}
