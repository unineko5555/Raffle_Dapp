// Web3Auth設定
import { 
  CHAIN_NAMESPACES, 
  CustomChainConfig, 
  WALLET_ADAPTERS,
  WEB3AUTH_NETWORK,
  getEvmChainConfig
} from "@web3auth/base";
import { Web3AuthNoModal } from "@web3auth/no-modal";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";
import { AuthAdapter } from "@web3auth/auth-adapter";
import { getDefaultExternalAdapters } from "@web3auth/default-evm-adapter";
import { WalletConnectV2Adapter } from "@web3auth/wallet-connect-v2-adapter";

// ローカル開発用のクライアントIDを設定
// 注意：実際の運用ではプロジェクト専用のクライアントIDが必要です
export const WEB3AUTH_CLIENT_ID = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID;
if (!WEB3AUTH_CLIENT_ID) {
  // アプリケーションの起動を止めるか、エラー処理を行う
  console.error("FATAL ERROR: NEXT_PUBLIC_WEB3AUTH_CLIENT_ID environment variable is not set.");
  throw new Error("Web3Auth Client ID is missing in environment variables.");
}

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
if (!googleClientId) {
  console.error("FATAL ERROR: NEXT_PUBLIC_GOOGLE_CLIENT_ID environment variable is not set.");
  throw new Error("Google Client ID is missing in environment variables.");
}

// Web3Auth Network のチェックを追加
const web3AuthNetworkStr = process.env.NEXT_PUBLIC_WEB3AUTH_NETWORK;
if (!web3AuthNetworkStr) {
  console.error("FATAL ERROR: NEXT_PUBLIC_WEB3AUTH_NETWORK environment variable is not set.");
  throw new Error("Web3Auth Network is missing in environment variables.");
}

// 明示的な定数を使用
const web3AuthNetwork = web3AuthNetworkStr === "mainnet" 
  ? WEB3AUTH_NETWORK.SAPPHIRE_MAINNET 
  : WEB3AUTH_NETWORK.SAPPHIRE_DEVNET;

// WalletConnectプロジェクトIDのチェック
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
if (!walletConnectProjectId) {
  console.error("FATAL ERROR: NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID environment variable is not set.");
  throw new Error("WalletConnect Project ID is missing in environment variables.");
}

// 注意: 以前の getChainConfig 関数は getEvmChainConfig に置き換えられましたが、
// 互換性のためにカスタム実装を残しておきます
export const getChainConfig = (chainId: number): CustomChainConfig | undefined => {
  // まずgetEvmChainConfigで標準サポートチェーンを試す
  const standardConfig = getEvmChainConfig(chainId, WEB3AUTH_CLIENT_ID!);
  if (standardConfig) {
    return standardConfig;
  }
  
  // 標準サポートにないチェーンのためのカスタム設定
  // Base Sepolia
  if (chainId === 84532) {
    return {
      chainNamespace: CHAIN_NAMESPACES.EIP155,
      chainId: "0x14a34",
      rpcTarget: `https://base-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "demo"}`,
      displayName: "Base Sepolia",
      blockExplorerUrl: "https://sepolia.basescan.org",
      ticker: "ETH",
      tickerName: "Base Ethereum",
    };
  }
  
  // Arbitrum Sepolia
  if (chainId === 421614) {
    return {
      chainNamespace: CHAIN_NAMESPACES.EIP155,
      chainId: "0x66eee",
      rpcTarget: `https://arb-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "demo"}`,
      displayName: "Arbitrum Sepolia",
      blockExplorerUrl: "https://sepolia-explorer.arbitrum.io",
      ticker: "ETH",
      tickerName: "Arbitrum Ethereum",
    };
  }
  
  return undefined;
};

// Web3Authクライアントの初期化
export async function initializeWeb3Auth(chainId: number) {
  // getChainConfigを使用してチェーン設定を取得
  const chainConfig = getChainConfig(chainId);
  if (!chainConfig) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  // プライベートキープロバイダーの設定
  const privateKeyProvider = new EthereumPrivateKeyProvider({
    config: { chainConfig },
  });

  // Web3Authオプションの作成 - 全てのパラメータ名を試す
  const web3AuthOptions = {
    clientId: WEB3AUTH_CLIENT_ID!,
    web3AuthNetwork,
    chainConfig,
    privateKeyProvider,
  };

  // Web3Authクライアントの初期化
  const web3auth = new Web3AuthNoModal({
    clientId: WEB3AUTH_CLIENT_ID!,
    web3AuthNetwork,
    chainConfig,
    privateKeyProvider,
  });

  // AuthAdapterアダプターの設定
  const authAdapter = new AuthAdapter({
    // privateKeyProvider,
    adapterSettings: {
      uxMode: "popup", // ドキュメントでは"redirect"だが、問題を避けるため"popup"を使用
      loginConfig: {
        google: {
          name: "Google",
          verifier: "Raffle-Dapp-Google",
          typeOfLogin: "google",
          clientId: googleClientId,
        },
        // メール認証の設定
        email_passwordless: {
          name: "Email",
          verifier: "Raffle-Dapp-Email", 
          typeOfLogin: "email_passwordless",
          clientId: WEB3AUTH_CLIENT_ID,
        },
      },
    },
  });

  // Web3Authにアダプターを設定
  web3auth.configureAdapter(authAdapter);

  // WalletConnectV2アダプターを手動で設定
  console.log("Configuring WalletConnectV2Adapter manually...");
  try {
    const walletConnectV2Adapter = new WalletConnectV2Adapter({
      adapterSettings: {
        walletConnectInitOptions: {
          projectId: walletConnectProjectId,
        }
      }
    });
    // WalletConnectアダプターをWeb3Authに追加
    web3auth.configureAdapter(walletConnectV2Adapter);
  } catch (error) {
    console.error("Error adding WalletConnectV2Adapter:", error);
    // エラーがあっても処理を続行
  }
  
  try {
    console.log("[web3auth-config] Initializing Web3Auth instance..."); // ログ追加
    console.log("Web3Auth Options:", {
      clientId: WEB3AUTH_CLIENT_ID,
      web3AuthNetwork,
      chainConfig: JSON.stringify(chainConfig, null, 2), // カンマ追加
    });
    await web3auth.init(); // ここで初期化を実行
    console.log("[web3auth-config] Web3Auth instance initialized successfully."); // ログ追加
    return web3auth;
  } catch (error) {
    console.error("Error during web3auth.init():", error);
    // より詳細なエラー情報を表示
    console.error("Error details:", JSON.stringify(error, null, 2));
    throw error; // エラーを再スローして呼び出し元で捕捉できるようにする
  }
}

// ユーティリティ関数
export const getWeb3AuthProvider = async (chainId: number) => {
  try {
    console.log("[web3auth-config] Calling initializeWeb3Auth..."); // ログ追加
    const web3auth = await initializeWeb3Auth(chainId);
    console.log("[web3auth-config] initializeWeb3Auth returned:", web3auth ? "Web3Auth instance" : "null"); // ログ追加
    return web3auth;
  } catch (error) {
    console.error("[web3auth-config] Error in getWeb3AuthProvider:", error); // ログ追加
    return null;
  }
};
