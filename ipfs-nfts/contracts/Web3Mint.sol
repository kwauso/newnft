// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
//OpenZeppelin が提供するヘルパー機能をインポートします。
import "hardhat/console.sol";
contract Web3Mint is ERC721{
    struct NftAttributes{
        string name;
        string imageURL;
    }
        NftAttributes[] Web3Nfts;
    // tokenId は NFT の一意な識別子で、0, 1, 2, .. N のように付与されます。
    uint256 private _tokenIds;
    constructor() ERC721("NFT","nft"){
        console.log("This is my NFT contract.");
    }
    // ユーザーが NFT を取得するために実行する関数です。
    function mintIpfsNFT(string memory name,string memory imageURI) public{
	uint256 newItemId = _tokenIds;
	_safeMint(msg.sender,newItemId);
	Web3Nfts.push(NftAttributes({
		name: name,
		imageURL: imageURI
        }));
        console.log("An NFT w/ ID %s has been minted to %s", newItemId, msg.sender);
        _tokenIds += 1;
    }

    function tokenURI(uint256 _tokenId) public view override returns (string memory) {
        require(_tokenId < Web3Nfts.length, "Token ID out of range");

        string memory name = Web3Nfts[_tokenId].name;
        string memory image = string(
            abi.encodePacked("ipfs://", Web3Nfts[_tokenId].imageURL)
        );

        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name": "',
                        name,
                        ' -- NFT #: ',
                        Strings.toString(_tokenId),
                        '", "description": "An epic NFT", "image": "',
                        image,
                        '"}'
                    )
                )
            )
        );

        return string(abi.encodePacked("data:application/json;base64,", json));
    }
}