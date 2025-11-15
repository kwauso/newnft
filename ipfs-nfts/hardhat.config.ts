require("@nomicfoundation/hardhat-toolbox");
module.exports = {
  solidity: "0.8.28",
  networks: {
    sepolia: {
      url: "https://eth-sepolia.g.alchemy.com/v2/vIDdTKkkjGKGP8ZhDVVzM",
      accounts: ["9754333e60f96ffd72fe8215b1526d526ca95108991ce236439ec0eb3e24c4d1"],
    },
  },
};