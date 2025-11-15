import "@nomicfoundation/hardhat-ethers";
import hre from "hardhat";

const main = async () => {
    // コントラクトをコンパイルします
    // コントラクトを扱うために必要なファイルが `artifacts` ディレクトリの直下に生成されます。
    const nftContractFactory = await hre.ethers.getContractFactory("Web3Mint");
    // Hardhat がローカルの Ethereum ネットワークを作成します。
    const nftContract = await nftContractFactory.deploy();
    // コントラクトが Mint され、ローカルのブロックチェーンにデプロイされるまで待ちます。
    await nftContract.waitForDeployment();
    const address = await nftContract.getAddress();
    console.log("Contract deployed to:", address);
    let txn = await nftContract.mintIpfsNFT("poker","bafybeibewfzz7w7lhm33k2rmdrk3vdvi5hfrp6ol5vhklzzepfoac37lry");
    await txn.wait();
    let returnedTokenUri = await nftContract.tokenURI(0);
    console.log("tokenURI:",returnedTokenUri);
};

// エラー処理を行っています。
(async () => {
    try {
        await main();
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})(); 