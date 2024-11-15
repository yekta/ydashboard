import { abi as uniswapPositionManagerABI } from "@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json";
import { ethers } from "ethers";

import { infuraApiKey } from "@/server/api/routers/uniswap/secrets";
import { TUniswapNetwork } from "@/server/api/routers/uniswap/types";

const providers: Record<TUniswapNetwork, ethers.JsonRpcProvider> = {
  ethereum: new ethers.InfuraProvider("mainnet", infuraApiKey),
};

export const uniswapPositionManagerAddress =
  "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
export const uniswapOkuUrl = `https://omni.icarus.tools`;

export function getUniswapPositionManager(network: TUniswapNetwork) {
  return new ethers.Contract(
    uniswapPositionManagerAddress,
    uniswapPositionManagerABI,
    providers[network]
  );
}
