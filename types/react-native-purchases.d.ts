declare module 'react-native-purchases' {
  export interface PurchasesPackage {
    identifier: string;
    packageType: string;
    product: PurchasesStoreProduct;
    offeringIdentifier: string;
  }

  export interface PurchasesStoreProduct {
    identifier: string;
    description?: string;
    title?: string;
    price?: number;
    priceString: string;
    currencyCode?: string;
    introPrice: PurchasesIntroPrice | null;
    pricePerMonthString?: string | null;
    pricePerYearString?: string | null;
  }

  export interface PurchasesIntroPrice {
    priceString: string;
    period?: string;
    periodNumberOfUnits?: number;
    periodUnit?: string;
  }

  export interface IntroEligibility {
    status: number;
    description?: string;
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

  export type CustomerInfoUpdateListener = (customerInfo: CustomerInfo) => void;

  export interface LogInResult {
    customerInfo: CustomerInfo;
    created: boolean;
  }

  interface PurchasesStatic {
    configure(config: { apiKey: string; appUserID?: string }): void;
    getCustomerInfo(): Promise<CustomerInfo>;
    getOfferings(): Promise<PurchasesOfferings>;
    purchasePackage(pkg: PurchasesPackage): Promise<{ customerInfo: CustomerInfo }>;
    restorePurchases(): Promise<CustomerInfo>;
    logIn(appUserID: string): Promise<LogInResult>;
    logOut(): Promise<CustomerInfo>;
    getAppUserID(): Promise<string>;
    isAnonymous(): Promise<boolean>;
    checkTrialOrIntroductoryPriceEligibility(productIDs: string[]): Promise<Record<string, IntroEligibility>>;
    addCustomerInfoUpdateListener(listener: CustomerInfoUpdateListener): void;
    removeCustomerInfoUpdateListener(listener: CustomerInfoUpdateListener): boolean;
  }

  const Purchases: PurchasesStatic;
  export default Purchases;
}
