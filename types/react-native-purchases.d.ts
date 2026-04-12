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
    getOfferings(): Promise<PurchasesOfferings>;
    purchasePackage(pkg: PurchasesPackage): Promise<{ customerInfo: CustomerInfo }>;
    restorePurchases(): Promise<CustomerInfo>;
  }

  const Purchases: PurchasesStatic;
  export default Purchases;
}
