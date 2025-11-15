//deploy.ts
const hre = require("hardhat");
const main = async () => {
    // コントラクトがコンパイルします
    // コントラクトを扱うために必要なファイルが `artifacts` ディレクトリの直下に生成されます。
    const nftContractFactory = await hre.ethers.getContractFactory("Web3Mint");

    // Hardhat がローカルの Ethereum ネットワークを作成します。
    const nftContract = await nftContractFactory.deploy();

    // コントラクトが Mint され、ローカルのブロックチェーンにデプロイされるまで待ちます。

    await nftContract.waitForDeployment();
    const address = await nftContract.getAddress()
    console.log("Contract deployed to:", address);
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
