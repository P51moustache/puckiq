export default {
  expo: {
    name: "PuckIQ",
    slug: "learning-project",
    version: "3.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "learningproject",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    notification: {
      icon: "./assets/images/icon.png",
      color: "#E10600"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.zlce.hockeystats",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        UIBackgroundModes: [
          "remote-notification"
        ],
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#14141C"
      },
      permissions: [
        "RECEIVE_BOOT_COMPLETED",
        "POST_NOTIFICATIONS"
      ],
      edgeToEdgeEnabled: true,
      package: "com.zlce.hockeystats"
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          // Matches the icon art's carbon background so the logo has no visible edge.
          backgroundColor: "#14141C"
        }
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/images/icon.png",
          color: "#E10600",
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
