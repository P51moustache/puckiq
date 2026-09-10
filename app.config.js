export default {
  expo: {
    name: "PuckIQ",
    slug: "learning-project",
    version: "3.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "learningproject",
    userInterfaceStyle: "automatic",
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.zlce.hockeystats",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        UIBackgroundModes: [
          "remote-notification"
        ],
        NSUserTrackingUsageDescription: "This allows PuckIQ to show you relevant ads. Your data is not shared with third parties.",
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      permissions: [
        "RECEIVE_BOOT_COMPLETED",
        "POST_NOTIFICATIONS"
      ],
      package: "com.zlce.hockeystats"
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      "expo-font",
      "expo-image",
      "expo-status-bar",
      "expo-web-browser",
      ["expo-build-properties", { ios: { deploymentTarget: "16.4" } }],
      [
        "expo-splash-screen",
        {
          image: "./assets/images/icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#1a1d29"
        }
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/images/icon.png",
          color: "#60a5fa",
        }
      ]
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      router: {},
      eas: {
        projectId: "b8956511-618d-4670-90a8-035892a7d4c0"
      }
    }
  }
};
