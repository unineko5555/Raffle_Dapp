// Web3Auth設定
import { CHAIN_NAMESPACES, CustomChainConfig } from "@web3auth/base";
import { Web3AuthNoModal } from "@web3auth/no-modal";
import { OpenloginAdapter } from "@web3auth/openlogin-adapter";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";

// ローカル開発用のクライアントIDを設定
// 注意：実際の運用ではプロジェクト専用のクライアントIDが必要です
export const WEB3AUTH_CLIENT_ID = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID || 
  "BJ38Nnj8g7-R9Z6vFGGF_RzVbGmB9lYiXnBQtJ3vgDOILPTPzQBY2HYF2Pp8Rr45R66HQlCvOeImxnCmB-BzRiU";

// チェーン設定
export const getChainConfig = (chainId: number): CustomChainConfig | undefined => {
  // Sepoliaの設定
  if (chainId === 11155111) {
    return {
      chainNamespace: CHAIN_NAMESPACES.EIP155,
      chainId: "0xaa36a7",
      rpcTarget: `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "demo"}`,
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
    clientId: WEB3AUTH_CLIENT_ID,
    web3AuthNetwork: "sapphire_devnet", // 開発環境用
    chainConfig,
  });

  // OpenLoginアダプターの設定
  const openloginAdapter = new OpenloginAdapter({
    privateKeyProvider,
    adapterSettings: {
      uxMode: "popup",
      loginConfig: {
        google: {
          name: "Google",
          verifier: "google",
          typeOfLogin: "google",
          clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
        },
        // メール認証の設定
        email_passwordless: {
          name: "Email",
          verifier: "web3auth-email",
          typeOfLogin: "email_password",
        },
      },
    },
  });

  web3auth.configureAdapter(openloginAdapter);

  await web3auth.init();
  return web3auth;
}

// ユーティリティ関数
export const getWeb3AuthProvider = async (chainId: number) => {
  try {
    const web3auth = await initializeWeb3Auth(chainId);
    return web3auth;
  } catch (error) {
    console.error("Error initializing Web3Auth:", error);
    return null;
  }
};
