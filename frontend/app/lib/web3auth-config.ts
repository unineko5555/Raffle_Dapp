// Web3Auth設定
import { CHAIN_NAMESPACES, CustomChainConfig } from "@web3auth/base";
import { Web3AuthNoModal } from "@web3auth/no-modal";
import { OpenloginAdapter } from "@web3auth/openlogin-adapter";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";
import { WALLET_ADAPTERS } from "@web3auth/base";
// AuthAdapterのインポートを追加しようとしましたが、モジュールが存在しない可能性があります
// import { AuthAdapter } from "@web3auth/auth-adapter";

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
const web3AuthNetwork = process.env.NEXT_PUBLIC_WEB3AUTH_NETWORK;
if (!web3AuthNetwork) {
  console.error("FATAL ERROR: NEXT_PUBLIC_WEB3AUTH_NETWORK environment variable is not set.");
  throw new Error("Web3Auth Network is missing in environment variables.");
}

// チェーン設定
export const getChainConfig = (chainId: number): CustomChainConfig | undefined => {
  // Sepoliaの設定
  if (chainId === 11155111) {
    return {
      chainNamespace: CHAIN_NAMESPACES.EIP155,
      chainId: "0xaa36a7",
      rpcTarget: `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
      displayName: "Ethereum Sepolia",
      blockExplorerUrl: "https://sepolia.etherscan.io",
      ticker: "ETH",
      tickerName: "Ethereum",
    };
  }
  
  // Base Sepoliaの設定
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
  
  // Arbitrum Sepoliaの設定
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
  const chainConfig = getChainConfig(chainId);
  if (!chainConfig) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  // プライベートキープロバイダーの設定
  const privateKeyProvider = new EthereumPrivateKeyProvider({
    config: { chainConfig },
  });

  // Web3Authクライアントの初期化
  const web3auth = new Web3AuthNoModal({
    clientId: WEB3AUTH_CLIENT_ID!, // Non-null assertion を追加
    web3AuthNetwork: web3AuthNetwork as any, // 型アサーションを追加 (より安全な型ガードが望ましいが、一旦 any で対応)
    // web3AuthNetwork: web3AuthNetwork as OPENLOGIN_NETWORK_TYPE, // OPENLOGIN_NETWORK_TYPE をインポートする必要あり
    chainConfig: chainConfig,
  });

  // OpenLoginアダプターの設定
  const openloginAdapter = new OpenloginAdapter({
    privateKeyProvider,
    adapterSettings: {
      uxMode: "popup", // popup から redirect に戻す
      loginConfig: {
        google: {
          name: "Google",
          verifier: "Raffle-Dapp-Google",
          typeOfLogin: "google",
          clientId: googleClientId!, // Non-null assertion を追加
        },
        // メール認証の設定 - 正しいIDを使用
        email_passwordless: {
          name: "Email",
          verifier: "Raffle-Dapp-Email", 
          typeOfLogin: "email_passwordless", 
          clientId: WEB3AUTH_CLIENT_ID, 
        },
      },
    },
  });

  web3auth.configureAdapter(openloginAdapter);

  try {
    console.log("Initializing Web3Auth...");
    await web3auth.init(); // ここで初期化を実行
    console.log("Web3Auth initialized successfully.");
    return web3auth;
  } catch (error) {
    console.error("Error during web3auth.init():", error);
    throw error; // エラーを再スローして呼び出し元で捕捉できるようにする
  }
}

// ユーティリティ関数
export const getWeb3AuthProvider = async (chainId: number) => {
  try {
    const web3auth = await initializeWeb3Auth(chainId);
    return web3auth;
  } catch (error) {
    // console.error("Error initializing Web3Auth:", error);
    return null;
  }
};
