import 'dotenv/config';

export default {
  expo: {
    name: "Weather Alert",
    slug: "weather-alert",
    scheme: "weatheralert",
    version: "1.0.0",
    userInterfaceStyle: "automatic",
    ios: {
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "We use your location to show local weather and alerts.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "We use your location to schedule local weather alerts.",
        NSLocationAlwaysUsageDescription: "We use your location to schedule local weather alerts."
      }
    },
    android: {
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "POST_NOTIFICATIONS"
      ]
    },
    extra: {
      METEOMATICS_USERNAME: process.env.METEOMATICS_USERNAME,
      METEOMATICS_PASSWORD: process.env.METEOMATICS_PASSWORD
    },
    plugins: [["expo-notifications"]]
  }
};
