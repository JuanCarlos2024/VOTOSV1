import { Image, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

function HeaderLogo() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Image
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        source={require('../assets/logo.png')}
        style={{ width: 36, height: 36, resizeMode: 'contain' }}
      />
    </View>
  );
}

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" backgroundColor="#003087" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#003087' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: 'bold', fontSize: 18 },
          contentStyle: { backgroundColor: '#FFFFFF' },
          headerRight: () => <HeaderLogo />,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
        <Stack.Screen
          name="home"
          options={{
            headerShown: false, // PresHeader maneja su propio header
          }}
        />
        <Stack.Screen
          name="proyeccion"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="historial-presidente"
          options={{
            title: 'Mi Historial',
            headerStyle: { backgroundColor: '#003087' },
            headerTintColor: '#FFFFFF',
          }}
        />
      </Stack>
    </>
  );
}
