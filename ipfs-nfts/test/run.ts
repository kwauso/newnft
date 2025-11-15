// run.ts
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Web3Mint", () => {
    it("Should return the nft", async () => {
        const Mint = await ethers.getContractFactory("Web3Mint");
        const mintContract = await Mint.deploy();
        await mintContract.waitForDeployment();
        const [owner, addr1] = await ethers.getSigners();
        let nftName = 'poker_face'
        let ipfsCID = 'bafkreihaqgmtho5djscovbm6d7pshfcs3m3ttmcmpmhm34rnd6fid4uvzq'

        //0
        await mintContract.connect(owner).mintIpfsNFT(nftName,ipfsCID)

        //1
        await mintContract.connect(addr1).mintIpfsNFT(nftName,ipfsCID) 

        console.log(await mintContract.tokenURI(0))
        console.log(await mintContract.tokenURI(1))
    });
}); 