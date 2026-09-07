import { createWalletClient, createPublicClient, http, parseAbi, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync("/workspace/edge-desk/.env", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    })
);

const pk = env.PRIVATE_KEY;
const account = privateKeyToAccount(pk);
const chain = {
  id: 50312,
  name: "Somnia Shannon",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: { default: { http: ["https://api.infra.testnet.somnia.network"] } },
};
const transport = http("https://api.infra.testnet.somnia.network");
const publicClient = createPublicClient({ chain, transport });
const walletClient = createWalletClient({ account, chain, transport });

const token = "0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E";
const abi = parseAbi([
  "function FAUCET_PER_TX() view returns (uint256)",
  "function faucet(uint256 amount)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

const perTx = await publicClient.readContract({ address: token, abi, functionName: "FAUCET_PER_TX" });
const decimals = await publicClient.readContract({ address: token, abi, functionName: "decimals" });
console.log("FAUCET_PER_TX", perTx.toString(), "human", formatUnits(perTx, decimals));

const hash = await walletClient.writeContract({
  address: token,
  abi,
  functionName: "faucet",
  args: [perTx],
});
console.log("tx", hash);
const receipt = await publicClient.waitForTransactionReceipt({ hash });
console.log("status", receipt.status);
const bal = await publicClient.readContract({
  address: token,
  abi,
  functionName: "balanceOf",
  args: [account.address],
});
console.log("balance", formatUnits(bal, decimals), "tUSDC");
console.log("wallet", account.address);
