//Web3Mint.ts
import  * as expect  from "chai";
const { ethers } = require("hardhat");
describe("Web3Mint", () => {
    it("Should return the nft", async () => {
        const nftContractFactory = await ethers.getContractFactory("Web3Mint");
        const nftContract = await nftContractFactory.deploy();
        await nftContract.waitForDeployment();
        const address = await nftContract.getAddress();
        console.log("Contract deployed to:", address);
        const [owner, addr1] = await ethers.getSigners();
        let nftName = 'poker_face'
        let ipfsCID = 'bbafybeiasrolxf5xpjh242qa3ucdyobklcekwcg6fpq3ldsewtpg7umfyaq'
        await nftContract.connect(owner).mintIpfsNFT(nftName, ipfsCID) //0
        await nftContract.connect(addr1).mintIpfsNFT(nftName, ipfsCID) //1
        console.log(await nftContract.tokenURI(0))
        console.log(await nftContract.tokenURI(1))
    });
}); 
