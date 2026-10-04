declare module 'react-native-purchases' {
  export interface PurchasesPackage {
    identifier: string;
    packageType: string;
    product: any;
    offeringIdentifier: string;
  }

  export interface EntitlementInfo {
    isActive: boolean;
    identifier: string;
    willRenew: boolean;
    periodType: string;
    latestPurchaseDate: string;
    originalPurchaseDate: string;
    expirationDate: string | null;
  }

  export interface EntitlementInfos {
    active: Record<string, EntitlementInfo>;
    all: Record<string, EntitlementInfo>;
  }

  export interface CustomerInfo {
    entitlements: EntitlementInfos;
    activeSubscriptions: string[];
    allPurchasedProductIdentifiers: string[];
    firstSeen: string;
    originalAppUserId: string;
    /** iOS: when the app itself was first bought/downloaded (from the App Store receipt). */
    originalPurchaseDate?: string | null;
    originalApplicationVersion?: string | null;
  }

  export interface PurchasesOffering {
    identifier: string;
    serverDescription: string;
    monthly: PurchasesPackage | null;
    annual: PurchasesPackage | null;
    lifetime: PurchasesPackage | null;
    availablePackages: PurchasesPackage[];
  }

  export interface PurchasesOfferings {
    current: PurchasesOffering | null;
    all: Record<string, PurchasesOffering>;
  }

  interface PurchasesStatic {
    configure(config: { apiKey: string; appUserID?: string }): Promise<void>;
    getCustomerInfo(): Promise<CustomerInfo>;
    syncPurchasesForResult(): Promise<{ customerInfo: CustomerInfo }>;
    checkTrialOrIntroductoryPriceEligibility(productIdentifiers: string[]): Promise<Record<string, { status: number; description: string }>>;
    getOfferings(): Promise<PurchasesOfferings>;
    purchasePackage(pkg: PurchasesPackage): Promise<{ customerInfo: CustomerInfo }>;
    restorePurchases(): Promise<CustomerInfo>;
    addCustomerInfoUpdateListener(listener: (info: CustomerInfo) => void): void;
    removeCustomerInfoUpdateListener(listener: (info: CustomerInfo) => void): boolean;
    isConfigured(): Promise<boolean>;
  }

  const Purchases: PurchasesStatic;
  export default Purchases;
}
