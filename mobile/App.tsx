/**
 * App.tsx — Honjang mobile app entry point.
 *
 * React Navigation with 3 tabs:
 *   - Conversation (main translator screen)
 *   - Settings
 *   - History
 *
 * Dark theme: background #1a1a2e, accent colors.
 */

import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { Colors } from "./src/constants/theme";
import { ConversationScreen } from "./src/screens/ConversationScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { HistoryScreen } from "./src/screens/HistoryScreen";

export type RootTabParamList = {
  Conversation: undefined;
  Settings: undefined;
  History: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Colors.background,
    card: Colors.surface,
    text: Colors.text,
    border: Colors.border,
    primary: Colors.primary,
    notification: Colors.accent,
  },
};

export default function App() {
  return (
    <>
      <StatusBar style="light" />
      <NavigationContainer theme={navTheme}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ color, size }) => {
              let iconName: keyof typeof Ionicons.glyphMap = "chatbubbles";

              if (route.name === "Conversation") {
                iconName = "chatbubbles";
              } else if (route.name === "Settings") {
                iconName = "settings";
              } else if (route.name === "History") {
                iconName = "time";
              }

              return <Ionicons name={iconName} size={size} color={color} />;
            },
            tabBarActiveTintColor: Colors.primary,
            tabBarInactiveTintColor: Colors.textDim,
            tabBarStyle: {
              backgroundColor: Colors.surface,
              borderTopColor: Colors.border,
            },
            headerShown: false,
          })}
        >
          <Tab.Screen
            name="Conversation"
            component={ConversationScreen}
            options={{ title: "Talk" }}
          />
          <Tab.Screen
            name="History"
            component={HistoryScreen}
            options={{ title: "History" }}
          />
          <Tab.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ title: "Settings" }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </>
  );
}